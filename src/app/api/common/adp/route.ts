import { NextRequest, NextResponse } from "next/server";
import { getADP } from "./utils/get-adp";

const CC = "public, max-age=300, s-maxage=1200, stale-while-revalidate=3600";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const teamsParam = searchParams.get("teams");
  const filters = {
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    leagueType: searchParams.get("leagueType") ?? undefined,
    bestBall: searchParams.get("bestBall") ?? undefined,
    draftType: searchParams.get("draftType") ?? undefined,
    playerType: searchParams.get("playerType") ?? undefined,
    rosterSlots: searchParams.get("rosterSlots") ?? undefined,
    scoring: searchParams.get("scoring") ?? undefined,
    superflex: searchParams.get("superflex") === "true" ? true : undefined,
    teams: teamsParam ? parseInt(teamsParam, 10) : undefined,
  };

  try {
    const result = await getADP(filters);

    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": CC },
    });
  } catch (err) {
    console.error("Error fetching ADP:", err);
    return NextResponse.json(
      { error: "Error fetching ADP data" },
      { status: 500 }
    );
  }
}
