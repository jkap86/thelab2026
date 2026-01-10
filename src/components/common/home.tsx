"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import logo from "../../../public/images/thelab.png";
import axiosInstance from "@/lib/axios-instance";

export default function Home({
  title,
  linkTo,
  searched,
  setSearched,
  placeholder,
  type,
}: {
  title: string;
  linkTo: string;
  searched: string;
  setSearched: (value: string) => void;
  placeholder: string;
  type: "username" | "leagueId";
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [leagues, setLeagues] = useState<{
    username: string;
    leagues: { league_id: string; name: string; avatar: string | null }[];
  }>({ username: "", leagues: [] });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearched(e.target.value.trim());
  };

  const fetchLeagues = async () => {
    const response = await axiosInstance.get("/api/common/leagues-list", {
      params: { username },
    });

    setLeagues({ username, leagues: response.data });
  };

  return (
    <div className="flex flex-col flex-1 relative">
      <Link href="/tools" className="home">
        Tools
      </Link>

      <div className="flex flex-col flex-1 items-center justify-center items-center relative">
        <Image
          src={logo}
          alt="logo"
          className="rounded-full max-h-[90%] w-[auto] opacity-30"
        />

        <div className="absolute flex flex-col items-center justify-between max-h-[90%] py-16">
          <h1 className="font-metal text-[var(--color1)] text-center text-[8rem] ![text-shadow:0_0_.5rem_red] font-black">
            The Lab
          </h1>
          <h1 className="font-metal text-yellow-600 text-center text-[6rem] ![text-shadow:0_0_.5rem_red] font-black p-4">
            {title}
          </h1>

          <div className="user-input text-[2rem] flex justify-center">
            <input
              type="text"
              value={type === "username" ? searched : username}
              placeholder={"Username"}
              onChange={
                type === "username"
                  ? handleInputChange
                  : (e) => setUsername(e.target.value.trim())
              }
              list="users"
              className="bg-[var(--color1)] opacity-80 text-center 
                outline-double outline-[var(--color1)] outline-4
                shadow-[inset_0_0_3rem_black] text-[var(--color3)]
                !text-shadow-[0_0_.1rem_black] font-chill
                font-bold p-2 contrast-[2] w-[80%] tracking-wider rounded placeholder:opacity-50"
            />

            {type === "username" ? (
              <button
                type="button"
                onClick={() => router.push(linkTo)}
                className="text-[var(--color1)] p-2 outline-double outline-[var(--color1)] outline-4 bg-[var(--color2)] font-black rounded"
              >
                Go
              </button>
            ) : (
              <button
                disabled={!username || username === leagues.username}
                type="button"
                onClick={fetchLeagues}
                className="text-[var(--color1)] text-[1rem] font-score p-2 outline-double outline-[var(--color1)] outline-4 bg-[var(--color2)] font-black rounded"
              >
                Get Leagues
              </button>
            )}
          </div>

          {type === "leagueId" && (
            <div
              className={
                "text-[2rem] flex justify-center mt-8 " +
                (username && leagues.username === username ? "" : "hidden")
              }
            >
              <select
                className={
                  "bg-[var(--color1)] outline-double outline-[var(--color1)] outline-4 contrast-[2] opacity-80 " +
                  "shadow-[inset_0_0_3rem_black] text-[var(--color3)] !text-shadow-[0_0_.1rem_black] " +
                  "font-chill  text-center max-w-[80%] tracking-wider rounded px-8 py-4 placeholder:opacity-50"
                }
                value={searched}
                onChange={(e) => setSearched(e.target.value)}
              >
                <option value="">Select a league</option>
                {leagues.leagues.map((league) => (
                  <option
                    key={league.league_id}
                    value={league.league_id}
                    className="w-full"
                  >
                    {league.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => router.push(linkTo)}
                className="text-[var(--color1)] p-2 outline-double outline-[var(--color1)] outline-4 bg-[var(--color2)] font-bold rounded"
              >
                Go
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
