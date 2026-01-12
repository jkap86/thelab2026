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

  const itemsPerPage = 20;

  const pageNumbers = (
    <PageNumbers
      data={trades.map((trade) => ({ id: trade.transaction_id, columns: [] }))}
      itemsPerPage={itemsPerPage}
      page={page}
      setPage={setPage}
      count={tradeCount}
      fetchMore={fetchMore}
    />
  );

  return (
    <div>
      {tradeCount && (
        <h2 className="text-[1.5rem] font-score m-8 text-[var(--color7)]">
          {tradeCount} trades
        </h2>
      )}
      {pageNumbers}
      <table className="!border-spacing-[.25rem]">
        {trades
          .slice(
            (page - 1) * itemsPerPage,
            (page - 1) * itemsPerPage + itemsPerPage
          )
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
