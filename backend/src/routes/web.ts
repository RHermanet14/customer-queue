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
      console.log("Fetched locations:", locations);
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

  return router;
}

