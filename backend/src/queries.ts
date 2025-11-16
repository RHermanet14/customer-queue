import { pool } from "./server";

export async function runQuery<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<T> {
    const result = await pool.query(sql, params);  // pg returns QueryResult
    return result.rows as T;                       // extract rows
  }
  
  export async function updateQueue() {
    return runQuery(
      `WITH ordered AS (
          SELECT customer_id, ROW_NUMBER() OVER (ORDER BY queue_position) AS new_pos
          FROM customer
          WHERE status = 'pending'
        )
        UPDATE customer
        SET queue_position = ordered.new_pos
        FROM ordered
        WHERE customer.customer_id = ordered.customer_id
          AND customer.status = 'pending';`
    );
  }