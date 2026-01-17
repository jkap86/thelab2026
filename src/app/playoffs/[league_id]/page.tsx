"use client";

import Avatar from "@/components/common/avatar";
import TableMain from "@/components/common/table-main";
import PlayoffRoster from "@/components/playoffs/playoff-roster";
import useFetchAllPlayers from "@/hooks/common/useFetchAllplayers";
import useFetchNflState from "@/hooks/common/useFetchNflState";
import axiosInstance from "@/lib/axios-instance";
import { Header, OptimalPlayer, Row } from "@/lib/types/common-types";
import { League, Roster } from "@/lib/types/manager-types";
import { RootState } from "@/redux/store";
import { use, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { rounds } from "@/utils/playoffs/playoff-rounds";
import { Score } from "@/lib/types/playoff-types";
import useFetchLeague from "@/hooks/common/useFetchLeague";
import Link from "next/link";

export default function PlayoffsPage({
  params,
}: {
  params: Promise<{ league_id: string }>;
}) {
  const { league_id } = use(params);
  const { nflState, allplayers } = useSelector(
    (state: RootState) => state.common
  );
  const [league, setLeague] = useState<League | null>(null);
  const [selectedRounds, setSelectedRounds] = useState<string[]>([]);
  const [completedScores, setCompletedScores] = useState<{
    [week: string]: Score;
  }>({});
  const [liveScores, setLiveScores] = useState<{
    [week: string]: Score;
  }>({});

  const allScores = { ...completedScores, ...liveScores };

  const totals = Object.fromEntries(
    (league?.rosters ?? []).map((roster) => {
      const { points, numPlayersElim } = selectedRounds.reduce(
        (acc, round) => {
          const roundScore = allScores[round]?.[roster.roster_id].points ?? 0;
          const roundNumPlayersElim = [
            ...(allScores[round]?.[roster.roster_id].optimal_starters ?? []),
            ...(allScores[round]?.[roster.roster_id].optimal_bench ?? []),
          ].filter((player) => player.result === "L").length;

          return {
            points: acc.points + roundScore,
            numPlayersElim: acc.numPlayersElim + roundNumPlayersElim,
          };
        },
        { points: 0, numPlayersElim: 0 }
      );

      return [roster.roster_id, { points, numPlayersElim }];
    })
  );

  useFetchNflState();
  useFetchAllPlayers();
  useFetchLeague(league_id, setLeague);

  useEffect(() => {
    if (!nflState || !league) return;

    const fetchCompletedWeeks = async (
      season: number,
      completedWeeks: string[],
      rosters: Roster[],
      roster_positions: string[],
      scoring_settings: { [key: string]: number }
    ) => {
      const res = await axiosInstance.get("/api/playoffs/completed-scores", {
        params: {
          season: "2025",
          season_type: "post",
          weeks: JSON.stringify(completedWeeks),
          rosters: JSON.stringify(
            rosters.map((roster) => [roster.roster_id, roster.players ?? []])
          ),
          roster_positions: JSON.stringify(roster_positions),
          scoring_settings: JSON.stringify(scoring_settings),
        },
      });

      setCompletedScores(res.data);
    };

    const completedWeeks = Object.keys(rounds).filter(
      (round) => parseInt(round) < nflState.week
    );

    setSelectedRounds([...completedWeeks, nflState.week.toString()]);

    if (completedWeeks.length > 0) {
      fetchCompletedWeeks(
        nflState.season,
        completedWeeks,
        league.rosters,
        league.roster_positions,
        league.scoring_settings
      );
    }
  }, [nflState, league]);

  useEffect(() => {
    if (!nflState || !league) return;

    const params = new URLSearchParams({
      season: "2025",
      season_type: "post",
      week: nflState.week.toString(),
      rosters: JSON.stringify(
        league.rosters.map((roster) => [roster.roster_id, roster.players ?? []])
      ),
      roster_positions: JSON.stringify(league.roster_positions),
      scoring_settings: JSON.stringify(league.scoring_settings),
    });

    const eventSource = new EventSource(
      `/api/playoffs/live-scores?${params.toString()}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLiveScores({ [nflState.week.toString()]: data });
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [nflState, league]);

  const headers: Header[] = [
    {
      text: <div>Manager</div>,
      colspan: 3,
    },
    {
      text: <div>Points</div>,
      colspan: 1,
    },
    {
      text: <div># Players Elim</div>,
      colspan: 1,
    },
  ];

  const data: Row[] = (league?.rosters ?? [])
    .sort((a, b) => totals[b.roster_id].points - totals[a.roster_id].points)
    .map((roster) => {
      return {
        id: roster.roster_id.toString(),
        columns: [
          {
            text: (
              <div className="font-metal">
                <Avatar
                  avatar_id={roster.avatar}
                  type="user"
                  name={roster.username}
                />
              </div>
            ),
            colspan: 3,
          },
          {
            text: (
              <div>
                {totals[roster.roster_id].points.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            ),
            colspan: 1,
            className: "font-score",
          },
          {
            text: (
              <div>{totals[roster.roster_id].numPlayersElim.toString()}</div>
            ),
            colspan: 1,
            className: "font-pulang",
          },
        ],
        detail: (
          <PlayoffRoster
            type={2}
            roster={roster}
            rosterPositions={league?.roster_positions ?? []}
            selectedRounds={selectedRounds}
            allScores={allScores}
          />
        ),
      };
    });

  return (
    <div className="h-full">
      <Link href={"/playoffs"} className="home">
        Playoffs Home
      </Link>

      <div className="flex flex-col text-center m-auto">
        <div className="flex justify-center text-[3rem] text-center m-8 font-chill text-[var(--color1)]">
          {league && (
            <Avatar
              avatar_id={league.avatar}
              type="league"
              name={league.name}
              centered={true}
            />
          )}
        </div>
        <div className="flex justify-evenly text-[1.5rem]">
          {Object.keys(rounds).map((round) => (
            <div
              key={round}
              className={
                "cursor-pointer p-4 rounded " +
                (selectedRounds.includes(round)
                  ? "bg-radial-active"
                  : "bg-radial-gray")
              }
              onClick={() => {
                if (selectedRounds.includes(round)) {
                  setSelectedRounds((prevState) =>
                    prevState.filter((r) => r !== round)
                  );
                } else {
                  setSelectedRounds((prevState) => [...prevState, round]);
                }
              }}
            >
              {rounds[round]}
            </div>
          ))}
        </div>
        <div>
          <TableMain type={1} headers={headers} data={data} />
        </div>
      </div>
    </div>
  );
}
