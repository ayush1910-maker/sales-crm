import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Rate limiter for authentication routes (login, register, refresh)
 * Limits brute force attacks while remaining unrestrictive during test runs.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 1000 : 20, // 20 attempts per 15 min in prod/dev
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: {
    success: false,
    error: {
      code: 429,
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
  skip: () => env.NODE_ENV === 'test' && process.env.ENABLE_TEST_RATE_LIMIT !== 'true',
});

/**
 * General API rate limiter
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 429,
      message: 'Too many requests. Please slow down.',
    },
  },
  skip: () => env.NODE_ENV === 'test' && process.env.ENABLE_TEST_RATE_LIMIT !== 'true',
});
