import axiosInstance from "@/lib/axios-instance";

type SleeperStats = {
  player_id: string;
  stats: { [cat: string]: number };
  player: { team: string };
}[];

export const getSleeperStats = async (
  week: string,
  season: number,
  season_type: "regular" | "post"
) => {
  const sleeperStats: { data: SleeperStats } = await axiosInstance.get(
    `https://api.sleeper.com/stats/nfl/${season}/${week}?season_type=${season_type}`,
    {
      params: {
        timestamp: new Date().getTime(),
      },
    }
  );

  return sleeperStats.data;
};
