import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pool";
import { getKtcCurrent } from "../common/ktc/current/utils/get-ktc-current";
import { getAllplayersCached } from "../common/allplayers/utils/get-allplayers";
import { addRosterMetrics } from "../manager/leagues/utils/add-roster-metrics";
import { Allplayer } from "@/lib/types/common-types";
import { Roster } from "@/lib/types/trades-types";

const CC = "public, max-age=300, s-maxage=1200, stale-while-revalidate=3600";

const draftPickEquals = (value: string) => {
  return `(dp->>'season') || ' ' || (dp->>'round')::text || '.' 
    || COALESCE(LPAD((dp->>'order')::text, 2, '0'), 'null') 
    = ${value}`;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const playerId1 = searchParams.get("playerId1");
  const playerId2 = searchParams.get("playerId2");
  const playerId3 = searchParams.get("playerId3");
  const playerId4 = searchParams.get("playerId4");
  const leagueType1 = searchParams.get("leagueType1");
  const leagueType2 = searchParams.get("leagueType2");
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const managersParam = searchParams.get("managers");

  // Validate and clamp limit/offset to prevent DoS
  const limit = Math.min(
    Math.max(parseInt(limitParam ?? "100", 10) || 100, 1),
    100
  );
  const offset = Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);

  console.log({
    playerId1,
    playerId2,
    playerId3,
    playerId4,
    leagueType1,
    leagueType2,
    limit: limitParam,
    offset: offsetParam,
  });

  const conditions: string[] = [
    `(SELECT count(*) FROM jsonb_each(t.adds)) <= 10`,
  ];

  const values = [];

  if (playerId1) {
    if (playerId1?.includes(".")) {
      conditions.push(
        `
        EXISTS (
            SELECT 1
            FROM jsonb_array_elements(t.draft_picks) as dp
            WHERE ${draftPickEquals("$1")}
        )    
      `
      );
    } else {
      conditions.push(`t.adds ? $1`);
    }
    values.push(playerId1);
  }

  if (playerId2) {
    if (playerId2?.includes(".")) {
      if (playerId1?.includes(".")) {
        conditions.push(
          `
            (
                SELECT dp->>'new'
                FROM jsonb_array_elements(t.draft_picks) as dp
                WHERE ${draftPickEquals("$1")}
                LIMIT 1
            ) != (
                SELECT dp->>'new'
                FROM jsonb_array_elements(t.draft_picks) as dp
                WHERE ${draftPickEquals(`$${values.length + 1}`)}
                LIMIT 1
            )
        `
        );
      } else {
        conditions.push(
          `
            (
                t.adds ->> $1
            ) != (
                SELECT dp->>'new' 
                FROM jsonb_array_elements(t.draft_picks) AS dp 
                WHERE ${draftPickEquals(`$${values.length + 1}`)}
                LIMIT 1
            )`
        );
      }
    } else {
      if (playerId1?.includes(".")) {
        conditions.push(
          `(
              t.adds ->> $${values.length + 1}
            ) != (
              SELECT dp->>'new' 
              FROM jsonb_array_elements(t.draft_picks) AS dp 
              WHERE ${draftPickEquals("$1")}
              LIMIT 1
            )`
        );
      } else {
        conditions.push(`t.adds ? $${values.length + 1}`);
        conditions.push(`t.adds ->> $1 != t.adds ->> $${values.length + 1}`);
      }
    }
    values.push(playerId2);
  }

  if (playerId3) {
    if (playerId3 === "Price Check") {
      if (playerId1?.includes(".")) {
        conditions.push(`
          (
            WITH pick(new_val) AS (
              SELECT dp->>'new'
              FROM jsonb_array_elements(t.draft_picks) dp
              WHERE ${draftPickEquals("$1")}
              LIMIT 1
            )
            SELECT
              (SELECT count(*) FROM jsonb_array_elements(t.draft_picks) dp
              WHERE dp->>'new' IS NOT DISTINCT FROM (SELECT new_val FROM pick)
              ) = 1
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_each_text(t.adds) e(k, v)
                WHERE v IS NOT DISTINCT FROM (SELECT new_val FROM pick)
              )
          )
        `);
      } else {
        conditions.push(`
          NOT EXISTS (
            SELECT 1 
            FROM jsonb_each_text(t.adds) AS e(k, v)
            WHERE e.k != $1
              AND v = t.adds->>$1
          )
      `);

        conditions.push(`
          NOT EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(t.draft_picks) dp
            WHERE dp->>'new' = t.adds->>$1
          )
      `);
      }
    } else {
      if (playerId3?.includes(".")) {
        if (playerId1?.includes(".")) {
          conditions.push(
            `(
            SELECT dp->>'new' 
            FROM jsonb_array_elements(t.draft_picks) AS dp 
            WHERE ${draftPickEquals("$1")}
            LIMIT 1
        ) = (
            SELECT dp->>'new' 
            FROM jsonb_array_elements(t.draft_picks) AS dp 
            WHERE ${draftPickEquals(`$${values.length + 1}`)}
            LIMIT 1
          )`
          );
        } else {
          conditions.push(`(
            SELECT dp->>'new' 
            FROM jsonb_array_elements(t.draft_picks) AS dp 
            WHERE ${draftPickEquals(`$${values.length + 1}`)}
            LIMIT 1
        ) = t.adds ->> $1`);
        }
      } else {
        if (playerId1?.includes(".")) {
          conditions.push(
            `t.adds ->> $${values.length + 1} != (
            SELECT dp->>'new' 
            FROM jsonb_array_elements(t.draft_picks) AS dp 
            WHERE ${draftPickEquals("$1")}
            LIMIT 1
          )`
          );
        } else {
          conditions.push(`t.adds ->> $1 = t.adds ->> $${values.length + 1}`);
        }
      }
      values.push(playerId3);
    }
  }

  if (playerId4) {
    if (playerId4 === "Price Check") {
      if (playerId2?.includes(".")) {
        conditions.push(`
          (
            WITH pick(new_val) AS (
              SELECT dp->>'new'
              FROM jsonb_array_elements(t.draft_picks) dp
              WHERE ${draftPickEquals("$2")}
              LIMIT 1
            )
            SELECT
              (SELECT count(*) FROM jsonb_array_elements(t.draft_picks) dp
              WHERE dp->>'new' IS NOT DISTINCT FROM (SELECT new_val FROM pick)
              ) = 1
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_each_text(t.adds) e(k, v)
                WHERE v IS NOT DISTINCT FROM (SELECT new_val FROM pick)
              )
          )
        `);
      } else {
        conditions.push(`
          NOT EXISTS (
            SELECT 1 
            FROM jsonb_each_text(t.adds) AS e(k, v)
            WHERE e.k != $2
              AND v = t.adds->>$2
          )
      `);

        conditions.push(`
          NOT EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(t.draft_picks) dp
            WHERE dp->>'new' = t.adds->>$2
          )
      `);
      }
    } else {
      if (playerId4?.includes(".")) {
        if (playerId2?.includes(".")) {
          conditions.push(
            `(
            SELECT dp->>'new' 
            FROM jsonb_array_elements(t.draft_picks) AS dp 
            WHERE ${draftPickEquals("$2")}
            LIMIT 1
          ) = (
            SELECT dp->>'new' 
            FROM jsonb_array_elements(t.draft_picks) AS dp 
            WHERE ${draftPickEquals(`$${values.length + 1}`)}
            LIMIT 1
          )`
          );
        } else {
          conditions.push(`
          (
            SELECT dp->>'new' 
            FROM jsonb_array_elements(t.draft_picks) AS dp 
            WHERE ${draftPickEquals(`$${values.length + 1}`)}
            LIMIT 1
          ) = t.adds ->> $2`);
        }
      } else {
        if (playerId2?.includes(".")) {
          conditions.push(`t.adds ->> $${values.length + 1} = (
            SELECT dp->>'new' 
            FROM jsonb_array_elements(t.draft_picks) AS dp 
            WHERE ${draftPickEquals("$2")}
            LIMIT 1
          )`);
        } else {
          conditions.push(`t.adds ->> $2 = t.adds ->> $${values.length + 1}`);
        }
      }
      values.push(playerId4);
    }
  }

  if (leagueType1 !== "All") {
    conditions.push(`l.settings ->> 'type' = $${values.length + 1}`);

    values.push(leagueType1);
  }

  if (leagueType2 !== "All") {
    conditions.push(`l.settings ->> 'best_ball' = $${values.length + 1}`);

    values.push(leagueType2);
  }

  if (managersParam) {
    const managers: string[] = JSON.parse(managersParam);
    if (managers.length > 0) {
      values.push(managers);
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM jsonb_each_text(t.adds) e(k, v)
          WHERE v = ANY($${values.length}::text[])
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_each_text(t.drops) e(k, v)
          WHERE v = ANY($${values.length}::text[])
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(t.draft_picks) dp
          WHERE dp->>'new' = ANY($${values.length}::text[])
            OR dp->>'old' = ANY($${values.length}::text[])
        )
      )`);
    }
  }

  const getTradesQuery = `
    SELECT t.*, to_jsonb(l) AS league
    FROM trades t
    JOIN leagues l ON t.league_id = l.league_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY t.status_updated DESC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2};
  `;

  const getTradesCountQuery = `
    SELECT count(*)
    FROM trades t
    JOIN leagues l ON t.league_id = l.league_id
    WHERE ${conditions.join(" AND ")}
  `;

  const [{ player_values }, allplayers] = await Promise.all([
    getKtcCurrent(),
    getAllplayersCached(),
  ]);

  const trades = await Promise.all(
    await (
      await pool.query(getTradesQuery, [...values, limit, offset])
    ).rows.map(async (trade) => {
      const rostersMetrics = await addRosterMetrics(
        trade.rosters,
        trade.league.roster_positions,
        Object.fromEntries(player_values),
        allplayers as Allplayer[]
      );
      return {
        ...trade,
        rosters: trade.rosters.map((roster: Roster) => ({
          ...roster,
          ...rostersMetrics[roster.roster_id],
        })),
      };
    })
  );

  const count = await (
    await pool.query(getTradesCountQuery, values)
  ).rows[0].count;

  return NextResponse.json(
    {
      trades,
      count,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": CC,
      },
    }
  );
}
