import pool from "@/lib/pool";
import { NextRequest, NextResponse } from "next/server";

const insertLogQuery = `
  INSERT INTO logs(ip, route)
  VALUES ($1, $2);
`;

// Keep GET for backwards compatibility with middleware
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const ip = searchParams.get("ip");
  const route = searchParams.get("route");

  if (!ip || !route) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    await pool.query(insertLogQuery, [ip, route]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Failed to insert log:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }
}

// POST method for state-changing operations (preferred)
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const ip = searchParams.get("ip");
  const route = searchParams.get("route");

  if (!ip || !route) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    await pool.query(insertLogQuery, [ip, route]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Failed to insert log:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }
}
