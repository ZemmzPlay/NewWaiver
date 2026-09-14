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
  // Require .env next to the lockfile so a stray package-lock.json higher up
  // the tree (e.g. in the user home directory) cannot win.
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'package-lock.json')) && existsSync(join(dir, '.env'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  dir = from;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'package-lock.json'))) return dir;
    dir = dirname(dir);
  }
  return from;
}

const root = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
config({ path: join(root, '.env') });

export const repoRoot = root;
