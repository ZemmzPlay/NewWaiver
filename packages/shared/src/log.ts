/**
 * Hard rule 2: no child or guardian data in logs. IDs only.
 *
 * This logger accepts a message and a flat bag of fields, and drops any field
 * whose key looks like it carries a person's details. It is deliberately blunt:
 * a dropped field is a nuisance, a logged phone number is a breach.
 */

const FORBIDDEN = /(name|phone|mobile|email|address|medical|note|signature|pin|dob|age)/i;

/** Keys that read as forbidden but are safe because they carry no value. */
const ALLOWLIST = new Set(['emailStatus', 'nameMatch', 'hasMedicalNotes', 'ageBand']);

export type LogFields = Record<string, string | number | boolean | null | undefined>;

function scrub(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWLIST.has(key) && FORBIDDEN.test(key)) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = value;
  }
  return out;
}

function emit(level: 'info' | 'warn' | 'error', scope: string, message: string, fields?: LogFields) {
  const line = { level, scope, message, ...(fields ? scrub(fields) : {}), at: new Date().toISOString() };
  const text = JSON.stringify(line);
  if (level === 'error') console.error(text);
  else if (level === 'warn') console.warn(text);
  else console.log(text);
}

export function createLogger(scope: string) {
  return {
    info: (message: string, fields?: LogFields) => emit('info', scope, message, fields),
    warn: (message: string, fields?: LogFields) => emit('warn', scope, message, fields),
    error: (message: string, fields?: LogFields) => emit('error', scope, message, fields),
  };
}

export type Logger = ReturnType<typeof createLogger>;
