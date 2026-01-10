import { Header, OptimalPlayer, Row } from "@/lib/types/common-types";
import { Roster } from "@/lib/types/manager-types";
import TableMain from "../common/table-main";
import { rounds } from "@/utils/playoffs/playoff-rounds";
import { Score } from "@/lib/types/playoff-types";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import Avatar from "../common/avatar";
import { useState } from "react";
import { getSlotAbbrev } from "@/utils/common/get-slot-abbrev";

const PlayoffRoster = ({
  type,
  roster,
  rosterPositions,
  selectedRounds,
  allScores,
}: {
  type: number;
  roster: Roster;
  rosterPositions: string[];
  selectedRounds: string[];
  allScores: {
    [week: string]: Score;
  };
}) => {
  const { allplayers } = useSelector((state: RootState) => state.common);

  const headers: Header[] = [
    {
      text: <div>{selectedRounds.length === 1 ? "Slot" : "Pos"}</div>,
      colspan: 1,
    },
    {
      text: <div>Player</div>,
      colspan: 4,
    },
    ...(selectedRounds.length === 1
      ? [
          {
            text: <div>Points</div>,
            colspan: 2,
            sort: true,
          },
        ]
      : [
          {
            text: <div>Lineup</div>,
            colspan: 2,
            sort: true,
          },
          {
            text: <div>Bench</div>,
            colspan: 2,
            sort: true,
          },
        ]),
  ];

  let dataLineup: Row[] = [];
  let dataBench: Row[] = [];

  if (selectedRounds.length > 1) {
    const totalPoints = Object.fromEntries(
      roster.players.map((playerId) => {
        const { lineup, bench } = selectedRounds.reduce(
          (acc, round) => {
            const lineupPoints =
              allScores[round]?.[roster.roster_id].optimal_starters.find(
                (player) => player.optimal_player_id === playerId
              )?.value ?? 0;
            const benchPoints =
              allScores[round]?.[roster.roster_id].optimal_bench.find(
                (player) => player.optimal_player_id === playerId
              )?.value ?? 0;
            return {
              lineup: acc.lineup + lineupPoints,
              bench: acc.bench + benchPoints,
            };
          },
          {
            lineup: 0,
            bench: 0,
          }
        );

        return [playerId, { lineup, bench }];
      })
    );

    dataLineup = roster.players
      .sort((a, b) => {
        const { lineup: lineupA, bench: benchA } = totalPoints[a];
        const { lineup: lineupB, bench: benchB } = totalPoints[b];

        return lineupB - lineupA || benchB - benchA;
      })
      .map((playerId) => {
        const { lineup, bench } = totalPoints[playerId];

        return {
          id: playerId.toString(),
          columns: [
            {
              text: <div>{allplayers?.[playerId]?.position || ""}</div>,
              colspan: 1,
              className: "font-metal",
            },
            {
              text: (
                <div>
                  <Avatar
                    avatar_id={playerId}
                    type="player"
                    name={allplayers?.[playerId]?.full_name ?? playerId}
                  />
                </div>
              ),
              colspan: 4,
              className: "font-metal",
            },
            {
              text: (
                <div>
                  {lineup.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              ),
              colspan: 2,
              sort: lineup,
              className: "font-score",
            },
            {
              text: (
                <div>
                  {bench.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              ),
              colspan: 2,
              className: "font-score",
            },
          ],
        };
      });
  } else if (selectedRounds.length === 1) {
    const round = selectedRounds[0];

    dataLineup =
      allScores[round]?.[roster.roster_id]?.optimal_starters?.map((player) => ({
        id: player.optimal_player_id.toString(),
        columns: [
          {
            text: <div>{getSlotAbbrev(player.slot__index.split("__")[0])}</div>,
            colspan: 1,
            className: "font-metal",
          },
          {
            text: (
              <div>
                <Avatar
                  avatar_id={player.optimal_player_id}
                  type="player"
                  name={
                    allplayers?.[player.optimal_player_id]?.full_name ??
                    player.optimal_player_id
                  }
                />
              </div>
            ),
            colspan: 4,
            className: "font-metal",
          },
          {
            text: (
              <div>
                {player.value.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            ),
            colspan: 2,
            className: "font-score",
          },
        ],
      })) ?? [];

    const className = "bg-radial-table4 ";
    dataBench =
      allScores[round]?.[roster.roster_id]?.optimal_bench?.map((player) => ({
        id: player.optimal_player_id.toString(),
        columns: [
          {
            text: <div>BN</div>,
            colspan: 1,
            className: className + "font-metal",
          },
          {
            text: (
              <div>
                <Avatar
                  avatar_id={player.optimal_player_id}
                  type="player"
                  name={
                    allplayers?.[player.optimal_player_id]?.full_name ??
                    player.optimal_player_id
                  }
                />
              </div>
            ),
            colspan: 4,
            className: className + "font-metal",
          },
          {
            text: (
              <div>
                {player.value.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            ),
            colspan: 2,
            className: className + "font-score",
          },
        ],
      })) ?? [];
  }

  return (
    <div className="">
      {selectedRounds.length === 1 ? (
        <>
          <TableMain
            type={type}
            half={true}
            headers={headers}
            data={dataLineup}
          />
          <TableMain
            type={type}
            half={true}
            headers={headers}
            data={dataBench}
          />
        </>
      ) : (
        <TableMain type={type} headers={headers} data={dataLineup} />
      )}
    </div>
  );
};

export default PlayoffRoster;
