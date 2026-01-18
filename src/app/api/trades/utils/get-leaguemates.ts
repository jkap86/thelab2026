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
  const leaguematesResult = await pool.query(
    `SELECT DISTINCT r->>'user_id' as user_id
     FROM leagues,
     jsonb_array_elements(rosters) as r
     WHERE EXISTS (
       SELECT 1 FROM jsonb_array_elements(rosters) as r2
       WHERE r2->>'user_id' = $1
     )
     AND r->>'user_id' IS NOT NULL`,
    [userId]
  );

  return leaguematesResult.rows.map((row) => row.user_id);
}
