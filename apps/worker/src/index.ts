import '@carnival/db/env';
import { db, runDueNotifications } from '@carnival/db';
import { WORKER_TICK_MS, createLogger } from '@carnival/shared';
import { advanceSessions } from './transitions.js';

/**
 * The timer. Ticks every 20 seconds; each step is its own transaction so a
 * failure in one does not roll back the others.
 *
 *   1. claim due notifications, then send  (hard rule 4: claim-then-send)
 *   2. advance active -> warned -> expired -> overdue
 *   3. heartbeat
 *
 * Everything it does is idempotent, so a crash and restart mid-tick costs a
 * duplicate log line and nothing else.
 */

const log = createLogger('worker');
let running = false;
let stopping = false;

async function tick() {
  if (running) {
    log.warn('previous tick still running, skipping');
    return;
  }
  running = true;
  const startedAt = Date.now();

  try {
    const sent = await runDueNotifications();
    const moved = await advanceSessions();

    if (sent || moved.warned || moved.expired || moved.overdue) {
      log.info('tick', {
        sent, warned: moved.warned, expired: moved.expired, overdue: moved.overdue,
        ms: Date.now() - startedAt,
      });
    }
  } catch (error) {
    log.error('tick failed', { message: error instanceof Error ? error.name : 'unknown' });
  } finally {
    running = false;
  }
}

async function main() {
  log.info('worker starting', { tickMs: WORKER_TICK_MS, provider: process.env.MESSAGING_PROVIDER ?? 'console' });
  await tick();
  const timer = setInterval(tick, WORKER_TICK_MS);

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info('shutting down', { signal });
    clearInterval(timer);
    // Let an in-flight send finish rather than leaving a row claimed but unsent.
    for (let i = 0; i < 50 && running; i += 1) await new Promise((r) => setTimeout(r, 100));
    await db.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

await main();
