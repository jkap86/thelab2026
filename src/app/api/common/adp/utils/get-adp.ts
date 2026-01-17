import pool from "@/lib/pool";
import { ADPFilters, PlayerADP } from "@/lib/types/common-types";

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

export async function getADP(filters?: ADPFilters): Promise<PlayerADP[]> {
  // Separate conditions for leagues CTE vs drafts/main query
  const leagueConditions: string[] = [];
  const draftConditions: string[] = ["d.status = 'complete'"];
  const values: (string | number)[] = [];

  // Date filters (on drafts)
  if (filters?.startDate) {
    values.push(new Date(filters.startDate).getTime());
    draftConditions.push(`d.start_time >= $${values.length}`);
  }
  if (filters?.endDate) {
    values.push(new Date(filters.endDate).getTime());
    draftConditions.push(`d.start_time <= $${values.length}`);
  }

  // League type filter (on leagues)
  if (filters?.leagueType) {
    values.push(filters.leagueType);
    leagueConditions.push(`settings ->> 'type' = $${values.length}`);
  }

  // Draft type filter (on drafts)
  if (filters?.draftType) {
    values.push(filters.draftType);
    draftConditions.push(`d.type = $${values.length}`);
  }

  // Player type filter (on drafts settings)
  // 0 or null = all players, 1 = rookies, 2 = veterans
  if (filters?.playerType) {
    if (filters.playerType === "0") {
      // 0 means all players - match '0' OR null/missing
      draftConditions.push(
        `(d.settings ->> 'player_type' = '0' OR d.settings ->> 'player_type' IS NULL)`
      );
    } else {
      values.push(filters.playerType);
      draftConditions.push(`d.settings ->> 'player_type' = $${values.length}`);
    }
  }

  // Roster slots filter using materialized columns (on leagues)
  if (filters?.rosterSlots) {
    const pairs = filters.rosterSlots.split(",").map((p) => p.trim());
    for (const pair of pairs) {
      const [slot, countStr] = pair.split(":");
      if (slot && countStr) {
        const column = SLOT_COLUMNS[slot.toUpperCase()];
        if (column) {
          values.push(parseInt(countStr, 10));
          leagueConditions.push(`${column} = $${values.length}`);
        }
      }
    }
  }

  // Scoring settings filter (on leagues)
  if (filters?.scoring) {
    const pairs = filters.scoring.split(",").map((p) => p.trim());
    for (const pair of pairs) {
      const match = pair.match(/^(\w+)(=|>|<)(.+)$/);
      if (match) {
        const [, key, operator, value] = match;
        values.push(parseFloat(value));
        leagueConditions.push(
          `(scoring_settings ->> '${key}')::numeric ${operator} $${values.length}`
        );
      }
    }
  }

  // Superflex filter: QB + SUPER_FLEX combined = 2 (on leagues)
  if (filters?.superflex) {
    leagueConditions.push(`qb_count + super_flex_count = 2`);
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
  // Round average to integer first to ensure valid round.pick (no 2.13 in 12-team)
  // Cast to numeric for ROUND(..., 2) to ensure .10 not .1 for pick 10
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

  const query = `
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
      COUNT(*)::int as pick_count,
      ROUND(AVG(dp.amount)::numeric, 2)::float as avg_amount,
      MIN(dp.amount)::int as min_amount,
      MAX(dp.amount)::int as max_amount,
      ROUND(COALESCE(STDDEV(dp.amount), 0)::numeric, 2)::float as amount_stddev,
      COUNT(dp.amount)::int as amount_count
    FROM draft_picks dp
    JOIN drafts d ON dp.draft_id = d.draft_id
    WHERE d.league_id IN (SELECT league_id FROM filtered_leagues)
      AND ${draftConditions.join(" AND ")}
    GROUP BY dp.player_id
    HAVING COUNT(*) >= 3
    ORDER BY avg_pick ASC;
  `;

  const result = await pool.query(query, values);

  return result.rows;
}
