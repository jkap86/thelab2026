"use client";

import Home from "@/components/common/home";
import { useState } from "react";

const PlayoffsPage = () => {
  const [searched, setSearched] = useState("");

  return (
    <Home
      title="Playoffs Scoring"
      linkTo={`/playoffs/${searched}`}
      searched={searched}
      setSearched={setSearched}
      placeholder="League ID"
      type="leagueId"
    />
  );
};

export default PlayoffsPage;
