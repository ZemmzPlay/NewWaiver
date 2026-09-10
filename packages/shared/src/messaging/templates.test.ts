import { describe, expect, it } from 'vitest';
import {
  expiryWarningEmail, loginCodeEmail, pickupRequestEmail, registrationEmail,
} from './templates.js';

const en = { baseUrl: 'https://x.test', eventName: 'Carnival', locale: 'en' as const };
const ar = { ...en, locale: 'ar' as const };
const kids = [{ firstName: 'Layla', zoneName: 'Bouncy Castles', minutes: 30 }];

describe('email templates', () => {
  it('shows the code grouped three and three', () => {
    const mail = registrationEmail(en, { code: '815646', guardianFirstName: 'Fatima', children: kids });
    expect(mail.html).toContain('815 646');
    expect(mail.subject).toContain('815 646');
  });

  it('sets the document direction from the locale', () => {
    expect(registrationEmail(en, { code: '815646', guardianFirstName: 'F', children: kids }).html)
      .toContain('dir="ltr"');
    expect(registrationEmail(ar, { code: '815646', guardianFirstName: 'ف', children: kids }).html)
      .toContain('<html lang="ar" dir="rtl"');
  });

  it('isolates the code so Arabic bidi cannot reverse it', () => {
    const mail = registrationEmail(ar, { code: '815646', guardianFirstName: 'ف', children: kids });
    // In the body, as markup...
    expect(mail.html).toContain('<span dir="ltr" style="unicode-bidi:isolate;display:inline-block">815 646</span>');
    // ...and in the subject, where markup is impossible.
    expect(mail.subject).toContain('⁦815 646⁩');
  });

  it('translates the duration unit, not just the number', () => {
    const arabic = registrationEmail(ar, { code: '815646', guardianFirstName: 'ف', children: kids });
    expect(arabic.html).toContain('دقيقة');
    expect(arabic.html).not.toMatch(/\d+ min</);
  });

  it('sends the warning and pickup in the reader’s language', () => {
    expect(expiryWarningEmail(ar, {
      code: '815646', childFirstName: 'نور', zoneName: 'القلاع', minutesLeft: 5, endsAtLocal: '15:32',
    }).subject).toContain('بقيت');
    expect(pickupRequestEmail(ar, { code: '815646', childFirstName: 'نور', zoneName: 'القلاع' }).subject)
      .toContain('عُد لاستلام');
  });

  it('keeps the sign-in code email free of anything the reader has not proved', () => {
    const mail = loginCodeEmail(en, { otp: '482109' });
    expect(mail.html).toContain('482109');
    // No child names, no zone, no registration code, and no link that signs in.
    expect(mail.html).not.toContain('/r/');
    expect(mail.html).not.toMatch(/Layla|Bouncy/);
  });
});
