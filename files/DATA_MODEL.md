# Data model & API surface

PostgreSQL on RDS. All timestamps `timestamptz`, stored UTC.

## Enums

```sql
create type relation_type    as enum ('mother','father','guardian','other');
create type supervision_mode as enum ('accompanied','drop_off');
create type reg_status       as enum ('active','void');
create type session_status   as enum ('active','warned','expired','overdue','checked_out','cancelled');
create type notif_type       as enum ('registration','expiry_warning','pickup_request');
create type notif_channel    as enum ('email','whatsapp');  -- whatsapp reserved, unused this event
create type notif_status     as enum ('scheduled','claimed','sent','delivered','failed','cancelled');
create type staff_role       as enum ('staffer','pickup','supervisor','admin');
create type verify_method    as enum ('code','qr','name_match','supervisor_override');
```

## Tables

**events** — `id, name, venue, starts_at, ends_at, timezone, created_at`

**zones** — `id, event_id, name, supervision_mode, capacity int, min_age int, max_age int, sort_order, is_active`
Two rows to start: Soft Play (`accompanied`), Bouncy Castles (`drop_off`).

**packages** — `id, zone_id, label, minutes int, sort_order, is_active`
These are the tiles on the landing page. `15 min — Soft Play`, `30 min — Soft Play`, etc. Adding a tile is a row, not a deploy.

**waiver_versions** — `id, event_id, locale('en'|'ar'), version int, title, body_md, published_at, is_active`. Unique `(event_id, locale, version)`. Immutable once published.

**guardians** — `id, event_id, full_name, relation relation_type, relation_other, phone_e164, email, email_status, marketing_consent bool, marketing_consent_at, created_at`. Unique `(event_id, phone_e164)`.
`email_status` is `unknown | delivered | bounced | complained` — set by the confirmation send and the SES webhook, and surfaced at the counter so a bad address is caught before the child goes in.

**registrations** — `id, event_id, guardian_id, code text unique, status reg_status, source, created_at`. `code` is Crockford base32, `R-XXXX`, generated with a uniqueness retry.

**children** — `id, registration_id, full_name, age_years int, medical_notes text, photo_consent bool, child_code text unique, seq int, created_at`. `child_code` = `{registration.code}-{seq}` and is what prints on the sticker.

**consents** — `id, registration_id, waiver_version_id, accepted_at, typed_name, ip inet, user_agent text`. Append-only.

**sessions** — `id, child_id, zone_id, package_id, minutes int, started_by_staff_id, started_at, ends_at, warn_at, status, stub_ref text, checked_out_at, checked_out_by_staff_id, released_to text, verify_method, extends_session_id, client_uuid uuid unique, created_at`

Constraints:
- partial unique index on `child_id where status in ('active','warned','expired','overdue')` — one live session per child, across both zones
- `client_uuid` unique — offline replay safety
- `released_to` is null when the registered guardian collected; a name only when someone else did, which also requires `verify_method = 'supervisor_override'`

**notifications** — `id, session_id, registration_id, type, channel, to_address, scheduled_for, claimed_at, sent_at, provider_message_id, status, error, attempts int`. Index `(status, scheduled_for) where status='scheduled'`.

**pickup_attempts** — `id, session_id, staff_id, attempted_at, method('call'|'whatsapp'), outcome('answered'|'no_answer'|'on_the_way'), note`

**prints** — `id, session_id, staff_id, device_id, copy_no, payload_hash, printed_at, status`

**staff** — `id, event_id, full_name, role, pin_hash, default_zone_id, is_active`

**devices** — `id, event_id, label, zone_id, print_agent_url, printer_ip, last_seen_at`

**audit_log** — `id, event_id, actor_type, actor_id, action, entity, entity_id, meta jsonb, created_at`. Written on session start, extend, check-out, override, capacity breach, waiver publish.

## Indexes

```sql
create extension if not exists pg_trgm;
create index on guardians using gin (full_name gin_trgm_ops);
create index on children  using gin (full_name gin_trgm_ops);
create index on guardians (event_id, phone_e164);
create index on sessions  (zone_id, status, ends_at);
```

Phone search normalises input to digits and matches the last 9.

## Session lifecycle

```
start   → active
          warn_at reached, alert claimed + sent   → warned
          ends_at reached                         → expired
          ends_at + grace                         → overdue   (enters Pickup queue)
          release confirmed                       → checked_out
extend  → new row with extends_session_id; old row → checked_out
```

Worker ticks every 20 seconds, each step its own transaction:
1. claim due notifications — `update notifications set status='claimed', claimed_at=now() where status='scheduled' and scheduled_for <= now() returning *` — then send, then mark `sent` or `failed` with backoff
2. advance `active → warned → expired → overdue`
3. heartbeat

## API surface

**Public**
- `GET  /r/{code}` — live status page for one family: a countdown per child, no auth, safe to leave open on a phone. Polls every 15s. Shows first names only.
- `GET  /api/packages` — zone tiles for the landing grid
- `GET  /api/waiver?locale=`
- `POST /api/register` → `{ code, qr }`

**Staff (device token + PIN session)**
- `GET  /api/search?q=` — guardian name, child name, phone, code
- `GET  /api/registrations/:code`
- `POST /api/sessions` — `[{ childId, packageId, stubRef, clientUuid }]`
- `POST /api/sessions/:id/extend`
- `POST /api/sessions/:id/checkout` — `{ verifyMethod, releasedTo?, supervisorPin? }`
- `GET  /api/zones/:id/board`
- `GET  /api/pickup-queue`
- `POST /api/sessions/:id/pickup-attempt`
- `POST /api/sync` — batched offline replay

**Print agent (local)**
- `POST http://localhost:9110/print` — `{ jobs: [{ childName, childCode, zone, timeIn, timeOut }] }`
- `GET  http://localhost:9110/health`

**Webhooks**
- `POST /api/webhooks/ses` — SNS bounce and complaint notifications → updates `notifications.status` and `guardians.email_status`

**Admin** — CRUD on zones, packages, staff, waiver versions; CSV export of registrations and sessions; retention job trigger.
