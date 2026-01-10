import { combineReducers } from "@reduxjs/toolkit";
import commonSlice from "./common/common-slice";
import managerSlice from "./manager/manager-slice";

const rootReducer = combineReducers({
  common: commonSlice,
  manager: managerSlice,
});

export default rootReducer;
