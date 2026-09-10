/**
 * The single source of validation truth. Convention: "every mutation validates
 * against a Zod schema from packages/shared before touching the DB" - so client,
 * server action, route handler and worker all import from here.
 */

import { z } from 'zod';
import { AGE_CHIPS } from './constants.js';
import { checkEmail } from './email.js';
import { toE164 } from './phone.js';
import { normaliseRegistrationCode } from './code.js';

const MIN_AGE = AGE_CHIPS[0];
const MAX_AGE = AGE_CHIPS.at(-1)!;

export const uuid = z.string().uuid();

export const personName = z
  .string()
  .trim()
  .min(2, 'Enter a full name.')
  .max(120, 'That name is too long.')
  .regex(/[^\d]/, 'Enter a name, not a number.');

export const relationEnum = z.enum(['mother', 'father', 'guardian', 'other']);
export const supervisionModeEnum = z.enum(['accompanied', 'drop_off']);
export const sessionStatusEnum = z.enum([
  'active', 'warned', 'expired', 'overdue', 'checked_out', 'cancelled',
]);
export const notifTypeEnum = z.enum(['registration', 'expiry_warning', 'pickup_request']);
export const notifChannelEnum = z.enum(['email', 'whatsapp']);
export const notifStatusEnum = z.enum([
  'scheduled', 'claimed', 'sent', 'delivered', 'failed', 'cancelled',
]);
export const verifyMethodEnum = z.enum(['code', 'qr', 'name_match', 'supervisor_override']);
export const pickupOutcomeEnum = z.enum(['answered', 'no_answer', 'on_the_way']);

export const emailField = z.string().trim().transform((v) => v.toLowerCase()).superRefine((value, ctx) => {
  const result = checkEmail(value);
  if (!result.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.reason });
});

export const phoneField = z
  .string()
  .trim()
  .min(6, 'Enter a mobile number.')
  .transform((value, ctx) => {
    const e164 = toE164(value);
    if (!e164) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "That doesn't look like a mobile number." });
      return z.NEVER;
    }
    return e164;
  });

export const registrationCodeField = z.string().transform((value, ctx) => {
  const code = normaliseRegistrationCode(value);
  if (!code) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'That code should be four characters, like R-7K2M.' });
    return z.NEVER;
  }
  return code;
});

export const childInput = z.object({
  fullName: personName,
  ageYears: z.number().int().min(MIN_AGE, 'Pick an age.').max(MAX_AGE, `This zone is for ages ${MIN_AGE}-${MAX_AGE}.`),
  packageId: uuid,
  medicalNotes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const guardianInput = z.object({
  fullName: personName,
  relation: relationEnum,
  relationOther: z.string().trim().max(60).optional().or(z.literal('')),
  phone: phoneField,
  email: emailField,
  /** The language they filled the form in. Every email to them uses it. */
  locale: z.enum(['en', 'ar']).default('en'),
});

/** POST /api/register. */
export const registerInput = z
  .object({
    guardian: guardianInput,
    children: z.array(childInput).min(1, 'Add at least one child.').max(10, 'Ten children is the most one registration can hold.'),
    consent: z.object({
      waiverVersionId: uuid,
      agreed: z.literal(true, { errorMap: () => ({ message: 'You need to accept the waiver to continue.' }) }),
      typedName: personName,
    }),
    marketingConsent: z.boolean().default(true),
    clientUuid: uuid,
  })
  .superRefine((value, ctx) => {
    if (value.guardian.relation === 'other' && !value.guardian.relationOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardian', 'relationOther'],
        message: 'Tell us how you are related to the child.',
      });
    }
    // The typed signature no longer has to equal the name above character for
    // character. It is pre-filled from that name, so an exact-match rule now
    // blocks only the honest edge cases — a parent who signs "Fatima A."
    // instead of "Fatima Al Mansoori" — while catching no dishonest ones. What
    // the acceptance record needs is a name, a version and a timestamp, and it
    // still gets all three.
  });

export type RegisterInput = z.input<typeof registerInput>;
export type RegisterParsed = z.output<typeof registerInput>;

/** POST /api/sessions - the counter check-in. */
export const startSessionsInput = z.object({
  deviceId: uuid.optional(),
  registrationId: uuid,
  entries: z
    .array(
      z.object({
        childId: uuid,
        packageId: uuid,
        stubRef: z.string().trim().max(40).optional().or(z.literal('')),
        clientUuid: uuid,
      }),
    )
    .min(1, 'Select at least one child.'),
});

export const checkoutInput = z.object({
  verifyMethod: verifyMethodEnum,
  releasedTo: z.string().trim().max(120).optional().or(z.literal('')),
  supervisorPin: z.string().trim().regex(/^\d{4,8}$/).optional(),
}).superRefine((value, ctx) => {
  // DATA_MODEL: released_to is a name only when someone else collected, which
  // also requires verify_method = supervisor_override.
  if (value.releasedTo && value.verifyMethod !== 'supervisor_override') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['verifyMethod'],
      message: 'Releasing to someone else needs a supervisor override.',
    });
  }
  if (value.verifyMethod === 'supervisor_override' && !value.supervisorPin) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['supervisorPin'], message: 'Supervisor PIN required.' });
  }
});

export const pickupAttemptInput = z.object({
  method: z.enum(['call', 'whatsapp']),
  outcome: pickupOutcomeEnum,
  note: z.string().trim().max(200).optional().or(z.literal('')),
});

export const staffLoginInput = z.object({
  pin: z.string().trim().regex(/^\d{4,8}$/, 'PIN is 4 to 8 digits.'),
  zoneId: uuid.optional(),
});

export const staffRoleEnum = z.enum(['staffer', 'pickup', 'supervisor', 'admin']);
const pinField = z.string().trim().regex(/^\d{4,8}$/, 'PIN is 4 to 8 digits.');

export const createStaffInput = z.object({
  fullName: personName,
  pin: pinField,
  role: staffRoleEnum,
  zoneId: uuid.optional().or(z.literal('')),
});

export const resetPinInput = z.object({
  staffId: uuid,
  pin: pinField,
});

export const setStaffActiveInput = z.object({
  staffId: uuid,
  isActive: z.boolean(),
});

export const searchInput = z.object({
  q: z.string().trim().min(2, 'Type at least two characters.').max(60),
  zoneId: uuid.optional(),
});

/** POST /api/sync - batched replay. Every write carries its own client_uuid. */
export const syncInput = z.object({
  sessions: z.array(startSessionsInput).default([]),
});

export const printJobInput = z.object({
  jobs: z.array(
    z.object({
      childName: z.string().min(1),
      childCode: z.string().min(1),
      zone: z.string().min(1),
      timeIn: z.string().min(1),
      timeOut: z.string().min(1),
      copies: z.number().int().min(1).max(3).default(1),
    }),
  ).min(1),
  deviceId: z.string().optional(),
});
export type PrintJobInput = z.infer<typeof printJobInput>;
