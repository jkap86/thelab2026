import {
  Reject,
  Allplayer,
  NflState,
  PlayerADP,
  ADPFilters,
} from "@/lib/types/common-types";
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

export const fetchADP = createAsyncThunk<
  Record<string, PlayerADP>,
  { key: string; filters?: ADPFilters; signal?: AbortSignal },
  { rejectValue: Reject }
>("common/fetchADP", async ({ filters, signal }, { rejectWithValue }) => {
  try {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.leagueType) params.set("leagueType", filters.leagueType);
      if (filters.draftType) params.set("draftType", filters.draftType);
      if (filters.playerType) params.set("playerType", filters.playerType);
      if (filters.rosterSlots) params.set("rosterSlots", filters.rosterSlots);
      if (filters.scoring) params.set("scoring", filters.scoring);
      if (filters.superflex) params.set("superflex", "true");
    }

    const queryString = params.toString();
    const url = `/api/common/adp${queryString ? `?${queryString}` : ""}`;

    const response: { data: PlayerADP[] } = await axiosInstance.get(url, {
      signal,
    });

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
      message: (error as AxiosError).message ?? "Failed to fetch ADP",
    });
  }
});
