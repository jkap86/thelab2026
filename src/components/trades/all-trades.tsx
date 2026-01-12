import useFetchTrades from "@/hooks/trades/useFetchTrades";
import { AppDispatch, RootState } from "@/redux/store";
import { useDispatch, useSelector } from "react-redux";
import TableTrades from "./table-trades";
import { fetchTrades } from "@/redux/trades/trades-actions";
import Search from "../common/search";
import { updateTradesState } from "@/redux/trades/trades-slice";
import { SearchOption } from "@/lib/types/common-types";
import LoadingIcon from "../common/loading-icon";

const AllTrades = ({
  playerPickOptions,
}: {
  playerPickOptions: SearchOption[];
}) => {
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

  const searches = (
    <div>
      <div className="flex justify-evenly">
        <div className=" m-auto">
          <Search
            searched={playerId1 ?? ""}
            setSearched={(value) =>
              dispatch(updateTradesState({ key: "playerId1", value }))
            }
            options={playerPickOptions}
            placeholder="Player"
          />
        </div>

        <div className="w-fit m-auto">
          <Search
            searched={playerId2 ?? ""}
            setSearched={(value) =>
              dispatch(updateTradesState({ key: "playerId2", value }))
            }
            options={playerPickOptions}
            placeholder="Player 2"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {searches}
      {playerId1 === trades?.playerId1 &&
      playerId2 === trades?.playerId2 &&
      playerId3 === trades?.playerId3 &&
      playerId4 === trades?.playerId4 &&
      leagueType1 === trades?.leagueType1 &&
      !isLoadingTrades &&
      !errorTrades ? (
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
                offset: trades?.trades.length || 0,
              })
            )
          }
        />
      ) : isLoadingTrades ? (
        <LoadingIcon />
      ) : (
        errorTrades
      )}
    </div>
  );
};

export default AllTrades;
