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
  setActiveTrade: (transaction_id: string) => void;
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

  return (
    <table className={""}>
      <tbody>
        <tr>
          <td colSpan={7}>
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
          <td colSpan={12}>
            <div className="flex justify-evenly">
              <Avatar
                avatar_id={trade.league.avatar}
                type="league"
                name={trade.league.name}
              />
            </div>
          </td>
        </tr>
        <tr>
          <td colSpan={3}>
            <div>
              {trade.league.settings.type === 2
                ? "Dynasty"
                : trade.league.settings.type === 1
                ? "Keeper"
                : "Redraft"}
            </div>
          </td>
          <td colSpan={3}>
            <div>
              {trade.league.settings.best_ball === 1 ? "Bestball" : "Lineup"}
            </div>
          </td>
          <td colSpan={2}>
            <div>{trade.rosters.length} Tm</div>
          </td>
          <td colSpan={2}>
            <div>
              S{" "}
              {trade.league.roster_positions.filter((rp) => rp !== "BN").length}
            </div>
          </td>
          <td colSpan={4}>
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
          <td colSpan={5}>
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
              <td colSpan={5}>
                <div>
                  <Avatar
                    avatar_id={manager_roster?.avatar ?? null}
                    type={"user"}
                    name={manager_roster?.username || "Orphan"}
                  />
                </div>
              </td>
              <td colSpan={8}>
                <table>
                  <tbody>
                    {Object.keys(trade.adds)
                      .filter((add) => trade.adds[add] === user_id)
                      .sort((a, b) => ktc[b] - ktc[a])
                      .map((add) => {
                        const ktcValue = ktc[add] ?? 0;
                        return (
                          <tr key={add}>
                            <td colSpan={2}>
                              <div>
                                {allplayers?.[add]?.full_name ??
                                  "Inactive Player " + add}
                              </div>
                            </td>
                            <td
                              className="font-pulang"
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
                          <tr key={`${dp.season}-${dp.round}-${dp.original}`}>
                            <td colSpan={4}>
                              <div>
                                {"+ "}
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
                              className={"font-pulang"}
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
              <td colSpan={6}>
                <table>
                  <tbody>
                    {Object.keys(trade.drops)
                      .filter((drop) => trade.drops[drop] === user_id)
                      .sort((a, b) => ktc[b] - ktc[a])
                      .map((drop) => {
                        const ktcValue = ktc[drop] ?? 0;
                        return (
                          <tr key={drop}>
                            <td colSpan={2}>
                              <div>
                                {allplayers?.[drop]?.full_name ??
                                  "Inactive Player " + drop}
                              </div>
                            </td>
                            <td
                              className="font-pulang"
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
                      .filter((dp) => dp.old === user_id)
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
                          <tr key={`${dp.season}-${dp.round}-${dp.original}`}>
                            <td colSpan={4}>
                              <div>
                                {"- "}
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
                              className={"font-pulang"}
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
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default Trade;
