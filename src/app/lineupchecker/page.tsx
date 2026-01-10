"use client";

import Home from "@/components/common/home";
import { useState } from "react";

const LineupCheckerPage = () => {
  const [searched, setSearched] = useState("");

  return (
    <Home
      title="Lineup Checker"
      linkTo={`/lineupchecker/${searched}/matchups`}
      searched={searched}
      setSearched={setSearched}
      placeholder="Username"
    />
  );
};

export default LineupCheckerPage;
