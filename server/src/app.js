import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { ApiResponse } from './utils/ApiResponse.js';
import { ApiError } from './utils/ApiError.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import orgRoutes from './modules/organizations/org.routes.js';

export const createApp = () => {
  const app = express();

  // Security headers & basic middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API v1 Health Check Endpoint
  app.get('/api/v1/health', (req, res) => {
    // Check MongoDB connection state: 1 = connected
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      return res.status(200).json(
        ApiResponse.ok(
          {
            status: 'ok',
            db: 'connected',
          },
          'OK'
        )
      );
    }

    return res.status(503).json({
      success: false,
      data: {
        status: 'error',
        db: 'disconnected',
      },
      message: 'Database is disconnected',
    });
  });

  // API v1 Feature Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/orgs', orgRoutes);

  // Catch-all 404 for undefined routes
  app.use((req, res, next) => {
    next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
