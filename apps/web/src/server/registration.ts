import 'server-only';
import { Prisma, db, scheduleRegistrationEmail, sendNow } from '@carnival/db';
import {
  childCode, createLogger, mintRegistrationCode, phoneTail, registerInput,
} from '@carnival/shared';
import type { RegisterInput } from '@carnival/shared';
import { activeWaiver, currentEvent } from './event.js';

const log = createLogger('registration');

export interface RegisterResult {
  code: string;
  registrationId: string;
  /** True when this phone was already registered and the children were added
   *  to the existing family rather than creating a second record. PRD s3. */
  merged: boolean;
  emailQueued: boolean;
}

/**
 * Codes are four Crockford characters, so collisions are rare but not
 * impossible across a three-day event. Retry rather than widen: a five
 * character code is materially harder to read aloud across a counter.
 */
async function insertWithUniqueCode(tx: Prisma.TransactionClient, eventId: string, guardianId: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = mintRegistrationCode();
    try {
      return await tx.registration.create({ data: { eventId, guardianId, code, source: 'web' } });
    } catch (error) {
      // Prisma's meta.target on a P2002 is the violated column name(s), not
      // the constraint name — confirmed empirically against Postgres.
      const isCodeCollision = error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
        && (error.meta?.target as string[] | undefined)?.includes('code');
      if (!isCodeCollision) throw error;
      log.warn('code collision, retrying', { attempt });
    }
  }
  throw new Error('Could not mint a unique registration code after 8 attempts.');
}

export async function register(input: RegisterInput, meta: { ip?: string; userAgent?: string }): Promise<RegisterResult> {
  const parsed = registerInput.parse(input);
  const event = await currentEvent();
  // The guardian read one language; the consent must point at that language's
  // current version, not at English's.
  const waiver = await activeWaiver(event.id, parsed.guardian.locale);

  if (parsed.consent.waiverVersionId !== waiver.id) {
    // They loaded the form, we published a new version, they submitted. Their
    // consent is against text that is no longer current, so it is not valid.
    throw new Error('WAIVER_SUPERSEDED');
  }

  // Every packageId has to belong to this event, or a crafted payload could
  // point a child at a zone that isn't ours.
  const chosen = await db.package.findMany({ where: { isActive: true }, select: { id: true } });
  const valid = new Set(chosen.map((p) => p.id));
  for (const child of parsed.children) {
    if (!valid.has(child.packageId)) throw new Error('UNKNOWN_PACKAGE');
  }

  const { registration, guardian, merged } = await db.$transaction(async (tx) => {
    const existingGuardian = await tx.guardian.findUnique({
      where: { eventId_phoneE164: { eventId: event.id, phoneE164: parsed.guardian.phone } },
    });

    const guardianValues = {
      fullName: parsed.guardian.fullName,
      relation: parsed.guardian.relation,
      relationOther: parsed.guardian.relationOther || null,
      phoneE164: parsed.guardian.phone,
      phoneTail: phoneTail(parsed.guardian.phone),
      email: parsed.guardian.email,
      locale: parsed.guardian.locale,
      marketingConsent: parsed.marketingConsent,
      marketingConsentAt: parsed.marketingConsent ? new Date() : null,
    };

    const guardianRow = existingGuardian
      ? await tx.guardian.update({
          where: { id: existingGuardian.id },
          data: {
            ...guardianValues,
            // A changed address is a new channel, so the old delivery verdict
            // must not carry over to it.
            emailStatus: existingGuardian.email === parsed.guardian.email ? existingGuardian.emailStatus : 'unknown',
          },
        })
      : await tx.guardian.create({ data: { ...guardianValues, eventId: event.id } });

    // PRD s3: a repeat registration on the same mobile returns the existing
    // family with an "add another child" option rather than a second record.
    const existingRegistration = await tx.registration.findFirst({
      where: { guardianId: guardianRow.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    const registrationRow = existingRegistration ?? await insertWithUniqueCode(tx, event.id, guardianRow.id);
    const isMerged = Boolean(existingRegistration);

    const lastChild = isMerged
      ? await tx.child.findFirst({
          where: { registrationId: registrationRow.id },
          orderBy: { seq: 'desc' },
          select: { seq: true },
        })
      : null;
    let nextSeq = (lastChild?.seq ?? 0) + 1;

    for (const child of parsed.children) {
      await tx.child.create({
        data: {
          registrationId: registrationRow.id,
          fullName: child.fullName,
          ageYears: child.ageYears,
          medicalNotes: child.medicalNotes || null,
          // Photography is a notice now, not a consent: the guardian is told we
          // film in the zones, and opting a child out is a word with a staffer at
          // the counter. The column records that the notice was shown. The verbal
          // opt-out is not yet captured anywhere — flagged in the README.
          photoConsent: true,
          childCode: childCode(registrationRow.code, nextSeq),
          seq: nextSeq,
          requestedPackageId: child.packageId,
        },
      });
      nextSeq += 1;
    }

    // Append-only, and written every time — a second visit is a second acceptance.
    await tx.consent.create({
      data: {
        registrationId: registrationRow.id,
        waiverVersionId: waiver.id,
        typedName: parsed.consent.typedName,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        eventId: event.id,
        actorType: 'guardian',
        actorId: guardianRow.id,
        action: isMerged ? 'registration.children_added' : 'registration.created',
        entity: 'registration',
        entityId: registrationRow.id,
        meta: { childCount: parsed.children.length, waiverVersionId: waiver.id },
      },
    });

    return { registration: registrationRow, guardian: guardianRow, merged: isMerged };
  });

  const notification = await scheduleRegistrationEmail(registration.id, parsed.guardian.email);
  // Immediate rather than waiting for the worker's tick, because this send is
  // also the channel test: a bounce has to surface while the parent is still
  // standing at the counter.
  const emailQueued = await sendNow(notification.id);

  log.info(merged ? 'children added to existing family' : 'registration created', {
    registrationId: registration.id, guardianId: guardian.id,
    childCount: parsed.children.length, merged, emailQueued,
  });

  return { code: registration.code, registrationId: registration.id, merged, emailQueued };
}

/** The public status page and the confirmation both read through this. */
export async function registrationByCode(code: string) {
  const row = await db.registration.findUnique({
    where: { code },
    include: { guardian: true, children: { orderBy: { seq: 'asc' } } },
  });
  if (!row) return null;
  const { guardian, children, ...registration } = row;
  return { registration, guardian: guardian ?? null, children };
}
