"use client";

import { use, useState } from "react";
import ManagerLayout from "../manager-layout";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import TableMain from "@/components/common/table-main";
import { filterLeagueIds } from "@/utils/common/filter-leagues";
import Avatar from "@/components/common/avatar";
import { Header, Row } from "@/lib/types/common-types";
import HeaderModal from "@/components/common/header-modal";
import { setLeaguesTabState } from "@/redux/manager/manager-slice";
import League from "@/components/manager/league";
import {
  leaguesColumnOptions,
  LeagueColumnKey,
} from "@/utils/manager/column-options";

export default function LeaguesPage({
  params,
}: {
  params: Promise<{ searched: string }>;
}) {
  const dispatch: AppDispatch = useDispatch();
  const { searched } = use(params);
  const { leagues, type1, type2 } = useSelector(
    (state: RootState) => state.manager
  );
  const { column1, column2, column3, column4, sortBy } = useSelector(
    (state: RootState) => state.manager.tabs.leagues
  );
  const [isOpen, setIsOpen] = useState(false);

  const headers: Header[] = [
    {
      text: <div>League</div>,
      colspan: 3,
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

  const data: Row[] = filterLeagueIds(Object.keys(leagues || {}), {
    type1,
    type2,
    leagues,
  }).map((leagueId) => {
    const league = leagues![leagueId];

    const userRoster = league.rosters.find(
      (roster) => roster.roster_id === league.user_roster_id
    );

    return {
      id: leagueId,
      search: {
        text: league.name,
        display: (
          <Avatar avatar_id={league.avatar} type="league" name={league.name} />
        ),
      },
      columns: [
        {
          text: (
            <div className="h-full font-chill">
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
        ...[column1, column2, column3, column4].map((col) => {
          const o = leaguesColumnOptions.find(
            (option) => option.abbrev === col
          );

          const value = userRoster?.[o?.key as LeagueColumnKey];

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
      detail: <League type={2} league={league} />,
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
        options={leaguesColumnOptions}
        columns={Object.keys(columns).map((key) => ({
          key,
          value: columns[key],
          setText: (text: string) => {
            return dispatch(setLeaguesTabState({ key, value: text }));
          },
        }))}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />
      <TableMain
        type={1}
        headers={headers}
        data={data}
        itemsPerPage={25}
        sortBy={sortBy}
        setSortBy={(column, direction) =>
          dispatch(
            setLeaguesTabState({ key: "sortBy", value: { column, direction } })
          )
        }
        placeholder="League"
      />
    </ManagerLayout>
  );
}
