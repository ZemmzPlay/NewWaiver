# carnival-waiver

Waiver and session-timer system for the two supervised play zones at Middle East
Film & Comic Con. Guardians register on their phone, counter staff check children
in and print stickers, the system emails a warning five minutes before time is
up, and a pickup queue chases anyone overdue.

Built against `files/PRD.md`, `files/DATA_MODEL.md`, `files/HARDWARE.md`,
`files/BUILD_PLAN.md` and `files/WAIVER_DRAFT.md`. Brand tokens and assets
live under `apps/web/src/styles/tokens/` and `apps/web/public/`.

Copy `.env.example` to `.env`, set `STAFF_DEVICE_TOKEN`, and use the commands
below for local development. Production deployment is TBD.

---

## Run it

Needs Node 22+ and a PostgreSQL 14+ you can create a database on.

```bash
npm install
cp .env.example .env          # then set STAFF_DEVICE_TOKEN to anything non-default
createdb carnival_waiver
npm run db:migrate
npm run db:seed
npm run dev                   # web on :3000, worker ticking every 20s
npm run dev:print             # optional: print agent on :9110
```

| URL | What it is |
|---|---|
| `/` | Package grid, grouped by zone. Step 1 of the guardian flow |
| `/register` | Waiver, guardian, children, sign |
| `/r/{code}` | Confirmation **and** the live status page |
| `/find` | Six-digit code, or mobile number → emailed one-time code |
| `/counter` | PIN unlock, then search and check-in |
| `/counter/board` | Who is inside this zone, and check-out |
| `/counter/pickup` | The pickup queue |
| `/counter/overview` | Both zones at once, the day's numbers, bounced addresses. Supervisors only |
| `/counter/admin` | Create staff accounts, reset PINs, deactivate a leaver. Admins only |
| `/dev/emails` | All four emails, both languages. Development only |

Every page has a language toggle. The choice is a cookie, not a URL segment, so
a family's `/r/{code}` link is one link whichever language they read it in.

**Seeded PINs** (in `packages/db/src/seed.ts` — rotate before the event):
`1111` Soft Play counter · `2222` Bouncy Castles counter · `3333` pickup marshal ·
`9999` admin (sees the overview too — every other account is created from
`/counter/admin`, not by hand-editing this file). Re-seeding invalidates any shift already signed in, and the
staffer is sent back to the PIN pad rather than hitting an error.

`MESSAGING_PROVIDER=console` prints emails to the terminal instead of sending
them. Set it to `sendgrid` when the domain is ready.

---

## What is in here

```
apps/web           Next.js 15 App Router — guardian flow, status page, counter console
apps/worker        20-second tick: due notifications, session state transitions
apps/print-agent   Local service on the counter laptop; ZPL over TCP:9100
packages/shared    Zod schemas, brand tokens, time, phone, email, Code 128
packages/db        Prisma schema, migrations, seed, notification dispatch
files/             The briefing documents this was built from
```

### The six things BUILD_PLAN said had to ship

1. **Package grid → waiver → guardian → children → consent → confirmation.**
   Scroll gate on the waiver, hard email validation with typo correction and
   confirm-by-retype, age chips 1–14, the circular `+`, three unticked consents.
2. **Live status page at `/r/{code}`.** Countdown per child, polls every 15s,
   ticks every second in between, first names only.
3. **Counter search, family card, check-in.** One field matching name, phone,
   code or a scanned sticker; the greeting line the staffer reads aloud; waiver
   and email-delivery status; medical notes in red.
4. **Sticker printing with browser fallback.** ZPL to the Zebra, and an exact
   51 × 25 mm `@page` fallback with a real Code 128 barcode when the agent does
   not answer.
5. **Worker.** Claim-then-send idempotency, `active → warned → expired →
   overdue`, three emails.
6. **Zone board, check-out, pickup queue.** Drop-off release verifies the code;
   anyone else needs a supervisor PIN and their name recorded.
7. **Bilingual throughout, an OTP way back in, and a supervisor overview** —
   all added after review, none in the original plan.

---

## Decisions worth knowing about

