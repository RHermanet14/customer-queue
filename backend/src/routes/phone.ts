import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { updateQueue } from "../queries";
import { AuthenticatedRequest, createAuthMiddleware } from "../middleware/auth";

const extractIdParam = (req: Request): string | undefined => {
  if (typeof req.params.id === "string" && req.params.id.length > 0) {
    return req.params.id;
  }

  const queryId = req.query.id;
  if (typeof queryId === "string" && queryId.length > 0) {
    return queryId;
  }

  if (Array.isArray(queryId) && queryId.length > 0 && typeof queryId[0] === "string") {
    return queryId[0];
  }

  return undefined;
};

// This function will receive the pool from server.ts
export function setupPhoneRoutes(pool: Pool) {
  const router = Router();
  const authMiddleware = createAuthMiddleware(pool);

  router.use(authMiddleware);

  // Set customer's status to complete
  router.put('/queue/:id/complete', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = extractIdParam(req);
  
    if (!id) {
      res.status(400).json({ error: 'ID parameter is required' });
      return;
    }

    try {
      const parsedId = parseInt(id, 10);
      if (isNaN(parsedId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }
      const updateResult = await pool.query(
        'UPDATE customer SET status = $1, complete_time = NOW() WHERE customer_id = $2 and status = \'in_progress\'',
        ['completed', parsedId]
      );

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

  // Get all active customers (pending and in_progress)
  router.get('/queue', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await pool.query(
        `SELECT * FROM customer 
         WHERE status IN ('pending', 'in_progress') 
         ORDER BY 
           CASE WHEN status = 'in_progress' THEN 0 ELSE 1 END,
           queue_position`
      );
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching queue:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get customer by customer_id (authenticated)
  router.get('/queue/customer-id/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id: customerIdParam } = req.params;

    if (!customerIdParam) {
      res.status(400).json({ error: 'Customer ID is required' });
      return;
    }

    const customerId = parseInt(customerIdParam, 10);

    if (Number.isNaN(customerId)) {
      res.status(400).json({ error: 'Invalid customer ID' });
      return;
    }

    try {
      console.log(`[Phone API] Fetching customer with ID: ${customerId} for user: ${req.userId}`);
      const result = await pool.query(
        'SELECT * FROM customer WHERE customer_id = $1',
        [customerId]
      );
      
      if (result.rowCount === 0) {
        console.log(`[Phone API] Customer ${customerId} not found in database`);
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
      
      console.log(`[Phone API] Found customer: ${JSON.stringify(result.rows[0])}`);
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching customer:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Mark customer as in progress
  router.put('/queue/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const idParam = extractIdParam(req);

    if (!idParam) {
      res.status(400).json({ error: 'ID parameter is required' });
      return;
    }

    try {
      const parsedId = parseInt(idParam, 10);
      if (Number.isNaN(parsedId)) {
        res.status(400).json({ error: 'Invalid ID parameter' });
        return;
      }

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
      await updateQueue();

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