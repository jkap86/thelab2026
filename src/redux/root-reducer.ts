import { combineReducers } from "@reduxjs/toolkit";
import commonSlice from "./common/common-slice";
import managerSlice from "./manager/manager-slice";
import tradesSlice from "./trades/trades-slice";

const rootReducer = combineReducers({
  common: commonSlice,
  manager: managerSlice,
  trades: tradesSlice,
});

export default rootReducer;
