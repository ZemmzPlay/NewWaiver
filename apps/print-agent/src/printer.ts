import { Socket } from 'node:net';
import { createLogger } from '@carnival/shared';

const log = createLogger('printer');

/**
 * ZPL over TCP:9100. No driver, no print queue, no OS dialog — the reason
 * HARDWARE.md picks the Zebra in the first place.
 */
export async function sendZpl(zpl: string, options: {
  host: string; port: number; timeoutMs?: number;
}): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 4000;

  await new Promise<void>((resolve, reject) => {
    const socket = new Socket();
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error); else resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.once('timeout', () => finish(new Error(`Printer at ${options.host}:${options.port} did not respond`)));
    socket.once('error', (error) => finish(error));
    socket.connect(options.port, options.host, () => {
      socket.write(zpl, 'utf8', () => {
        // The printer never replies to a print job, so a successful flush is
        // the only acknowledgement there is.
        socket.end();
        finish();
      });
    });
    socket.once('close', () => finish());
  });

  log.info('zpl sent', { host: options.host, port: options.port, bytes: zpl.length });
}

/** Opens and closes a socket. Used by /health so a counter knows before a queue forms. */
export async function probe(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const done = (ok: boolean) => { socket.destroy(); resolve(ok); };
    socket.setTimeout(timeoutMs);
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host, () => done(true));
  });
}
