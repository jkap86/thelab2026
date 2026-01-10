import { Roster as RosterType } from "@/lib/types/manager-types";
import TableMain from "./table-main";
import { AppDispatch, RootState } from "@/redux/store";
import { useDispatch, useSelector } from "react-redux";
import { getSlotAbbrev } from "@/utils/common/get-slot-abbrev";
import Avatar from "./avatar";
import { ColumnOption } from "@/lib/types/common-types";
import { getTextColor } from "@/utils/common/get-text-color";
import { getAgeMinMaxValues, ktcMinMax } from "@/utils/common/min-max-values";
import { setRosterTabState } from "@/redux/manager/manager-slice";

const Roster = ({ type, roster }: { type: number; roster: RosterType }) => {
  const dispatch: AppDispatch = useDispatch();
  const { allplayers, ktcCurrent } = useSelector(
    (state: RootState) => state.common
  );
  const { column1, column2, sortBy } = useSelector(
    (state: RootState) => state.manager.tabs.roster
  );

  type RosterColumnKey = "ktc_current" | "age";

  const rosterColumnOptions: ColumnOption[] = [
    {
      label: "KTC Dynasty Value",
      abbrev: "KTC",
      desc: "KeepTradeCut current dynasty value",
      key: "ktc_current",
      className: "font-pulang text-[1.25rem]",
      style: (
        value: number,
        min: number,
        max: number,
        avg: number,
        reverse?: boolean
      ) => getTextColor(value, min, max, avg, reverse),
    },
    {
      label: "Age",
      abbrev: "Age",
      desc: "Player age",
      key: "age",
      className: "font-pulang text-[1.25rem]",
      style: (
        value: number,
        min: number,
        max: number,
        avg: number,
        reverse?: boolean
      ) => getTextColor(value, min, max, avg, reverse),
    },
  ];

  const playerValues = Object.fromEntries(
    roster.players.map((player_id) => {
      return [
        player_id,
        {
          ktc_current: ktcCurrent?.player_values?.[player_id] ?? 0,
          age: allplayers?.[player_id]?.age ?? 0,
        },
      ];
    })
  );
  const className = "bg-radial-table4 ";
  return (
    <TableMain
      type={type}
      half={true}
      headers={[
        {
          text: <div></div>,
          colspan: 1,
        },
        {
          text: <div>Player</div>,
          colspan: 4,
        },
        {
          text: <div>{column1}</div>,
          colspan: 2,
        },
        {
          text: <div>{column2}</div>,
          colspan: 2,
        },
      ]}
      data={[
        ...(roster.optimal_ktc?.optimalStarters ?? []).map((player, index) => {
          return {
            id: `${player.slot__index}`,
            columns: [
              {
                text: (
                  <div className="font-chill">
                    {getSlotAbbrev(player.slot__index.split("__")[0])}
                  </div>
                ),
                colspan: 1,
                className,
              },
              {
                text: (
                  <div className="font-chill">
                    {player.optimal_player_id === "0" ? (
                      "---"
                    ) : (
                      <Avatar
                        avatar_id={player.optimal_player_id}
                        type="player"
                        name={
                          allplayers?.[player.optimal_player_id]?.full_name ??
                          player.optimal_player_id
                        }
                      />
                    )}
                  </div>
                ),
                colspan: 4,
                className,
              },
              ...[column1, column2].map((col) => {
                const o = rosterColumnOptions.find(
                  (option) => option.abbrev === col
                );

                const value =
                  playerValues[player.optimal_player_id]?.[
                    o?.key as RosterColumnKey
                  ] ?? "-";

                const position =
                  allplayers?.[player.optimal_player_id]?.position;

                const { min, max } =
                  col === "KTC"
                    ? ktcMinMax
                    : col === "Age"
                    ? getAgeMinMaxValues(position)
                    : {
                        min: 0,
                        max: 0,
                      };

                const reverse = col === "Age" ? true : false;

                return {
                  text: <div>{value?.toLocaleString("en-US")}</div>,
                  colspan: 2,
                  className: "text-center " + className + o?.className,
                  style:
                    (o &&
                      o.style &&
                      value &&
                      o.style(value, min, max, (min + max) / 2, reverse)) ||
                    {},
                };
              }),
            ],
          };
        }),
        ...[...(roster.optimal_ktc?.optimalBench ?? [])]
          .sort((a, b) => {
            const getPositionValue = (player_id: string) => {
              const position = allplayers && allplayers[player_id]?.position;

              switch (position) {
                case "QB":
                  return 1;
                case "RB":
                  return 2;
                case "FB":
                  return 2;
                case "WR":
                  return 3;
                case "TE":
                  return 4;
                default:
                  return 5;
              }
            };
            return (
              getPositionValue(a.optimal_player_id) -
                getPositionValue(b.optimal_player_id) || b.value - a.value
            );
          })
          .map((player, index) => {
            return {
              id: `${player.slot__index}-${index}`,
              columns: [
                {
                  text: <div>BN</div>,
                  colspan: 1,
                  className,
                },
                {
                  text: (
                    <div className="font-chill">
                      {player.optimal_player_id === "0" ? (
                        "---"
                      ) : (
                        <Avatar
                          avatar_id={player.optimal_player_id}
                          type="player"
                          name={
                            allplayers?.[player.optimal_player_id]?.full_name ??
                            player.optimal_player_id
                          }
                        />
                      )}
                    </div>
                  ),
                  colspan: 4,
                  className,
                },
                ...[column1, column2].map((col) => {
                  const o = rosterColumnOptions.find(
                    (option) => option.abbrev === col
                  );

                  const value =
                    playerValues[player.optimal_player_id]?.[
                      o?.key as RosterColumnKey
                    ] ?? "-";

                  const position =
                    allplayers?.[player.optimal_player_id]?.position;

                  const { min, max } =
                    col === "KTC"
                      ? ktcMinMax
                      : col === "Age"
                      ? getAgeMinMaxValues(position)
                      : {
                          min: 0,
                          max: 0,
                        };

                  const reverse = col === "Age" ? true : false;

                  return {
                    text: <div>{value?.toLocaleString("en-US")}</div>,
                    colspan: 2,
                    className: "text-center " + className + o?.className,
                    style:
                      (o &&
                        o.style &&
                        value &&
                        o.style(value, min, max, (min + max) / 2, reverse)) ||
                      {},
                  };
                }),
              ],
            };
          }),
      ]}
    />
  );
};

export default Roster;
