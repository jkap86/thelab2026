import { getSleeperStats } from "./get-sleeper-stats";
import { getSchedule } from "./get-schedule";

type Stats = {
  player_id: string;
  stats: { [cat: string]: number };
  kickoff: number;
  timeLeft: number;
  is_in_progress: boolean;
}[];

export const getLiveStats = async (
  week: string,
  season: number,
  season_type: "regular" | "post"
) => {
  const [schedule, sleeperStats] = await Promise.all([
    getSchedule(week, season, season_type),
    getSleeperStats(week, season, season_type),
  ]);

  const stats: Stats = [];

  sleeperStats.forEach((stat) => {
    const { kickoff, timeLeft, is_in_progress } = schedule[
      stat.player.team
    ] ?? { kickoff: 0, timeLeft: 0, is_in_progress: false };

    stats.push({
      player_id: stat.player_id,
      stats: stat.stats,
      kickoff,
      timeLeft,
      is_in_progress,
    });
  });

  const upcomingKickoffTimes = Object.values(schedule)
    .filter((team) => team.kickoff > new Date().getTime())
    .map((team) => team.kickoff);

  const delay = Object.values(schedule).some((game) => game.is_in_progress)
    ? 10_000
    : upcomingKickoffTimes.length > 0
    ? Math.min(...upcomingKickoffTimes) - new Date().getTime()
    : 12 * 60 * 60 * 1000;

  return {
    statsArray: stats,
    delay,
    schedule,
  };
};
