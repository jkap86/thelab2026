import { Trade } from "@/lib/types/trades-types";
import { createSlice } from "@reduxjs/toolkit";

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
  };
  errorTrades: string | null;
}

const initialState: TradesState = {
  isLoadingTrades: false,
  trades: {
    playerId1: undefined,
    playerId2: undefined,
    playerId3: undefined,
    playerId4: undefined,
    leagueType1: "",
    count: 0,
    trades: [],
  },
  errorTrades: null,
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
});

export const { upateTradesState } = tradesSlice.actions;

export default tradesSlice.reducer;
