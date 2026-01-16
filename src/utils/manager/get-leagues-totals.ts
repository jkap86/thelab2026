import { League, User, PlayerShare } from "@/lib/types/manager-types";
import { getDraftPickId } from "../common/format-draftpick";

export const getLeagueTotals = (leagues: League[]) => {
  const playershares: { [player_id: string]: PlayerShare } = {};
  const leaguemates: {
    [lm_user_id: string]: Omit<User, "type"> & { leagues: string[] };
  } = {};

  // track all players in each league to calculate availability later
  const leaguePlayerSets: { [player_id: string]: Set<string> } = {};

  leagues.forEach((league) => {
    const leaguePlayers = (leaguePlayerSets[league.league_id] =
      new Set<string>());

    league.rosters.forEach((roster) => {
      roster.players.forEach((player_id) => {
        if (!playershares[player_id]) {
          playershares[player_id] = {
            owned: [],
            taken: [],
            available: [],
          };
        }

        if (roster.roster_id === league.user_roster_id) {
          playershares[player_id].owned.push(league.league_id);
        } else {
          playershares[player_id].taken.push({
            lm_roster_id: roster.roster_id,
            lm: {
              user_id: roster.user_id,
              username: roster.username,
              avatar: roster.avatar,
            },
            league_id: league.league_id,
          });
        }

        leaguePlayers.add(player_id);
      });

      if (roster.roster_id === league.user_roster_id) {
        roster.draftPicks.forEach((draftpick) => {
          const pickId = getDraftPickId(draftpick);

          if (!playershares[pickId]) {
            playershares[pickId] = {
              owned: [],
              taken: [],
              available: [],
            };
          }

          playershares[pickId].owned.push(league.league_id);
        });
      }
    });
  });

  // ---availability ---
  leagues.forEach((league) => {
    const rostered = leaguePlayerSets[league.league_id];

    Object.keys(playershares).forEach((player_id) => {
      if (!rostered.has(player_id)) {
        playershares[player_id].available.push(league.league_id);
      }
    });
  });
  return { playershares, leaguemates };
};
