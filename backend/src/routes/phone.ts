import { Router, Request, Response } from "express";
import { Pool } from "pg";

const router = Router();

// This function will receive the pool from server.ts
export function setupPhoneRoutes(pool: Pool) {
  // Phone-specific routes will go here
  // Example:
  // router.get("/api/phone/...", async (req: Request, res: Response) => {
  //   // Phone route implementation
  // });
  router.put('/queue/:id/complete', async (req: Request, res: Response): Promise<void> => {
    // Support both query parameter and path parameter for flexibility
    const id = req.query.id || req.params.id;
  
    try {
      // Validate that id is provided and is a number
      if (!id) {
        res.status(400).json({ error: 'ID parameter is required' });
        return;
      }
      
      const parsedId = parseInt(id as string, 10);
      if (isNaN(parsedId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }
  
      // Update the customer status to completed instead of deleting
      const updateResult = await pool.query(
        'UPDATE customer SET status = $1, complete_time = NOW() WHERE customer_id = $2 and status = \'in_progress\'',
        ['completed', parsedId]
      );
  
      // Check if the update actually affected a row
      if (updateResult.rowCount === 0) {
        res.status(404).json({ error: 'No in-progress customer found' });
        return;
      }
  
      res.status(200).json({ message: 'Success' });
    } catch (error) {
      console.error('Error deleting from queue:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/queue', async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query('SELECT * FROM customer WHERE status = \'pending\' ORDER BY queue_position');
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching queue:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/queue/:position', async (req: Request, res: Response): Promise<void> => {
    const position = req.params.position;
    try {
      const result = await pool.query('SELECT * FROM customer WHERE queue_position = $1', [position]);
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'No customer found at the specified queue position' });
        return;
      }
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching queue:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/queue/:id', async (req: Request, res: Response): Promise<void> => {
    const idParam = req.params.id ?? (req.query.id as string | undefined);

    if (!idParam) {
      res.status(400).json({ error: 'ID parameter is required' });
      return;
    }

    const parsedId = parseInt(idParam as string, 10);
    if (Number.isNaN(parsedId)) {
      res.status(400).json({ error: 'Invalid ID parameter' });
      return;
    }

    try {
      // Mark the customer at this position as in progress and remove them from the active queue
      const updateResult = await pool.query(
        `UPDATE customer SET status = $1, start_time = NOW(), queue_position = 0 WHERE customer_id = $2 AND status = 'pending'
         RETURNING customer_id, first_name, location, start_time`,
        ['in_progress', parsedId]
      );

      if (updateResult.rowCount === 0) {
        res.status(404).json({ error: 'No pending customer found at the specified customer ID' });
        return;
      }

      // Reorder the remaining pending customers to close the gap in the queue
      await pool.query(`
        WITH ordered AS (
          SELECT customer_id,
                 ROW_NUMBER() OVER (ORDER BY queue_position) AS new_pos
          FROM customer
          WHERE status = 'pending'
        )
        UPDATE customer
        SET queue_position = ordered.new_pos
        FROM ordered
        WHERE customer.customer_id = ordered.customer_id
          AND customer.status = 'pending';
      `);

      res.status(200).json({
        message: 'Customer marked as in progress',
        customer: updateResult.rows[0],
      });
    } catch (error) {
      console.error('Error marking customer as in progress:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

