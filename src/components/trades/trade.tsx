import { Trade as TradeType } from "@/lib/types/trades-types";
import { RootState } from "@/redux/store";
import { useSelector } from "react-redux";
import Avatar from "../common/avatar";
import {
  getDraftPickId,
  getDraftPickKtcName,
} from "@/utils/common/format-draftpick";
import { getTextColor } from "@/utils/common/get-text-color";
import { ktcMinMax } from "@/utils/common/min-max-values";
const Trade = ({
  trade,
  activeTrade,
  setActiveTrade,
}: {
  trade: TradeType;
  activeTrade: string | null;
  setActiveTrade: (transaction_id: string | null) => void;
}) => {
  const { ktcCurrent, allplayers } = useSelector(
    (state: RootState) => state.common
  );

  const ktc = ktcCurrent?.player_values ?? {};

  const managers = Array.from(
    new Set([
      ...Object.values(trade.adds),
      ...Object.values(trade.drops),
      ...trade.draft_picks.flatMap((dp) => [dp.new, dp.old]),
    ])
  );

  const bg =
    activeTrade === trade.transaction_id
      ? "bg-radial-active "
      : "bg-radial-table1 ";

  return (
    <table
      className={
        "h-[5rem] text-[1.5rem] font-chill " +
        bg +
        "outline-double outline-1 outline-[silver]"
      }
      onClick={() =>
        setActiveTrade(
          activeTrade === trade.transaction_id ? null : trade.transaction_id
        )
      }
    >
      <tbody>
        <tr className={"h-[5rem]"}>
          <td colSpan={7} className="font-score text-[1.25rem]">
            <div className="flex justify-evenly">
              {new Date(trade.status_updated).toLocaleDateString("en-US", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
              })}

              <em>
                {new Date(trade.status_updated).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "numeric",
                })}
              </em>
            </div>
          </td>
          <td colSpan={12} className="font-hugmate">
            <div className="flex justify-evenly">
              <Avatar
                avatar_id={trade.league.avatar}
                type="league"
                name={trade.league.name}
              />
            </div>
          </td>
        </tr>
        <tr className={"h-[3rem]"}>
          <td colSpan={3} className="text-center font-hugmate text-[1rem]">
            <div>
              {trade.league.settings.type === 2
                ? "Dynasty"
                : trade.league.settings.type === 1
                ? "Keeper"
                : "Redraft"}
            </div>
          </td>
          <td colSpan={3} className="text-center font-hugmate text-[1rem]">
            <div>
              {trade.league.settings.best_ball === 1 ? "Bestball" : "Lineup"}
            </div>
          </td>
          <td colSpan={2} className="text-center font-hugmate text-[1rem]">
            <div>{trade.rosters.length} Tm</div>
          </td>
          <td colSpan={2} className="text-center font-hugmate text-[1rem]">
            <div>
              S{" "}
              {trade.league.roster_positions.filter((rp) => rp !== "BN").length}
            </div>
          </td>
          <td colSpan={4} className="text-center font-hugmate text-[1rem]">
            <div>
              {trade.league.roster_positions
                .filter((rp) => rp === "QB")
                .length.toString()}{" "}
              QB{" "}
              {trade.league.roster_positions
                .filter((rp) => rp === "SUPER_FLEX")
                .length.toString()}{" "}
              SF
            </div>
          </td>
          <td colSpan={5} className="text-center font-hugmate text-[1rem]">
            <div>
              {trade.league.roster_positions
                .filter((rp) => rp === "TE")
                .length.toString()}{" "}
              TE{" "}
              {trade.league.scoring_settings.bonus_rec_te?.toLocaleString(
                "en-US",
                { maximumFractionDigits: 2 }
              ) || "0"}
              {"pt "}
              Prem
            </div>
          </td>
        </tr>
        {managers.map((user_id) => {
          const manager_roster = trade.rosters.find(
            (r) => r.user_id === user_id
          );

          return (
            <tr key={`${user_id}-${trade.transaction_id}`}>
              <td
                colSpan={5}
                className={"min-h-[5rem] " + bg + " text-[1.5rem]"}
              >
                <div className="p-2 text-overflow font-chill font-black">
                  <Avatar
                    avatar_id={manager_roster?.avatar ?? null}
                    type={"user"}
                    name={manager_roster?.username || "Orphan"}
                  />
                </div>
              </td>
              <td colSpan={8} className={" text-[1.25rem]"}>
                <table className={bg + " text-[1.25rem]"}>
                  <tbody>
                    {Object.keys(trade.adds)
                      .filter((add) => trade.adds[add] === user_id)
                      .sort((a, b) => ktc[b] - ktc[a])
                      .map((add) => {
                        const ktcValue = ktc[add] ?? 0;
                        return (
                          <tr key={add} className="h-[3rem]">
                            <td className="text-center">+</td>
                            <td colSpan={5}>
                              <div className="text-overflow p-2">
                                {allplayers?.[add] ? (
                                  <Avatar
                                    avatar_id={add}
                                    type="player"
                                    name={allplayers?.[add].full_name}
                                  />
                                ) : (
                                  "Inactive Player " + add
                                )}
                              </div>
                            </td>
                            <td
                              colSpan={2}
                              className="font-pulang text-center"
                              style={getTextColor(
                                ktcValue,
                                ktcMinMax.min,
                                ktcMinMax.max,
                                (ktcMinMax.min + ktcMinMax.max) / 2,
                                false
                              )}
                            >
                              <div>{ktcValue}</div>
                            </td>
                          </tr>
                        );
                      })}

                    {trade.draft_picks
                      .filter((dp) => dp.new === user_id)
                      .map((dp) => {
                        const ktcValue =
                          ktc[
                            getDraftPickKtcName(
                              getDraftPickId({
                                ...dp,
                                season: parseInt(dp.season),
                                original_username: dp.original,
                                roster_id: 0,
                              })
                            )
                          ] ?? 0;
                        return (
                          <tr
                            key={`${dp.season}-${dp.round}-${dp.original}`}
                            className="h-[3rem]"
                          >
                            <td className="text-center">+</td>
                            <td colSpan={5}>
                              <div className="text-overflow px-2">
                                {dp.order
                                  ? `${dp.season} ${
                                      dp.round
                                    }.${dp.order.toLocaleString("en-US", {
                                      minimumIntegerDigits: 2,
                                    })}`
                                  : `${dp.season} Round ${dp.round} (${dp.original})`}
                              </div>
                            </td>
                            <td
                              colSpan={2}
                              className={"font-pulang text-center"}
                              style={getTextColor(
                                ktcValue,
                                ktcMinMax.min,
                                ktcMinMax.max,
                                (ktcMinMax.min + ktcMinMax.max) / 2,
                                false
                              )}
                            >
                              {ktcValue}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </td>
              <td
                colSpan={6}
                className={"min-h-[5rem] " + bg + " text-[1.25rem]"}
              >
                <table className={bg + " text-[1.25rem]"}>
                  <tbody>
                    {Object.keys(trade.drops)
                      .filter((drop) => trade.drops[drop] === user_id)
                      .sort((a, b) => ktc[b] - ktc[a])
                      .map((drop) => {
                        return (
                          <tr key={drop}>
                            <td className="text-center">-</td>
                            <td colSpan={5}>
                              <div className="text-overflow p-2 font-chill">
                                {allplayers?.[drop] ? (
                                  <Avatar
                                    avatar_id={drop}
                                    type="player"
                                    name={allplayers?.[drop].full_name}
                                  />
                                ) : (
                                  "Inactive Player " + drop
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                    {trade.draft_picks
                      .filter((dp) => dp.old === user_id)
                      .map((dp) => {
                        return (
                          <tr
                            key={`${dp.season}-${dp.round}-${dp.original}`}
                            className="h-[3rem]"
                          >
                            <td className="text-center">-</td>
                            <td colSpan={5} className="">
                              <div className="text-overflow px-2">
                                {dp.order
                                  ? `${dp.season} ${
                                      dp.round
                                    }.${dp.order.toLocaleString("en-US", {
                                      minimumIntegerDigits: 2,
                                    })}`
                                  : `${dp.season} Round ${dp.round} (${dp.original})`}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default Trade;
