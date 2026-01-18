import { NextRequest, NextResponse } from "next/server";
import { getAllplayersCached } from "../../common/allplayers/utils/get-allplayers";
import { getSleeperStats } from "../../utils/get-sleeper-stats";
import { getPlayerPoints } from "../../utils/get-player-points";
import { getOptimalStarters } from "../../../../utils/common/get-optimal-starters";
import { OptimalPlayer } from "@/lib/types/common-types";
import { getSchedule } from "../../utils/get-schedule";
import { computeHistoricalRoster } from "../../manager/leagues/route";
import { SleeperTransaction } from "@/lib/types/sleeper-types";
import axiosInstance from "@/lib/axios-instance";
import { Roster } from "@/lib/types/manager-types";

type OptimalPlayersWeek = {
  [roster_id: string]: {
    optimal_starters: OptimalPlayer[];
    optimal_bench: OptimalPlayer[];
    points: number;
  };
};

const weekCutoffs: { [key: string]: number } = {
  "1": new Date("2024-01-13T23:59:59Z").getTime(),
  "2": new Date("2024-01-20T23:59:59Z").getTime(),
  "3": new Date("2024-01-27T23:59:59Z").getTime(),
};

const CC = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const searchParams = body.params;

  const season = searchParams["season"];
  const seasonType = searchParams["season_type"];
  const league_id = searchParams["league_id"];
  const weeksString = searchParams["weeks"];
  const rostersString = searchParams["rosters"];
  const rosterPositionsString = searchParams["roster_positions"];
  const scoringSettingsString = searchParams["scoring_settings"];

  if (
    !season ||
    !seasonType ||
    !league_id ||
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

    const transactions = (
      await Promise.all(
        weeks.map(async (week: number) => {
          const transactionsWeek: { data: SleeperTransaction[] } =
            await axiosInstance.get(
              `https://api.sleeper.app/v1/league/${league_id}/transactions/${week}`
            );

          return transactionsWeek.data.filter(
            (transaction) => transaction.status === "complete"
          );
        })
      )
    ).flat();

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

        const historicalRosters = rosters.map((roster: Roster) =>
          computeHistoricalRoster(
            roster,
            transactions
              .filter(
                (txn) => txn.status_updated > weekCutoffs[week.toString()]
              )
              .sort((a, b) => b.status_updated - a.status_updated)
          )
        );

        const playerPoints = Object.fromEntries(
          historicalRosters.flatMap((roster: Roster) => {
            return roster.players.map((playerId: string) => [
              playerId,
              getPlayerPoints(scoringSettings, stats[playerId] || {}),
            ]);
          })
        );

        const optimalRostersWeek = Object.fromEntries(
          historicalRosters.map((roster: Roster) => {
            const { optimalStarters, optimalBench } = getOptimalStarters(
              rosterPositions,
              roster.players,
              playerPoints,
              allplayers
            );

            return [
              roster.roster_id,
              {
                optimal_starters: optimalStarters.map((player) => {
                  const team = allplayers[player.optimal_player_id]?.team;
                  return {
                    ...player,
                    playing: team ? !!schedule[team] : false,
                    result: team ? schedule[team]?.result : undefined,
                  };
                }),
                optimal_bench: optimalBench.map((player) => {
                  const team = allplayers[player.optimal_player_id]?.team;
                  return {
                    ...player,
                    playing: team ? !!schedule[team] : false,
                    result: team ? schedule[team]?.result : undefined,
                  };
                }),
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
    console.error("completed-scores error:", e);
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
}
