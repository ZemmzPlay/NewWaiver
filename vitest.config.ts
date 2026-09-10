import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Several integration test files (sessions.test.ts, registration.test.ts,
    // notifications.test.ts) share one real Postgres and each temporarily
    // becomes "the" current event via currentEvent()'s earliest-startsAt
    // resolution — a per-process, per-file trick, not something scoped to a
    // single test. Running test files in parallel means two files' fixture
    // events race for that resolution and can steal each other's, producing
    // exactly the kind of intermittent, hard-to-reproduce failures this
    // whole test suite exists to catch. Sequential files avoid it entirely;
    // the full suite is well under a second either way.
    fileParallelism: false,
    // `server-only` is Next.js's build-time guard against a server module
    // ending up in a client bundle — meaningless outside Next's own bundler,
    // and not hoisted anywhere vitest's resolver can find it. Stubbed so
    // apps/web/src/server/*.ts is importable from a plain vitest run.
    alias: { 'server-only': fileURLToPath(new URL('./vitest.stub-server-only.ts', import.meta.url)) },
  },
});
