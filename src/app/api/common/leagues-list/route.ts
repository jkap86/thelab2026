import { NextRequest, NextResponse } from "next/server";
import axiosInstance from "@/lib/axios-instance";
import { SleeperLeague } from "@/lib/types/sleeper-types";

const CC = "public, max-age=120, s-maxage=360, stale-while-revalidate=300";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const username = searchParams.get("username");

  if (!username) return new NextResponse("Missing username", { status: 400 });

  try {
    const { user_id } = await (
      await axiosInstance.get(`https://api.sleeper.app/v1/user/${username}`)
    ).data;

    if (!user_id) return new NextResponse("User not found", { status: 404 });

    const leagues = await (
      await axiosInstance.get(
        `https://api.sleeper.app/v1/user/${user_id}/leagues/nfl/${process.env.SEASON}`
      )
    ).data.map((league: SleeperLeague) => ({
      league_id: league.league_id,
      name: league.name,
      avatar: league.avatar,
    }));

    return new NextResponse(JSON.stringify(leagues), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": CC,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json(
        { error: err.message },
        {
          status: 500,
        }
      );
    }
  }
}
