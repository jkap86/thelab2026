import { NextRequest, NextResponse } from "next/server";
import { getLeaguemateUserIds } from "../trades/utils/get-leaguemates";

// In-memory cache: username -> { leaguemateIds, timestamp }
const cache = new Map<string, { leaguemateIds: string[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// HTTP Cache-Control header
const CC = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const usernameLower = username.toLowerCase();
  const cached = cache.get(usernameLower);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(
      { leaguemateIds: cached.leaguemateIds, username },
      { headers: { "Cache-Control": CC } }
    );
  }

  const leaguemateIds = await getLeaguemateUserIds(username);

  cache.set(usernameLower, { leaguemateIds, timestamp: Date.now() });

  return NextResponse.json(
    { leaguemateIds, username },
    { headers: { "Cache-Control": CC } }
  );
}
