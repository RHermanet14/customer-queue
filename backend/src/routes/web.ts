import { Router, Request, Response } from "express";
import { Pool } from "pg";

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

  router.post('/queue', async (req: Request, res: Response): Promise<void> => {
    const { first_name, location } = req.body;
    try {
      const result = await pool.query('INSERT INTO customer (first_name, location, queue_position) VALUES ($1, $2, (SELECT COALESCE(MAX(queue_position), 0) + 1 FROM customer WHERE status = \'pending\')) RETURNING customer_id, queue_position', [first_name, location]);
      res.status(200).json({ message: 'Customer added to queue', customer_id: result.rows[0].customer_id, queue_position: result.rows[0].queue_position });
    } catch (error) {
      console.error('Error adding customer to queue:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/queue/customer/:customerId', async (req: Request, res: Response): Promise<void> => {
    const { customerId } = req.params;

    if (!customerId) {
      res.status(400).json({ error: 'Customer ID is required' });
      return;
    }

    const parsedId = parseInt(customerId, 10);

    if (Number.isNaN(parsedId)) {
      res.status(400).json({ error: 'Invalid customer ID' });
      return;
    }

    try {
      const result = await pool.query(
        `SELECT customer_id, first_name, location, status, queue_position, add_time, start_time, complete_time
         FROM customer
         WHERE customer_id = $1`,
        [parsedId]
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

  return router;
}

