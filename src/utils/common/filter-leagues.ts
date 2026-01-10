import { RootState } from "@/redux/store";

type ManagerSlice = Pick<RootState["manager"], "type1" | "type2" | "leagues">;

export const filterLeagueIds = (
  leagueIds: string[],
  { type1, type2, leagues }: ManagerSlice
) => {
  return leagueIds.filter((league_id) => {
    const condition1 =
      type1 === "All" ||
      (type1 === "Redraft" && leagues![league_id].settings.type !== 2) ||
      (type1 === "Dynasty" && leagues![league_id].settings.type === 2);

    const condition2 =
      type2 === "All" ||
      (type2 === "Bestball" && leagues![league_id].settings.best_ball === 1) ||
      (type2 === "Lineup" && leagues![league_id].settings.best_ball !== 1);

    return condition1 && condition2;
  });
};
