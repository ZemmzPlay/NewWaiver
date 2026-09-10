'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { normaliseRegistrationCode, toE164 } from '@carnival/shared';
import { lookUpCodeAction, requestCodeAction, verifyCodeAction } from '@/app/actions/login';
import { useLocale } from './LocaleProvider';
import { TextField } from './register/Field';

/**
 * "Open my page again."
 *
 * Two ways in, and the fast one is first. A guardian who still has the six
 * digits types them and is through in one step. A guardian who has lost them
 * types the mobile number they registered with and we email a one-time code to
 * the address already on file.
 *
 * The mobile number alone never opens anything — it is printed on a sticker and
 * said out loud at a counter all day, so it only decides where the code is sent.
 */
type Stage = 'choose' | 'awaiting-otp';

export function FindFlow() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('choose');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otp, setOtp] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function openWithCode() {
    setError(null);
    const normalised = normaliseRegistrationCode(code);
    if (!normalised) { setError(t.find.codeError); return; }
    setBusy(true);
    const result = await lookUpCodeAction(normalised);
    setBusy(false);
    if (!result.ok) { setError(t.find.codeError); return; }
    router.push(`/r/${normalised}`);
  }

  async function sendCode() {
    setError(null);
    setNote(null);
    setBusy(true);
    const result = await requestCodeAction(phone, locale);
    setBusy(false);
    if (!result.ok) {
      setError(result.reason === 'too_many' ? t.find.tooMany : t.find.notFound);
      return;
    }
    setEmailHint(result.emailHint);
    setStage('awaiting-otp');
  }

  async function verify() {
    setError(null);
    setBusy(true);
    const result = await verifyCodeAction(phone, otp);
    setBusy(false);
    if (!result.ok) {
      setError(result.reason === 'too_many' ? t.find.tooMany : t.find.badOtp);
      return;
    }
    router.push(`/r/${result.code}`);
  }

  if (stage === 'awaiting-otp') {
    return (
      <div className="px-6 py-10 max-w-[--container-narrow] mx-auto flex flex-col gap-6">
        <div>
          <h1 className="headline" style={{ fontSize: 'var(--font-size-2xl)' }}>{t.find.codeHeading}</h1>
          <p className="mt-2 text-sm muted">{t.find.codeHelp(emailHint)}</p>
        </div>

        <TextField
          label={t.find.otpLabel}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="numeric"
          style={{ fontSize: 'var(--font-size-2xl)', letterSpacing: 'var(--tracking-caps)' }}
          error={error}
        />

        {note ? <div className="notice notice-info">{note}</div> : null}

        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={busy || otp.length !== 6}
          onClick={verify}
        >
          {busy ? t.find.verifying : t.find.verify}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={async () => { await sendCode(); setNote(t.find.resent); }}
        >
          {t.find.resend}
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-10 max-w-[--container-narrow] mx-auto flex flex-col gap-8">
      <div>
        <h1 className="headline" style={{ fontSize: 'var(--font-size-2xl)' }}>{t.find.heading}</h1>
      </div>

      <div className="card card-block flex flex-col gap-4">
        <div className="eyebrow">{t.find.useCode}</div>
        <TextField
          label={t.find.codeEntry}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/[^\d\s]/g, '').slice(0, 7))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="482 109"
          className="numeric"
          style={{ fontSize: 'var(--font-size-2xl)', letterSpacing: 'var(--tracking-wide)' }}
          hint={t.find.codeEntryHint}
        />
        <button
          type="button"
          className="btn btn-secondary btn-lg"
          disabled={busy || !normaliseRegistrationCode(code)}
          onClick={openWithCode}
        >
          {t.find.openPage}
        </button>
      </div>

      <div className="card flex flex-col gap-4">
        <div className="eyebrow">{t.landing.alreadyRegistered}</div>
        <p className="text-sm muted">{t.find.help}</p>
        <TextField
          label={t.find.mobile}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t.guardianStep.mobilePlaceholder}
        />
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={busy || !toE164(phone)}
          onClick={sendCode}
        >
          {busy ? t.find.sending : t.find.sendCode}
        </button>
      </div>

      {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}
    </div>
  );
}
