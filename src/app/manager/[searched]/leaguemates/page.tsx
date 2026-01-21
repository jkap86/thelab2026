"use client";

import { use, useEffect, useState } from "react";
import ManagerLayout from "../manager-layout";
import TableMain from "@/components/common/table-main";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { Header, Row } from "@/lib/types/common-types";
import {
  leaguemateColumnOptions,
  LeaguemateColumnKey,
  LEAGUE_COLUMN_KEYS,
} from "@/utils/manager/column-options";
import Avatar from "@/components/common/avatar";
import { filterLeagueIds } from "@/utils/common/filter-leagues";
import HeaderModal from "@/components/common/header-modal";
import { setLeaguematesTabState } from "@/redux/manager/manager-slice";
import LeaguemateLeagues from "@/components/manager/leaguemate-leagues";

export default function LeaguematesPage({
  params,
}: {
  params: Promise<{ searched: string }>;
}) {
  const { searched } = use(params);
  const dispatch: AppDispatch = useDispatch();
  const { leaguemates, leagues, type1, type2 } = useSelector(
    (state: RootState) => state.manager,
  );
  const { column1, column2, column3, column4, sortBy } = useSelector(
    (state: RootState) => state.manager.tabs.leaguemates,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeColIndex, setActiveColIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeColIndex !== null) {
      setIsOpen(true);
    }
  }, [activeColIndex]);

  useEffect(() => {
    if (!isOpen) {
      setActiveColIndex(null);
    }
  }, [isOpen]);

  const leaguemateValues = Object.fromEntries(
    Object.values(leaguemates).map((leaguemate) => {
      const leaguesCount = filterLeagueIds(leaguemate.leagues, {
        type1,
        type2,
        leagues,
      }).length;

      const { user, lm } = leaguemate.leagues.reduce(
        (acc, cur) => {
          const league = leagues?.[cur];

          const userRoster = league?.rosters?.find(
            (r) => r.roster_id === league.user_roster_id,
          );
          const lmRoster = league?.rosters.find(
            (r) => r.user_id === leaguemate.user_id,
          );

          if (!userRoster || !lmRoster) {
            return acc;
          }

          return {
            user: Object.fromEntries(
              LEAGUE_COLUMN_KEYS.map((key) => {
                return [
                  key,
                  acc.user[key] + (userRoster[key] ?? 0) / leaguesCount,
                ];
              }),
            ),
            lm: Object.fromEntries(
              LEAGUE_COLUMN_KEYS.map((key) => {
                return [key, acc.lm[key] + (lmRoster[key] ?? 0) / leaguesCount];
              }),
            ),
          };
        },
        {
          user: Object.fromEntries(LEAGUE_COLUMN_KEYS.map((key) => [key, 0])),
          lm: Object.fromEntries(LEAGUE_COLUMN_KEYS.map((key) => [key, 0])),
        },
      );

      return [
        leaguemate.user_id,
        {
          num_common: {
            display: leaguesCount.toLocaleString("en-US"),
            sort: leaguesCount,
          },
          ...Object.fromEntries(
            LEAGUE_COLUMN_KEYS.flatMap((key) => [
              [
                "avg_" + key,
                {
                  display: user[key].toLocaleString("en-US", {
                    maximumFractionDigits: 1,
                  }),
                  sort: user[key],
                },
              ],
              [
                "lm_avg_" + key,
                {
                  display: lm[key].toLocaleString("en-US", {
                    maximumFractionDigits: 1,
                  }),
                  sort: lm[key],
                },
              ],
              [
                "avg_delta_" + key,
                {
                  display: (lm[key] - user[key]).toLocaleString("en-US", {
                    maximumFractionDigits: 1,
                  }),
                  sort: lm[key] - user[key],
                },
              ],
            ]),
          ),
        },
      ];
    }),
  );

  const headers: Header[] = [
    {
      text: <div>Leaguemate</div>,
      colspan: 3,
      sort: true,
    },
    ...[column1, column2, column3, column4].map((col, index) => ({
      text: (
        <div
          onClick={() => {
            setActiveColIndex(index);
          }}
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

  const data: Row[] = Object.values(leaguemates)
    .filter(
      (lm) =>
        lm.user_id &&
        filterLeagueIds(lm.leagues, { type1, type2, leagues }).length > 0,
    )
    .map((lm) => {
      return {
        id: lm.user_id,
        search: {
          text: lm.username,
          display: (
            <Avatar avatar_id={lm.avatar} type="user" name={lm.username} />
          ),
        },
        columns: [
          {
            text: (
              <div className="h-full font-chill text-[1.75rem] p-2">
                <Avatar avatar_id={lm.avatar} type="user" name={lm.username} />
              </div>
            ),
            colspan: 3,
          },
          ...[column1, column2, column3, column4].map((col, index) => {
            const o = leaguemateColumnOptions.find(
              (option) => option.abbrev === col,
            );

            const value =
              leaguemateValues[lm.user_id]?.[o?.key as LeaguemateColumnKey];

            const { min, max, reverse } =
              col === "# Common"
                ? {
                    min: 0,
                    max:
                      filterLeagueIds(Object.keys(leagues ?? {}), {
                        type1,
                        type2,
                        leagues,
                      }).length / 10,
                    reverse: false,
                  }
                : col.includes("\u0394")
                  ? { min: -6, max: 6, reverse: false }
                  : col.includes("Rk")
                    ? { min: 1, max: 12, reverse: true }
                    : { min: 0, max: 0, reverse: false };

            const style =
              (o &&
                o.style &&
                o.style(value.sort, min, max, (min + max) / 2, reverse)) ||
              {};

            return {
              text: <div>{value?.display}</div>,
              colspan: 1,
              className: "text-center " + o?.className,
              style,
              sort: value?.sort ?? 0,
            };
          }),
        ],
        detail: (
          <LeaguemateLeagues type={2} league_ids={lm.leagues} leaguemate={lm} />
        ),
      };
    });

  const columns: { [key: string]: string } = {
    column1,
    column2,
    column3,
    column4,
  };

  return (
    <ManagerLayout searched={searched}>
      <HeaderModal
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        columns={Object.keys(columns).map((key) => ({
          key,
          value: columns[key],
          setText: (text: string) => {
            return dispatch(setLeaguematesTabState({ key, value: text }));
          },
        }))}
        options={[...leaguemateColumnOptions]}
        activeColIndex={activeColIndex}
      />
      <TableMain
        type={1}
        headers={headers}
        data={data}
        itemsPerPage={25}
        sortBy={sortBy}
        setSortBy={(column, direction) =>
          dispatch(
            setLeaguematesTabState({
              key: "sortBy",
              value: { column, direction },
            }),
          )
        }
        placeholder="Leaguemate"
      />
    </ManagerLayout>
  );
}
