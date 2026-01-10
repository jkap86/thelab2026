"use client";

import Home from "@/components/common/home";
import { useState } from "react";

const PickTrackerHomepage = () => {
  const [searched, setSearched] = useState("");

  return (
    <Home
      title="Pick Tracker"
      linkTo={`/picktracker/${searched}`}
      searched={searched}
      setSearched={setSearched}
      placeholder="League ID"
    />
  );
};

export default PickTrackerHomepage;
