import pool from "@/lib/pool";
import { NextRequest, NextResponse } from "next/server";
import { updateLeagues } from "../../manager/leagues/route";

const CC = "public, max-age=120, s-maxage=360, stale-while-revalidate=300";

const CUTOFF = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const league_id = searchParams.get("league_id");

  if (!league_id)
    return NextResponse.json("Missing league_id", { status: 400 });

  const selectLeagueQuery = `
      SELECT * FROM leagues WHERE league_id = $1;
    `;
  const leagueDb = await (
    await pool.query(selectLeagueQuery, [league_id])
  ).rows[0];

  if (leagueDb?.updated_at > CUTOFF)
    return NextResponse.json(leagueDb, { status: 200 });

  const league = await updateLeagues([league_id], [], 1);

  return NextResponse.json(league[0], { status: 200 });
}
