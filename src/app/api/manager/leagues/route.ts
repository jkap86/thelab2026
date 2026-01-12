import axiosInstance from "@/lib/axios-instance";
import pool from "@/lib/pool";
import { DraftPick, League, Roster, User } from "@/lib/types/manager-types";
import {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperRoster,
  SleeperTransaction,
  SleeperUser,
} from "@/lib/types/sleeper-types";
import { NextRequest, NextResponse } from "next/server";
import { addRosterMetrics } from "./utils/add-roster-metrics";
import { getKtcCurrent } from "../../common/ktc/current/utils/get-ktc-current";
import { getAllplayersCached } from "../../common/allplayers/utils/get-allplayers";
import { Allplayer } from "@/lib/types/common-types";
import { Trade } from "@/lib/types/trades-types";

export const dynamic = "force-dynamic";

const CC = "public, max-age=30, s-maxage=360, stale-while-revalidate=300";

const CUTOFF = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const user_id = searchParams.get("user_id");
  const week = searchParams.get("week");

  if (!user_id || !week) {
    return new Response("Missing user_id or week", { status: 400 });
  }
  try {
    const [{ player_values }, allplayers] = await Promise.all([
      getKtcCurrent(),
      getAllplayersCached(),
    ]);

    const leagues: SleeperLeague[] = await (
      await axiosInstance.get(
        `https://api.sleeper.app/v1/user/${user_id}/leagues/nfl/${process.env.SEASON}`
      )
    ).data.map((league: SleeperLeague, index: number) => ({
      ...league,
      index,
    }));

    const batchSize = 15;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < leagues.length; i += batchSize) {
            const batch = leagues.slice(i, i + batchSize);
            const processed = await processLeagues(
              batch,
              user_id,
              parseInt(week),
              Object.fromEntries(player_values),
              allplayers as Allplayer[]
            );

            for (const league of processed) {
              controller.enqueue(encoder.encode(JSON.stringify(league) + "\n"));
            }
          }
          controller.close();
        } catch (error: unknown) {
          if (error instanceof Error) {
            controller.error(error);
          } else {
            controller.error(new Error("Unknown error"));
          }
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": CC,
        "X-Content-Type-Options": "nosniff",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json(
        { error: err.message },
        {
          status: 500,
        }
      );
    } else {
      return NextResponse.json(
        { error: "An unknown error occurred." },
        {
          status: 500,
        }
      );
    }
  }
}

async function processLeagues(
  leaguesBatch: SleeperLeague[],
  user_id: string,
  week: number,
  ktcCurrent: { [player_id: string]: number },
  allplayers: Allplayer[]
) {
  const selectLeaguesQuery = `
      SELECT * FROM leagues WHERE league_id = ANY($1);
    `;

  const league_ids = leaguesBatch.map((league) => league.league_id);

  const result = await pool.query(selectLeaguesQuery, [league_ids]);

  const upToDateLeagues = result.rows.filter(
    (league) => league.updated_at > CUTOFF
  );

  const upToDate = upToDateLeagues.map((league) => league.league_id);

  const toUpdate = leaguesBatch
    .filter((league) => !upToDate.includes(league.league_id))
    .map((league) => league.league_id);

  const updated = await updateLeagues(
    toUpdate,
    result.rows.map((league) => league.league_id),
    week
  );

  const processed: League[] = [];

  await Promise.all(
    [...upToDateLeagues, ...updated].map(async (league: League) => {
      const user_roster = league.rosters.find(
        (roster) => roster.user_id === user_id
      );

      if (!user_roster) return;

      const rostersMetrics = await addRosterMetrics(
        league.rosters,
        league.roster_positions,
        ktcCurrent,
        allplayers
      );

      processed.push({
        ...league,
        rosters: league.rosters.map((roster) => ({
          ...roster,
          ...rostersMetrics[roster.roster_id],
        })),
        user_roster_id: user_roster.roster_id,
      });
    })
  );

  return processed;
}

