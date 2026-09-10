import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __carnivalPrisma: PrismaClient | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
  return url;
}

/**
 * One client per process. Next.js in dev re-evaluates modules on every edit, so
 * the client is parked on globalThis to stop the connection count climbing.
 */
export const db = globalThis.__carnivalPrisma ?? new PrismaClient({
  datasourceUrl: connectionString(),
});

if (process.env.NODE_ENV !== 'production') globalThis.__carnivalPrisma = db;

export type Db = typeof db;
