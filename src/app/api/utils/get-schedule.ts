import axiosInstance from "@/lib/axios-instance";

type TeamsSchedule = {
  [team: string]: {
    kickoff: number;
    opp: string;
    timeLeft: number;
    is_in_progress: boolean;
    result?: "W" | "L" | "T";
  };
};

type Game = {
  start_time: number;
  metadata: {
    away_team: string;
    home_team: string;
    time_remaining?: string;
    is_in_progress: boolean;
    quarter_num: number | "";
    away_score?: number;
    home_score?: number;
  };
  status: string;
};

const timeStringToS = (
  time: string | undefined,
  quarter_num: number | ""
): number => {
  const [minutes, seconds] = time?.split(":").map(Number) || [];

  return minutes * 60 + seconds + (4 - (quarter_num || 1)) * 15 * 60;
};

export const getSchedule = async (
  week: string,
  season: number,
  season_type: "regular" | "post"
) => {
  const graphqlQuery = {
    query: `
            query batch_scores {
                scores(
                    sport: "nfl",
                    season_type: "${season_type}",
                    season: "${season}",
                    week: ${week}
                ) {
                    game_id
                    metadata
                    status    
                    start_time
                }
            }
        `,
  };

  const schedule = await axiosInstance.post(
    "https://sleeper.com/graphql",
    graphqlQuery
  );

  const teamsSchedule: TeamsSchedule = {};

  schedule.data.data.scores.forEach((game: Game, index: number) => {
    teamsSchedule[game.metadata.away_team] = {
      kickoff: game.start_time,
      opp: "@ " + game.metadata.home_team,
      timeLeft:
        timeStringToS(
          game.metadata.time_remaining,
          game.metadata.quarter_num
        ) ?? 0,
      is_in_progress: game.metadata.is_in_progress,
      result:
        game.metadata.away_score &&
        game.metadata.home_score &&
        game.status === "complete"
          ? game.metadata.away_score > game.metadata.home_score
            ? "W"
            : "L"
          : undefined,
    };

    teamsSchedule[game.metadata.home_team] = {
      kickoff: game.start_time,
      opp: "vs " + game.metadata.away_team,
      timeLeft:
        timeStringToS(
          game.metadata.time_remaining,
          game.metadata.quarter_num
        ) ?? 0,
      is_in_progress: game.metadata.is_in_progress,
      result:
        game.metadata.away_score &&
        game.metadata.home_score &&
        game.status === "complete"
          ? game.metadata.away_score > game.metadata.home_score
            ? "L"
            : "W"
          : undefined,
    };
  });

  return teamsSchedule;
};
