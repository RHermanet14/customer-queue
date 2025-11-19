import { NextFunction, Request, Response } from "express";
import { Pool } from "pg";

export interface AuthenticatedRequest extends Request {
  userId?: number;
}

export function createAuthMiddleware(pool: Pool) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication token required" });
    }

    const token = header.split(" ")[1];

    try {
      const result = await pool.query(
        "SELECT user_id FROM sessions WHERE token = $1",
        [token]
      );

      if (result.rowCount === 0) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      req.userId = result.rows[0].user_id;
      next();
    } catch (error) {
      console.error("Error verifying session token:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  };
}

