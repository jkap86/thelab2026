"use client";

import { useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import axiosInstance from "@/lib/axios-instance";
import { League } from "@/lib/types/manager-types";

export default function useFetchLeague(
  league_id: string,
  setLeague: (league: League) => void
) {
  const { allplayers } = useSelector((state: RootState) => state.common);

  useEffect(() => {
    if (allplayers) {
      const fetchLeague = async () => {
        const res = await axiosInstance.get(`/api/common/league`, {
          params: {
            league_id,
          },
        });

        setLeague(res.data);
      };
      fetchLeague();
    }
  }, [allplayers]);
}
