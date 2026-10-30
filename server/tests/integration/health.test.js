import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';

describe('GET /api/v1/health', () => {
  const app = createApp();

  it('should return 200 and db connected status when database is connected', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      statusCode: 200,
      data: {
        status: 'ok',
        db: 'connected',
      },
      message: 'OK',
    });
  });

  it('should return 503 when database is disconnected', async () => {
    // Temporarily disconnect mongoose
    await mongoose.disconnect();

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe('error');
    expect(res.body.data.db).toBe('disconnected');
  });
});
