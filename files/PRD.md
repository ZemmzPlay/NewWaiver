# Carnival Waiver & Session System — PRD v2

**Codename:** `carnival-waiver`
**Deployment:** Middle East Film & Comic Con — two supervised play zones
**Owner:** Nabil Alhajasad (Zawaya / Carnival.ae)

Revised after round 1. Items still marked **[OPEN]** need your answer.

---

## 1. What it does

Guardians scan a QR at the zone entrance, pick a package, read and accept a waiver, and enter their and their children's details on their own phone. At the counter a staffer finds them in seconds, starts the clock, and prints a sticker per child. WhatsApp warns the guardian 5 minutes before time is up. Staff see a live board of who is inside and who is overdue.

**Explicitly out of scope:** payment (handled on separate unlinked POS terminals), ticketing, photos of children.

---

## 2. The two zones

| | Soft Play | Bouncy Castles |
|---|---|---|
| Supervision | **Accompanied** — guardian stays in the zone | **Drop-off** — guardian may leave |
| Typical age | Younger | Older |
| Age limits | **[OPEN]** | **[OPEN]** |
| Durations | 15 / 30 min **[OPEN — confirm, and any others]** | 15 / 30 min |

`supervision_mode` is a property of the zone, and it drives the check-out rules. Under no circumstances does a child leave a zone without their adult — that's a hard rule in the UI copy, the waiver, and the staff script.

---

## 3. Registration flow (guardian's phone)

**Step 1 — Pick a package.** The landing page is the package grid you used before, now 2 zones × durations:

```
┌──────────────────┐  ┌──────────────────┐
│  15 MINUTES      │  │  30 MINUTES      │
│  Soft Play       │  │  Soft Play       │
└──────────────────┘  └──────────────────┘
┌──────────────────┐  ┌──────────────────┐
│  15 MINUTES      │  │  30 MINUTES      │
│  Bouncy Castle   │  │  Bouncy Castle   │
└──────────────────┘  └──────────────────┘
```

The selection sets the default for all children; it can be changed per child in step 3 and again by the staffer at the counter. Zone tiles carry a one-line supervision note ("You'll stay with your child" / "You may leave, we'll message you").

**Step 2 — Read the waiver.** Full text in a scrollable panel. The Continue control is disabled until the panel is scrolled to the end. EN / AR toggle.

**Step 3 — Your details.**
- Full name
- Relation: Mother / Father / Legal guardian / Other
- Mobile — UAE-first, stored E.164. Used by staff to call, not for automated messages
- Email — **this is the alert channel, so validate it hard**: inline format check, a common-typo correction pass (gmial, hotmial, yaho), and a confirm-by-retype on the field

**Step 4 — Children.**
- Child's name
- **Age** — a single row of tappable number chips (1–14), not a date picker. One tap, no keyboard, no calendar. This gives you age gating with the least friction
- Zone + duration chip, prefilled from step 1, tappable to change
- Circular `+` button below the last child adds another block; each block after the first has a small remove control

**Step 5 — Consent.**
- Checkbox: I have read and agree to the waiver (records the exact waiver version ID)
- Typed full name as signature
- Separate optional checkbox: photography and media consent
- Marketing consent — see §8, this needs a decision

**Step 6 — Confirmation.** Large registration code (`R-7K2M`) plus QR, a prominent **"Keep this page open"** link to the live status page, and the confirmation email sent immediately.

The immediate email doubles as a **channel test**: SES bounce and complaint webhooks flip `email_status`, and a failed delivery raises a warning on the counter screen so the staffer can correct the address before the child goes in. This is the single highest-value detail in the design — a wrong address caught at 14:32 is fixable, caught at 15:27 it isn't.

**Duplicate handling:** a repeat registration on the same mobile returns the existing family with an "add another child" option rather than creating a second record.

---

## 4. Counter flow

1. Console is pinned to one zone. Staffer unlocks with a PIN.
2. **Search** — one field matching guardian name, child name, mobile in any format, or the code. Camera scan fills the same field.
3. **Family card**, leading with the greeting line the staffer reads aloud:
   > *"Welcome Fatima — and hello Layla and Omar!"*
   Below it: waiver status, email delivery status, children with ages, any medical note in red, and any live session in the other zone.
4. Staffer multi-selects the children going in, confirms or changes the duration (prefilled from what the family picked online, and cross-checked against the ticket stub), and optionally types the stub reference.
5. **Start & print.** Sessions created, stickers queued, WhatsApp alert scheduled at `ends_at − 5 min`.
6. Console shows the closing script: *"You'll get a WhatsApp 5 minutes before their time is up."*

Age vs zone mismatch shows an amber warning the staffer must acknowledge. Capacity overflow needs a supervisor PIN. **[OPEN — should either of these hard-block instead?]**

---

## 5. Check-out and the overdue path

**Soft Play (accompanied):** the guardian is already there. Check-out is a scan of the sticker, or a tap on the board. No identity check needed.

**Bouncy Castles (drop-off):** the returning adult must produce the registration code — from their WhatsApp confirmation or the guardian's own sticker copy — or match the guardian name on file. The staffer taps *Confirm release*, and the system logs staff ID, method of verification, and timestamp. If someone other than the registered guardian collects, the staffer records the name and the system requires a supervisor PIN.

**Overdue path.** At `ends_at + 10 min` (**[ASSUMPTION]**) the child moves to `overdue` and enters a dedicated **Pickup queue** visible to the assigned staff member:
- Guardian name, child name, zone, minutes overdue
- One-tap call and one-tap WhatsApp
- Each attempt is logged with an outcome: answered / no answer / on their way
- After 3 failed attempts or 30 minutes, the card escalates to red and prompts the supervisor and the venue's lost-child procedure

