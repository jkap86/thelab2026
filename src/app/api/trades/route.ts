import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pool";

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
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");

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
                SELECT dp1->>'new'
                FROM jsonb_array_elements(t.draft_picks) as dp1
                WHERE ${draftPickEquals("$1")}
                LIMIT 1
            ) != (
                SELECT dp2->>'new'
                FROM jsonb_array_elements(t.draft_picks) as dp2
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

      values.push(playerId2);
    }
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
              (SELECT count(*) FROM jsonb_array_elements(t.draft_picks) dp2
              WHERE dp2->>'new' IS NOT DISTINCT FROM (SELECT new_val FROM pick)
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
              (SELECT count(*) FROM jsonb_array_elements(t.draft_picks) dp2
              WHERE dp2->>'new' IS NOT DISTINCT FROM (SELECT new_val FROM pick)
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

  const trades = await (
    await pool.query(getTradesQuery, [...values, limit, offset])
  ).rows;

  const tradesCount = await (
    await pool.query(getTradesCountQuery, values)
  ).rows[0].count;

  return NextResponse.json({
    trades,
    tradesCount,
  });
}
