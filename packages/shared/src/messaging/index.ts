/**
 * Provider selection is a config value, not a deploy. Flip MESSAGING_PROVIDER
 * and nothing else changes.
 */

import type { Channel } from './channel.js';
import { createConsoleChannel } from './console.js';
import { createSendGridChannel } from './sendgrid.js';

export type { Channel, OutboundMessage, SendResult } from './channel.js';
export * from './templates.js';

let cached: Channel | null = null;

export function getChannel(): Channel {
  if (cached) return cached;
  const provider = process.env.MESSAGING_PROVIDER ?? 'console';
  const from = process.env.MESSAGING_FROM ?? 'Carnival <no-reply@example.invalid>';

  switch (provider) {
    case 'sendgrid': {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) throw new Error('MESSAGING_PROVIDER=sendgrid but SENDGRID_API_KEY is not set');
      cached = createSendGridChannel({ apiKey, from });
      break;
    }
    case 'console':
      cached = createConsoleChannel();
      break;
    default:
      throw new Error(`Unknown MESSAGING_PROVIDER: ${provider}`);
  }
  return cached;
}

/** Test seam. */
export function setChannel(channel: Channel | null) {
  cached = channel;
}
