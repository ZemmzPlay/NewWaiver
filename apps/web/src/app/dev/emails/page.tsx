import { notFound } from 'next/navigation';
import {
  expiryWarningEmail, loginCodeEmail, pickupRequestEmail, registrationEmail,
} from '@carnival/shared/messaging';
import type { Locale } from '@carnival/shared';

export const dynamic = 'force-dynamic';

/**
 * Every email the system sends, in both languages, side by side.
 *
 * BUILD_PLAN's Friday rehearsal asks you to "test emails to real Gmail, Outlook
 * and iCloud handsets — inbox, not send log". This page is the step before
 * that: it is for checking the words and the layout without burning a send, and
 * for showing someone the Arabic who can actually read it.
 *
 * Development only. In production it 404s, because it renders a sign-in code
 * template and a page that displays one of those has no business existing on a
 * public host.
 */
export default async function EmailPreviewPage({ searchParams }: {
  searchParams: Promise<{ locale?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const query = await searchParams;
  const locale: Locale = query.locale === 'ar' ? 'ar' : 'en';
  const ctx = { baseUrl: 'https://waiver.thecarnival.ae', eventName: 'Carnival', locale };
  const zone = locale === 'ar' ? 'القلاع النطاطة' : 'Bouncy Castles';
  const child = locale === 'ar' ? 'نور' : 'Layla';

  const previews = [
    {
      key: 'registration',
      when: 'Immediately on registering',
      mail: registrationEmail(ctx, {
        code: '815646',
        guardianFirstName: locale === 'ar' ? 'فاطمة' : 'Fatima',
        children: [
          { firstName: child, zoneName: zone, minutes: 30 },
          { firstName: locale === 'ar' ? 'عمر' : 'Omar', zoneName: locale === 'ar' ? 'اللعب الآمن' : 'Soft Play', minutes: 15 },
        ],
      }),
    },
    {
      key: 'expiry_warning',
      when: 'ends_at − 5 min',
      mail: expiryWarningEmail(ctx, {
        code: '815646', childFirstName: child, zoneName: zone, minutesLeft: 5, endsAtLocal: '15:32',
      }),
    },
    {
      key: 'pickup_request',
      when: 'ends_at, drop-off zones only',
      mail: pickupRequestEmail(ctx, { code: '815646', childFirstName: child, zoneName: zone }),
    },
    {
      key: 'login_code',
      when: 'On asking to reopen your page',
      mail: loginCodeEmail(ctx, { otp: '482109' }),
    },
  ];

  return (
    <div style={{ padding: 'var(--space-6)', background: 'var(--ink-50)', minHeight: '100dvh' }}>
      <div className="flex items-baseline justify-between flex-wrap gap-4 mb-6">
        <h1 className="display" style={{ fontSize: 'var(--font-size-3xl)' }}>EMAIL PREVIEW</h1>
        <div className="flex gap-2">
          <a className={`btn btn-sm ${locale === 'en' ? 'btn-secondary' : 'btn-outline'}`} href="?locale=en">English</a>
          <a className={`btn btn-sm ${locale === 'ar' ? 'btn-secondary' : 'btn-outline'}`} href="?locale=ar">العربية</a>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-6)', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        {previews.map((preview) => (
          <div key={preview.key} className="card" style={{ padding: 'var(--space-4)' }}>
            <div className="eyebrow">{preview.key}</div>
            <div className="text-2xs muted mt-1">{preview.when}</div>
            <div className="headline mt-3 mb-3" style={{ fontSize: 'var(--font-size-sm)' }}>
              {preview.mail.subject}
            </div>
            <iframe
              title={preview.key}
              srcDoc={preview.mail.html}
              style={{
                width: '100%', height: '560px', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)', background: 'var(--carnival-white)',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
