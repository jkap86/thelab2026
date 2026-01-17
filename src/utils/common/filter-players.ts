import { Allplayer } from "@/lib/types/common-types";

export const filterPlayerIds = (
  playerIds: string[],
  season: number,
  allplayers: { [player_id: string]: Allplayer },
  filterPosition: string,
  filterTeam: string,
  filterDraftClass: string
) => {
  return playerIds.filter((playerId) => {
    const isPick = playerId.includes(".");
    const player = allplayers[playerId];

    const conditionPosition =
      (isPick && filterPosition === "Picks") ||
      (!isPick && filterPosition === "Players") ||
      player?.fantasy_positions?.includes(filterPosition);

    const conditionTeam =
      filterTeam === "All" ||
      (isPick && filterTeam === "FA") ||
      player?.team === filterTeam;

    const conditionDraftClass =
      filterDraftClass === "All" ||
      (isPick && filterDraftClass === playerId.split(" ")[0]) ||
      season -
        allplayers[playerId]?.years_exp +
        (season === new Date().getFullYear() ? 0 : 1) ===
        parseInt(filterDraftClass);

    return conditionPosition && conditionTeam && conditionDraftClass;
  });
};