export async function updateLeagues(
  toUpdate: string[],
  db: string[],
  week: number
) {
  const usersToUpsert: User[] = [];
  const leaguesToUpsert: League[] = [];
  const tradesToUpsert: Trade[] = [];

  const batchSize = 5;

  for (let i = 0; i < toUpdate.length; i += batchSize) {
    await Promise.all(
      toUpdate.slice(i, i + batchSize).map(async (league_id) => {
        try {
          const league: { data: SleeperLeague } = await axiosInstance.get(
            `https://api.sleeper.app/v1/league/${league_id}`
          );

          const rosters: { data: SleeperRoster[] } = await axiosInstance.get(
            `https://api.sleeper.app/v1/league/${league_id}/rosters`
          );

          const users: { data: SleeperUser[] } = await axiosInstance.get(
            `https://api.sleeper.app/v1/league/${league_id}/users`
          );

          const drafts = await axiosInstance.get(
            `https://api.sleeper.app/v1/league/${league_id}/drafts`
          );
          const tradedPicks = await axiosInstance.get(
            `https://api.sleeper.app/v1/league/${league_id}/traded_picks`
          );

          const { draftPicks, draftOrder, startupCompletionTime } =
            getLeagueDraftPicks(
              league.data,
              rosters.data,
              users.data,
              drafts.data,
              tradedPicks.data
            );

          const rostersUsername = getRostersUsernames(
            rosters.data,
            users.data,
            draftPicks
          );

          rostersUsername.forEach((roster) => {
            if (
              !usersToUpsert.some((user) => user.user_id === roster.user_id) &&
              roster.user_id
            ) {
              usersToUpsert.push({
                user_id: roster.user_id,
                username: roster.username,
                avatar: roster.avatar,
                type: "LM",
              });
            }
          });

          const trades = await getTrades(
            league.data,
            week,
            rostersUsername,
            draftOrder,
            startupCompletionTime
          );

          tradesToUpsert.push(...trades);

          leaguesToUpsert.push({
            league_id: league.data.league_id,
            name: league.data.name,
            avatar: league.data.avatar,
            roster_positions: league.data.roster_positions || [],
            scoring_settings: league.data.scoring_settings || {},
            settings: league.data.settings,
            rosters: rostersUsername,
            status: league.data.status,
            season: league.data.season,
          });
        } catch (err: unknown) {
          if (err instanceof Error) {
            console.log(err.message);
          } else {
            console.log("An unknown error occurred.");
          }
        }
      })
    );
  }

  try {
    await pool.query("BEGIN");

    await upsertUsers(usersToUpsert);
    await upsertLeagues(leaguesToUpsert);
    await upsertTrades(tradesToUpsert);

    await pool.query("COMMIT");
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.log(err.message);
    } else {
      console.log("An unknown error occurred.");
    }

    await pool.query("ROLLBACK");
  }

  return leaguesToUpsert;
}

