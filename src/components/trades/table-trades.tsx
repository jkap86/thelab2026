import { Trade as TradeType } from "@/lib/types/trades-types";
import PageNumbers from "../common/page-numbers";
import { useState, useEffect } from "react";
import Trade from "./trade";

const TableTrades = ({
  trades,
  tradeCount,
  fetchMore,
}: {
  trades: TradeType[];
  tradeCount: number | undefined;
  fetchMore: () => void;
}) => {
  const [page, setPage] = useState(1);
  const [activeTrade, setActiveTrade] = useState<string | null>(null);

  useEffect(() => {
    setPage(Math.max(Math.max(Math.ceil((trades.length - 1) / 25), 5) - 4, 1));
  }, [trades]);

  const pageNumbers = (
    <PageNumbers data={[]} itemsPerPage={15} page={page} setPage={setPage} />
  );

  return (
    <div>
      {tradeCount && <h2>{tradeCount} trades</h2>}
      {pageNumbers}
      <table>
        {trades
          .slice((page - 1) * 25, (page - 1) * 25 + 25)
          .map((trade, index) => (
            <tbody key={trade.transaction_id}>
              <tr>
                <td>
                  <Trade
                    trade={trade}
                    activeTrade={activeTrade}
                    setActiveTrade={setActiveTrade}
                  />
                </td>
              </tr>
            </tbody>
          ))}
      </table>
      {pageNumbers}
    </div>
  );
};

export default TableTrades;
