import pool from "@/lib/pool";

// Cheap query - just get timestamp for ETag check
export async function getKtcLastUpdated() {
  const result = await pool.query(`
    SELECT MAX(updated_at) AS last_updated
    FROM ktc_dynasty
    WHERE date = (SELECT MAX(date) FROM ktc_dynasty)
  `);

  const lastUpdated = result.rows[0]?.last_updated as Date | null;

  return {
    etag: lastUpdated ? `W/"${new Date(lastUpdated).getTime()}"` : "",
    lastModified: lastUpdated ? new Date(lastUpdated) : undefined,
  };
}

// Full query - only called if ETag doesn't match
export async function getKtcCurrent() {
  const query = `
    WITH latest_date AS (
      SELECT MAX(date) as d
      FROM ktc_dynasty
    )
    SELECT
      ld.d AS latest_date,
      MIN(k.updated_at) AS last_updated,
      jsonb_object_agg(k.player_id, k.value) AS player_values
    FROM ktc_dynasty k
    JOIN latest_date ld ON k.date = ld.d
    GROUP BY ld.d;
  `;

  const result = await pool.query(query);
  const { latest_date, last_updated, player_values } = result.rows[0];

  return {
    latest_date,
    last_updated,
    player_values: Object.entries(
      player_values as { [player_id: string]: number }
    ),
  };
}
