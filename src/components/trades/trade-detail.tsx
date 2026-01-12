import { Trade as TradeType } from "@/lib/types/trades-types";
import { RootState } from "@/redux/store";
import { useSelector } from "react-redux";
import TableMain from "../common/table-main";
import League from "../manager/league";

const TradeDetail = ({ trade }: { trade: TradeType }) => {
  const { ktcCurrent, allplayers } = useSelector(
    (state: RootState) => state.common
  );

  return (
    <div>
      <League
        type={2}
        league={{
          ...trade.league,
          rosters: trade.rosters,
        }}
      />
    </div>
  );
};

export default TradeDetail;
