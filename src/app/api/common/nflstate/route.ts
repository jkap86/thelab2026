import { NextResponse } from "next/server";
import pool from "@/lib/pool";
import axiosInstance from "@/lib/axios-instance";
import { NflState } from "@/lib/types/common-types";

const CC = "public, max-age=120, s-maxage=1800, stale-while-revalidate=300";

export async function GET(req: Request) {
  try {
    const nflStateDb = await (
      await pool.query("SELECT * FROM common WHERE name = 'nflState'")
    ).rows[0];

    const freshInDb =
      nflStateDb &&
      new Date().getTime() - 1000 * 60 * 60 * 12 <
        new Date(nflStateDb.updated_at).getTime();

    const etag = nflStateDb
      ? `W/"${new Date(nflStateDb.updated_at).getTime()}"`
      : undefined;

    const ifNoneMatch = req.headers.get("if-none-match");

    if (etag && ifNoneMatch === etag && freshInDb) {
      return NextResponse.json(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Last-Modified": new Date(nflStateDb.updated_at).toUTCString(),
          "Cache-Control": CC,
        },
      });
    }

    if (freshInDb && nflStateDb && etag) {
      return NextResponse.json(nflStateDb.data, {
        status: 200,
        headers: {
          "Cache-Control": CC,
          ETag: etag,
        },
      });
    }

    try {
      const response: { data: { season: string; leg: number; week: number } } =
        await axiosInstance.get("https://api.sleeper.app/v1/state/nfl");

      const nflState: NflState = {
        ...response.data,
        season: parseInt(process.env.SEASON!),
        leg:
          process.env.SEASON! === response.data.season ? response.data.leg : 1,
      };

      await pool.query(
        `INSERT INTO common (name, data) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET data =$2`,
        ["nflState", nflState]
      );

      const now = new Date();
      const newEtag = `W/"${now.getTime()}"`;

      return NextResponse.json(nflState, {
        status: 200,
        headers: {
          "Cache-Control": CC,
          ETag: newEtag,
        },
      });
    } catch (err) {
      if (nflStateDb) {
        return NextResponse.json(nflStateDb.data, {
          status: 200,
          headers: {
            "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
            ETag: etag || "",
          },
        });
      }

      throw err;
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load nfl state - ", err },
      { status: 500 }
    );
  }
}
