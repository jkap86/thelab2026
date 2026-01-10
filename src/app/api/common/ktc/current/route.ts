import { NextResponse } from "next/server";
import { cachedResponseLazy } from "@/lib/utils/cached-response";
import { getKtcCurrent, getKtcLastUpdated } from "./utils/get-ktc-current";

export async function GET(req: Request) {
  try {
    return await cachedResponseLazy(
      req,
      getKtcLastUpdated, // Cheap query first
      getKtcCurrent // Full query only if ETag doesn't match
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Error fetching KTC values" },
      { status: 500 }
    );
  }
}
