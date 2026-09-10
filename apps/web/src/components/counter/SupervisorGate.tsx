'use client';

import { Shape } from '../Brand';
import { useLocale } from '../LocaleProvider';

/** Shown when a counter staffer reaches the overview or admin screen. Not an error — a door. */
export function SupervisorGate() {
  const { t } = useLocale();
  return (
    <div className="p-6 max-w-[--container-narrow] mx-auto">
      <div className="card card-poster relative overflow-hidden text-center py-16">
        <Shape name="arch" size={200} className="absolute -end-10 -bottom-12 text-indigo" style={{ opacity: 0.1 }} />
        <div className="relative">
          <div className="display" style={{ fontSize: 'var(--font-size-2xl)' }}>{t.counter.supervisorsOnly}</div>
          <p className="muted mt-3">{t.counter.supervisorsOnlyBody}</p>
        </div>
      </div>
    </div>
  );
}
