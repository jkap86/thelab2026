import { OptimalPlayer } from "@/lib/types/common-types";
import { NextRequest, NextResponse } from "next/server";
import { getAllplayersCached } from "../../common/allplayers/utils/get-allplayers";
import { getLiveStats } from "../../utils/get-live-stats";
import { getPlayerPoints } from "../../utils/get-player-points";
import { getOptimalStarters } from "@/utils/common/get-optimal-starters";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const season = searchParams.get("season");
  const week = searchParams.get("week");
  const seasonType = searchParams.get("season_type");
  const rostersString = searchParams.get("rosters");
  const rosterPositionsString = searchParams.get("roster_positions");
  const scoringSettingsString = searchParams.get("scoring_settings");

  if (
    !season ||
    !week ||
    !seasonType ||
    !rostersString ||
    !scoringSettingsString ||
    !rosterPositionsString
  )
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

  try {
    const rosters = JSON.parse(rostersString);
    const scoringSettings = JSON.parse(scoringSettingsString);
    const rosterPositions = JSON.parse(rosterPositionsString);

    const allplayersArray = await getAllplayersCached();

    const allplayers = Object.fromEntries(
      allplayersArray!.map((player) => [player.player_id, player])
    );

    const encoder = new TextEncoder();

    let timeoutId: NodeJS.Timeout | null = null;
    let isClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const sendData = async () => {
          if (isClosed) return;
          console.log("---fetching live stats---");

          const { statsArray, delay, schedule } = await getLiveStats(
            week.toString(),
            parseInt(season),
            seasonType as "regular" | "post"
          );

          const stats = Object.fromEntries(
            statsArray.map((stat) => [stat.player_id, stat])
          );

          const playerPoints = Object.fromEntries(
            rosters.flatMap((roster: [number, string[]]) => {
              return roster[1].map((playerId: string) => [
                playerId,
                getPlayerPoints(scoringSettings, stats[playerId]?.stats || {}),
              ]);
            })
          );

          const optimalRosters = Object.fromEntries(
            rosters.map((roster: [number, string[]]) => {
              const { optimalStarters, optimalBench } = getOptimalStarters(
                rosterPositions,
                roster[1],
                playerPoints,
                allplayers
              );

              return [
                roster[0],
                {
                  optimal_starters: optimalStarters.map((player) => ({
                    ...player,
                    playing: schedule[allplayers[player.optimal_player_id].team]
                      ? true
                      : false,
                    is_in_progress:
                      stats[player.optimal_player_id]?.is_in_progress,
                    result:
                      schedule[allplayers[player.optimal_player_id].team]
                        ?.result,
                  })),
                  optimal_bench: optimalBench.map((player) => ({
                    ...player,
                    playing: schedule[allplayers[player.optimal_player_id].team]
                      ? true
                      : false,
                    is_in_progress:
                      stats[player.optimal_player_id]?.is_in_progress,
                    result:
                      schedule[allplayers[player.optimal_player_id].team]
                        ?.result,
                  })),
                  points: optimalStarters.reduce(
                    (acc, curr) => acc + curr.value,
                    0
                  ),
                },
              ];
            })
          );

          if (!isClosed) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(optimalRosters)}\n\n`)
            );

            timeoutId = setTimeout(sendData, delay);
          }
        };
        await sendData();
      },
      cancel() {
        isClosed = true;
        if (timeoutId) clearTimeout(timeoutId);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
}
