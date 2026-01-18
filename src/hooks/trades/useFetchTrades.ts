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
    leaguemateIds,
    playerId1,
    playerId2,
    playerId3,
    playerId4,
    leagueType1,
    leagueType2,
  } = useSelector((state: RootState) => state.trades);

  useEffect(() => {
    if (
      (trades &&
        trades.playerId1 === playerId1 &&
        trades.playerId2 === playerId2 &&
        trades.playerId3 === playerId3 &&
        trades.playerId4 === playerId4 &&
        trades.leagueType1 === leagueType1 &&
        trades.leagueType2 === leagueType2) ||
      isLoadingTrades ||
      errorTrades
    )
      return;

    dispatch(
      fetchTrades({
        managers: leaguemateIds.length > 0 ? leaguemateIds : undefined,
        playerId1,
        playerId2,
        playerId3,
        playerId4,
        leagueType1,
        leagueType2,
        offset: 0,
      })
    );
  }, [
    trades,
    isLoadingTrades,
    errorTrades,
    leaguemateIds,
    playerId1,
    playerId2,
    playerId3,
    playerId4,
    leagueType1,
    leagueType2,
    dispatch,
  ]);
}
