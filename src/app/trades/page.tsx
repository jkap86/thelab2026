"use client";

import Avatar from "@/components/common/avatar";
import AllTrades from "@/components/trades/all-trades";
import FiltersModal from "@/components/trades/filters-modal";
import LeaguemateTrades from "@/components/trades/leaguemate-trades";
import useFetchAllPlayers from "@/hooks/common/useFetchAllplayers";
import useFetchKtcCurrent from "@/hooks/common/useFetchKtcCurrent";
import useFetchNflState from "@/hooks/common/useFetchNflState";
import { RootState } from "@/redux/store";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSelector } from "react-redux";

const TradesPage = () => {
  const { allplayers, nflState } = useSelector(
    (state: RootState) => state.common
  );
  const [tab, setTab] = useState<"All" | "Leaguemate">("All");
  const [isOpen, setIsOpen] = useState(false);

  useFetchNflState();
  useFetchAllPlayers();
  useFetchKtcCurrent();

  const playerPickOptions = useMemo(() => {
    const pick_seasons =
      (nflState?.season &&
        Array.from(Array(4).keys()).map((key) => nflState.season + key)) ||
      [];

    const pick_rounds = Array.from(Array(4).keys()).map((key) => key + 1);

    const pick_orders = Array.from(Array(12).keys()).map((key) => key + 1);

    const current_season_picks = pick_rounds.flatMap((round) => {
      const season = nflState?.season;
      return pick_orders.map((order) => {
        const order_formatted = order.toString().padStart(2, "0");
        const pick = `${season} ${round}.${order_formatted}`;
        return {
          id: pick,
          text: pick,
          display: <div>{pick}</div>,
        };
      });
    });

    const pick_options = [
      ...pick_seasons.flatMap((season) => {
        return pick_rounds.map((round) => {
          return {
            id: `${season} ${round}.null`,
            text: `${season} Round ${round}`,
            display: (
              <div>
                {season} Round {round}
              </div>
            ),
          };
        });
      }),
      ...current_season_picks,
      {
        id: "Price Check",
        text: "$$ Price Check",
        display: <>$$ Price Check</>,
      },
    ];

    return [
      ...Object.keys(allplayers || {}).map((player_id) => {
        return {
          id: player_id,
          text:
            allplayers?.[player_id]?.full_name ||
            (parseInt(player_id) ? "Inactive - " + player_id : player_id),
          display: (
            <Avatar
              avatar_id={player_id}
              name={allplayers?.[player_id]?.full_name || player_id}
              type="player"
            />
          ),
        };
      }),
      ...pick_options,
    ];
  }, [allplayers, nflState]);

  return (
    <div>
      <Link href={"/tools"} className="home">
        Tools
      </Link>
      <div className="m-8 text-[3rem] font-metal text-[var(--color1)] text-center">
        Trades
      </div>
      <div className="flex justify-center items-center font-score text-[1.5rem]">
        {["All", "Leaguemate"].map((item) => (
          <div
            key={item}
            className={
              "w-[10rem] py-4  mx-8 flex justify-center items-center rounded " +
              (tab === item ? "bg-radial-active" : "bg-radial-gray")
            }
            onClick={() => setTab(item as "All" | "Leaguemate")}
          >
            {item}
          </div>
        ))}
      </div>
      <div className="flex justify-center items-center m-16">
        <i
          className="fa-solid fa-filter text-[3rem] text-[var(--color1)]"
          onClick={() => setIsOpen(true)}
        ></i>
      </div>
      <FiltersModal isOpen={isOpen} setIsOpen={setIsOpen} />
      {tab === "All" ? (
        <AllTrades playerPickOptions={playerPickOptions} />
      ) : (
        <LeaguemateTrades playerPickOptions={playerPickOptions} />
      )}
    </div>
  );
};

export default TradesPage;
