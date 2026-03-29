import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function createRateLimiter(requests: number, window: string) {
  // If Redis is not configured, return a no-op limiter for development
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      limit: async (_identifier: string) => ({
        success: true,
        limit: requests,
        remaining: requests - 1,
        reset: Date.now() + 60000,
      }),
    };
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window as `${number} ${"s" | "m" | "h" | "d"}`),
    analytics: true,
  });
}

// Login: 5 attempts per 15 minutes per IP
export const loginRateLimit = createRateLimiter(5, "15 m");

// Registration: 3 per hour per IP
export const registerRateLimit = createRateLimiter(3, "1 h");

// OCR scan: 10 per hour per user
export const scanRateLimit = createRateLimiter(10, "1 h");

// General API: 100 per minute per user
export const generalRateLimit = createRateLimiter(100, "1 m");

export async function checkRateLimit(
  limiter: ReturnType<typeof createRateLimiter>,
  identifier: string
): Promise<{ success: boolean; remainingRequests: number }> {
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remainingRequests: result.remaining,
  };
}
