import pool from "@/lib/pool";

export async function getLeaguemateUserIds(username: string): Promise<string[]> {
  // First get the user_id from username
  const userResult = await pool.query(
    "SELECT user_id FROM users WHERE LOWER(username) = LOWER($1)",
    [username]
  );

  if (userResult.rows.length === 0) {
    return [];
  }

  const userId = userResult.rows[0].user_id;

  // Get all unique user_ids from leagues where this user is a member
  // Use CTE to first find user's leagues, then extract leaguemates
  const leaguematesResult = await pool.query(
    `WITH user_leagues AS (
       SELECT league_id
       FROM leagues,
       jsonb_array_elements(rosters) as r
       WHERE r->>'user_id' = $1
     )
     SELECT DISTINCT r->>'user_id' as user_id
     FROM leagues l
     JOIN user_leagues ul ON l.league_id = ul.league_id,
     jsonb_array_elements(l.rosters) as r
     WHERE r->>'user_id' IS NOT NULL`,
    [userId]
  );

  return leaguematesResult.rows.map((row) => row.user_id);
}
