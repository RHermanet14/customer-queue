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
  router.delete('/queue/:position', async (req: Request, res: Response): Promise<void> => {
    // Support both query parameter and path parameter for flexibility
    const position = req.query.position || req.params.position;
  
    try {
      // Validate that id is provided and is a number
      if (!position) {
        res.status(400).json({ error: 'Position parameter is required' });
        return;
      }
      
      const parsedPosition = parseInt(position as string, 10);
      if (isNaN(parsedPosition)) {
        res.status(400).json({ error: 'Invalid Position parameter' });
        return;
      }
  
      // Update the customer status to completed instead of deleting
      const updateResult = await pool.query(
        'UPDATE customer SET status = $1, remove_time = NOW(), queue_position = 0 WHERE queue_position = $2', // and status = \'in_progress\'
        ['completed', parsedPosition]
      );
  
      // Check if the update actually affected a row
      if (updateResult.rowCount === 0) {
        res.status(404).json({ error: 'No pending customer found at the specified queue position' });
        return;
      }
  
      // Reorder remaining positions (only for pending customers)
      await pool.query(`
        WITH ordered AS (
          SELECT customer_id, ROW_NUMBER() OVER (ORDER BY queue_position) AS new_pos
          FROM customer
          WHERE status = 'pending'
        )
        UPDATE customer
        SET queue_position = ordered.new_pos
        FROM ordered
        WHERE customer.customer_id = ordered.customer_id
          AND customer.status = 'pending';
      `);
  
      res.status(200).json({ message: 'Removed and reordered successfully' });
    } catch (error) {
      console.error('Error deleting from queue:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

