import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export const errorHandler = (err, req, res, _next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, error.errors || [], err.stack);
  }

  const response = {
    success: false,
    error: {
      code: error.statusCode,
      message: error.message,
      ...(error.errors && error.errors.length > 0 && { details: error.errors }),
      ...(env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  };

  logger.error(`${req.method} ${req.originalUrl} - ${error.statusCode} - ${error.message}`);

  res.status(error.statusCode).json(response);
};
