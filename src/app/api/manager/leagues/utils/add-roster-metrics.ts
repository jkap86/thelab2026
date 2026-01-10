import { Allplayer } from "@/lib/types/common-types";
import { Roster } from "@/lib/types/manager-types";
import { getOptimalStarters } from "@/utils/common/get-optimal-starters";

export async function addRosterMetrics(
  rosters: Roster[],
  rosterPositions: string[],
  ktcCurrent: { [player_id: string]: number },
  allplayers: Allplayer[]
) {
  const rankings = Object.fromEntries(
    rosters
      .sort(
        (a, b) =>
          b.wins - a.wins || a.losses - b.losses || b.fp - a.fp || b.fpa - a.fpa
      )
      .map((roster, index) => [roster.roster_id, index + 1])
  );

  const pointsRankings = Object.fromEntries(
    rosters
      .sort((a, b) => b.fp - a.fp)
      .map((roster, index) => [roster.roster_id, index + 1])
  );

  const rostersOptimal = Object.fromEntries(
    rosters.map((roster) => {
      const optimalKtc = getOptimalStarters(
        rosterPositions,
        roster.players,
        ktcCurrent,
        Object.fromEntries(
          allplayers.map((player) => [player.player_id, player])
        )
      );

      return [roster.roster_id, { optimalKtc }];
    })
  );

  const getPositonalRankings = (
    position: string,
    type1: "ktc",
    type2: "starter" | "bench"
  ) => {
    return Object.keys(rostersOptimal).sort((a, b) => {
      switch (type1) {
        case "ktc":
          switch (type2) {
            case "starter":
              return (
                rostersOptimal[b].optimalKtc.optimalStarters
                  .filter((player) => player.player_position === position)
                  .reduce((acc, cur) => acc + cur.value, 0) -
                rostersOptimal[a].optimalKtc.optimalStarters
                  .filter((player) => player.player_position === position)
                  .reduce((acc, cur) => acc + cur.value, 0)
              );
            case "bench":
              return (
                rostersOptimal[b].optimalKtc.optimalBench
                  .filter((player) => player.player_position === position)
                  .reduce((acc, cur) => acc + cur.value, 0) -
                rostersOptimal[a].optimalKtc.optimalBench
                  .filter((player) => player.player_position === position)
                  .reduce((acc, cur) => acc + cur.value, 0)
              );
            default:
              return 0;
          }

        default:
          return 0;
      }
    });
  };

  const rankingsAll = {
    optimal_starters_ktc: Object.keys(rostersOptimal).sort(
      (a, b) =>
        rostersOptimal[b].optimalKtc.optimalStarters.reduce(
          (acc, cur) => acc + cur.value,
          0
        ) -
        rostersOptimal[a].optimalKtc.optimalStarters.reduce(
          (acc, cur) => acc + cur.value,
          0
        )
    ),
    optimal_bench_ktc: Object.keys(rostersOptimal).sort(
      (a, b) =>
        rostersOptimal[b].optimalKtc.optimalBench.reduce(
          (acc, cur) => acc + cur.value,
          0
        ) -
        rostersOptimal[a].optimalKtc.optimalBench.reduce(
          (acc, cur) => acc + cur.value,
          0
        )
    ),
    optimal_qb_starters_ktc: getPositonalRankings("QB", "ktc", "starter"),
    optimal_qb_bench_ktc: getPositonalRankings("QB", "ktc", "bench"),
    optimal_rb_starters_ktc: getPositonalRankings("RB", "ktc", "starter"),
    optimal_rb_bench_ktc: getPositonalRankings("RB", "ktc", "bench"),
    optimal_wr_starters_ktc: getPositonalRankings("WR", "ktc", "starter"),
    optimal_wr_bench_ktc: getPositonalRankings("WR", "ktc", "bench"),
    optimal_te_starters_ktc: getPositonalRankings("TE", "ktc", "starter"),
    optimal_te_bench_ktc: getPositonalRankings("TE", "ktc", "bench"),
  };

  const metrics = Object.fromEntries(
    rosters.map((roster) => {
      return [
        roster.roster_id,
        {
          rank: rankings[roster.roster_id],
          points_rank: pointsRankings[roster.roster_id],
          optimal_ktc: rostersOptimal[roster.roster_id].optimalKtc,
          optimal_starters_ktc_total: rostersOptimal[
            roster.roster_id
          ].optimalKtc.optimalStarters.reduce((acc, cur) => acc + cur.value, 0),
          optimal_starters_ktc_rank:
            rankingsAll.optimal_starters_ktc.indexOf(
              roster.roster_id.toString()
            ) + 1,
          optimal_bench_ktc_total: rostersOptimal[
            roster.roster_id
          ].optimalKtc.optimalBench.reduce((acc, cur) => acc + cur.value, 0),
          optimal_bench_ktc_rank:
            rankingsAll.optimal_bench_ktc.indexOf(roster.roster_id.toString()) +
            1,
          optimal_qb_starters_ktc_rank:
            rankingsAll.optimal_qb_starters_ktc.indexOf(
              roster.roster_id.toString()
            ) + 1,
          optimal_qb_bench_ktc_rank:
            rankingsAll.optimal_qb_bench_ktc.indexOf(
              roster.roster_id.toString()
            ) + 1,
          optimal_rb_starters_ktc_rank:
            rankingsAll.optimal_rb_starters_ktc.indexOf(
              roster.roster_id.toString()
            ) + 1,
          optimal_rb_bench_ktc_rank:
            rankingsAll.optimal_rb_bench_ktc.indexOf(
              roster.roster_id.toString()
            ) + 1,
          optimal_wr_starters_ktc_rank:
            rankingsAll.optimal_wr_starters_ktc.indexOf(
              roster.roster_id.toString()
            ) + 1,
          optimal_wr_bench_ktc_rank:
            rankingsAll.optimal_wr_bench_ktc.indexOf(
              roster.roster_id.toString()
            ) + 1,
          optimal_te_starters_ktc_rank:
            rankingsAll.optimal_te_starters_ktc.indexOf(
              roster.roster_id.toString()
            ) + 1,
          optimal_te_bench_ktc_rank:
            rankingsAll.optimal_te_bench_ktc.indexOf(
              roster.roster_id.toString()
            ) + 1,
        },
      ];
    })
  );

  return metrics;
}
