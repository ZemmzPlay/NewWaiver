import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mirrors packages/db/src/env.ts's convention: one .env at the repo root.
// `override: false` lets an already-set DATABASE_URL (e.g. in CI) win over the file.
config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env'), override: false });
