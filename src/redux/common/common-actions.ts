import { Reject, Allplayer, NflState } from "@/lib/types/common-types";
import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "@/lib/axios-instance";
import { AxiosError } from "axios";

export const fetchAllplayers = createAsyncThunk<
  Record<string, Allplayer>,
  { signal?: AbortSignal },
  { rejectValue: Reject }
>("common/fetchAllplayers", async ({ signal }, { rejectWithValue }) => {
  try {
    const response: { data: Allplayer[] } = await axiosInstance.get(
      "/api/common/allplayers",
      { signal }
    );

    return Object.fromEntries(
      response.data.map((player) => [player.player_id, player])
    );
  } catch (error: unknown) {
    if (["AbortError", "CanceledError"].includes((error as AxiosError).name)) {
      return rejectWithValue({
        message: "__ABORTED__",
      });
    }

    return rejectWithValue({
      message: (error as AxiosError).message ?? "Failed to fetch allplayers",
    });
  }
});

export const fetchNflState = createAsyncThunk<
  NflState,
  { signal?: AbortSignal },
  { rejectValue: Reject }
>("common/fetchNflState", async ({ signal }, { rejectWithValue }) => {
  try {
    const response: { data: NflState } = await axiosInstance.get(
      "/api/common/nflstate",
      { signal }
    );

    return response.data;
  } catch (error: unknown) {
    if (["AbortError", "CanceledError"].includes((error as AxiosError).name)) {
      return rejectWithValue({
        message: "__ABORTED__",
      });
    }
    return rejectWithValue({
      message: (error as AxiosError).message ?? "Failed to fetch nflstate",
    });
  }
});

export const fetchKtcCurrent = createAsyncThunk<
  {
    latest_date: string;
    last_updated: string;
    player_values: Record<string, number>;
  },
  { signal?: AbortSignal },
  { rejectValue: Reject }
>("common/fetchKtcCurrent", async ({ signal }, { rejectWithValue }) => {
  try {
    const response: {
      data: {
        latest_date: string;
        last_updated: string;
        player_values: [string, number][];
      };
    } = await axiosInstance.get("/api/common/ktc/current", {
      signal,
    });

    const { latest_date, last_updated, player_values } = response.data;

    return {
      latest_date,
      last_updated,
      player_values: Object.fromEntries(player_values),
    };
  } catch (error: unknown) {
    if (["AbortError", "CanceledError"].includes((error as AxiosError).name)) {
      return rejectWithValue({
        message: "__ABORTED__",
      });
    }
    return rejectWithValue({
      message: (error as AxiosError).message ?? "Failed to fetch ktc current",
    });
  }
});