function getLeagueDraftPicks(
  league: SleeperLeague,
  rosters: SleeperRoster[],
  users: SleeperUser[],
  drafts: SleeperDraft[],
  tradedPicks: SleeperDraftPick[]
) {
  const draftSeason =
    league.status === "pre_draft"
      ? parseInt(league.season)
      : parseInt(league.season) + 1;

  const draftOrder: { [key: string]: number } | undefined = drafts.find(
    (draft) =>
      draft.season === draftSeason.toString() &&
      draft.settings.rounds === league.settings.draft_rounds
  )?.draft_order;

  const startupCompletionTime = league.previous_league_id
    ? 1
    : drafts.find(
        (draft) =>
          draft.status === "complete" &&
          draft.settings.rounds > league.settings.draft_rounds
      )?.last_picked ?? undefined;

  const draftPicks: { [key: number]: DraftPick[] } = {};

  rosters.forEach((roster) => {
    const teamDraftPicks: DraftPick[] = [];

    const user = users.find((user) => user.user_id === roster.owner_id);

    for (let i = draftSeason; i <= draftSeason + 2; i++) {
      for (let j = 1; j <= league.settings.draft_rounds; j++) {
        const isTraded = tradedPicks.some(
          (tradedPick) =>
            parseInt(tradedPick.season) === i &&
            tradedPick.round === j &&
            tradedPick.roster_id === roster.roster_id
        );

        if (isTraded) continue;

        teamDraftPicks.push({
          season: i,
          round: j,
          roster_id: roster.roster_id,
          original_username: user?.display_name || "Orphan",
          order:
            (i === draftSeason && draftOrder?.[roster.owner_id]) || undefined,
        });
      }
    }

    draftPicks[roster.roster_id] = teamDraftPicks;
  });

  tradedPicks
    .filter((tradedPick) => parseInt(tradedPick.season) >= draftSeason)
    .forEach((tradedPick) => {
      const originalRoster = rosters.find(
        (roster) => roster.roster_id === tradedPick.roster_id
      );

      const originalUser = users.find(
        (user) => user.user_id === originalRoster?.owner_id
      );

      draftPicks[tradedPick.owner_id].push({
        season: parseInt(tradedPick.season),
        round: tradedPick.round,
        roster_id: tradedPick.roster_id,
        original_username: originalUser?.display_name || "Orphan",
        order:
          tradedPick.season === draftSeason.toString()
            ? originalRoster?.owner_id
              ? draftOrder?.[originalRoster.owner_id]
              : undefined
            : undefined,
      });

      const index = draftPicks[tradedPick.previous_owner_id].findIndex(
        (draftPick) =>
          draftPick.season === parseInt(tradedPick.season) &&
          draftPick.round === tradedPick.round &&
          draftPick.roster_id === tradedPick.roster_id
      );

      if (index !== -1) {
        draftPicks[tradedPick.previous_owner_id].splice(index, 1);
      }
    });

  return { draftPicks, draftOrder, startupCompletionTime };
}

function getRostersUsernames(
  rosters: SleeperRoster[],
  users: SleeperUser[],
  draftPicks: { [key: number]: DraftPick[] } | undefined
) {
  const rostersUsernames = rosters.map((roster) => {
    const user = users.find((user) => user.user_id === roster.owner_id);

    return {
      ...roster,
      user_id: roster.owner_id,
      username: user?.display_name || "Orphan",
      avatar: user?.avatar ?? null,
      players: roster.players || [],
      starters: roster.starters || [],
      taxi: roster.taxi || [],
      reserve: roster.reserve || [],
      draftpicks: draftPicks?.[roster.roster_id] || [],
      wins: roster.settings.wins,
      losses: roster.settings.losses,
      ties: roster.settings.ties,
      fp: parseFloat(
        `${roster.settings.fpts}.${roster.settings.fpts_decimal || 0}`
      ),
      fpa: parseFloat(
        `${roster.settings.fpts_against}.${
          roster.settings.fpts_against_decimal || 0
        }`
      ),
    };
  });

  return rostersUsernames;
}

