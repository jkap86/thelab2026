import { NextResponse } from "next/server";

type CacheOptions = {
  cacheControl?: string;
  lastModified?: Date;
};

type EtagInfo = {
  etag: string;
  lastModified?: Date;
};

// Simple version - data already fetched
export function cachedResponse<T>(
  req: Request,
  data: T,
  options: CacheOptions & { etag: string }
) {
  const {
    cacheControl = "public, max-age=120, s-maxage=1200, stale-while-revalidate=300",
    etag,
    lastModified,
  } = options;

  const ifNoneMatch = req.headers.get("if-none-match");

  const headers: Record<string, string> = {
    ETag: etag,
    "Cache-Control": cacheControl,
  };

  if (lastModified) {
    headers["Last-Modified"] = lastModified.toUTCString();
  }

  if (ifNoneMatch === etag) {
    return NextResponse.json(null, { status: 304, headers });
  }

  return NextResponse.json(data, { status: 200, headers });
}

// Lazy version - only fetches data if ETag doesn't match
export async function cachedResponseLazy<T>(
  req: Request,
  getEtagInfo: () => Promise<EtagInfo>,
  getData: () => Promise<T>,
  options?: CacheOptions
) {
  const cacheControl =
    options?.cacheControl ??
    "public, max-age=120, s-maxage=1200, stale-while-revalidate=300";

  const { etag, lastModified } = await getEtagInfo();
  const ifNoneMatch = req.headers.get("if-none-match");

  const headers: Record<string, string> = {
    ETag: etag,
    "Cache-Control": cacheControl,
  };

  if (lastModified) {
    headers["Last-Modified"] = lastModified.toUTCString();
  }

  // Early return - skip data fetch
  if (ifNoneMatch === etag) {
    return NextResponse.json(null, { status: 304, headers });
  }

  // Only fetch full data if needed
  const data = await getData();
  return NextResponse.json(data, { status: 200, headers });
}
