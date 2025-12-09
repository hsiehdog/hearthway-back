import Redis from "ioredis";

const host = process.env.REDIS_HOST || "127.0.0.1";
const port = Number(process.env.REDIS_PORT || 6379);

export const redis = new Redis({
  host,
  port,
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

redis.on("error", (error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Redis error", error);
});

redis.on("connect", () => {
  // eslint-disable-next-line no-console
  console.info("Redis connected");
});

export const ensureRedisConnection = async (): Promise<void> => {
  if (redis.status === "ready" || redis.status === "connecting") return;
  await redis.connect().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error("Redis connect failed", error);
  });
};
