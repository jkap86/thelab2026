import axiosInstance from "@/lib/axios-instance";
import { Reject } from "@/lib/types/common-types";
import { Trade } from "@/lib/types/trades-types";
import { createAsyncThunk } from "@reduxjs/toolkit";

export const fetchTrades = createAsyncThunk<
  {
    trades: Trade[];
    count: number;
    playerId1: string | undefined;
    playerId2: string | undefined;
    playerId3: string | undefined;
    playerId4: string | undefined;
    leagueType1: string;
    leagueType2: string;
  },
  {
    playerId1: string | undefined;
    playerId2: string | undefined;
    playerId3: string | undefined;
    playerId4: string | undefined;
    leagueType1: string;
    leagueType2: string;
    offset: number;

    signal?: AbortSignal;
  },
  { rejectValue: Reject }
>(
  "trades/fetchTrades",
  async (
    {
      playerId1,
      playerId2,
      playerId3,
      playerId4,
      leagueType1,
      leagueType2,
      offset,
      signal,
    },
    { rejectWithValue }
  ) => {
    try {
      const response: { data: { trades: Trade[]; count: number } } =
        await axiosInstance.get("/api/trades", {
          params: {
            playerId1,
            playerId2,
            playerId3,
            playerId4,
            leagueType1,
            leagueType2,
            offset,
            limit: 100,
          },
          signal,
        });

      return {
        ...response.data,
        playerId1,
        playerId2,
        playerId3,
        playerId4,
        leagueType1,
        leagueType2,
      };
    } catch (error: unknown) {
      if (["AbortError", "CanceledError"].includes((error as Error).name)) {
        return rejectWithValue({
          message: "__ABORTED__",
        });
      }
      return rejectWithValue({
        message: (error as Error).message ?? "Failed to fetch user",
      });
    }
  }
);
