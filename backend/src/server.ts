import express, { Request, Response } from "express";
import { Pool } from "pg";
import cors from "cors";
import dotenv from 'dotenv';
import { setupWebRoutes } from "./routes/web";
import { setupPhoneRoutes } from "./routes/phone";

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

// Set up routes for each frontend
app.use(setupWebRoutes(pool));
app.use(setupPhoneRoutes(pool));

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