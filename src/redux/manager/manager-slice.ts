import { League, PlayerShare, User } from "@/lib/types/manager-types";
import { createSlice } from "@reduxjs/toolkit";
import { fetchUser, fetchLeagues } from "./manager-actions";

export interface ManagerState {
  type1: "Redraft" | "All" | "Dynasty";
  type2: "Bestball" | "All" | "Lineup";

  isLoadingUser: boolean;
  errorUser: string;
  user: User | null;

  isLoadingLeagues: boolean;
  errorLeagues: string;
  leagues: { [league_id: string]: League } | null;
  leaguesProgress: number;

  playerShares: { [player_id: string]: PlayerShare };
  leaguemates: {
    [lm_user_id: string]: Omit<User, "type"> & { leagues: string[] };
  };

  tabs: {
    leagues: {
      column1: string;
      column2: string;
      column3: string;
      column4: string;
      sortBy: {
        column: number;
        direction: "asc" | "desc";
      };
    };
    players: {
      column1: string;
      column2: string;
      column3: string;
      column4: string;
      sortBy: {
        column: number;
        direction: "asc" | "desc";
      };
      positionFilter: string;
      teamFilter: string;
      draftClassFilter: string;
    };
    teams: {
      column1: string;
      column2: string;
      sortBy: {
        column: number;
        direction: "asc" | "desc";
      };
    };
    roster: {
      column1: string;
      column2: string;
      sortBy: {
        column: number;
        direction: "asc" | "desc";
      };
    };
    playerLeagues: {
      tab: "Owned" | "Taken" | "Available";
      ownedAvailableColumn1: string;
      ownedAvailableColumn2: string;
      ownedAvailableColumn3: string;
      ownedAvailableColumn4: string;
      takenColumn1: string;
      takenColumn2: string;
      sortBy: {
        column: number;
        direction: "asc" | "desc";
      };
    };
  };
}

const initialState: ManagerState = {
  type1: "All",
  type2: "All",

  isLoadingUser: false,
  errorUser: "",
  user: null,

  isLoadingLeagues: false,
  errorLeagues: "",
  leagues: null,
  leaguesProgress: 0,

  playerShares: {},
  leaguemates: {},

  tabs: {
    leagues: {
      column1: "KTC S Rk",
      column2: "KTC B Rk",
      column3: "KTC QB S Rk",
      column4: "KTC QB B Rk",
      sortBy: {
        column: 0,
        direction: "asc",
      },
    },
    players: {
      column1: "# Own",
      column2: "KTC D",
      column3: "ADP D",
      column4: "ADP R",
      sortBy: {
        column: 1,
        direction: "desc",
      },
      positionFilter: "Players",
      teamFilter: "All",
      draftClassFilter: "All",
    },
    teams: {
      column1: "KTC S",
      column2: "KTC B",
      sortBy: {
        column: 2,
        direction: "desc",
      },
    },
    roster: {
      column1: "KTC",
      column2: "Age",
      sortBy: {
        column: 2,
        direction: "desc",
      },
    },
    playerLeagues: {
      tab: "Owned",
      ownedAvailableColumn1: "KTC S Rk",
      ownedAvailableColumn2: "KTC B Rk",
      ownedAvailableColumn3: "KTC QB S Rk",
      ownedAvailableColumn4: "KTC QB B Rk",
      takenColumn1: "KTC S Rk",
      takenColumn2: "Lm KTC S Rk",
      sortBy: {
        column: 0,
        direction: "asc",
      },
    },
  },
};

const managerSlice = createSlice({
  name: "manager",
  initialState,
  reducers: {
    setType1: (state, action) => {
      state.type1 = action.payload;
    },
    setType2: (state, action) => {
      state.type2 = action.payload;
    },
    resetUserAndLeagues(state) {
      state.user = null;
      state.leagues = null;
      state.leaguesProgress = 0;
    },
    updateLeaguesProgress(state, action) {
      state.leaguesProgress = action.payload;
    },
    resetLeaguesProgress(state) {
      state.leaguesProgress = 0;
    },
    setLeaguesTabState(state, action) {
      state.tabs.leagues = {
        ...state.tabs.leagues,
        [action.payload.key]: action.payload.value,
      };
    },
    setPlayersTabState(state, action) {
      state.tabs.players = {
        ...state.tabs.players,
        [action.payload.key]: action.payload.value,
      };
    },
    setTeamsTabState(state, action) {
      state.tabs.teams = {
        ...state.tabs.teams,
        [action.payload.key]: action.payload.value,
      };
    },
    setRosterTabState(state, action) {
      state.tabs.roster = {
        ...state.tabs.roster,
        [action.payload.key]: action.payload.value,
      };
    },
    setPlayerLeaguesTabState(state, action) {
      state.tabs.playerLeagues = {
        ...state.tabs.playerLeagues,
        [action.payload.key]: action.payload.value,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.isLoadingUser = true;
        state.errorUser = "";
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isLoadingUser = false;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.isLoadingUser = false;
        if (action.payload?.message === "__ABORTED__") return;

        state.errorUser = action.payload?.message ?? "Failed to fetch user";
      });

    builder
      .addCase(fetchLeagues.pending, (state) => {
        state.isLoadingLeagues = true;
        state.errorLeagues = "";
      })
      .addCase(fetchLeagues.fulfilled, (state, action) => {
        state.leagues = action.payload.leagues;
        state.playerShares = action.payload.playershares;
        state.leaguemates = action.payload.leaguemates;
        state.isLoadingLeagues = false;
      })
      .addCase(fetchLeagues.rejected, (state, action) => {
        state.isLoadingLeagues = false;
        if (action.payload?.message === "__ABORTED__") return;

        state.errorLeagues =
          action.payload?.message ?? "Failed to fetch leagues";
      });
  },
});

export const {
  setType1,
  setType2,
  resetUserAndLeagues,
  updateLeaguesProgress,
  resetLeaguesProgress,
  setLeaguesTabState,
  setPlayersTabState,
  setTeamsTabState,
  setRosterTabState,
  setPlayerLeaguesTabState,
} = managerSlice.actions;

export default managerSlice.reducer;
