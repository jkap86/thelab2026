import { getLiveStats } from "../../../utils/get-live-stats";

type CachedData = {
  data: Awaited<ReturnType<typeof getLiveStats>>;
  timestamp: number;
  key: string;
};

let cache: CachedData | null = null;
let fetchPromise: Promise<CachedData["data"]> | null = null;

export async function getCachedLiveStats(
  week: string,
  season: number,
  seasonType: "regular" | "post"
) {
  const key = `${season}-${seasonType}-${week}`;
  const now = Date.now();

  // Return cached data if fresh
  if (cache && cache.key === key && now - cache.timestamp < cache.data.delay) {
    return cache.data;
  }

  // If fetch already in progress, wait for it
  if (fetchPromise) {
    return fetchPromise;
  }

  // Start new fetch (only one at a time)
  console.log("---fetching live stats---");
  fetchPromise = getLiveStats(week, season, seasonType).then((result) => {
    cache = { data: result, timestamp: Date.now(), key };
    fetchPromise = null;
    return result;
  });

  return fetchPromise;
}
