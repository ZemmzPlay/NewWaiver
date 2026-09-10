import type { PrintJobInput } from '@carnival/shared';
import { config } from './config';

/**
 * Two paths, in the order HARDWARE.md sets out.
 *
 * 1. The local print agent, which speaks ZPL to the Zebra over TCP:9100.
 * 2. The browser dialog with exact @page sizing.
 *
 * "If the agent is unreachable, the console falls back to a browser print
 * dialog so you're degraded, not dead." The staffer is never asked which one;
 * they tap Start and a sticker comes out.
 */

const AGENT_TIMEOUT_MS = 2500;

export type PrintOutcome = { via: 'agent' } | { via: 'browser' } | { via: 'failed'; reason: string };

/**
 * Opens the popup synchronously, in direct response to the tap that starts a
 * check-in — before `start()`'s first `await`. A browser only allows
 * `window.open()` without asking while it is still inside that gesture; call
 * it any later (after the check-in request round-trip) and every browser
 * blocks it silently, with nothing on screen to say so. `printStickers` then
 * only has to navigate this already-open window, not create one.
 */
export function openPrintWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  return window.open('about:blank', 'carnival-sticker', 'width=420,height=320');
}

export async function printStickers(
  jobs: PrintJobInput['jobs'],
  sessionIds: string[],
  popup: Window | null,
): Promise<PrintOutcome> {
  if (config.printAgentUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
      const response = await fetch(`${config.printAgentUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok) {
        // The label printer took it — the popup opened as a just-in-case was
        // never needed.
        popup?.close();
        return { via: 'agent' };
      }
    } catch {
      // Agent down, wrong IP, laptop swapped. Fall through rather than stop.
    }
  }

  if (!popup) return { via: 'failed', reason: 'popup blocked' };
  popup.location.href = `/sticker?s=${sessionIds.join(',')}&auto=1`;
  return { via: 'browser' };
}
