"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import logo from "../../../public/images/thelab.png";

export default function Home({
  title,
  linkTo,
  searched,
  setSearched,
  placeholder,
}: {
  title: string;
  linkTo: string;
  searched: string;
  setSearched: (value: string) => void;
  placeholder: string;
}) {
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearched(e.target.value.trim());
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
              value={searched}
              placeholder={placeholder}
              onChange={handleInputChange}
              list="users"
              className="bg-[var(--color1)] opacity-80 text-center 
                outline-double outline-[var(--color1)] outline-4
                shadow-[inset_0_0_3rem_black] text-[var(--color2)]
                font-bold p-2 contrast-[2] w-[80%] tracking-wider rounded placeholder:opacity-50"
            />

            <button
              type="button"
              onClick={() => router.push(linkTo)}
              className="text-[var(--color1)] p-4 outline-double outline-[var(--color1)] outline-4 bg-[var(--color2)] font-black rounded"
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
