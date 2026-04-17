import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.headers['x-real-ip'] as string
    || req.ip
    || 'unknown';
}

export function createRateLimiter(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${getClientIp(req)}:${req.path}`;
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
      };
    }
    
    entry.count++;
    
    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      });
      return;
    }
    
    rateLimitStore.set(key, entry);
    res.set('X-RateLimit-Limit', String(config.maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - entry.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    
    next();
  };
}

// Pre-configured limiters for auth endpoints
export const authRateLimits = {
  registerStart: createRateLimiter({ windowMs: 60000, maxRequests: 5 }),
  registerVerify: createRateLimiter({ windowMs: 60000, maxRequests: 10 }),
  registerComplete: createRateLimiter({ windowMs: 60000, maxRequests: 5 }),
  login: createRateLimiter({ windowMs: 60000, maxRequests: 10 }),
  refresh: createRateLimiter({ windowMs: 60000, maxRequests: 20 }),
};