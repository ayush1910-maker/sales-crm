import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Middleware factory for validating incoming Express requests with Zod schemas.
 * Can validate req.body by default, or { body, query, params } if configured.
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'query' | 'params' | 'all'} source
 */
export const validate = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      if (source === 'all') {
        const parsed = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        if (parsed.body !== undefined) req.body = parsed.body;
        if (parsed.query !== undefined) req.query = parsed.query;
        if (parsed.params !== undefined) req.params = parsed.params;
      } else {
        const parsed = await schema.parseAsync(req[source]);
        req[source] = parsed;
      }
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return next(new ApiError(400, 'Validation failed', errors));
      }
      return next(err);
    }
  };
};