async function getTrades(
  league: SleeperLeague,
  week: number,
  rosters: Roster[],
  draftOrder: { [key: string]: number } | undefined,
  startupCompletionTime: number | undefined
) {
  if (league.settings.disable_trades) return [];

  const transactions: { data: SleeperTransaction[] } = await axiosInstance.get(
    `https://api.sleeper.app/v1/league/${league.league_id}/transactions/${week}`
  );

  return transactions.data
    .filter(
      (t) =>
        t.type === "trade" &&
        t.status === "complete" &&
        startupCompletionTime &&
        t.status_updated > startupCompletionTime
    )
    .map((t) => {
      const adds: { [player_id: string]: string } = {};
      const drops: { [player_id: string]: string } = {};

      const draftPicks = t.draft_picks.map((draftPick) => {
        const originalUserId = rosters.find(
          (roster) => roster.roster_id === draftPick.roster_id
        )?.user_id;

        const order =
          draftPick.season === league.season
            ? draftOrder?.[originalUserId || ""]
            : undefined;

        return {
          season: draftPick.season,
          round: draftPick.round,
          new:
            rosters.find((roster) => roster.roster_id === draftPick.owner_id)
              ?.user_id ?? "0",
          old:
            rosters.find(
              (roster) => roster.roster_id === draftPick.previous_owner_id
            )?.user_id ?? "0",
          original:
            rosters.find((roster) => roster.roster_id === draftPick.roster_id)
              ?.username ?? "Team " + draftPick,
          order,
        };
      });

      if (t.adds) {
        Object.keys(t.adds).forEach((add) => {
          const manager = rosters.find(
            (roster) => roster.roster_id === t.adds[add]
          );

          adds[add] = manager?.user_id || "0";
        });
      }

      if (t.drops) {
        Object.keys(t.drops).forEach((drop) => {
          const manager = rosters.find(
            (roster) => roster.roster_id === t.drops[drop]
          );

          drops[drop] = manager?.user_id || "0";
        });
      }

      return {
        transaction_id: t.transaction_id,
        status_updated: t.status_updated,
        league_id: league.league_id,
        league: {
          league_id: league.league_id,
          name: league.name,
          avatar: league.avatar,
          roster_positions: league.roster_positions || [],
          scoring_settings: league.scoring_settings || {},
          settings: league.settings,
        },
        adds,
        drops,
        draft_picks: draftPicks,
        rosters: rosters.map((roster) => ({
          roster_id: roster.roster_id,
          user_id: roster.user_id,
          username: roster.username,
          avatar: roster.avatar,
          players: roster.players,
        })),
      };
    });
}

async function upsertUsers(users: User[]) {
  const upsertUsersQuery = `
    INSERT INTO users (user_id, username, avatar, type)
    VALUES ${users
      .map(
        (_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
      )
      .join(",")}
    ON CONFLICT (user_id) DO UPDATE SET
      username = EXCLUDED.username,
      avatar = EXCLUDED.avatar,
      type = CASE
        WHEN users.type = 'S' THEN users.type
        ELSE EXCLUDED.type
      END;
  `;

  const values = users.flatMap((user) => [
    user.user_id,
    user.username,
    user.avatar,
    user.type,
  ]);

  await pool.query(upsertUsersQuery, values);

  return;
}

async function upsertLeagues(leagues: League[]) {
  const upserLeaguesQuery = `
    INSERT INTO leagues (league_id, name, avatar, season, status, settings, scoring_settings, roster_positions, rosters)
    VALUES ${leagues.map(
      (_, i) =>
        `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${
          i * 9 + 5
        }, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`
    )}    ON CONFLICT (league_id) DO UPDATE SET
      name = EXCLUDED.name,
      avatar = EXCLUDED.avatar,
      season = EXCLUDED.season,
      status = EXCLUDED.status,
      settings = EXCLUDED.settings,
      scoring_settings = EXCLUDED.scoring_settings,
      roster_positions = EXCLUDED.roster_positions,
      rosters = EXCLUDED.rosters;
  `;

  const values = leagues.flatMap((league) => [
    league.league_id,
    league.name,
    league.avatar,
    league.season,
    league.status,
    JSON.stringify(league.settings),
    JSON.stringify(league.scoring_settings),
    JSON.stringify(league.roster_positions),
    JSON.stringify(league.rosters),
  ]);

  await pool.query(upserLeaguesQuery, values);

  return;
}

async function upsertTrades(trades: Trade[]) {
  if (trades.length === 0) return;

  const upsertTradesQuery = `
    INSERT INTO trades (transaction_id, status_updated, league_id, adds, drops, draft_picks, rosters)
    VALUES ${trades.map(
      (_, i) =>
        `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${
          i * 7 + 5
        }, $${i * 7 + 6}, $${i * 7 + 7})`
    )}
    ON CONFLICT (transaction_id) DO UPDATE SET
      draft_picks = EXCLUDED.draft_picks;
  `;

  const values = trades.flatMap((trade) => [
    trade.transaction_id,
    new Date(trade.status_updated),
    trade.league_id,
    JSON.stringify(trade.adds),
    JSON.stringify(trade.drops),
    JSON.stringify(trade.draft_picks),
    JSON.stringify(trade.rosters),
  ]);

  await pool.query(upsertTradesQuery, values);

  return;
}
