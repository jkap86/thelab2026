import useFetchTrades from "@/hooks/trades/useFetchTrades";
import { AppDispatch, RootState } from "@/redux/store";
import { useDispatch, useSelector } from "react-redux";
import TableTrades from "./table-trades";
import { fetchTrades } from "@/redux/trades/trades-actions";

const AllTrades = () => {
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

  useFetchTrades();

  return (
    <div>
      <TableTrades
        trades={trades?.trades || []}
        tradeCount={trades?.count}
        fetchMore={() =>
          dispatch(
            fetchTrades({
              playerId1,
              playerId2,
              playerId3,
              playerId4,
              leagueType1,
              offset: trades?.trades.length || 0,
            })
          )
        }
      />
    </div>
  );
};

export default AllTrades;
