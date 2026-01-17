import { createSlice } from "@reduxjs/toolkit";
import {
  Allplayer,
  NflState,
  PlayerADP,
  ADPFilters,
} from "@/lib/types/common-types";
import {
  fetchAllplayers,
  fetchNflState,
  fetchKtcCurrent,
  fetchADP,
} from "./common-actions";

export const serializeFilters = (filters?: ADPFilters): string => {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.leagueType) params.set("leagueType", filters.leagueType);
  if (filters.draftType) params.set("draftType", filters.draftType);
  if (filters.playerType) params.set("playerType", filters.playerType);
  if (filters.rosterSlots) params.set("rosterSlots", filters.rosterSlots);
  if (filters.scoring) params.set("scoring", filters.scoring);
  params.sort();
  return params.toString();
};

export interface CommonState {
  nflState: NflState | null;
  allplayers: { [player_id: string]: Allplayer } | null;
  ktcCurrent: {
    latest_date: string;
    last_updated: string;
    player_values: { [player_id: string]: number };
  } | null;
  adp: Record<string, Record<string, PlayerADP>>;
  isLoadingCommon: string[];
  errorCommon: string[];
}

const initialState: CommonState = {
  nflState: null,
  allplayers: null,
  ktcCurrent: null,
  adp: {},
  isLoadingCommon: [],
  errorCommon: [],
};

const commonSlice = createSlice({
  name: "common",
  initialState,
  reducers: {
    clearAdpCache: (state) => {
      state.adp = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllplayers.pending, (state) => {
        state.isLoadingCommon.push("allplayers");
        state.errorCommon = state.errorCommon.filter(
          (item) => item !== "allplayers"
        );
      })
      .addCase(fetchAllplayers.fulfilled, (state, action) => {
        state.allplayers = action.payload;

        state.isLoadingCommon = state.isLoadingCommon.filter(
          (item) => item !== "allplayers"
        );
      })
      .addCase(fetchAllplayers.rejected, (state, action) => {
        state.isLoadingCommon = state.isLoadingCommon.filter(
          (item) => item !== "allplayers"
        );

        if (action.payload?.message === "__ABORTED__") return;

        state.errorCommon.push("allplayers");
      });

    builder
      .addCase(fetchNflState.pending, (state) => {
        state.isLoadingCommon.push("nflState");
        state.errorCommon = state.errorCommon.filter(
          (item) => item !== "nflState"
        );
      })
      .addCase(fetchNflState.fulfilled, (state, action) => {
        state.nflState = action.payload;

        state.isLoadingCommon = state.isLoadingCommon.filter(
          (item) => item !== "nflState"
        );
      })
      .addCase(fetchNflState.rejected, (state, action) => {
        state.isLoadingCommon = state.isLoadingCommon.filter(
          (item) => item !== "nflState"
        );

        if (action.payload?.message === "__ABORTED__") return;

        state.errorCommon.push("nflState");
      });

    builder
      .addCase(fetchKtcCurrent.pending, (state) => {
        state.isLoadingCommon.push("ktcCurrent");
        state.errorCommon = state.errorCommon.filter(
          (item) => item !== "ktcCurrent"
        );
      })
      .addCase(fetchKtcCurrent.fulfilled, (state, action) => {
        state.ktcCurrent = action.payload;

        state.isLoadingCommon = state.isLoadingCommon.filter(
          (item) => item !== "ktcCurrent"
        );
      })
      .addCase(fetchKtcCurrent.rejected, (state, action) => {
        state.isLoadingCommon = state.isLoadingCommon.filter(
          (item) => item !== "ktcCurrent"
        );
        if (action.payload?.message === "__ABORTED__") return;

        state.errorCommon.push("ktcCurrent");
      });

    builder
      .addCase(fetchADP.pending, (state) => {
        state.isLoadingCommon.push("adp");
        state.errorCommon = state.errorCommon.filter(
          (item) => item !== "adp"
        );
      })
      .addCase(fetchADP.fulfilled, (state, action) => {
        state.adp[action.meta.arg.key] = action.payload;

        state.isLoadingCommon = state.isLoadingCommon.filter(
          (item) => item !== "adp"
        );
      })
      .addCase(fetchADP.rejected, (state, action) => {
        state.isLoadingCommon = state.isLoadingCommon.filter(
          (item) => item !== "adp"
        );

        if (action.payload?.message === "__ABORTED__") return;

        state.errorCommon.push("adp");
      });
  },
});

export const { clearAdpCache } = commonSlice.actions;
export default commonSlice.reducer;