This queue is the reason to build the system, not a side feature. It should be the clearest screen in the product.

---

## 6. Notifications — email only

**Decision (8 Sep):** WhatsApp is cut. Meta Business verification and template approval cannot be guaranteed inside three days. Email via AWS SES is the channel. The `Channel` interface stays in the code so WhatsApp can be added after the event without touching anything else.

| Trigger | Timing | Contents |
|---|---|---|
| Registration complete | Immediate | Code, zone, duration, link to the live status page |
| 5 minutes remaining | `ends_at − 5 min` | Child name, zone, minutes left, which counter to return to |
| Ready for pickup | `ends_at + grace`, drop-off zones only | Please return to the Bouncy Castle counter now |

### The three compensations for losing push

Email will not reliably reach a parent inside five minutes in a comic con hall. Three things carry the load instead, and all three are free and need no approvals:

1. **The live status page.** The confirmation screen and the confirmation email both link to `/r/{code}` — a public page showing a live countdown for each of that family's children. Parents keep the tab open on their phone. This is the closest thing to push that ships by Friday, and it should be built in the same phase as registration, not treated as an extra.
2. **The printed time.** `OUT 15:32` is on the sticker on the child's chest. The staffer reads the pickup time aloud at check-in and it goes in the closing script.
3. **The staff board.** The counter board and the Pickup queue are the real safety net. If nobody reads an email, the system still knows exactly who is overdue and who to call.

### Deliverability — handle today

- **SES starts in sandbox** and will only send to verified addresses until AWS grants production access. Request it immediately; it's usually approved within a day, but it is a hard blocker until it lands.
- **Have a second provider ready.** Wire the `EmailChannel` so the provider is a config value, and stand up a Resend or Postmark account on the same domain as backup. If SES production access hasn't landed by Thursday morning, switch a single env var.
- **DNS today, not Thursday.** SPF, DKIM and DMARC on the sending domain need to be in place and propagated before any volume goes out.
- **Send from an established Zawaya domain if you have one with sending history.** A brand-new domain pushing a few thousand messages on its first day is exactly the pattern spam filters are built to catch.
- **Test to real Gmail, Outlook and iCloud accounts** and check the inbox, not the send log.

## 7. Rules

- No session without a valid consent against the current waiver version.
- One live session per child across both zones.
- Extensions create a linked follow-on session, reschedule the alert, and reprint the sticker.
- All timestamps UTC in the database, `Asia/Dubai` on screen.
- Waiver versions are immutable; editing published text creates a new version.

---

## 8. Two things I'd push back on

**8.1 The auto-checked marketing opt-in.** UAE PDPL requires consent to be a clear affirmative act, and a pre-ticked box is the textbook example of what does not qualify. It's also the practice that gets a sending domain flagged for spam complaints — and that same domain is now carrying your operational alerts, so a reputation hit puts the 5-minute warnings at risk. The sensitivity is higher than normal here because the surrounding record is children's data.

What I'd do instead: an unticked box with warm, specific copy — *"Email me when Carnival is in town"* — placed prominently rather than buried. At a comic con with families who just had a good time, a well-placed unticked box converts far better than people expect, and every name on the list is one you can actually market to. Your call, but I'd want it recorded as a deliberate decision rather than a default.

**8.2 What the waiver can and can't do.** Under UAE civil law you cannot contract out of liability for your own negligence — a release clause won't shield Zawaya the way it would in the US. That doesn't make the waiver pointless; it makes it a different instrument. Its real value is documented proof that the guardian was informed of the risks, accepted the zone rules, declared the child fit to participate, and authorised emergency medical treatment. Draft it for that purpose and it earns its place. Draft it as a liability shield and it gives false comfort. See `WAIVER_DRAFT.md`.

I'm not a lawyer and this isn't legal advice — the final text needs a UAE-qualified lawyer and your insurer's sign-off before the event.

---

## 9. Data protection

- **Controller:** Zawaya. Named in the form's privacy notice with a contact address.
- **Purpose:** operating the play zones, contacting guardians during a session, and — separately and only with consent — future marketing.
- **Retention:** children's names, ages and medical notes deleted 30 days after the event. Guardian contact details retained only where marketing consent was given; otherwise deleted at the same time. **[ASSUMPTION]**
- **Cross-border:** hosting in AWS Mumbai means guardian and children's personal data leaves the UAE. PDPL permits transfers with adequate safeguards, but it has to be disclosed in the privacy notice and it's worth a look at whether AWS `me-central-1` (UAE) suits this particular workload better. Flagging it, not arguing it — you know why Mumbai.

---

## 10. Three-day reality check

Friday is three days away. The full scope in this document is not a three-day build. `BUILD_PLAN.md` has been rewritten as a Wed/Thu/Fri sprint with an explicit cut list. Read that before starting anything.

## 11. Still open

1. ★ Duration options and age limits per zone — needed for the seed script, blocks Phase 1
2. ★ Is Friday the first event day, or the day it must be live for a rehearsal?
3. Whether age/zone mismatch and capacity overflow warn or hard-block
4. Marketing opt-in — pre-ticked or not (§8.1)
5. Whether Soft Play children need a printed sticker at all, given the guardian is present — my view is yes, for the timer and for lost-child identification, but it's a real cost and time saving if not
6. Who owns the Pickup queue on the day, and what ADNEC's own lost-child procedure requires you to plug into
