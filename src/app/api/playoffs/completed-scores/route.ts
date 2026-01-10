import { NextRequest, NextResponse } from "next/server";
import { getAllplayersCached } from "../../common/allplayers/utils/get-allplayers";
import { getSleeperStats } from "../../utils/get-sleeper-stats";
import { getPlayerPoints } from "../../utils/get-player-points";
import { getOptimalStarters } from "../../../../utils/common/get-optimal-starters";
import { OptimalPlayer } from "@/lib/types/common-types";
import { getSchedule } from "../../utils/get-schedule";

type OptimalPlayersWeek = {
  [roster_id: string]: {
    optimal_starters: OptimalPlayer[];
    optimal_bench: OptimalPlayer[];
    points: number;
  };
};

const CC = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const season = searchParams.get("season");
  const seasonType = searchParams.get("season_type");
  const weeksString = searchParams.get("weeks");
  const rostersString = searchParams.get("rosters");
  const rosterPositionsString = searchParams.get("roster_positions");
  const scoringSettingsString = searchParams.get("scoring_settings");

  if (
    !season ||
    !seasonType ||
    !weeksString ||
    !rostersString ||
    !scoringSettingsString ||
    !rosterPositionsString
  )
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

  try {
    const weeks = JSON.parse(weeksString);
    const rosters = JSON.parse(rostersString);
    const scoringSettings = JSON.parse(scoringSettingsString);
    const rosterPositions = JSON.parse(rosterPositionsString);

    const allplayersArray = await getAllplayersCached();

    const allplayers = Object.fromEntries(
      allplayersArray!.map((player) => [player.player_id, player])
    );

    const optimalRosters: {
      [week: string]: OptimalPlayersWeek;
    } = {};

    await Promise.all(
      weeks.map(async (week: number) => {
        const [schedule, sleeperStats] = await Promise.all([
          getSchedule(
            week.toString(),
            parseInt(season),
            seasonType as "regular" | "post"
          ),
          getSleeperStats(
            week.toString(),
            parseInt(season),
            seasonType as "regular" | "post"
          ),
        ]);

        const stats = Object.fromEntries(
          sleeperStats.map((stat) => [stat.player_id, stat.stats])
        );

        const playerPoints = Object.fromEntries(
          rosters.flatMap((roster: [number, string[]]) => {
            return roster[1].map((playerId: string) => [
              playerId,
              getPlayerPoints(scoringSettings, stats[playerId] || {}),
            ]);
          })
        );

        const optimalRostersWeek = Object.fromEntries(
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
                  result:
                    schedule[allplayers[player.optimal_player_id].team]?.result,
                })),
                optimal_bench: optimalBench.map((player) => ({
                  ...player,
                  playing: schedule[allplayers[player.optimal_player_id].team]
                    ? true
                    : false,
                  result:
                    schedule[allplayers[player.optimal_player_id].team]?.result,
                })),
                points: optimalStarters.reduce(
                  (acc, curr) => acc + curr.value,
                  0
                ),
              },
            ];
          })
        );

        optimalRosters[week] = optimalRostersWeek;
      })
    );

    return NextResponse.json(optimalRosters, {
      status: 200,
      headers: { "Cache-Control": CC },
    });
  } catch (e) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
}
