import { NextResponse } from "next/server";
import { cachedResponse } from "@/lib/utils/cached-response";
import {
  getAllplayers,
  getAllplayersCached,
  getAllplayersEtagInfo,
} from "./utils/get-allplayers";

const CC = "public, max-age=120, s-maxage=3600, stale-while-revalidate=300";

export async function GET(req: Request) {
  try {
    const etagInfo = await getAllplayersEtagInfo();

    // If fresh and ETag matches, return 304
    if (etagInfo.isFresh && etagInfo.etag) {
      const ifNoneMatch = req.headers.get("if-none-match");
      if (ifNoneMatch === etagInfo.etag) {
        return NextResponse.json(null, {
          status: 304,
          headers: {
            ETag: etagInfo.etag,
            "Last-Modified": etagInfo.lastModified!.toUTCString(),
            "Cache-Control": CC,
          },
        });
      }
    }

    // Get data (from cache if fresh, or refresh from API)
    const { data, etag, lastModified } = await getAllplayers();

    return cachedResponse(req, data, {
      etag,
      lastModified,
      cacheControl: CC,
    });
  } catch (error) {
    // Fallback to stale cache if available
    const cached = await getAllplayersCached();
    if (cached) {
      const { etag } = await getAllplayersEtagInfo();
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
          ETag: etag || "",
        },
      });
    }

    return NextResponse.json(
      { message: "Failed to fetch players", error },
      { status: 500 }
    );
  }
}
