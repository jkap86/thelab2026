import { Trade } from "@/lib/types/trades-types";
import { createSlice } from "@reduxjs/toolkit";
import { fetchLeaguemates } from "./leaguemates-actions";
import { fetchTrades } from "./trades-actions";

export interface TradesState {
  isLoadingTrades: boolean;
  isLoadingLeaguemates: boolean;

  trades: {
    managers: string[] | undefined;
    playerId1: string | undefined;
    playerId2: string | undefined;
    playerId3: string | undefined;
    playerId4: string | undefined;
    leagueType1: string;
    leagueType2: string;
    count: number;
    trades: Trade[];
  } | null;
  errorTrades: string | null;

  username: string | undefined;
  leaguemateIds: string[];
  playerId1: string | undefined;
  playerId2: string | undefined;
  playerId3: string | undefined;
  playerId4: string | undefined;
  leagueType1: string;
  leagueType2: string;
}

const initialState: TradesState = {
  isLoadingTrades: false,
  isLoadingLeaguemates: false,
  trades: null,
  errorTrades: null,

  username: undefined,
  leaguemateIds: [],
  playerId1: undefined,
  playerId2: undefined,
  playerId3: undefined,
  playerId4: undefined,
  leagueType1: "All",
  leagueType2: "All",
};

const tradesSlice = createSlice({
  name: "trades",
  initialState,
  reducers: {
    updateTradesState: (state, action) => {
      return (state = {
        ...state,
        [action.payload.key]: action.payload.value,
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeaguemates.pending, (state) => {
        state.isLoadingLeaguemates = true;
      })
      .addCase(fetchLeaguemates.fulfilled, (state, action) => {
        state.isLoadingLeaguemates = false;
        state.username = action.payload.username;
        state.leaguemateIds = action.payload.leaguemateIds;
      })
      .addCase(fetchLeaguemates.rejected, (state) => {
        state.isLoadingLeaguemates = false;
      })
      .addCase(fetchTrades.pending, (state) => {
        state.isLoadingTrades = true;
        state.errorTrades = null;
      })
      .addCase(fetchTrades.fulfilled, (state, action) => {
        state.isLoadingTrades = false;
        state.errorTrades = null;

        if (
          state.trades &&
          state.trades.playerId1 === action.payload.playerId1 &&
          state.trades.playerId2 === action.payload.playerId2 &&
          state.trades.playerId3 === action.payload.playerId3 &&
          state.trades.playerId4 === action.payload.playerId4 &&
          state.trades.leagueType1 === action.payload.leagueType1 &&
          state.trades.leagueType2 === action.payload.leagueType2
        ) {
          state.trades.trades = [
            ...state.trades.trades,
            ...action.payload.trades.filter(
              (trade) =>
                !state.trades?.trades.some(
                  (t) => t.transaction_id === trade.transaction_id
                )
            ),
          ];
        } else {
          state.trades = action.payload;
        }
      })
      .addCase(fetchTrades.rejected, (state, action) => {
        state.isLoadingTrades = false;

        if (action.payload?.message === "__ABORTED__") return;

        state.errorTrades = action.payload?.message ?? "Failed to fetch trades";
      });
  },
});

export const { updateTradesState } = tradesSlice.actions;

export default tradesSlice.reducer;
