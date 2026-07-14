import { NextFunction, Request, Response } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createRateLimitMiddleware(windowMs: number, maxRequests: number) {
  const entries = new Map<string, RateLimitEntry>();

  return (request: Request, response: Response, next: NextFunction) => {
    if (request.path === '/api/health' || request.path === '/api/health/ready') {
      next();
      return;
    }
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const current = entries.get(key);
    const entry =
      !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    entries.set(key, entry);
    response.setHeader('RateLimit-Limit', maxRequests);
    response.setHeader('RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    response.setHeader('RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
    if (entry.count > maxRequests) {
      response.setHeader('Retry-After', Math.max(1, Math.ceil((entry.resetAt - now) / 1000)));
      response.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please retry shortly.',
        requestId: (request as Request & { requestId?: string }).requestId,
      });
      return;
    }
    next();
  };
}
