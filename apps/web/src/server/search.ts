import 'server-only';
import { Prisma, db } from '@carnival/db';
import {
  LIVE_SESSION_STATUSES, digitsOf, firstName, normaliseRegistrationCode,
  parseChildCode, phoneTail,
} from '@carnival/shared';
import { currentEvent } from './event.js';

/**
 * One field, four kinds of input. PRD s4: "guardian name, child name, mobile in
 * any format, or the code. Camera scan fills the same field."
 *
 * Ordered by how certain the match is, because the staffer is reading the top
 * of the list while the parent is still talking.
 */

export interface SearchHit {
  registrationId: string;
  code: string;
  guardianName: string;
  guardianPhone: string;
  emailStatus: 'unknown' | 'delivered' | 'bounced' | 'complained';
  childNames: string[];
  liveSessions: number;
  matchedOn: 'code' | 'phone' | 'guardian' | 'child';
}

const liveStatuses = [...LIVE_SESSION_STATUSES];

export async function search(query: string, limit = 12): Promise<SearchHit[]> {
  const event = await currentEvent();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const byId = new Map<string, SearchHit>();

  async function collect(matchedOn: SearchHit['matchedOn'], ids: string[]) {
    if (!ids.length) return;
    const rows = await db.registration.findMany({
      where: { eventId: event.id, id: { in: ids } },
      select: {
        id: true, code: true,
        guardian: { select: { fullName: true, phoneE164: true, emailStatus: true } },
      },
    });

    for (const row of rows) {
      if (byId.has(row.id)) continue;
      const kids = await db.child.findMany({
        where: { registrationId: row.id },
        select: { fullName: true },
        orderBy: { seq: 'asc' },
      });
      const live = await db.session.count({
        where: { child: { registrationId: row.id }, status: { in: liveStatuses } },
      });
      byId.set(row.id, {
        registrationId: row.id,
        code: row.code,
        guardianName: row.guardian.fullName,
        guardianPhone: row.guardian.phoneE164,
        emailStatus: row.guardian.emailStatus,
        childNames: kids.map((k) => k.fullName),
        liveSessions: live,
        matchedOn,
      });
    }
  }

  // 1. A code, or a sticker's child code. Exact, so it wins.
  const child = parseChildCode(trimmed);
  const code = child?.code ?? normaliseRegistrationCode(trimmed);
  if (code) {
    const rows = await db.registration.findMany({
      where: { eventId: event.id, code },
      select: { id: true },
    });
    await collect('code', rows.map((r) => r.id));
  }

  // 2. A phone, however it was typed. Matched on the last nine digits.
  const digits = digitsOf(trimmed);
  if (digits.length >= 6) {
    const tail = phoneTail(digits);
    const rows = await db.$queryRaw<{ id: string }[]>`
      select r.id
        from registrations r
        join guardians g on g.id = r.guardian_id
       where r.event_id = ${event.id}::uuid
         and right(g.phone_tail, ${tail.length}::int) = ${tail}
       limit ${limit}
    `;
    await collect('phone', rows.map((r) => r.id));
  }

  // 3 & 4. Names, through the trigram indexes. Prefix and substring first, so
  // "fat" finds Fatima the moment the staffer stops typing; then
  // word_similarity, which scores the query against the best-matching *word*
  // rather than the whole name — "fatma" scores 0.19 against
  // "Fatima Al Mansoori" whole, and 0.5 against its first word. A name heard
  // once across a loud counter is misspelt far more often than not.
  //
  // The function form of word_similarity does not use the gin_trgm_ops index —
  // only the `<%` operator does, and that needs a session-level threshold. On a
  // three-day event this scans a few thousand rows behind a LIKE that has
  // already matched most of the time, which is nothing. If this system ever
  // holds a season's worth of registrations, switch to `<%` and set
  // pg_trgm.word_similarity_threshold on the connection.
  if (/[a-z]/i.test(trimmed)) {
    const needle = trimmed.toLowerCase();
    const pattern = `${needle}%`;
    const contains = `%${needle}%`;

    const guardianRows = await db.$queryRaw<{ id: string }[]>`
      select r.id
        from registrations r
        join guardians g on g.id = r.guardian_id
       where r.event_id = ${event.id}::uuid
         and (
           lower(g.full_name) like ${pattern}
           or lower(g.full_name) like ${contains}
           or word_similarity(${needle}, lower(g.full_name)) > 0.45
         )
       order by word_similarity(${needle}, lower(g.full_name)) desc
       limit ${limit}
    `;
    await collect('guardian', guardianRows.map((r) => r.id));

    const childRows = await db.$queryRaw<{ id: string }[]>`
      select r.id
        from children c
        join registrations r on r.id = c.registration_id
       where r.event_id = ${event.id}::uuid
         and (
           lower(c.full_name) like ${pattern}
           or lower(c.full_name) like ${contains}
           or word_similarity(${needle}, lower(c.full_name)) > 0.45
         )
       order by word_similarity(${needle}, lower(c.full_name)) desc
       limit ${limit}
    `;
    await collect('child', childRows.map((r) => r.id));
  }

  return [...byId.values()].slice(0, limit);
}

