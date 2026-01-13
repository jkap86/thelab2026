import useFetchTrades from "@/hooks/trades/useFetchTrades";
import { AppDispatch, RootState } from "@/redux/store";
import { useDispatch, useSelector } from "react-redux";
import TableTrades from "./table-trades";
import { fetchTrades } from "@/redux/trades/trades-actions";
import { SearchOption } from "@/lib/types/common-types";

const AllTrades = ({
  playerPickOptions,
}: {
  playerPickOptions: SearchOption[];
}) => {
  const dispatch: AppDispatch = useDispatch();
  const {
    trades,
    playerId1,
    playerId2,
    playerId3,
    playerId4,
    leagueType1,
    leagueType2,
  } = useSelector((state: RootState) => state.trades);

  return (
    <div>
      <TableTrades
        trades={trades?.trades ?? []}
        tradeCount={trades?.count ?? 0}
        fetchMore={() =>
          dispatch(
            fetchTrades({
              playerId1,
              playerId2,
              playerId3,
              playerId4,
              leagueType1,
              leagueType2,
              offset: trades?.trades.length || 0,
            })
          )
        }
      />
    </div>
  );
};

export default AllTrades;
