"use client";

import { use, useState } from "react";
import { League } from "@/lib/types/manager-types";
import useFetchAllPlayers from "@/hooks/common/useFetchAllplayers";
import useFetchLeague from "@/hooks/common/useFetchLeague";
import Avatar from "@/components/common/avatar";
import useFetchKickerPicks from "@/hooks/picktracker/useFetchKickerPicks";
import { Pick } from "@/lib/types/picktracker-types";
import Link from "next/link";
import TableMain from "@/components/common/table-main";
import { Header, Row } from "@/lib/types/common-types";

const PickTrackerPage = ({
  params,
}: {
  params: Promise<{ league_id: string }>;
}) => {
  const { league_id } = use(params);
  const [league, setLeague] = useState<League | null>(null);
  const [picks, setPicks] = useState<{
    picks: Pick[];
    nextPick: string;
  } | null>(null);

  useFetchAllPlayers();
  useFetchLeague(league_id, setLeague);
  useFetchKickerPicks(league_id, setPicks);

  const headers: Header[] = [
    {
      text: <div>Pick</div>,
      colspan: 2,
    },
    {
      text: <div>Manager</div>,
      colspan: 4,
    },
    {
      text: <div>Player</div>,
      colspan: 4,
    },
  ];

  const data: Row[] = (picks?.picks ?? []).map((pick) => {
    return {
      id: pick.player_id,
      columns: [
        {
          text: <div>{pick.pick}</div>,
          colspan: 2,
        },
        {
          text: (
            <Avatar
              avatar_id={pick.picked_by_avatar}
              type="user"
              name={pick.picked_by}
            />
          ),
          colspan: 4,
          className: "font-metal",
        },
        {
          text: (
            <Avatar
              avatar_id={pick.player_id}
              type="player"
              name={pick.player_name}
            />
          ),
          colspan: 4,
          classname: "",
        },
      ],
    };
  });

  return (
    <div className="h-full m-auto">
      <Link href={"/picktracker"} className="home">
        Pick Tracker Home
      </Link>
      <div className="flex flex-col text-center">
        {league && (
          <>
            <div className="m-8 text-[3rem] font-chill text-[var(--color1)]">
              <Avatar
                avatar_id={league.avatar}
                type="league"
                name={league.name}
                centered={true}
              />
            </div>
            {picks && (
              <>
                <div className="text-[2rem] font-chill text-gray-400 flex flex-col bg-radial-table3">
                  Next Pick
                  <strong className="font-score text-orange-400">
                    {picks.nextPick}
                  </strong>
                </div>
                <TableMain type={1} headers={headers} data={data} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PickTrackerPage;
