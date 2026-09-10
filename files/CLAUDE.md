# CLAUDE.md — carnival-waiver

Project instructions for Claude Code. Read `PRD.md`, `DATA_MODEL.md`, `HARDWARE.md` and `BUILD_PLAN.md` before writing code. Work `BUILD_PLAN.md` one phase at a time and stop at every phase gate for review.

## What this is

A waiver and session-timer system for two supervised kids' play zones at a live event. Guardians register on their phone; counter staff check children in and print stickers; the system sends a WhatsApp alert 5 minutes before time is up and runs a pickup queue for overdue children.

## Stack

- **Framework:** Next.js 15, App Router, TypeScript strict
- **Styling:** Tailwind v4, all values from CSS custom properties in `src/styles/tokens.css`
- **Database:** PostgreSQL on AWS RDS (`ap-south-1`)
- **ORM:** Prisma, migrations checked into `packages/db/prisma/migrations/`
- **Messaging:** SendGrid, provider selectable by env var so a second provider can be swapped in without a deploy. WhatsApp is explicitly out of scope for this event.
- **Worker:** long-running Node process, `apps/worker`
- **Print agent:** local Node service on the counter machine, `apps/print-agent`, speaks ZPL over TCP:9100
- **Hosting:** Docker Compose on EC2 (`t4g.small`, ARM) behind Caddy for TLS; RDS `db.t4g.micro` with automated snapshots. Images to ECR, deployed by GitHub Actions.
- **Validation:** Zod in `packages/shared`, used by client, server, and worker
- **Testing:** Vitest units, Playwright on the register and check-in paths

npm workspaces: `apps/web`, `apps/worker`, `apps/print-agent`, `packages/shared`, `packages/db`, `infra/`.

## Hard rules

1. **No hardcoded design values.** No hex, no magic pixels. Everything through tokens — the design system is being built in parallel by the owner.
2. **No child or guardian data in logs.** IDs only. Never a name, number, email, age, or medical note.
3. **UTC in the database, always.** Display in `Asia/Dubai`. Never store a naive timestamp.
4. **Notifications are idempotent.** Claim a row with a conditional update before sending. A double-run never double-sends.
5. **Check-in survives offline.** Every session write carries a client-generated UUID and is safe to replay.
6. **Messaging is behind a `Channel` interface.** `EmailChannel` is the only implementation for now; nothing else in the codebase knows which channel is in use, so WhatsApp can be added after the event without a rewrite.
7. **Waiver versions are immutable.** Publishing inserts; it never updates.
8. **Ask before adding a dependency** not listed above.
9. **No secrets in the repo.** `.env` only, with `.env.example` current.

## Conventions

- Server Actions for mutations; Route Handlers only for external callers (print agent, Meta webhooks).
- Every mutation validates against a Zod schema from `packages/shared` before touching the DB.
- Errors reach staff as a plain sentence and a retry button. Never a stack trace on a counter screen.
- One component per file, test colocated.
- Commits: `feat(scope):`, `fix(scope):`, `chore(scope):`.

## Commands

```bash
npm run dev            # web + worker
npm run db:generate    # prisma migration
npm run db:migrate
npm run db:seed        # event, 2 zones, durations, waiver v1, staff PINs
npm test
npm run test:e2e
```

## Design intent

The counter staffer is standing in front of a parent with a queue behind them, in a loud hall, on day three. Every staff-facing screen is optimised for glanceability and speed — big type, obvious state colours, no more than one decision per screen.

The **Pickup queue** for overdue children is the most important screen in the product. Build it like it is.

Because email will not reliably reach a parent inside five minutes in a loud hall, the staff-facing board is the real safety net and the public live status page at `/r/{code}` is the parent-facing one. Neither is optional.

The guardian's form is used once, on a phone, one-handed, possibly while holding a child. Big tap targets, no keyboards where a chip selector will do, minimum 16px inputs.

Anything marked **[OPEN]** in `PRD.md` gets flagged, not guessed. If a phase depends on one, build behind an interface with a stub and say so in the phase summary.
