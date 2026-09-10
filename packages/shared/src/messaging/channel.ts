/**
 * Hard rule 6: messaging is behind a Channel interface. EmailChannel is the
 * only implementation for now; nothing else in the codebase knows which channel
 * is in use, so WhatsApp can be added after the event without a rewrite.
 */

export interface OutboundMessage {
  /** Email address today. A phone number when a WhatsApp channel is added. */
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Correlates a provider callback back to the notifications row. */
  reference: string;
}

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; retryable: boolean };

export interface Channel {
  readonly name: string;
  send(message: OutboundMessage): Promise<SendResult>;
}
