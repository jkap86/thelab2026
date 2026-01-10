"use client";

import { useEffect } from "react";
import axiosInstance from "@/lib/axios-instance";
import { Pick } from "@/lib/types/picktracker-types";

const useFetchKickerPicks = (
  league_id: string,
  setPicks: ({ picks, nextPick }: { picks: Pick[]; nextPick: string }) => void
) => {
  useEffect(() => {
    const fetchKickerPicks = async () => {
      const res = await axiosInstance.get(`/api/picktracker/picks`, {
        params: {
          league_id,
        },
      });

      setPicks(res.data);
    };
    fetchKickerPicks();
  }, []);
};

export default useFetchKickerPicks;
