import pool from "@/lib/pool";
import { ADPFilters, PlayerADP, ADPResponse } from "@/lib/types/common-types";

// Map slot names to materialized column names
const SLOT_COLUMNS: Record<string, string> = {
  QB: "qb_count",
  RB: "rb_count",
  WR: "wr_count",
  TE: "te_count",
  FLEX: "flex_count",
  SUPER_FLEX: "super_flex_count",
  REC_FLEX: "rec_flex_count",
  WRRB_FLEX: "wrrb_flex_count",
  K: "k_count",
  DEF: "def_count",
  BN: "bn_count",
  DL: "dl_count",
  LB: "lb_count",
  DB: "db_count",
  IDP_FLEX: "idp_flex_count",
  // Computed aggregates
  STARTER: "starter_count",
  IDP: "idp_count",
};

export async function getADP(filters?: ADPFilters): Promise<ADPResponse> {
  // Build common conditions for leagues
  const leagueConditions: string[] = [];
  const baseDraftConditions: string[] = ["d.status = 'complete'"];
  const values: (string | number)[] = [];

  // Date filters (on drafts)
  if (filters?.startDate) {
    values.push(new Date(filters.startDate).getTime());
    baseDraftConditions.push(`d.start_time >= $${values.length}`);
  }
  if (filters?.endDate) {
    values.push(new Date(filters.endDate).getTime());
    baseDraftConditions.push(`d.start_time <= $${values.length}`);
  }

  // League type filter (on leagues) - 0=redraft, 1=keeper, 2=dynasty
  if (filters?.leagueType) {
    values.push(filters.leagueType);
    leagueConditions.push(`settings ->> 'type' = $${values.length}`);
  }

  // Best ball filter (on leagues) - 0=lineup, 1=best_ball
  if (filters?.bestBall) {
    if (filters.bestBall === "0") {
      // 0 means lineup - match '0' OR null/missing
      leagueConditions.push(
        `(settings ->> 'best_ball' = '0' OR settings ->> 'best_ball' IS NULL)`
      );
    } else {
      values.push(filters.bestBall);
      leagueConditions.push(`settings ->> 'best_ball' = $${values.length}`);
    }
  }

  // Player type filter (on drafts settings)
  // 0 or null = all players, 1 = rookies, 2 = veterans
  if (filters?.playerType) {
    if (filters.playerType === "0") {
      // 0 means all players - match '0' OR null/missing
      baseDraftConditions.push(
        `(d.settings ->> 'player_type' = '0' OR d.settings ->> 'player_type' IS NULL)`
      );
    } else {
      values.push(filters.playerType);
      baseDraftConditions.push(
        `d.settings ->> 'player_type' = $${values.length}`
      );
    }
  }

  // Roster slots filter using materialized columns (on leagues)
  if (filters?.rosterSlots) {
    const pairs = filters.rosterSlots.split(",").map((p) => p.trim());
    for (const pair of pairs) {
      // Support new format: "QB=2", "FLEX>1" or legacy format: "QB:2"
      const match = pair.match(/^([A-Z_+]+)(=|>|<|:)(\d+)$/i);
      if (match) {
        const [, slot, op, countStr] = match;
        const slotUpper = slot.toUpperCase();
        // Treat ":" as "=" for backwards compatibility
        const operator = op === ":" ? "=" : op;
        // Special case: QB+SF means combined qb_count + super_flex_count
        if (slotUpper === "QB+SF") {
          values.push(parseInt(countStr, 10));
          leagueConditions.push(
            `COALESCE(qb_count, 0) + COALESCE(super_flex_count, 0) ${operator} $${values.length}`
          );
        } else {
          const column = SLOT_COLUMNS[slotUpper];
          if (column) {
            values.push(parseInt(countStr, 10));
            leagueConditions.push(
              `COALESCE(${column}, 0) ${operator} $${values.length}`
            );
          }
        }
      }
    }
  }

  // Scoring settings filter (on leagues)
  // COALESCE treats missing scoring settings as 0
  if (filters?.scoring) {
    const pairs = filters.scoring.split(",").map((p) => p.trim());
    for (const pair of pairs) {
      const match = pair.match(/^(\w+)(=|>|<)(.+)$/);
      if (match) {
        const [, key, operator, value] = match;
        values.push(parseFloat(value));
        leagueConditions.push(
          `COALESCE((scoring_settings ->> '${key}')::numeric, 0) ${operator} $${values.length}`
        );
      }
    }
  }

  // Superflex filter: QB + SUPER_FLEX combined = 2 (on leagues)
  if (filters?.superflex) {
    leagueConditions.push(
      `COALESCE(qb_count, 0) + COALESCE(super_flex_count, 0) = 2`
    );
  }

  // Teams filter (on leagues)
  if (filters?.teams) {
    values.push(filters.teams);
    leagueConditions.push(`jsonb_array_length(rosters) = $${values.length}`);
  }

  // Build query with CTE to filter leagues first
  const leagueWhere =
    leagueConditions.length > 0
      ? `WHERE ${leagueConditions.join(" AND ")}`
      : "";

  // Build round.pick format if teams specified
  const teams = filters?.teams;
  const avgPickExpr = teams
    ? `ROUND(((FLOOR((ROUND(AVG(dp.pick_no)) - 1) / ${teams}) + 1) +
       ((ROUND(AVG(dp.pick_no)) - 1) % ${teams} + 1) / 100.0)::numeric, 2)::float`
    : `ROUND(AVG(dp.pick_no)::numeric, 2)::float`;

  const minPickExpr = teams
    ? `ROUND(((FLOOR((MIN(dp.pick_no) - 1) / ${teams}) + 1) +
       ((MIN(dp.pick_no) - 1) % ${teams} + 1) / 100.0)::numeric, 2)::float`
    : `MIN(dp.pick_no)::float`;

  const maxPickExpr = teams
    ? `ROUND(((FLOOR((MAX(dp.pick_no) - 1) / ${teams}) + 1) +
       ((MAX(dp.pick_no) - 1) % ${teams} + 1) / 100.0)::numeric, 2)::float`
    : `MAX(dp.pick_no)::float`;

  // Query for snake drafts (pick positions)
  const snakeDraftConditions = [...baseDraftConditions, `d.type = 'snake'`];
  const snakeQuery = `
    WITH filtered_leagues AS (
      SELECT league_id
      FROM leagues
      ${leagueWhere}
    )
    SELECT
      dp.player_id,
      ${avgPickExpr} as avg_pick,
      ${minPickExpr} as min_pick,
      ${maxPickExpr} as max_pick,
      ROUND(COALESCE(STDDEV(dp.pick_no), 0)::numeric, 2)::float as pick_stddev,
      COUNT(*)::int as pick_count
    FROM draft_picks dp
    JOIN drafts d ON dp.draft_id = d.draft_id
    WHERE d.league_id IN (SELECT league_id FROM filtered_leagues)
      AND ${snakeDraftConditions.join(" AND ")}
    GROUP BY dp.player_id;
  `;

  // Query for auction drafts (amounts as % of budget)
  const auctionDraftConditions = [...baseDraftConditions, `d.type = 'auction'`];
  const auctionQuery = `
    WITH filtered_leagues AS (
      SELECT league_id
      FROM leagues
      ${leagueWhere}
    )
    SELECT
      dp.player_id,
      ROUND(AVG(dp.amount * 100.0 / NULLIF((d.settings ->> 'budget')::int, 0))::numeric, 2)::float as avg_amount,
      ROUND(MIN(dp.amount * 100.0 / NULLIF((d.settings ->> 'budget')::int, 0))::numeric, 2)::float as min_amount,
      ROUND(MAX(dp.amount * 100.0 / NULLIF((d.settings ->> 'budget')::int, 0))::numeric, 2)::float as max_amount,
      ROUND(COALESCE(STDDEV(dp.amount * 100.0 / NULLIF((d.settings ->> 'budget')::int, 0)), 0)::numeric, 2)::float as amount_stddev,
      COUNT(dp.amount)::int as amount_count
    FROM draft_picks dp
    JOIN drafts d ON dp.draft_id = d.draft_id
    WHERE d.league_id IN (SELECT league_id FROM filtered_leagues)
      AND ${auctionDraftConditions.join(" AND ")}
      AND dp.amount IS NOT NULL
      AND dp.amount > 0
      AND (d.settings ->> 'budget')::int > 0
    GROUP BY dp.player_id
    HAVING COUNT(*) >= 3;
  `;

  // Query to count unique drafts
  const snakeCountQuery = `
    WITH filtered_leagues AS (
      SELECT league_id
      FROM leagues
      ${leagueWhere}
    )
    SELECT COUNT(DISTINCT d.draft_id)::int as count
    FROM drafts d
    WHERE d.league_id IN (SELECT league_id FROM filtered_leagues)
      AND ${snakeDraftConditions.join(" AND ")};
  `;

  const auctionCountQuery = `
    WITH filtered_leagues AS (
      SELECT league_id
      FROM leagues
      ${leagueWhere}
    )
    SELECT COUNT(DISTINCT d.draft_id)::int as count
    FROM drafts d
    WHERE d.league_id IN (SELECT league_id FROM filtered_leagues)
      AND ${auctionDraftConditions.join(" AND ")}
      AND (d.settings ->> 'budget')::int > 0;
  `;

  // Run all queries in parallel
  const [snakeResult, auctionResult, snakeCountResult, auctionCountResult] =
    await Promise.all([
      pool.query(snakeQuery, values),
      pool.query(auctionQuery, values),
      pool.query(snakeCountQuery, values),
      pool.query(auctionCountQuery, values),
    ]);

  const snakeCount = snakeCountResult.rows[0]?.count ?? 0;
  const auctionCount = auctionCountResult.rows[0]?.count ?? 0;

  // Create a map of auction amounts by player_id
  const auctionMap = new Map<
    string,
    {
      avg_amount: number;
      min_amount: number;
      max_amount: number;
      amount_stddev: number;
      amount_count: number;
    }
  >();
  for (const row of auctionResult.rows) {
    auctionMap.set(row.player_id, {
      avg_amount: row.avg_amount,
      min_amount: row.min_amount,
      max_amount: row.max_amount,
      amount_stddev: row.amount_stddev,
      amount_count: row.amount_count,
    });
  }

  // Combine snake pick data with auction amount data
  const combined: PlayerADP[] = snakeResult.rows.map((row) => {
    const auction = auctionMap.get(row.player_id);
    return {
      player_id: row.player_id,
      avg_pick: row.avg_pick,
      min_pick: row.min_pick,
      max_pick: row.max_pick,
      pick_stddev: row.pick_stddev,
      pick_count: row.pick_count,
      avg_amount: auction?.avg_amount ?? null,
      min_amount: auction?.min_amount ?? null,
      max_amount: auction?.max_amount ?? null,
      amount_stddev: auction?.amount_stddev ?? null,
      amount_count: auction?.amount_count ?? 0,
    };
  });

  // Sort by avg_pick
  combined.sort((a, b) => (a.avg_pick ?? 0) - (b.avg_pick ?? 0));

  return {
    players: combined,
    draftCounts: {
      snake: snakeCount,
      auction: auctionCount,
      total: snakeCount + auctionCount,
    },
  };
}
