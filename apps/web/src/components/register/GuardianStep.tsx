'use client';

import { useState } from 'react';
import { checkEmail, toE164 } from '@carnival/shared';
import { useLocale } from '../LocaleProvider';
import { ChipRow, TextField } from './Field';

type Relation = 'mother' | 'father' | 'guardian' | 'other';

export interface GuardianDraft {
  fullName: string;
  relation: Relation | null;
  relationOther: string;
  phone: string;
  email: string;
}

const RELATIONS: Relation[] = ['mother', 'father', 'guardian', 'other'];

/**
 * Step 3 — your details.
 *
 * Email is the alert channel, so it is validated harder than anything else on
 * the form. PRD s3 asked for three things: shape, a common-typo correction, and
 * a confirm-by-retype.
 *
 * The retype is gone. Typing an address twice with paste disabled is the single
 * slowest thing on this form — fifteen to twenty seconds of a one-minute flow,
 * done one-handed by someone holding a child — and it catches only the class of
 * error the typo pass already catches, because a person who mistypes a domain
 * once usually mistypes it the same way twice. What replaced it is a read-back:
 * the address is shown large on the sign step with an edit link, which is one
 * glance instead of one retype. The other two checks are untouched, and the
 * counter still shows a bounce before the child goes in.
 */
export function GuardianStep({ value, onChange, onContinue, onBack }: {
  value: GuardianDraft;
  onChange: (next: GuardianDraft) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { t } = useLocale();
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const set = <K extends keyof GuardianDraft>(key: K, next: GuardianDraft[K]) =>
    onChange({ ...value, [key]: next });

  const emailResult = value.email ? checkEmail(value.email) : null;
  const suggestion = emailResult?.suggestion ?? null;
  const e164 = value.phone ? toE164(value.phone) : null;

  const errors = {
    fullName: value.fullName.trim().length < 2 ? t.guardianStep.fullNameError : null,
    relation: value.relation ? null : t.guardianStep.relationError,
    relationOther: value.relation === 'other' && !value.relationOther.trim()
      ? t.guardianStep.relationOtherError : null,
    phone: value.phone ? (e164 ? null : t.guardianStep.mobileError) : t.guardianStep.mobileMissing,
    email: value.email ? (emailResult?.ok ? null : t.guardianStep.emailError) : t.guardianStep.emailMissing,
  };
  const ready = Object.values(errors).every((error) => error === null);
  const show = (key: keyof typeof errors) => (touched[key] ? errors[key] : null);
  const blur = (key: string) => () => setTouched((prev) => ({ ...prev, [key]: true }));

  return (
    <div className="px-6 py-8 flex flex-col gap-6 max-w-[--container-narrow] mx-auto">
      <div>
        <h1 className="headline" style={{ fontSize: 'var(--font-size-2xl)' }}>{t.guardianStep.heading}</h1>
        <p className="mt-2 text-sm muted">{t.guardianStep.help}</p>
      </div>

      <TextField
        label={t.guardianStep.fullName}
        value={value.fullName}
        onChange={(event) => set('fullName', event.target.value)}
        onBlur={blur('fullName')}
        error={show('fullName')}
        autoComplete="name"
        enterKeyHint="next"
      />

      <ChipRow
        label={t.guardianStep.relation}
        options={RELATIONS}
        value={value.relation}
        onChange={(relation) => set('relation', relation)}
        error={show('relation')}
        renderLabel={(relation) => t.guardianStep.relations[relation]}
      />

      {value.relation === 'other' ? (
        <TextField
          label={t.guardianStep.relationOther}
          value={value.relationOther}
          onChange={(event) => set('relationOther', event.target.value)}
          onBlur={blur('relationOther')}
          error={show('relationOther')}
        />
      ) : null}

      <TextField
        label={t.guardianStep.mobile}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t.guardianStep.mobilePlaceholder}
        value={value.phone}
        onChange={(event) => set('phone', event.target.value)}
        onBlur={blur('phone')}
        error={show('phone')}
        hint={e164 ? t.guardianStep.mobileSaved(e164) : t.guardianStep.mobileHint}
      />

      <div className="flex flex-col gap-3">
        <TextField
          label={t.guardianStep.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          value={value.email}
          onChange={(event) => set('email', event.target.value)}
          onBlur={blur('email')}
          error={show('email')}
          hint={t.guardianStep.emailHint}
        />

        {suggestion && suggestion !== value.email.trim().toLowerCase() ? (
          <div className="notice notice-warn flex flex-wrap items-center gap-3" role="status">
            <span>{t.guardianStep.didYouMean} <strong className="latin">{suggestion}</strong>?</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => set('email', suggestion)}
            >
              {t.guardianStep.useIt}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>{t.common.back}</button>
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          disabled={!ready}
          onClick={() => {
            setTouched({ fullName: true, relation: true, relationOther: true, phone: true, email: true });
            if (ready) onContinue();
          }}
        >
          {t.guardianStep.next}
        </button>
      </div>
    </div>
  );
}
