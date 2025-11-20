import { Router, Request, Response } from "express";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { AuthenticatedRequest, createAuthMiddleware } from "../middleware/auth";

const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);

export function setupAuthRoutes(pool: Pool) {
  const router = Router();
  const authMiddleware = createAuthMiddleware(pool);

  router.post("/auth/register", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    try {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await pool.query(
        "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
        [username, passwordHash]
      );

      res.status(201).json({ success: true });
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "Username already exists" });
      }
      console.error("Error registering user:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  router.post("/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    try {
      const result = await pool.query(
        "SELECT user_id, password_hash FROM users WHERE username = $1",
        [username]
      );

      if (result.rowCount === 0) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);

      if (!valid) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      await pool.query(
        "INSERT INTO sessions (user_id, token) VALUES ($1, $2)",
        [user.user_id, token]
      );

      res.json({ success: true, token });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  router.get("/auth/profile", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    res.json({ message: `Logged in as user ${req.userId}` });
  });

  return router;
}

