import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { updateQueue } from "../queries";
import crypto from 'crypto';

const router = Router();

// This function will receive the pool from server.ts
export function setupWebRoutes(pool: Pool) {
  // Get all enum values for locations
  router.get("/api/locations", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT enumlabel as location 
         FROM pg_enum 
         WHERE enumtypid = (
           SELECT oid 
           FROM pg_type 
           WHERE typname = 'location_enum'
         )
         ORDER BY enumsortorder`
      );
      const locations = result.rows.map((row) => row.location);
      res.json(locations);
    } catch (error: any) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ 
        error: "Failed to fetch locations",
        message: error.message,
        hint: error.code === "42P01" ? "The 'location_enum' type does not exist. Please run db.sql to create it." : "Check database connection and enum type existence."
      });
    }
  });

  // Add customer to queue
  router.post('/queue', async (req: Request, res: Response): Promise<void> => {
    const { first_name, location } = req.body;
    try {
        const accessCode = crypto.randomBytes(16).toString('hex'); // 32-char random string
      const result = await pool.query(`INSERT INTO customer (first_name, location, queue_position, access_code)
         VALUES ($1, $2, (SELECT COALESCE(MAX(queue_position), 0) + 1 FROM customer WHERE status = \'pending\'), $3) 
         RETURNING customer_id, queue_position, access_code`, [first_name, location, accessCode]);
      res.status(200).json({ message: 'Customer added to queue', customer_id: result.rows[0].customer_id, queue_position: result.rows[0].queue_position, access_code: result.rows[0].access_code });
    } catch (error) {
      console.error('Error adding customer to queue:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get specific customer by their access code
  router.get('/queue/customer/:accessCode', async (req: Request, res: Response): Promise<void> => {
    const { accessCode } = req.params;

    if (!accessCode) {
      res.status(400).json({ error: 'Access code is required' });
      return;
    }

    try {
      const result = await pool.query(
        `SELECT customer_id, first_name, location, status, queue_position, add_time, start_time, complete_time
         FROM customer
         WHERE access_code = $1`,
        [accessCode]
      );

      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }

      const customer = result.rows[0];
      res.status(200).json({
        customer_id: customer.customer_id,
        first_name: customer.first_name,
        location: customer.location,
        status: customer.status,
        queue_position: customer.queue_position,
        add_time: customer.add_time,
        start_time: customer.start_time,
        complete_time: customer.complete_time,
      });
    } catch (error) {
      console.error('Error fetching customer queue status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Cancel customer waiting in queue
  router.put('/queue/customer/:accessCode/cancel', async (req: Request, res: Response): Promise<void> => {
    const { accessCode } = req.params;

    if (!accessCode) {
      res.status(400).json({ error: 'Access code is required' });
      return;
    }

    try {
      // Update customer status to cancelled and set queue_position to 0
      const updateResult = await pool.query(
        `UPDATE customer 
         SET status = 'cancelled', queue_position = 0 
         WHERE access_code = $1 AND status IN ('pending', 'in_progress')`,
        [accessCode]
      );

      if (updateResult.rowCount === 0) {
        res.status(404).json({ error: 'Customer not found or cannot be cancelled' });
        return;
      }

      await updateQueue();
      res.status(200).json({ message: 'Queue entry cancelled successfully' });
    } catch (error) {
      console.error('Error cancelling queue entry:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

