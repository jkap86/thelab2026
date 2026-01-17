import axiosInstance from "./lib/axios-instance";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const getApiBaseUrl = (): string => {
  return process.env.NODE_ENV === "production"
    ? "https://the-lab.southharmonff.com"
    : "http://localhost:3000";
};

/**
 * Sanitize IP address to prevent log injection
 */
const sanitizeIp = (ip: string): string => {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  const cleaned = ip.trim().slice(0, 45);

  if (ipv4Regex.test(cleaned) || ipv6Regex.test(cleaned)) {
    return cleaned;
  }

  return "Invalid IP";
};

/**
 * Sanitize route path to prevent log injection
 */
const sanitizeRoute = (route: string): string => {
  // Only allow alphanumeric, slashes, hyphens, and underscores
  return route.replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 200);
};

export async function middleware(request: NextRequest) {
  // Extract and sanitize IP address
  const rawIp =
    (request.headers.get("x-forwarded-for") || "Unknown IP")
      .split(",")[0]
      ?.trim()
      .replace(/^::ffff:/, "") || "Unknown IP";

  const ipAddress = rawIp === "Unknown IP" ? rawIp : sanitizeIp(rawIp);
  const route = sanitizeRoute(request.nextUrl.pathname);

  const url = getApiBaseUrl();
  const redirectUrl = new URL("/api/common/logs/update", url);

  redirectUrl.searchParams.set("ip", ipAddress);
  redirectUrl.searchParams.set("route", route);

  // Fire-and-forget logging - use .catch() to handle promise rejection
  axiosInstance.get(redirectUrl.toString()).catch(() => {
    // Silently fail - logging should not block requests
  });

  return NextResponse.next();
}

// Define the routes this middleware applies to
export const config = {
  matcher: [
    "/manager/:path+",
    "/playoffs/:path+",
    "/trades/:path*",
    "/picktracker/:path+",
  ],
};
