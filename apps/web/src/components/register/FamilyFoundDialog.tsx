'use client';

import { formatForDisplay } from '@carnival/shared';
import { useLocale } from '../LocaleProvider';

/**
 * Calm confirm when the mobile already owns an active family.
 * No kid names — possession of the number is not proof of identity.
 * The number itself is shown so they can catch a mistype at a glance.
 */
export function FamilyFoundDialog({ phoneE164, onContinue, onChangeNumber }: {
  phoneE164: string;
  onContinue: () => void;
  onChangeNumber: () => void;
}) {
  const { t } = useLocale();

  return (
    <div
      className="fixed inset-0 scrim flex items-center justify-center p-6 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-found-title"
    >
      <div className="card card-poster bg-white w-full max-w-[560px] flex flex-col gap-4">
        <div>
          <h2
            id="family-found-title"
            className="headline"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            {t.guardianStep.familyFoundTitle}
          </h2>
          <div className="mt-3">
            <div className="eyebrow">{t.common.mobile}</div>
            <p className="numeric mt-1" style={{ fontSize: 'var(--font-size-xl)' }}>
              {formatForDisplay(phoneE164)}
            </p>
          </div>
          <p className="mt-3 text-sm" style={{ lineHeight: 'var(--line-normal)' }}>
            {t.guardianStep.familyFoundBody}
          </p>
        </div>

        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onContinue}>
          {t.guardianStep.familyFoundContinue}
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={onChangeNumber}>
          {t.guardianStep.familyFoundChangeNumber}
        </button>
      </div>
    </div>
  );
}
