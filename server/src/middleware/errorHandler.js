import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export const errorHandler = (err, req, res, _next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'field';
      error = new ApiError(409, `A record with that ${field} already exists`);
    } else if (error.name === 'JsonWebTokenError') {
      error = new ApiError(401, 'Invalid authentication token');
    } else if (error.name === 'TokenExpiredError') {
      error = new ApiError(401, 'Authentication token expired');
    } else if (error.name === 'CastError') {
      error = new ApiError(400, `Invalid ID format for ${error.path}`);
    } else {
      const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
      const message = error.message || 'Internal Server Error';
      error = new ApiError(statusCode, message, error.errors || [], err.stack);
    }
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
