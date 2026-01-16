import { Reject } from "@/lib/types/common-types";
import { User, League, PlayerShare } from "@/lib/types/manager-types";
import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "@/lib/axios-instance";
import { getLeagueTotals } from "@/utils/manager/get-leagues-totals";

export const fetchUser = createAsyncThunk<
  User,
  { searched: string; signal?: AbortSignal },
  { rejectValue: Reject }
>("manager/fetchUser", async ({ searched, signal }, { rejectWithValue }) => {
  try {
    const response: { data: User } = await axiosInstance.get(
      "/api/manager/user",
      {
        params: { searched },
        signal,
      }
    );

    return response.data;
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
});

export const fetchLeagues = createAsyncThunk<
  {
    leagues: { [league_id: string]: League };
    playershares: { [player_id: string]: PlayerShare };
    leaguemates: {
      [lm_user_id: string]: Omit<User, "type"> & { leagues: string[] };
    };
  },
  { user_id: string; week: number; signal?: AbortSignal },
  { rejectValue: Reject }
>(
  "manager/fetchLeagues",
  async ({ user_id, week, signal }, { dispatch, rejectWithValue }) => {
    try {
      const response = await fetch(
        `/api/manager/leagues?user_id=${user_id}&week=${week}`,
        {
          method: "GET",
          headers: { Accept: "application/x-ndjson, application/json" },
          signal,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch leagues");
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error("Failed to get reader");
      }

      const decoder = new TextDecoder();

      let data = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        if (value) {
          data += decoder.decode(value, { stream: true });
        }

        const matches = data.match(/\{"league_id":/g);

        if (matches) {
          dispatch({
            type: "manager/updateLeaguesProgress",
            payload: matches.length,
          });
        }
      }

      const dataArray = data.split("\n");

      const parsedLeaguesArray: League[] = [];

      dataArray
        .filter((item) => item !== "")
        .forEach((item) => {
          parsedLeaguesArray.push(JSON.parse(item));
        });

      const leagues = Object.fromEntries(
        parsedLeaguesArray.map((league) => [league.league_id, league])
      );

      console.log({ leagues });

      const { playershares, leaguemates } = getLeagueTotals(
        Object.values(leagues)
      );

      return { leagues, playershares, leaguemates };
    } catch (error: unknown) {
      if (["AbortError", "CanceledError"].includes((error as Error).name)) {
        return rejectWithValue({
          message: "__ABORTED__",
        });
      }

      return rejectWithValue({
        message: (error as Error).message ?? "Failed to fetch leagues",
      });
    }
  }
);
