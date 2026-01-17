import { NextResponse } from "next/server";
import pool from "@/lib/pool";

export async function GET() {
  const query = `
        SELECT * 
        FROM logs 
        WHERE created_at > NOW() - INTERVAL '24 hours';
    `;

  try {
    const logRows = await pool.query(query);

    return NextResponse.json(logRows.rows);
  } catch (err: unknown) {
    console.error("Failed to fetch logs:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
