import { League as LeagueType } from "@/lib/types/manager-types";
import {
  League as TradeLeagueType,
  Roster as TradeRosterType,
} from "@/lib/types/trades-types";
import TableMain from "../common/table-main";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import Avatar from "../common/avatar";
import {
  teamsColumnOptions,
  TeamsColumnKey,
} from "@/utils/manager/column-options";
import { useEffect, useState } from "react";
import Roster from "../common/roster";
import { setTeamsTabState } from "@/redux/manager/manager-slice";
import HeaderModal from "../common/header-modal";

const League = ({
  type,
  league,
}: {
  type: number;
  league: LeagueType | (TradeLeagueType & { rosters: TradeRosterType[] });
}) => {
  const dispatch: AppDispatch = useDispatch();
  const { column1, column2, sortBy } = useSelector(
    (state: RootState) => state.manager.tabs.teams
  );
  const [activeRosterId, setActiveRosterId] = useState<string | null>(null);
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

  const values = Object.fromEntries(
    teamsColumnOptions.map((option) => {
      const optionValues = league.rosters.map((roster) => {
        return roster[option.key as TeamsColumnKey] ?? 0;
      });

      return [option.abbrev, optionValues];
    })
  );

  const activeRoster = league.rosters.find(
    (r) => r.roster_id.toString() === activeRosterId
  );

  const columns: { [key: string]: string } = {
    column1,
    column2,
  };

  const className = "bg-radial-table4 ";

  return (
    <>
      <HeaderModal
        options={teamsColumnOptions}
        columns={Object.keys(columns).map((key) => ({
          key,
          value: columns[key],
          setText: (text: string) => {
            return dispatch(setTeamsTabState({ key, value: text }));
          },
        }))}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        activeColIndex={activeColIndex}
      />
      <div className={"h-[5rem] bg-radial-gray2 "}></div>
      <TableMain
        type={type}
        half={true}
        headers={[
          {
            text: <div>Rk</div>,
            colspan: 2,
          },
          {
            text: <div>Manager</div>,
            colspan: 5,
          },
          {
            text: (
              <div
                onClick={() => setActiveColIndex(0)}
                className={
                  "cursor-pointer h-full w-full outline-[var(--color3)] outline-[.25rem]  outline-double flex items-center justify-center "
                }
              >
                {column1}
              </div>
            ),
            colspan: 4,
            sort: true,
          },
          {
            text: (
              <div
                onClick={() => setActiveColIndex(1)}
                className={
                  "cursor-pointer h-full w-full outline-[var(--color3)] outline-[.25rem]  outline-double flex items-center justify-center "
                }
              >
                {column2}
              </div>
            ),
            colspan: 4,
            sort: true,
          },
        ]}
        data={[...league.rosters].map((roster) => {
          return {
            id: roster.roster_id.toString(),
            columns: [
              {
                text: <div>INDEX</div>,
                colspan: 2,
                className: "font-chill text-center text-[1.25rem]",
              },
              {
                text: (
                  <div className="font-chill text-[1.5rem]">
                    <Avatar
                      avatar_id={roster.avatar}
                      type="user"
                      name={roster.username}
                    />
                  </div>
                ),
                colspan: 5,
              },
              ...[column1, column2].map((col) => {
                const o = teamsColumnOptions.find(
                  (option) => option.abbrev === col
                );

                const value = roster[o?.key as TeamsColumnKey];

                return {
                  text: <div>{value?.toLocaleString("en-US")}</div>,
                  colspan: 4,
                  className: "text-center " + o?.className,
                  style:
                    (o &&
                      o.style &&
                      value &&
                      o.style(
                        value,
                        Math.min(...values[col]),
                        Math.max(...values[col]),
                        (Math.max(...values[col]) + Math.min(...values[col])) /
                          2
                      )) ||
                    {},
                  sort: value,
                };
              }),
            ],
          };
        })}
        sortBy={sortBy}
        setSortBy={(column, direction) =>
          dispatch(
            setTeamsTabState({
              key: "sortBy",
              value: { column, direction },
            })
          )
        }
        sendActive={(active: string | null) => setActiveRosterId(active)}
      />
      {activeRoster ? (
        <Roster type={type} roster={activeRoster} />
      ) : (
        <TableMain
          type={type}
          half={true}
          headers={[{ text: <div>Scoring Settings</div>, colspan: 8 }]}
          data={Object.keys(league.scoring_settings)
            .filter(
              (cat) =>
                league.scoring_settings[cat] !== 0 &&
                (league.roster_positions.includes("K") ||
                  (!cat.includes("fg") && !cat.includes("xp"))) &&
                (league.roster_positions.includes("DEF") ||
                  !cat.includes("pts_allow"))
            )
            .sort(
              (a, b) =>
                ((b.startsWith("pass") && 1) || 0) -
                  ((a.startsWith("pass") && 1) || 0) ||
                b.indexOf("pass") - a.indexOf("pass") ||
                ((b.startsWith("rush") && 1) || 0) -
                  ((a.startsWith("rush") && 1) || 0) ||
                b.indexOf("rush") - a.indexOf("rush") ||
                ((b.startsWith("rec") && 1) || 0) -
                  ((a.startsWith("rec") && 1) || 0) ||
                b.indexOf("rec") - a.indexOf("rec") ||
                Math.abs(league.scoring_settings[b]) -
                  Math.abs(league.scoring_settings[a]) ||
                league.scoring_settings[b] - league.scoring_settings[a]
            )
            .map((cat) => {
              return {
                id: cat,
                columns: [
                  {
                    text: (
                      <div className="font-chill px-4">
                        {cat.replace(/_/g, " ")}
                      </div>
                    ),
                    colspan: 5,
                    className,
                  },
                  {
                    text: (
                      <div className="text-center font-score">
                        {league.scoring_settings[cat].toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    ),
                    colspan: 3,
                    className,
                  },
                ],
              };
            })}
        />
      )}
    </>
  );
};

export default League;
