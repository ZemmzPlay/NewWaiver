import { createPublicKey, verify } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@carnival/db';
import { createLogger } from '@carnival/shared';

export const dynamic = 'force-dynamic';

const log = createLogger('webhook:sendgrid');

/**
 * SendGrid Event Webhook: bounce, drop and complaint notifications.
 *
 * This is the mechanism behind the highest-value detail in the design: the
 * confirmation email doubles as a channel test, and a failed delivery has to
 * raise a warning on the counter screen before the child goes in.
 *
 * Unlike the old SES/SNS route, this one carries a real signature: SendGrid
 * signs `timestamp + rawBody` with an ECDSA key and the verification key
 * (base64, from the SendGrid dashboard's Event Webhook settings) is
 * SENDGRID_WEBHOOK_SIGNING_KEY. Every request is verified before its JSON is
 * even parsed.
 */

const SIGNATURE_HEADER = 'x-twilio-email-event-webhook-signature';
const TIMESTAMP_HEADER = 'x-twilio-email-event-webhook-timestamp';
/** SendGrid's own documented tolerance for the Event Webhook. A valid,
 *  captured request older than this is a replay, not a late delivery. */
const MAX_TIMESTAMP_SKEW_SECONDS = 600;

interface SendGridEvent {
  event?: string;
  email?: string;
  reference?: string;
  [key: string]: unknown;
}

function verifySignature(publicKeyBase64: string, rawBody: string, timestamp: string, signatureBase64: string): boolean {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const signedPayload = Buffer.from(timestamp + rawBody);
    return verify('sha256', signedPayload, publicKey, Buffer.from(signatureBase64, 'base64'));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const signingKey = process.env.SENDGRID_WEBHOOK_SIGNING_KEY;
  const signature = request.headers.get(SIGNATURE_HEADER);
  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  const rawBody = await request.text();

  if (!signingKey || !signature || !timestamp || !verifySignature(signingKey, rawBody, timestamp, signature)) {
    log.warn('sendgrid webhook signature rejected');
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // The signature alone doesn't stop a captured valid request being replayed
  // indefinitely — the timestamp is signed material too, but nothing checked
  // it against the clock.
  const skewSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(skewSeconds) || skewSeconds > MAX_TIMESTAMP_SKEW_SECONDS) {
    log.warn('sendgrid webhook timestamp outside tolerance', { skewSeconds });
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let events: SendGridEvent[];
  try {
    events = JSON.parse(rawBody) as SendGridEvent[];
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  for (const event of events) {
    const verdict =
      event.event === 'bounce' || event.event === 'dropped' ? 'bounced'
      : event.event === 'spamreport' ? 'complained'
      : event.event === 'delivered' ? 'delivered'
      : null;

    if (!verdict) continue;

    if (event.email) {
      // Case-insensitive: SendGrid echoes the address as the sender wrote it.
      await db.guardian.updateMany({
        where: { email: { equals: event.email, mode: 'insensitive' } },
        data: { emailStatus: verdict },
      });
    }

    if (event.reference) {
      await db.notification.updateMany({
        where: { id: event.reference },
        data: {
          status: verdict === 'delivered' ? 'delivered' : 'failed',
          error: verdict === 'delivered' ? null : `sendgrid:${event.event}`,
        },
      });
    }

    log.info('sendgrid event applied', { type: event.event, verdict, notificationId: event.reference ?? null });
  }

  return NextResponse.json({ ok: true });
}
