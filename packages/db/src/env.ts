/**
 * One .env at the repo root, loaded the same way from every workspace package,
 * so `npm run db:seed` and `npm run dev:worker` never disagree about a
 * connection string. Hard rule 9: nothing here has a default that reaches a
 * real service.
 */
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function findRepoRoot(from: string): string {
  let dir = from;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'package-lock.json'))) return dir;
    dir = dirname(dir);
  }
  return from;
}

const root = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
config({ path: join(root, '.env') });

export const repoRoot = root;
