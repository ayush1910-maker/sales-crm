import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { cleanEnv, str, port, url } from 'envalid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from the server root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ['development', 'test', 'production'],
    default: 'development',
  }),
  PORT: port({ default: 5000 }),
  MONGODB_URI: url({
    desc: 'MongoDB connection string (e.g., mongodb://127.0.0.1:27017/sales_crm)',
  }),
  PLACES_PROVIDER: str({
    choices: ['mock', 'google'],
    default: 'mock',
    desc: 'Provider for Places search: mock (Phases 1-5) or google (Phase 6 only)',
  }),
  CORS_ORIGIN: str({
    default: 'http://localhost:5173',
    desc: 'Frontend URL for CORS origin allowlist',
  }),
  JWT_ACCESS_SECRET: str({
    default: 'development-jwt-access-secret-key-32-chars-min',
    desc: 'Secret key for signing short-lived access JWTs',
  }),
  JWT_REFRESH_SECRET: str({
    default: 'development-jwt-refresh-secret-key-32-chars-min',
    desc: 'Secret key for signing refresh JWTs',
  }),
  JWT_ACCESS_EXPIRES_IN: str({
    default: '15m',
    desc: 'Access token expiration time (e.g. 15m)',
  }),
  JWT_REFRESH_EXPIRES_IN: str({
    default: '7d',
    desc: 'Refresh token expiration time (e.g. 7d)',
  }),
});
