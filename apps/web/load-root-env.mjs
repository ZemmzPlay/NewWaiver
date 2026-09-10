/**
 * Next only reads a .env next to the app, and this is a monorepo with one .env
 * at the root so `npm run db:seed`, the worker and the web app can never
 * disagree about a connection string. Twelve lines here beats four copies of
 * the file.
 *
 * Existing environment variables always win, so a real deployment that injects
 * them properly is untouched.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadRootEnv() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, '.env');
    if (existsSync(join(dir, 'package-lock.json')) && existsSync(candidate)) {
      for (const line of readFileSync(candidate, 'utf8').split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (process.env[key] !== undefined) continue;
        process.env[key] = rawValue.trim().replace(/^["'](.*)["']$/, '$1');
      }
      return candidate;
    }
    dir = dirname(dir);
  }
  return null;
}
