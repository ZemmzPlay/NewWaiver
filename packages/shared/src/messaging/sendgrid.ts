import type { Channel, OutboundMessage, SendResult } from './channel.js';

export interface SendGridOptions {
  apiKey: string;
  /** "Name <email@domain>" — the local part is split off for SendGrid's from.email/from.name fields. */
  from: string;
}

function parseFrom(from: string): { email: string; name?: string } {
  const match = /^(.*)<(.+)>$/.exec(from.trim());
  if (!match) return { email: from.trim() };
  const name = match[1]!.trim().replace(/^"|"$/g, '');
  return { email: match[2]!.trim(), name: name || undefined };
}

/** Errors worth another tick. Anything else is a bad address, not a bad moment. */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Uses fetch rather than the SendGrid SDK, same rationale Resend used: the
 *  provider swap should not cost an install. */
export function createSendGridChannel(options: SendGridOptions): Channel {
  const from = parseFrom(options.from);

  return {
    name: 'sendgrid',
    async send(message: OutboundMessage): Promise<SendResult> {
      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: message.to }] }],
            from,
            subject: message.subject,
            content: [
              { type: 'text/plain', value: message.text },
              { type: 'text/html', value: message.html },
            ],
            // Correlates the Event Webhook callback back to the notifications row.
            custom_args: { reference: message.reference },
          }),
        });

        if (response.ok) {
          // SendGrid returns 202 with no body; the message id is in the header.
          const providerMessageId = response.headers.get('x-message-id') ?? 'unknown';
          return { ok: true, providerMessageId };
        }
        const detail = await response.text();
        return {
          ok: false,
          error: `HTTP ${response.status}: ${detail.slice(0, 200)}`,
          retryable: isRetryable(response.status),
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          retryable: true,
        };
      }
    },
  };
}
