import { NextResponse } from "next/server";
import pool from "@/lib/pool";

const CC = "public, max-age=300, s-maxage=1200, stale-while-revalidate=3600";

export async function GET() {
  try {
    const result = await pool.query(`
      WITH trade_managers AS (
        SELECT DISTINCT e.v AS user_id
        FROM trades t, jsonb_each_text(t.adds) e(k, v)
      )
      SELECT u.user_id, u.username, u.avatar
      FROM users u
      JOIN trade_managers tm ON u.user_id = tm.user_id
      ORDER BY u.username
    `);

    return NextResponse.json(result.rows, {
      status: 200,
      headers: { "Cache-Control": CC },
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch managers", error },
      { status: 500 }
    );
  }
}
