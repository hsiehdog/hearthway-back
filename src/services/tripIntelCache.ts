import { redis, ensureRedisConnection } from "../lib/redisClient";
import { computeInputHash } from "../utils/hash";
import type { TripIntelSectionResponse } from "./tripIntelService";
import type { TripIntelSection } from "./tripIntelService";

const CACHE_VERSION = "v1";

const tripIntelKey = (tripId: string, section: TripIntelSection) =>
  `trip:intel:${CACHE_VERSION}:${tripId}:${section}`;

type CachedPayload = {
  inputHash: string;
  payload: TripIntelSectionResponse;
};

export const getTripIntelFromCache = async (
  tripId: string,
  section: TripIntelSection,
  inputHash: string
): Promise<TripIntelSectionResponse | null> => {
  await ensureRedisConnection();
  const key = tripIntelKey(tripId, section);
  const cached = await redis.get(key);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached) as CachedPayload;
    if (parsed.inputHash !== inputHash) return null;
    return { ...parsed.payload, fromCache: true };
  } catch {
    return null;
  }
};

export const setTripIntelCache = async (
  tripId: string,
  section: TripIntelSection,
  inputHash: string,
  payload: TripIntelSectionResponse
): Promise<void> => {
  await ensureRedisConnection();
  const key = tripIntelKey(tripId, section);
  const value: CachedPayload = {
    inputHash,
    payload,
  };
  await redis.set(key, JSON.stringify(value));
};

const invalidateAllTripIntel = async (tripId: string): Promise<void> => {
  await ensureRedisConnection();
  const pattern = tripIntelKey(tripId, "*" as TripIntelSection);
  const stream = redis.scanStream({ match: pattern, count: 100 });
  const keys: string[] = [];

  await new Promise<void>((resolve) => {
    stream.on("data", (resultKeys: string[]) => {
      keys.push(...resultKeys);
    });
    stream.on("end", () => resolve());
  });

  if (keys.length) {
    await redis.del(...keys);
  }
};

export const buildTripIntelInputHash = (
  input: unknown,
  section: TripIntelSection
): string => {
  return computeInputHash({ section, input });
};
