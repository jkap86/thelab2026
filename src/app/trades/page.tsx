"use client";

import Avatar from "@/components/common/avatar";
import LoadingIcon from "@/components/common/loading-icon";
import Search from "@/components/common/search";
import AllTrades from "@/components/trades/all-trades";
import FiltersModal from "@/components/trades/filters-modal";
import LeaguemateTrades from "@/components/trades/leaguemate-trades";
import useFetchAllPlayers from "@/hooks/common/useFetchAllplayers";
import useFetchKtcCurrent from "@/hooks/common/useFetchKtcCurrent";
import useFetchNflState from "@/hooks/common/useFetchNflState";
import { AppDispatch, RootState } from "@/redux/store";
import { fetchTrades } from "@/redux/trades/trades-actions";
import { updateTradesState } from "@/redux/trades/trades-slice";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

const TradesPage = () => {
  const dispatch: AppDispatch = useDispatch();
  const { allplayers, nflState } = useSelector(
    (state: RootState) => state.common
  );
  const {
    trades,
    isLoadingTrades,
    errorTrades,
    playerId1,
    playerId2,
    playerId3,
    playerId4,
    leagueType1,
    leagueType2,
  } = useSelector((state: RootState) => state.trades);

  const [tab, setTab] = useState<"All" | "Leaguemate">("All");
  const [isOpen, setIsOpen] = useState(false);

  useFetchNflState();
  useFetchAllPlayers();
  useFetchKtcCurrent();

  useEffect(() => {
    if (!playerId1 && playerId3) {
      dispatch(
        updateTradesState({
          key: "playerId1",
          value: playerId3 === "Price Check" ? "" : playerId3,
        })
      );

      if (playerId3 !== "Price Check")
        dispatch(updateTradesState({ key: "playerId3", value: "" }));
    }
  }, [playerId1, playerId3]);

  useEffect(() => {
    if (!playerId2 && playerId4) {
      dispatch(
        updateTradesState({
          key: "playerId2",
          value: playerId4 === "Price Check" ? "" : playerId4,
        })
      );

      if (playerId4 !== "Price Check")
        dispatch(updateTradesState({ key: "playerId4", value: "" }));
    }
  }, [playerId2, playerId4]);

  const playerPickOptions = useMemo(() => {
    const pick_seasons =
      (nflState?.season &&
        Array.from(Array(4).keys()).map((key) => nflState.season + key)) ||
      [];

    const pick_rounds = Array.from(Array(4).keys()).map((key) => key + 1);

    const pick_orders = Array.from(Array(12).keys()).map((key) => key + 1);

    const current_season_picks = pick_rounds.flatMap((round) => {
      const season = nflState?.season;
      return pick_orders.map((order) => {
        const order_formatted = order.toString().padStart(2, "0");
        const pick = `${season} ${round}.${order_formatted}`;
        return {
          id: pick,
          text: pick,
          display: <div>{pick}</div>,
        };
      });
    });

    const pick_options = [
      ...pick_seasons.flatMap((season) => {
        return pick_rounds.map((round) => {
          return {
            id: `${season} ${round}.null`,
            text: `${season} Round ${round}`,
            display: (
              <div>
                {season} Round {round}
              </div>
            ),
          };
        });
      }),
      ...current_season_picks,
      {
        id: "Price Check",
        text: "$$ Price Check",
        display: <div>$$ Price Check</div>,
      },
    ];

    return [
      ...Object.keys(allplayers || {}).map((player_id) => {
        return {
          id: player_id,
          text:
            allplayers?.[player_id]?.full_name ||
            (parseInt(player_id) ? "Inactive - " + player_id : player_id),
          display: (
            <Avatar
              avatar_id={player_id}
              name={allplayers?.[player_id]?.full_name || player_id}
              type="player"
            />
          ),
        };
      }),
      ...pick_options,
    ];
  }, [allplayers, nflState]);

  const searches = (
    <div>
      <div className="flex justify-evenly w-full">
        <div className=" mx-auto h-full w-[45%]">
          <div className="h-[3rem]">
            <Search
              searched={playerId1 ?? ""}
              setSearched={(value) =>
                dispatch(updateTradesState({ key: "playerId1", value }))
              }
              options={playerPickOptions.filter(
                (option) =>
                  !["Price Check", playerId2, playerId3, playerId4].includes(
                    option.id
                  )
              )}
              placeholder="Player/Pick"
            />
          </div>
          {playerId1 && (
            <div className="h-[3rem] my-[2rem]">
              <Search
                searched={playerId3 ?? ""}
                setSearched={(value) =>
                  dispatch(updateTradesState({ key: "playerId3", value }))
                }
                options={playerPickOptions.filter(
                  (option) =>
                    ![playerId1, playerId2, playerId4].includes(option.id)
                )}
                placeholder="Player/Pick"
                disabled={!playerId1}
              />
            </div>
          )}
        </div>

        <div className=" mx-auto h-full w-[45%]">
          <div className="h-[3rem]">
            <Search
              searched={playerId2 ?? ""}
              setSearched={(value) =>
                dispatch(updateTradesState({ key: "playerId2", value }))
              }
              options={playerPickOptions.filter(
                (option) =>
                  !["Price Check", playerId1, playerId3, playerId4].includes(
                    option.id
                  )
              )}
              placeholder="Player/Pick"
              disabled={!playerId1}
            />
          </div>
          {playerId2 && (
            <div className="h-[3rem] my-[2rem]">
              <Search
                searched={playerId4 ?? ""}
                setSearched={(value) =>
                  dispatch(updateTradesState({ key: "playerId4", value }))
                }
                options={playerPickOptions.filter(
                  (option) =>
                    ![playerId1, playerId2, playerId3].includes(option.id)
                )}
                placeholder="Player/Pick"
                disabled={!playerId2}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <Link href={"/tools"} className="home">
        Tools
      </Link>
      <div className="text-[3rem] font-metal text-[var(--color1)] text-center">
        Trades
      </div>
      <div className="flex flex-col items-center">
        <div className="flex justify-center items-center m-8">
          <i
            className="fa-solid fa-filter text-[3rem] text-[var(--color1)]"
            onClick={() => setIsOpen(true)}
          ></i>
        </div>

        <FiltersModal
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          filters={{ leagueType1, leagueType2 }}
        />
        {searches}
        <div>
          <button
            className="p-4 bg-[var(--color3)] rounded m-8"
            onClick={() =>
              dispatch(
                fetchTrades({
                  playerId1,
                  playerId2,
                  playerId3,
                  playerId4,
                  leagueType1,
                  leagueType2,
                  offset:
                    playerId1 === trades?.playerId1 &&
                    playerId2 === trades?.playerId2 &&
                    playerId3 === trades?.playerId3 &&
                    playerId4 === trades?.playerId4 &&
                    leagueType1 === trades?.leagueType1 &&
                    leagueType2 === trades?.leagueType2
                      ? trades.trades.length
                      : 0,
                })
              )
            }
          >
            Search
          </button>
        </div>
      </div>
      {playerId1 === trades?.playerId1 &&
      playerId2 === trades?.playerId2 &&
      playerId3 === trades?.playerId3 &&
      playerId4 === trades?.playerId4 &&
      leagueType1 === trades?.leagueType1 &&
      !isLoadingTrades &&
      !errorTrades ? (
        tab === "All" ? (
          <AllTrades playerPickOptions={playerPickOptions} />
        ) : (
          <LeaguemateTrades playerPickOptions={playerPickOptions} />
        )
      ) : isLoadingTrades ? (
        <LoadingIcon />
      ) : (
        errorTrades
      )}
    </div>
  );
};

export default TradesPage;
