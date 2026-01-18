import axiosInstance from "@/lib/axios-instance";
import { Reject } from "@/lib/types/common-types";
import { createAsyncThunk } from "@reduxjs/toolkit";

export const fetchLeaguemates = createAsyncThunk<
  { leaguemateIds: string[]; username: string },
  { username: string },
  { rejectValue: Reject }
>(
  "trades/fetchLeaguemates",
  async ({ username }, { rejectWithValue }) => {
    try {
      const response: { data: { leaguemateIds: string[]; username: string } } =
        await axiosInstance.get("/api/leaguemates", {
          params: { username },
        });

      return response.data;
    } catch (error: unknown) {
      return rejectWithValue({
        message: (error as Error).message ?? "Failed to fetch leaguemates",
      });
    }
  }
);
