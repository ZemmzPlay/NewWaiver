import type { Channel, OutboundMessage, SendResult } from './channel.js';

/**
 * Development channel. Prints the subject and recipient domain, never the
 * address itself — hard rule 2 applies to a dev terminal too, because dev
 * terminals end up in screenshots.
 */
export function createConsoleChannel(): Channel {
  return {
    name: 'console',
    async send(message: OutboundMessage): Promise<SendResult> {
      const domain = message.to.split('@')[1] ?? 'unknown';
      console.log(`[email:console] to=<redacted>@${domain} subject=${JSON.stringify(message.subject)} ref=${message.reference}`);
      return { ok: true, providerMessageId: `console-${message.reference}` };
    },
  };
}
