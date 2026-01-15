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
    if (err instanceof Error) console.log(err.message);
    return NextResponse.json(err);
  }
}
