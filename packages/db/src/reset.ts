import './env.js';
import { db } from './client.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to reset a production database.');
}

// Prisma's migration ledger (`_prisma_migrations`) lives inside `public`, not
// a separate schema the way Drizzle's did, so dropping and recreating public
// alone also clears it.
await db.$executeRawUnsafe('drop schema if exists public cascade');
await db.$executeRawUnsafe('create schema public');
console.log('schema and migration ledger dropped - run db:migrate next');
await db.$disconnect();
