import { createServer } from 'node:http';
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger, printJobInput } from '@carnival/shared';
import { probe, sendZpl } from './printer.js';
import { renderBatch } from './zpl.js';

/**
 * The counter laptop's local print service.
 *
 *   POST /print   { jobs: [{ childName, childCode, zone, timeIn, timeOut }] }
 *   GET  /health
 *
 * It runs on localhost only. The console posts to it and, if it does not
 * answer, falls back to the browser print dialog — degraded, not dead.
 *
 * Node's own http server rather than a framework: this process has to start on
 * a borrowed laptop at 08:00 with no network, and every dependency is a way
 * that fails.
 */

let dir = dirname(fileURLToPath(import.meta.url));
for (let i = 0; i < 6; i += 1) {
  if (existsSync(join(dir, 'package-lock.json'))) { config({ path: join(dir, '.env') }); break; }
  dir = dirname(dir);
}

const log = createLogger('print-agent');
const PORT = Number(process.env.PRINT_AGENT_PORT ?? 9110);
const PRINTER_IP = process.env.PRINTER_IP ?? '';
const PRINTER_PORT = Number(process.env.PRINTER_PORT ?? 9100);
const DRY_RUN = process.env.PRINT_AGENT_DRY_RUN === 'true';

function json(response: import('node:http').ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    // The console is served from another origin; only it needs to reach us.
    'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_BASE_URL ?? '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  });
  response.end(payload);
}

async function readBody(request: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > 64_000) throw new Error('payload too large');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);

  if (request.method === 'OPTIONS') return json(response, 204, {});

  if (request.method === 'GET' && url.pathname === '/health') {
    const reachable = DRY_RUN ? true : PRINTER_IP ? await probe(PRINTER_IP, PRINTER_PORT) : false;
    return json(response, reachable ? 200 : 503, {
      ok: reachable, dryRun: DRY_RUN, printer: PRINTER_IP || null, port: PRINTER_PORT,
    });
  }

  if (request.method === 'POST' && url.pathname === '/print') {
    try {
      const parsed = printJobInput.parse(await readBody(request));
      const zpl = renderBatch(parsed.jobs);

      if (DRY_RUN || !PRINTER_IP) {
        // No printer on this laptop. Log the ZPL so it can be eyeballed, and
        // report success so the console does not fall back unnecessarily.
        log.info('dry run', { labels: parsed.jobs.length, bytes: zpl.length });
        console.log(zpl);
        return json(response, 200, { ok: true, dryRun: true, labels: parsed.jobs.length });
      }

      await sendZpl(zpl, { host: PRINTER_IP, port: PRINTER_PORT });
      log.info('printed', { labels: parsed.jobs.length });
      return json(response, 200, { ok: true, labels: parsed.jobs.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      log.error('print failed', { reason: message.slice(0, 120) });
      return json(response, 502, { ok: false, error: message });
    }
  }

  json(response, 404, { error: 'not_found' });
});

// Bound to loopback: this service must not be reachable from the hall's wifi.
server.listen(PORT, '127.0.0.1', () => {
  log.info('print agent listening', { port: PORT, printer: PRINTER_IP || null, dryRun: DRY_RUN });
});
