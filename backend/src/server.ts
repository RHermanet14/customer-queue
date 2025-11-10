import express, { Request, Response } from "express";
import { Pool } from "pg";
import cors from "cors";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Set up PostgreSQL connection pool
const pool = new Pool();
app.use(express.json());
app.use(cors());

// Test database connection
app.get("/api/test-db", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, message: "Database connected", time: result.rows[0].now });
  } catch (error: any) {
    console.error("Database connection error:", error);
    res.status(500).json({ 
      error: "Database connection failed", 
      message: error.message,
      details: error.code 
    });
  }
});

// Get all enum values for locations
app.get("/api/locations", async (req: Request, res: Response) => {
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

// Test database connection on startup
pool.query("SELECT NOW()")
  .then(() => {
    console.log("Database connection successful");
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
    console.error("Please check your database credentials and ensure PostgreSQL is running");
  });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Database: ${process.env.DB_NAME || "customerqueue"} on ${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "5432"}`);
});