/* ------------------------------------------------------------ family card */

export interface FamilyChild {
  id: string;
  fullName: string;
  childCode: string;
  ageYears: number;
  medicalNotes: string | null;
  requestedPackageId: string | null;
  liveSession: {
    id: string;
    zoneId: string;
    zoneName: string;
    status: string;
    endsAt: Date;
  } | null;
}

export interface FamilyCard {
  registrationId: string;
  code: string;
  /** First names only. The console composes the greeting in its own language. */
  guardianFirstName: string;
  childFirstNames: string[];
  guardian: {
    id: string;
    fullName: string;
    phoneE164: string;
    email: string;
    emailStatus: 'unknown' | 'delivered' | 'bounced' | 'complained';
    relation: string;
    relationOther: string | null;
    /** Which language they registered in — the staffer may want to know. */
    locale: string;
  };
  waiverAccepted: boolean;
  waiverVersion: number | null;
  children: FamilyChild[];
}

export async function familyCard(code: string): Promise<FamilyCard | null> {
  const event = await currentEvent();
  const row = await db.registration.findFirst({
    where: { eventId: event.id, code },
    select: {
      id: true, code: true,
      guardian: {
        select: {
          id: true, fullName: true, phoneE164: true, email: true, emailStatus: true,
          relation: true, relationOther: true, locale: true,
        },
      },
    },
  });
  if (!row) return null;

  const kids = await db.child.findMany({
    where: { registrationId: row.id },
    orderBy: { seq: 'asc' },
  });

  const live = kids.length
    ? await db.session.findMany({
        where: { childId: { in: kids.map((k) => k.id) }, status: { in: liveStatuses } },
        select: { id: true, childId: true, zoneId: true, status: true, endsAt: true, zone: { select: { name: true } } },
      })
    : [];

  const [consent] = await db.$queryRaw<{ version: number }[]>(Prisma.sql`
    select wv.version
      from consents c
      join waiver_versions wv on wv.id = c.waiver_version_id
     where c.registration_id = ${row.id}::uuid
     order by c.accepted_at desc
     limit 1
  `);

  return {
    registrationId: row.id,
    code: row.code,
    guardianFirstName: firstName(row.guardian.fullName),
    childFirstNames: kids.map((kid) => firstName(kid.fullName)),
    guardian: {
      id: row.guardian.id,
      fullName: row.guardian.fullName,
      phoneE164: row.guardian.phoneE164,
      email: row.guardian.email,
      emailStatus: row.guardian.emailStatus,
      relation: row.guardian.relation,
      relationOther: row.guardian.relationOther,
      locale: row.guardian.locale,
    },
    waiverAccepted: Boolean(consent),
    waiverVersion: consent?.version ?? null,
    children: kids.map((kid) => {
      const session = live.find((s) => s.childId === kid.id);
      return {
        id: kid.id,
        fullName: kid.fullName,
        childCode: kid.childCode,
        ageYears: kid.ageYears,
        medicalNotes: kid.medicalNotes,
        requestedPackageId: kid.requestedPackageId,
        liveSession: session
          ? { id: session.id, zoneId: session.zoneId, zoneName: session.zone.name, status: session.status, endsAt: session.endsAt }
          : null,
      };
    }),
  };
}
