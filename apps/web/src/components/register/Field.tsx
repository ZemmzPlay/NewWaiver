'use client';

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

interface Common {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children?: ReactNode;
}

export function Field({ label, hint, error, children, id }: Common & { id?: string }) {
  const auto = useId();
  const uid = id ?? auto;
  return (
    <div className="field">
      <label className="ui-label" htmlFor={uid}>{label}</label>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function TextField({ label, hint, error, className = '', id, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const uid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} id={uid}>
      {/* className is merged, not replaced — a caller adding `numeric` must not
          silently drop the control styling. */}
      <input
        id={uid}
        className={`field-control ${className}`}
        aria-invalid={error ? 'true' : undefined}
        {...rest}
      />
    </Field>
  );
}

export function TextAreaField({ label, hint, error, className = '', ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const uid = useId();
  return (
    <Field label={label} hint={hint} error={error} id={uid}>
      <textarea
        id={uid}
        rows={3}
        className={`field-control ${className}`}
        aria-invalid={error ? 'true' : undefined}
        {...rest}
      />
    </Field>
  );
}

/** A row of tappable chips. One tap, no keyboard, no calendar. */
export function ChipRow<T extends string | number>({ label, options, value, onChange, hint, error, renderLabel, chipClassName = '' }: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  hint?: ReactNode;
  error?: string | null;
  renderLabel?: (option: T) => ReactNode;
  chipClassName?: string;
}) {
  return (
    <div className="field">
      <span className="ui-label">{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option)}
            type="button"
            className={`chip ${chipClassName}`}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {renderLabel ? renderLabel(option) : String(option)}
          </button>
        ))}
      </div>
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function CheckboxField({ label, description, checked, onChange, error }: {
  label: ReactNode; description?: ReactNode; checked: boolean; onChange: (checked: boolean) => void; error?: string | null;
}) {
  const uid = useId();
  return (
    <div className="field">
      <label
        htmlFor={uid}
        className="flex gap-3 items-start cursor-pointer card"
        style={{ borderColor: checked ? 'var(--carnival-indigo)' : undefined, borderWidth: '2px' }}
      >
        <input
          id={uid}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 shrink-0"
          style={{ width: 'var(--space-5)', height: 'var(--space-5)', accentColor: 'var(--carnival-indigo)' }}
        />
        <span>
          <span className="block text-sm font-semibold" style={{ color: 'var(--carnival-indigo)' }}>{label}</span>
          {description ? <span className="block text-2xs muted mt-1 leading-normal">{description}</span> : null}
        </span>
      </label>
      {error ? <span className="field-error" role="alert">{error}</span> : null}
    </div>
  );
}
