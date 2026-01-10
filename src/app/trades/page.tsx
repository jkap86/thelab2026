"use client";

import AllTrades from "@/components/trades/all-trades";
import FiltersModal from "@/components/trades/filters-modal";
import LeaguemateTrades from "@/components/trades/leaguemate-trades";
import Link from "next/link";
import { useState } from "react";

const TradesPage = () => {
  const [tab, setTab] = useState<"All" | "Leaguemate">("All");
  const [isOpen, setIsOpen] = useState(false);

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
      {tab === "All" ? <AllTrades /> : <LeaguemateTrades />}
    </div>
  );
};

export default TradesPage;
