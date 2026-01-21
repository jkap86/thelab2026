import { Header, Row } from "@/lib/types/common-types";
import TableMain from "../common/table-main";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/redux/store";
import { useState, useEffect } from "react";
import { setLeaguemateLeaguesTabState } from "@/redux/manager/manager-slice";
import { filterLeagueIds } from "@/utils/common/filter-leagues";
import Avatar from "../common/avatar";
import {
  LeagueColumnKey,
  leaguemateLeaguesColumnOptions,
} from "@/utils/manager/column-options";

const LeaguemateLeagues = ({
  type,
  league_ids,
  leaguemate,
}: {
  type: number;
  league_ids: string[];
  leaguemate: { user_id: string; avatar: string | null; username: string };
}) => {
  const dispatch: AppDispatch = useDispatch();
  const { leagues, type1, type2 } = useSelector(
    (state: RootState) => state.manager,
  );
  const { column1, column2, column3, column4, sortBy } = useSelector(
    (state: RootState) => state.manager.tabs.leaguemateLeagues,
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

  const headers: Header[] = [
    {
      text: <div>League</div>,
      colspan: 3,
      sort: true,
    },
    ...[column1, column2, column3, column4].map((col, index) => ({
      text: (
        <div
          onClick={() => setActiveColIndex(index)}
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

  const data: Row[] = filterLeagueIds(league_ids, {
    type1,
    type2,
    leagues,
  }).map((leagueId) => {
    const league = leagues![leagueId];

    const userRoster = league.rosters.find(
      (roster) => roster.roster_id === league.user_roster_id,
    );

    const lmRoster = league.rosters.find(
      (roster) => roster.user_id === leaguemate.user_id,
    );

    console.log({ leaguemateLeaguesColumnOptions });

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
        ...[column1, column2, column3, column4].map((col) => {
          const o = leaguemateLeaguesColumnOptions.find(
            (option) => option.abbrev === col,
          );

          const key = o?.key?.replace("lm_", "");

          if (!o) console.log({ o, key, col });

          const value = key
            ? col.startsWith("Lm")
              ? lmRoster?.[key as LeagueColumnKey]
              : userRoster?.[key as LeagueColumnKey]
            : undefined;

          return {
            text: <div>{value ?? "-"}</div>,
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
                  true,
                )) ||
              {},
            sort: value ?? 0,
          };
        }),
      ],
    };
  });

  return (
    <TableMain
      type={type}
      headers={headers}
      data={data}
      itemsPerPage={10}
      sortBy={sortBy}
      setSortBy={(column, direction) =>
        dispatch(
          setLeaguemateLeaguesTabState({
            key: "sortBy",
            value: { column, direction },
          }),
        )
      }
    />
  );
};

export default LeaguemateLeagues;
