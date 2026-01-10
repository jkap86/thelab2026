import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/pool";
import axiosInstance from "@/lib/axios-instance";

const CUTOFF = new Date().getTime() - 1 * 60 * 60 * 1000;

const CC = "public, max-age=120, s-maxage=360, stale-while-revalidate=300";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const searched = searchParams.get("searched");

  try {
    const selectQuery = `SELECT * FROM users WHERE username ILIKE $1;`;

    const userDb = await (
      await pool.query(selectQuery, [`%${searched}%`])
    ).rows[0];

    if (!(userDb?.updated_at > new Date(CUTOFF)) || userDb?.type !== "S") {
      let user;
      try {
        user = await axiosInstance.get(
          `https://api.sleeper.app/v1/user/${searched}`
        );
      } catch (err) {
        return NextResponse.json(
          { error: "User not found on Sleeper." },
          { status: 404 }
        );
      }

      const { user_id, display_name, avatar } = user.data;

      const insertQuery = `INSERT INTO users (user_id, username, avatar, type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          username = EXCLUDED.username,
          avatar = EXCLUDED.avatar,
          type = EXCLUDED.type;`;

      await pool.query(insertQuery, [user_id, display_name, avatar, "S"]);

      return NextResponse.json(
        { user_id, username: display_name, avatar },
        { status: 200, headers: { "Cache-Control": CC } }
      );
    } else {
      return NextResponse.json(
        {
          user_id: userDb.user_id,
          username: userDb.username,
          avatar: userDb.avatar,
        },
        { status: 200, headers: { "Cache-Control": CC } }
      );
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json(
        { error: err.message },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      { error: "An unknown error occurred." },
      {
        status: 500,
      }
    );
  }
}
