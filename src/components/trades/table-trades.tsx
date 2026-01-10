import { Trade as TradeType } from "@/lib/types/trades-types";
import PageNumbers from "../common/page-numbers";
import { useState } from "react";

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

  const pageNumbers = (
    <PageNumbers data={[]} itemsPerPage={15} page={page} setPage={setPage} />
  );
};

export default TableTrades;
