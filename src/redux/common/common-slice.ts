import { createSlice } from "@reduxjs/toolkit";
import { Allplayer, NflState } from "@/lib/types/common-types";
import {
  fetchAllplayers,
  fetchNflState,
  fetchKtcCurrent,
} from "./common-actions";

export interface CommonState {
  nflState: NflState | null;
  allplayers: { [player_id: string]: Allplayer } | null;
  ktcCurrent: {
    latest_date: string;
    last_updated: string;
    player_values: { [player_id: string]: number };
  } | null;
  isLoadingCommon: string[];
  errorCommon: string[];
}

const initialState: CommonState = {
  nflState: null,
  allplayers: null,
  ktcCurrent: null,
  isLoadingCommon: [],
  errorCommon: [],
};

const commonSlice = createSlice({
  name: "common",
  initialState,
  reducers: {},
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
  },
});

export default commonSlice.reducer;
