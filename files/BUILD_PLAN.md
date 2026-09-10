# Build plan — three-day sprint

**Today: Tuesday 8 September. Live: Friday 11 September.**

The eight-phase plan is dead. This is what fits, in order, with an explicit cut list. Read the cut list first — knowing what you are *not* building is what makes Friday possible.

---

## What ships

| | Feature | Why it's in |
|---|---|---|
| 1 | Package grid → waiver → guardian → children → consent → confirmation | No waiver, no operation |
| 2 | Live status page at `/r/{code}` | The only parent-facing timer that actually works in a loud hall |
| 3 | Counter search, family card, check-in | The core staff loop |
| 4 | Sticker printing with browser fallback | Identification and printed pickup time |
| 5 | Worker: timers, state transitions, three emails | The 5-minute promise |
| 6 | Zone board + check-out + **Pickup queue** | The safety net, and the reason to build this |

## What is cut — do not build these

- Offline PWA and sync queue. **Mitigated by:** the private 5G router. If the uplink dies the app is unreachable, and the paper fallback covers it. This is the biggest accepted risk of the sprint.
- Arabic and RTL. English only.
- Admin CRUD. Zones, packages, staff and waiver text are seed data, changed by editing the seed and re-running it.
- Extend flow. **Workaround:** the staffer checks the child out and checks them straight back in. One extra step, no code.
- Capacity enforcement, age gating, supervisor PINs, audit log, CSV exports, load testing, Playwright.
- WhatsApp. Interface stays, implementation doesn't.

---

## Tuesday — today, before any code

These are the things that can still make Friday impossible. Do them now, in this order.

1. **Request AWS SES production access.** Sandbox mode only sends to verified addresses. Approval is usually within a day but it is not instant, and nothing works without it.
2. **Stand up Resend or Postmark on the same domain as a backup provider.** If SES hasn't cleared by Thursday morning you flip one env var.
3. **Publish SPF, DKIM and DMARC** for the sending domain. Propagation takes hours.
4. **Call a POS supplier about Zebra stock** — on the shelf, not on order. See the fallback ladder in `HARDWARE.md`.
5. **Buy the travel router and 5G SIM.** With no offline mode, this is now load-bearing.
6. **Send me the duration options and age limits per zone.** They block the seed script, which blocks everything else.
7. **Waiver text.** A lawyer-reviewed version in three days is unlikely. Decide now whether you go live on a draft reviewed by whoever you can reach, and get it properly reviewed before the next event. That's your risk call, not mine — but the text has to be final by Wednesday evening either way.

## Wednesday — build day 1

**Morning:** scaffold, schema, seed with the real zones, packages, waiver text and staff PINs. RDS and EC2 provisioned, domain pointed, a hello-world deployed through the real pipeline. *Deploy on day one — do not leave first deployment until Thursday night.*

**Afternoon:** the full public flow. Package grid, waiver panel with scroll gate, guardian form with hard email validation, children with age chips and the circular `+`, consent, confirmation. Live status page at `/r/{code}`. Confirmation email through SES.

**Gate, end of Wednesday:** you can register a family on your own phone against the deployed URL, receive the confirmation email, and watch a status page.

## Thursday — build day 2

**Morning:** counter console. PIN unlock, unified search, family card with the greeting line, multi-select check-in, sticker preview. Then printing: the ZPL agent if the Zebra has arrived, the browser fallback either way.

**Afternoon:** the worker. 20-second tick, claim-then-send idempotency, state transitions, expiry and pickup emails. Then the zone board, check-out honouring supervision mode, and the Pickup queue with tap-to-call and logged attempts.

**Gate, end of Thursday:** a two-minute test session runs the whole lifecycle on the deployed environment — check in, sticker prints, warning email arrives once, child goes overdue, pickup queue shows them, check-out closes it.

## Friday morning — rehearsal, not development

Code freeze at whatever exists. The morning is for the venue, not the editor:

- Router up, printers on static IPs, counters connected, hall wifi unplugged to prove failover
- 30 test stickers, adhesion checked on cotton, polyester and a costume cape
- Test emails to real Gmail, Outlook and iCloud handsets — inbox, not send log
- One timed run through the counter script with the actual staff, twice
- Paper fallback laid out at both counters: blank stickers, markers, and a printed one-page procedure

Fix only what the rehearsal breaks. Ship nothing new after 11am.

---

## Honest risk register

| Risk | Likelihood | If it happens |
|---|---|---|
| SES production access late | Medium | Flip to the backup provider |
| Zebra doesn't arrive | Medium | Browser fallback, then A4 label sheets, then marker |
| Uplink dies at ADNEC, no offline mode | Low but severe | Paper fallback; re-enter afterwards. **The one thing that stops the system dead** |
| Waiver not legally reviewed in time | High | Your call. Document it as a known gap and fix before the next event |
| Emails land in spam | Medium | Status page, printed time and staff board carry it; staff verbally confirm pickup time at check-in |

The pattern in that table: every row has a fallback except the uplink. If you can find a day between now and Friday, spend it on the offline queue rather than on any feature.

## After the event

Offline PWA, Arabic, WhatsApp, admin CRUD, extend flow, exports. This is the first of several carnivals — build the second version from what Friday teaches you, not from this document.
