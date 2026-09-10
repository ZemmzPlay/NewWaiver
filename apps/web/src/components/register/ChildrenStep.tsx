'use client';

import { useState } from 'react';
import { AGE_CHIPS } from '@carnival/shared';
import { useLocale } from '../LocaleProvider';
import { zoneLabel, type Tile } from '../PackageGrid';
import { ChipRow, TextAreaField, TextField } from './Field';

export interface ChildDraft {
  key: string;
  fullName: string;
  ageYears: number | null;
  packageId: string;
  medicalNotes: string;
}

export function newChild(packageId: string): ChildDraft {
  return {
    key: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()),
    fullName: '', ageYears: null, packageId, medicalNotes: '',
  };
}

/**
 * Step 4 — children.
 *
 * Age is a row of tappable chips rather than a date picker: one tap, no
 * keyboard, no calendar. The zone and duration are prefilled from step 1 and
 * changeable per child, and the staffer can change them again at the counter.
 */
export function ChildrenStep({ tiles, children, onChange, onContinue, onBack }: {
  tiles: Tile[];
  children: ChildDraft[];
  onChange: (next: ChildDraft[]) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { t, n, locale } = useLocale();
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});

  const update = (key: string, patch: Partial<ChildDraft>) =>
    onChange(children.map((child) => (child.key === key ? { ...child, ...patch } : child)));

  const complete = (child: ChildDraft) => child.fullName.trim().length >= 2 && child.ageYears !== null;
  const ready = children.length > 0 && children.every(complete);

  return (
    <div className="px-6 py-8 flex flex-col gap-6 max-w-[--container-narrow] mx-auto">
      <div>
        <h1 className="headline" style={{ fontSize: 'var(--font-size-2xl)' }}>{t.childrenStep.heading}</h1>
        <p className="mt-2 text-sm muted">{t.childrenStep.help}</p>
      </div>

      {children.map((child, index) => {
        const tile = tiles.find((candidate) => candidate.packageId === child.packageId) ?? tiles[0]!;
        return (
          <div key={child.key} className="card flex flex-col gap-5" style={{ borderWidth: '2px' }}>
            <div className="flex items-center justify-between">
              <span className="eyebrow">{t.childrenStep.child(index + 1)}</span>
              {children.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onChange(children.filter((candidate) => candidate.key !== child.key))}
                >
                  {t.childrenStep.remove}
                </button>
              ) : null}
            </div>

            <TextField
              label={t.childrenStep.childName}
              value={child.fullName}
              onChange={(event) => update(child.key, { fullName: event.target.value })}
              autoComplete="off"
            />

            <ChipRow
              label={t.childrenStep.age}
              options={AGE_CHIPS}
              value={child.ageYears}
              onChange={(age) => update(child.key, { ageYears: age })}
              chipClassName="chip-age"
              hint={t.childrenStep.ageHint}
              renderLabel={(age) => n(age)}
            />

            <ChipRow
              label={t.childrenStep.zoneAndLength}
              options={tiles.map((candidate) => candidate.packageId)}
              value={child.packageId}
              onChange={(packageId) => update(child.key, { packageId })}
              renderLabel={(packageId) => {
                const option = tiles.find((candidate) => candidate.packageId === packageId)!;
                return `${zoneLabel(option, locale)} · ${n(option.minutes)} ${t.common.min}`;
              }}
              hint={t.childrenStep.supervision[tile.supervisionMode]}
            />

            {openNotes[child.key] ? (
              <TextAreaField
                label={t.childrenStep.note}
                value={child.medicalNotes}
                onChange={(event) => update(child.key, { medicalNotes: event.target.value })}
                placeholder={t.childrenStep.notePlaceholder}
                hint={t.childrenStep.noteHint}
              />
            ) : (
              <button
                type="button"
                className="btn btn-outline btn-sm self-start"
                onClick={() => setOpenNotes((prev) => ({ ...prev, [child.key]: true }))}
              >
                {t.childrenStep.addNote}
              </button>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="chip-add"
          aria-label={t.childrenStep.addChild}
          onClick={() => onChange([...children, newChild(children.at(-1)?.packageId ?? tiles[0]!.packageId)])}
        >
          +
        </button>
        <span className="text-sm muted">{t.childrenStep.addChild}</span>
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>{t.common.back}</button>
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!ready} onClick={onContinue}>
          {t.childrenStep.next}
        </button>
      </div>
    </div>
  );
}
