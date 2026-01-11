import { AppDispatch, RootState } from "@/redux/store";
import { fetchTrades } from "@/redux/trades/trades-actions";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

export default function useFetchTrades() {
  const dispatch: AppDispatch = useDispatch();
  const {
    trades,
    isLoadingTrades,
    errorTrades,
    playerId1,
    playerId2,
    playerId3,
    playerId4,
    leagueType1,
  } = useSelector((state: RootState) => state.trades);

  useEffect(() => {
    if (trades || isLoadingTrades || errorTrades) return;

    dispatch(
      fetchTrades({
        playerId1,
        playerId2,
        playerId3,
        playerId4,
        leagueType1,
        offset: 0,
        limit: 100,
      })
    );
  }, [
    trades,
    isLoadingTrades,
    errorTrades,
    playerId1,
    playerId2,
    playerId3,
    playerId4,
    leagueType1,
    dispatch,
  ]);
}
