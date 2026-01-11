import { Trade } from "@/lib/types/trades-types";
import { createSlice } from "@reduxjs/toolkit";
import { fetchTrades } from "./trades-actions";

export interface TradesState {
  isLoadingTrades: boolean;
  trades: {
    playerId1: string | undefined;
    playerId2: string | undefined;
    playerId3: string | undefined;
    playerId4: string | undefined;
    leagueType1: string;
    count: number;
    trades: Trade[];
  } | null;
  errorTrades: string | null;

  playerId1: string | undefined;
  playerId2: string | undefined;
  playerId3: string | undefined;
  playerId4: string | undefined;
  leagueType1: string;
}

const initialState: TradesState = {
  isLoadingTrades: false,
  trades: null,
  errorTrades: null,

  playerId1: undefined,
  playerId2: undefined,
  playerId3: undefined,
  playerId4: undefined,
  leagueType1: "All",
};

const tradesSlice = createSlice({
  name: "trades",
  initialState,
  reducers: {
    upateTradesState: (state, action) => {
      state = {
        ...state,
        [action.payload.key]: action.payload.value,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrades.pending, (state) => {
        state.isLoadingTrades = true;
        state.errorTrades = null;
      })
      .addCase(fetchTrades.fulfilled, (state, action) => {
        state.isLoadingTrades = false;
        state.trades = action.payload;
      })
      .addCase(fetchTrades.rejected, (state, action) => {
        state.isLoadingTrades = false;

        if (action.payload?.message === "__ABORTED__") return;

        state.errorTrades = action.payload?.message ?? "Failed to fetch trades";
      });
  },
});

export const { upateTradesState } = tradesSlice.actions;

export default tradesSlice.reducer;
