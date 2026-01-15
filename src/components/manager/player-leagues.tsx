import { PlayerShare, Roster } from "@/lib/types/manager-types";
import TableMain from "../common/table-main";
import { Header, Row } from "@/lib/types/common-types";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { setPlayerLeaguesTabState } from "@/redux/manager/manager-slice";
import { useState } from "react";
import HeaderModal from "../common/header-modal";
import { filterLeagueIds } from "@/utils/common/filter-leagues";
import Avatar from "../common/avatar";
import {
  leaguesColumnOptions,
  LeagueColumnKey,
} from "@/utils/manager/column-options";
import League from "./league";

const PlayerLeagues = ({
  type,
  playerId,
  playerLeagues,
}: {
  type: number;
  playerId: string;
  playerLeagues: PlayerShare;
}) => {
  const dispatch: AppDispatch = useDispatch();
  const { leagues, type1, type2 } = useSelector(
    (state: RootState) => state.manager
  );
  const {
    tab,
    ownedAvailableColumn1,
    ownedAvailableColumn2,
    ownedAvailableColumn3,
    ownedAvailableColumn4,
    takenColumn1,
    takenColumn2,
    sortBy,
  } = useSelector((state: RootState) => state.manager.tabs.playerLeagues);
  const [isOpen, setIsOpen] = useState(false);

  const headers: Header[] = [
    {
      text: <div>League</div>,
      colspan: 3,
      sort: true,
    },
    ...(tab === "Taken"
      ? [
          {
            text: <div>Leaguemate</div>,
            colspan: 2,
            sort: true,
          },
        ]
      : []),
    ...[
      ...(tab === "Taken"
        ? [takenColumn1, takenColumn2]
        : [
            ownedAvailableColumn1,
            ownedAvailableColumn2,
            ownedAvailableColumn3,
            ownedAvailableColumn4,
          ]),
    ].map((col) => ({
      text: (
        <div
          onClick={() => setIsOpen(true)}
          className={
            "cursor-pointer h-full w-full outline-[var(--color3)] outline-[.25rem]  outline-double flex items-center justify-center "
          }
        >
          {col}
        </div>
      ),
      colspan: 1,
      sort: true,
    })),
  ];

  const league_ids =
    tab === "Owned"
      ? playerLeagues.owned
      : tab === "Available"
      ? playerLeagues.available
      : tab === "Taken"
      ? playerLeagues.taken.map((t) => t.league_id)
      : [];

  const data: Row[] = filterLeagueIds(league_ids, {
    type1,
    type2,
    leagues,
  }).map((leagueId) => {
    const league = leagues![leagueId];

    const userRoster = league.rosters.find(
      (roster) => roster.roster_id === league.user_roster_id
    );

    let lmRoster: Roster | undefined;

    if (tab === "Taken") {
      const playerShare = playerLeagues.taken.find(
        (t) => t.league_id === leagueId
      );

      lmRoster = league.rosters.find(
        (roster) => roster.roster_id === playerShare?.lm_roster_id
      );
    }

    return {
      id: leagueId,
      columns: [
        {
          text: (
            <div className="h-full font-chill text-[1.75rem] p-2">
              <Avatar
                avatar_id={league.avatar}
                type="league"
                name={league.name}
              />
            </div>
          ),
          colspan: 3,
          sort:
            sortBy?.direction === "desc" ? league.name : -(league.index ?? 0),
        },
        ...(tab === "Taken"
          ? [
              {
                text: (
                  <div className="font-chill h-full text-[1.75rem] p-2">
                    <Avatar
                      avatar_id={lmRoster?.avatar ?? null}
                      type="user"
                      name={lmRoster?.username ?? "Orphan"}
                    />
                  </div>
                ),
                colspan: 2,
                sort: lmRoster?.username || "Orphan",
              },
            ]
          : []),
        ...(tab === "Taken"
          ? [takenColumn1, takenColumn2]
          : [
              ownedAvailableColumn1,
              ownedAvailableColumn2,
              ownedAvailableColumn3,
              ownedAvailableColumn4,
            ]
        ).map((col) => {
          const o = leaguesColumnOptions.find(
            (option) =>
              option.abbrev === (tab === "Taken" ? col.replace("Lm ", "") : col)
          );

          const value =
            tab === "Taken" && col.startsWith("Lm")
              ? lmRoster?.[o?.key as LeagueColumnKey]
              : userRoster?.[o?.key as LeagueColumnKey];

          return {
            text: <div>{value}</div>,
            colspan: 1,
            className: "text-center " + o?.className,
            style:
              (o &&
                o.style &&
                value &&
                o.style(
                  value,
                  1,
                  league.rosters.length,
                  (league.rosters.length + 1) / 2,
                  true
                )) ||
              {},
            sort: value,
          };
        }),
      ],
      detail: <League type={3} league={league} />,
    };
  });

  const columns: { [key: string]: string } =
    tab === "Taken"
      ? {
          takenColumn1,
          takenColumn2,
        }
      : {
          ownedAvailableColumn1,
          ownedAvailableColumn2,
          ownedAvailableColumn3,
          ownedAvailableColumn4,
        };

  return (
    <>
      <HeaderModal
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        columns={Object.keys(columns).map((key) => ({
          key,
          value: columns[key],
          setText: (text: string) => {
            return dispatch(setPlayerLeaguesTabState({ key, value: text }));
          },
        }))}
        options={[
          ...leaguesColumnOptions,
          ...(tab === "Taken"
            ? leaguesColumnOptions.map((option) => ({
                ...option,
                abbrev: "Lm " + option.abbrev,
                label: "Leaguemate " + option.label,
                desc: "Leaguemate " + option.desc,
              }))
            : []),
        ]}
      />
      <div
        className={
          "h-[5rem] bg-radial-gray2 flex justify-evenly items-center font-chill "
        }
      >
        {["Owned", "Taken", "Available"].map((t) => (
          <div
            key={t}
            className={
              "cursor-pointer " +
              (t === tab ? "text-[var(--color1)]" : "text-gray-400")
            }
            onClick={() =>
              dispatch(setPlayerLeaguesTabState({ key: "tab", value: t }))
            }
          >
            {t}
          </div>
        ))}
      </div>
      <TableMain
        type={type}
        headers={headers}
        data={data}
        itemsPerPage={10}
        sortBy={sortBy}
        setSortBy={(column, direction) =>
          dispatch(
            setPlayerLeaguesTabState({
              key: "sortBy",
              value: { column, direction },
            })
          )
        }
      />
    </>
  );
};

export default PlayerLeagues;