**Bilingual, English and Arabic, everywhere.** The guardian flow, the status
page, the counter console, and all four emails. Copy lives in one dictionary
(`packages/shared/src/i18n/`) and a test asserts the two locales have identical
shapes and no untranslated strings, so English cannot leak into an Arabic
screen. Zone names are database columns, not dictionary keys, because a zone is
data. Arabic prose uses Arabic-Indic digits; codes, times and countdowns stay in
Western digits, because the staffer reading them may not read Arabic and the
sticker prints once for both.

**Monigue is the display face, everywhere, including the numbers.** The cut in
`apps/web/public/fonts/` carries a full Latin set — 374 mapped glyphs, digits,
colon, upper and lower case — so the mid-string fallback that used to break
every time and code is gone, and it is shipped as woff2 (23 KB against 41 KB
for the otf). The interim League Gothic substitution has been removed.

One property to know about: its figures are **proportional**, and its GSUB has
no `tnum` feature, so `font-variant-numeric: tabular-nums` cannot help. A `1`
sets at 267 units where a `5` sets at 407, on a 1000-unit em. Measured on the
real thing at 60px, a `mm:ss` countdown swings **32.8px** between `11:11` and
`88:88` — a 43% width change, redrawn every second, which the eye reads as
something happening.

Rather than set countdowns in a second typeface, `TickingNumber` gives each
digit a fixed cell (`--digit-cell: 0.44em`, clearing Monigue's widest figure)
and leaves separators at their natural width. Same measurement with the cells
in place: **0px**. That is what lets one face carry every number in the product
— the code, the countdowns, the overdue clock and the durations on the tiles.

**Arabic display and body type are Noto Kufi Arabic and Cairo.** The supplied
brand has no Arabic direction at all and Monigue has no Arabic in its cmap, so
this pairing is a proposal. Have an Arabic-reading designer look at it.

**The registration code is six digits, grouped `815 646`.** It was Crockford
base32 (`R-7K2M`). In a hall at 85 dB, between a Filipino staffer, an Egyptian
parent and a British child, letters are where it breaks — M and N, F and S, K
and Q survive almost no accent plus that much crowd noise. Digits are a distinct
word in every accent, they are what everybody already recites down a bad phone
line, and they type on a numeric keypad.

**The email confirm-by-retype is gone.** PRD §3 asked for shape, typo
correction and a retype. The retype was fifteen to twenty seconds of a
one-minute flow, typed one-handed with paste disabled, and it only caught the
class of error the typo pass already catches — someone who mistypes a domain
once usually mistypes it the same way twice. It is replaced by a read-back: the
address is shown large on the sign step with a Change button. The other two
checks are untouched and the counter still shows a bounce before the child goes
in. **This is a deliberate departure from the PRD.**

**Photography is a notice, not a checkbox,** and **the marketing box starts
ticked**, both at your direction. On the second: I flagged that UAE PDPL wants
consent to be a clear affirmative act and that a pre-ticked box is the textbook
example of what does not qualify, on a domain that also carries the 5-minute
safety alerts. You have decided otherwise; the code comment in `ConsentStep.tsx`
is the record of that being a decision rather than an oversight. It is a real
box the guardian can untick, the wording is specific, and the timestamp is
stored either way.

**The signature is pre-filled** from the name given two steps earlier, and the
schema no longer requires it to match character for character — an exact-match
rule now blocks only honest edge cases (signing "Fatima A.") while catching no
dishonest ones. The acceptance record still gets a name, a version and a time.

**Arabic names are romanised on the thermal sticker.** A Zebra's built-in fonts
are Latin and ZPL does no text shaping, so an Arabic name sent as ZPL prints as
boxes or nothing. `stickerSafeName` romanises it — badly, and the code says so:
Arabic omits short vowels, so long-vowel names survive ("نور" → "Nur") and
others do not ("محمد" → "Mhmd"). That is acceptable because the identifier on
the sticker is the child code, which is digits. **The browser fallback prints the
real Arabic correctly**, because HTML shapes text. The proper ZPL fix is a
`^GFA` bitmap and is listed as open.

**Numbers are LTR-isolated on every page, not just Arabic ones.** An Arabic
*name* on the English zone board starts an RTL run, and the phone number beside
it was rendering `050 987 6543` as `6543 987 050`.

**"Open my page again" is mobile number → emailed one-time code.** The number
alone never opens anything — it is printed on a sticker and said aloud at a
counter all day — so it only decides where a six-digit code is sent. Possession
of the mailbox authorises. Codes are stored hashed, expire in ten minutes, allow
five attempts and three outstanding at a time. The email deliberately contains
no child names, no zone and no sign-in link, because it is sent on the say-so of
a phone number.

**The QR code is gone.** It only earned its place if a counter had a scanner to
read it, and there is no scanner in the buy list — so it was a square of ink
telling a parent to do something nobody could act on. The Code 128 barcode still
prints on the sticker: it costs nothing, and a £25 USB scanner later makes it
useful. Nothing in the interface now assumes scanning.

**The confirmation screen and the live status page are one URL.** PRD §3 asks
for a confirmation carrying the code; PRD §6 asks the parent to keep the live
page open. Folded together, the page already open on their phone becomes the
countdown the moment the staffer starts the clock.

**A child who picked Soft Play arrives unticked at the Bouncy Castles counter,**
with a "Picked Soft Play" badge. Still sendable, but it takes a deliberate tap.

**Name search uses `word_similarity`, not `similarity`.** "fatma" scores 0.19
against "Fatima Al Mansoori" whole and 0.5 against its first word.

**The pickup queue's "Collected" runs the same check as the board.** An overdue
child is still a child in a zone, so a drop-off release from that screen still
asks for the code.

**A staff shift cookie is checked against the database on every request.** A
signed cookie outlives a re-seed, which is the documented way to rotate PINs, so
without this a staffer would hit a foreign-key error at check-in. Now they get
the PIN pad. It also means deactivating someone takes effect on their next tap.

**The counter is pinned to one zone; the supervisor overview is not.** PRD §4
asks for a console locked to a single zone, which is right for a counter with a
queue in front of it — but it meant nobody could see the whole operation.
`/counter/overview` is the answer: both zones side by side with live countdowns,
the pickup queue, the day's totals, and every address that bounced. It is
read-only by design, because it is the screen most likely to be left open on a
laptop nobody is standing at, and it is gated on the staff row's role rather
than on the cookie, so it cannot be reached by editing a payload.

**Overdue durations roll over to hours.** A session nobody closed overnight was
rendering as "-1227:01" and "1227 minutes over". Past sixty minutes the
countdown becomes `h:mm:ss` and the queue's headline number becomes `h:mm` with
the label switching to hours.

**There is an End shift control.** Without it a laptop stayed locked to whoever
typed a PIN first, for twelve hours — so a supervisor could not open the
overview on a counter machine, and a staffer going off shift left their session
running on it.

**`/counter*` and the staff API are IP-restricted in the Caddyfile** to the
counters' private LAN.

---

## Getting to one minute

The flow was "about two minutes". What was cut, in order of seconds saved:

| Change | Roughly |
|---|---|
| Confirm-by-retype on email removed, read-back instead | 15–20s |
| Signature pre-filled from the name already given | 8–10s |
| Photo consent checkbox → a notice with nothing to tap | 3–5s |
| Marketing box pre-ticked | 2–3s |
| Zone tiles grouped, one number per tile, supervision note on the group | 5–8s |
| Landing sub-head removed, second logo removed | fewer things to read |

The waiver scroll gate stays, and so does the scroll itself — it is the thing
the whole document exists to evidence. What was added there is a progress bar,
so a disabled button is never disabled for a reason the reader cannot see.

## Cut, per BUILD_PLAN

Offline PWA and sync queue (though `/api/sync` and the `client_uuid` replay
guard are both built and working, so the queue has somewhere to land), admin
CRUD, the extend flow (check out and straight back in — verified), capacity
enforcement, age gating, audit-log UI, CSV export, Playwright, WhatsApp (the
`Channel` interface is there; only `EmailChannel` is implemented).

**Arabic is no longer cut** — BUILD_PLAN dropped it and it is now built, across
the guardian flow, the counter console and every email.

---

## Commands

```bash
npm run dev           # web + worker
npm run dev:print     # print agent
npm test              # unit + integration tests
npm run typecheck     # every package
npm run db:generate   # new migration from the schema
npm run db:migrate
npm run db:seed       # idempotent; never rewrites a published waiver
npm run db:reset      # drops and recreates public (refuses in production)
```
