"use client";

import { use, useMemo, useState } from "react";
import ManagerLayout from "../manager-layout";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import TableMain from "@/components/common/table-main";
import { filterLeagueIds } from "@/utils/common/filter-leagues";
import Avatar from "@/components/common/avatar";
import { Header, Row } from "@/lib/types/common-types";
import HeaderModal from "@/components/common/header-modal";
import { setPlayersTabState } from "@/redux/manager/manager-slice";
import {
  getDraftPickDisplayText,
  getDraftPickKtcName,
} from "@/utils/common/format-draftpick";
import {
  getAgeMinMaxValues,
  getDraftClassMinMaxValues,
  ktcMinMax,
} from "@/utils/common/min-max-values";
import PlayersFilters from "@/components/common/players-filters";
import { positions } from "@/utils/common/positions";
import { filterPlayerIds } from "@/utils/common/filter-players";
import PlayerLeagues from "@/components/manager/player-leagues";
import {
  playersColumnOptions,
  PlayerColumnKey,
} from "@/utils/manager/column-options";

export default function PlayersPage({
  params,
}: {
  params: Promise<{ searched: string }>;
}) {
  const dispatch: AppDispatch = useDispatch();
  const { searched } = use(params);
  const { allplayers, ktcCurrent, nflState } = useSelector(
    (state: RootState) => state.common
  );
  const { leagues, type1, type2, playerShares } = useSelector(
    (state: RootState) => state.manager
  );
  const {
    column1,
    column2,
    column3,
    column4,
    sortBy,
    positionFilter,
    teamFilter,
    draftClassFilter,
  } = useSelector((state: RootState) => state.manager.tabs.players);
  const [isOpen, setIsOpen] = useState(false);

  const headers: Header[] = [
    {
      text: <div>Player</div>,
      colspan: 2,
      sort: true,
    },
    ...[column1, column2, column3, column4].map((col) => ({
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

  const filteredLeagueCount = filterLeagueIds(Object.keys(leagues || {}), {
    type1,
    type2,
    leagues,
  }).length;

  const playerValues = Object.fromEntries(
    Object.keys(playerShares).map((playerId) => {
      const isPick = playerId.includes(".");

      return [
        playerId,
        {
          num_own: filterLeagueIds(playerShares[playerId].owned, {
            type1,
            type2,
            leagues,
          }).length,
          ktc_d: isPick
            ? ktcCurrent?.player_values?.[playerId] ??
              ktcCurrent?.player_values?.[getDraftPickKtcName(playerId)] ??
              0
            : ktcCurrent?.player_values?.[playerId] ?? 0,
          age: allplayers?.[playerId]?.age ?? 0,
          draft_class:
            nflState?.season! - (allplayers?.[playerId]?.years_exp ?? 0),
        },
      ];
    })
  );

  const data: Row[] = filterPlayerIds(
    Object.keys(playerShares),
    nflState?.season!,
    allplayers!,
    positionFilter,
    teamFilter,
    draftClassFilter
  ).map((playerId) => {
    const isPick = playerId.includes(".");
    const name = isPick
      ? getDraftPickDisplayText(playerId)
      : allplayers?.[playerId]?.full_name ?? playerId;

    return {
      id: playerId,
      search: {
        text: name,
        display: isPick ? (
          <div>{name}</div>
        ) : (
          <Avatar avatar_id={playerId} type="player" name={name} />
        ),
      },
      columns: [
        {
          text: (
            <div className="h-full font-chill text-[1.75rem] p-2">
              {isPick ? (
                name
              ) : (
                <Avatar avatar_id={playerId} type="player" name={name} />
              )}
            </div>
          ),
          colspan: 2,
          sort: name,
        },
        ...[column1, column2, column3, column4].map((col) => {
          const o = playersColumnOptions.find(
            (option) => option.abbrev === col
          );

          const value = playerValues[playerId]?.[o?.key as PlayerColumnKey];

          const { min, max } =
            col === "# Own"
              ? { min: 0, max: filteredLeagueCount }
              : col === "KTC D"
              ? ktcMinMax
              : col === "Age"
              ? getAgeMinMaxValues(allplayers?.[playerId]?.position)
              : col === "Draft Class"
              ? getDraftClassMinMaxValues(nflState?.season!)
              : { min: 0, max: 0 };

          const reverse = col === "Age" ? true : false;

          const style =
            (o &&
              o.style &&
              o.style(value, min, max, (min + max) / 2, reverse)) ||
            {};

          return {
            text: <div>{value}</div>,
            colspan: 1,
            className: "text-center " + o?.className,
            style,
            sort: value ?? 0,
          };
        }),
      ],
      detail: (
        <PlayerLeagues
          type={2}
          playerId={playerId}
          playerLeagues={playerShares[playerId]}
        />
      ),
    };
  });

  const columns: { [key: string]: string } = {
    column1,
    column2,
    column3,
    column4,
  };

  const teams = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          Object.values(allplayers || {}).map((player) => player.team ?? "FA")
        )
      ).sort((a, b) => {
        const valueA = a.toLowerCase();
        const valueB = b.toLowerCase();

        if (valueA === "fa") return 1;
        if (valueB === "fa") return -1;

        if (valueA < valueB) {
          return -1;
        }
        if (valueA > valueB) {
          return 1;
        }
        return 0;
      }),
    ];
  }, [allplayers]);

  const draftClasses = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          Object.values(allplayers || {})
            .sort((a, b) => (a.years_exp || 0) - (b.years_exp || 0))
            .map((player) =>
              (nflState?.season! - (player.years_exp || 0)).toString()
            )
        )
      ),
    ];
  }, [nflState?.season, allplayers]);

  const filters = [
    {
      label: "Position",
      filter: positionFilter,
      key: "positionFilter",
      options: ["Players", ...positions, "Picks"],
    },
    {
      label: "Team",
      filter: teamFilter,
      key: "teamFilter",
      options: teams,
    },
    {
      label: "Draft Class",
      filter: draftClassFilter,
      key: "draftClassFilter",
      options: draftClasses,
    },
  ];

  return (
    <ManagerLayout searched={searched}>
      <HeaderModal
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        columns={Object.keys(columns).map((key) => ({
          key,
          value: columns[key],
          setText: (text: string) => {
            return dispatch(setPlayersTabState({ key, value: text }));
          },
        }))}
        options={playersColumnOptions}
      />
      <div className="flex justify-center text-[1.5rem] mt-6">
        {filters.map((filter) => (
          <div key={filter.key} className="w-[10rem] mx-4">
            <PlayersFilters
              filter={filter.filter}
              setFilter={(value: string) =>
                dispatch(setPlayersTabState({ key: filter.key, value }))
              }
              options={filter.options}
              label={filter.label}
            />
          </div>
        ))}
      </div>
      <TableMain
        type={1}
        headers={headers}
        data={data}
        itemsPerPage={25}
        sortBy={sortBy}
        setSortBy={(column, direction) =>
          dispatch(
            setPlayersTabState({ key: "sortBy", value: { column, direction } })
          )
        }
        placeholder="Player"
      />
    </ManagerLayout>
  );
}
