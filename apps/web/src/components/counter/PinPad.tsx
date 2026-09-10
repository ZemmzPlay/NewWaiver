'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInAction } from '@/app/actions/counter';
import { Shape, Wordmark } from '../Brand';
import { LocaleToggle } from '../LocaleToggle';
import { useLocale } from '../LocaleProvider';

/**
 * Unlock. A keypad rather than a text input, because a staffer is standing at a
 * counter and may be wearing gloves, and because a numeric keyboard on a laptop
 * is a mouse trip to nowhere.
 */
export function PinPad({ zones }: { zones: { id: string; name: string }[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = (digit: string) => {
    setError(null);
    setPin((prev) => (prev.length >= 8 ? prev : prev + digit));
  };

  async function submit(value: string) {
    setBusy(true);
    const result = await signInAction(value, zoneId || undefined);
    if (result.ok) { router.refresh(); return; }
    setBusy(false);
    setPin('');
    setError(
      result.error === 'wrong_zone' && result.homeZoneName
        ? t.counter.chooseZoneFirst(result.homeZoneName)
        : result.message,
    );
  }

  return (
    <div className="min-h-dvh bg-indigo flex flex-col items-center justify-center gap-8 p-6 relative overflow-hidden">
      <Shape name="sunburst" size={520} spin className="absolute text-white" style={{ opacity: 0.06 }} />

      <div className="relative flex flex-col items-center gap-3">
        <Wordmark colourway="white" height={26} />
        <div className="eyebrow" style={{ color: 'var(--carnival-yellow)' }}>{t.counter.console}</div>
        <LocaleToggle onDark />
      </div>

      <div className="relative flex flex-wrap justify-center gap-2">
        {zones.map((zone) => (
          <button
            key={zone.id}
            type="button"
            className="chip chip-on-dark"
            aria-pressed={zoneId === zone.id}
            onClick={() => setZoneId(zone.id)}
          >
            {zone.name}
          </button>
        ))}
      </div>

      <div
        className="relative display"
        style={{ fontSize: 'var(--font-size-4xl)', color: 'var(--carnival-white)', letterSpacing: 'var(--tracking-caps)', minHeight: 'var(--space-8)' }}
        aria-live="polite"
        aria-label={`${pin.length} digits entered`}
      >
        {pin.replace(/./g, '•') || '····'}
      </div>

      {error ? <div className="relative notice notice-danger" role="alert">{error}</div> : null}

      <div className="relative grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            className="btn btn-on-dark numeric"
            style={{ width: 'var(--counter-key-size)', height: 'var(--counter-key-size)', fontSize: 'var(--font-size-xl)' }}
            onClick={() => press(digit)}
            disabled={busy}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: 'var(--counter-key-size)', height: 'var(--counter-key-size)', color: 'var(--carnival-white)' }}
          onClick={() => setPin('')}
          disabled={busy}
        >
          {t.counter.clear}
        </button>
        <button
          type="button"
          className="btn btn-on-dark numeric"
          style={{ width: 'var(--counter-key-size)', height: 'var(--counter-key-size)', fontSize: 'var(--font-size-xl)' }}
          onClick={() => press('0')}
          disabled={busy}
        >
          0
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: 'var(--counter-key-size)', height: 'var(--counter-key-size)' }}
          onClick={() => submit(pin)}
          disabled={busy || pin.length < 4}
        >
          {busy ? '…' : t.counter.go}
        </button>
      </div>
    </div>
  );
}
