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
});
