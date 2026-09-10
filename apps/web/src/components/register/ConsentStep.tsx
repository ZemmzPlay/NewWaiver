'use client';

import { useState } from 'react';
import { useLocale } from '../LocaleProvider';
import { CheckboxField, TextField } from './Field';

export interface ConsentDraft {
  agreed: boolean;
  typedName: string;
  marketingConsent: boolean;
}

/**
 * Step 5 — sign.
 *
 * Three changes from the first build, all at the owner's direction:
 *
 * - **Photography is a notice, not a checkbox.** Filming happens in the zones
 *   and the guardian is told so plainly; opting a child out is handled by a
 *   staff member at the counter rather than by a tick here.
 * - **The marketing box starts ticked.** I flagged that UAE PDPL wants consent
 *   to be a clear affirmative act and that a pre-ticked box is the textbook
 *   example of what does not qualify; the owner has decided otherwise and this
 *   comment is the record of that decision. It is a real box the guardian can
 *   untick, its wording is specific, and the timestamp is stored either way.
 * - **The signature is pre-filled** with the name from step 3, because it is
 *   the same person in all but a rounding error of cases and retyping it was
 *   costing ten seconds. It is still an editable field they must look at, and
 *   the value stored is whatever the field holds when they submit.
 */
export function ConsentStep({
  guardianName, guardianEmail, waiverVersion, value, onChange, onSubmit, onBack, onEditEmail, submitting, error,
}: {
  guardianName: string;
  guardianEmail: string;
  waiverVersion: number;
  value: ConsentDraft;
  onChange: (next: ConsentDraft) => void;
  onSubmit: () => void;
  onBack: () => void;
  onEditEmail: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const { t } = useLocale();
  const [touched, setTouched] = useState(false);
  const ready = value.agreed && value.typedName.trim().length >= 2;

  return (
    <div className="px-6 py-8 flex flex-col gap-6 max-w-[--container-narrow] mx-auto">
      <div>
        <h1 className="headline" style={{ fontSize: 'var(--font-size-2xl)' }}>{t.consentStep.heading}</h1>
        <p className="mt-2 text-sm muted">{t.consentStep.help}</p>
      </div>

      {/* The read-back that replaced the confirm-by-retype on step 3. */}
      {/* Stacked, not side by side: an address long enough to matter is an
          address long enough to be squeezed into three broken lines by a button
          sitting next to it. `anywhere` breaks at the @ and the dots rather
          than mid-word. */}
      <div className="card card-poster">
        <div className="eyebrow">{t.guardianStep.emailHint}</div>
        <div
          className="headline latin mt-2"
          style={{ fontSize: 'var(--font-size-lg)', overflowWrap: 'anywhere' }}
        >
          {guardianEmail}
        </div>
        <button type="button" className="btn btn-outline btn-sm mt-4" onClick={onEditEmail}>
          {t.consentStep.editEmail}
        </button>
      </div>

      <CheckboxField
        label={t.consentStep.agree(waiverVersion)}
        description={t.consentStep.agreeDetail}
        checked={value.agreed}
        onChange={(agreed) => onChange({ ...value, agreed })}
        error={touched && !value.agreed ? t.consentStep.agreeError : null}
      />

      <TextField
        label={t.consentStep.signature}
        value={value.typedName}
        onChange={(event) => onChange({ ...value, typedName: event.target.value })}
        onBlur={() => setTouched(true)}
        placeholder={guardianName}
        autoComplete="off"
        error={touched && value.typedName.trim().length < 2 ? t.consentStep.signatureError : null}
      />

      <div className="notice notice-info">
        <strong>{t.consentStep.photoNoticeTitle}</strong>
        <p className="mt-1">{t.consentStep.photoNoticeBody}</p>
      </div>

      <CheckboxField
        label={t.consentStep.marketing}
        description={t.consentStep.marketingDetail}
        checked={value.marketingConsent}
        onChange={(marketingConsent) => onChange({ ...value, marketingConsent })}
      />

      {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}

      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={submitting}>
          {t.common.back}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          disabled={submitting}
          onClick={() => { setTouched(true); if (ready) onSubmit(); }}
        >
          {submitting ? t.consentStep.submitting : t.consentStep.submit}
        </button>
      </div>
    </div>
  );
}
