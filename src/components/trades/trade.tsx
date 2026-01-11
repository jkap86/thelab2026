import { Trade as TradeType } from "@/lib/types/trades-types";
const Trade = ({
  trade,
  activeTrade,
  setActiveTrade,
}: {
  trade: TradeType;
  activeTrade: string | null;
  setActiveTrade: (transaction_id: string) => void;
}) => {
  return <div></div>;
};

export default Trade;
