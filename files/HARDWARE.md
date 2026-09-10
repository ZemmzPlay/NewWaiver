# Hardware, network & procurement

## Recommended: Zebra ZD411d / ZD421d, direct thermal, with the Ethernet module

**Why this is the least likely to break:**

- **No drivers, anywhere.** You send ZPL — plain text — to TCP port 9100 on the printer's IP. No print queue, no OS driver, no USB permission dialogs, no "printer offline" in Windows. If a label doesn't come out, you can literally telnet the printer and test it.
- **No ribbon.** Direct thermal has exactly one consumable: the label roll. Nothing to misalign, nothing to run out of mid-queue.
- **Device-independent.** Because printing goes over the LAN, the counter device can be a laptop today and a different laptop tomorrow. Swap in seconds.
- **Serviceable in the UAE.** Zebra has real distribution here and 51×25mm direct thermal rolls are a stock item, not a special order.

**Model choice:** ZD411d is the 2-inch model and matches our 51×25mm sticker exactly — cheaper and smaller footprint on a counter. ZD421d is the 4-inch version if you want the option of bigger labels later.

**Indicative cost:** the ZD421 direct thermal sits around <cite index="11-1">$390 for the direct thermal desktop unit</cite>, roughly AED 1,430; the ZD411d runs lower. Budget AED 1,100–1,500 per unit landed.

### Buy list

| Item | Qty | Note |
|---|---|---|
| Zebra ZD411d (or ZD421d), direct thermal, Ethernet module | 3 | 2 counters + 1 cold spare, pre-configured with static IPs |
| Direct thermal labels 51×25mm, 1" core | 6,000+ | ~AED 30–50 per 1,000. Buy double what you think |
| Travel router (GL.iNet Slate or similar) with a 5G SIM | 1–2 | **The single most important reliability purchase** |
| Counter device (laptop, Chrome, runs the print agent) | 2 + 1 spare | Any existing Zawaya laptop is fine |
| Cat6 patch cables, power strips, gaffer tape | — | Printers wired, never on wifi |
| Blank stickers + marker | 200 | Paper fallback if everything dies |

**Total new spend: roughly AED 5,000–6,000** assuming laptops exist.

### Why the router matters more than the printers

ADNEC hall wifi under a comic con crowd is the thing that will fail, not the software. Your own private LAN — one router, printers on ethernet, counters on its wifi, a 5G SIM for the uplink — means the counters talk to the printers even if the internet is completely gone. Combined with the offline queue in the app, a full internet outage costs you nothing except delayed WhatsApp messages.

### Rejected alternatives

- **Brother QL-820NWB** (~AED 900). Cheaper upfront, but it speaks a proprietary raster protocol rather than ZPL, the Node libraries for it are hobby-grade, and DK die-cut labels are proprietary and cost several times more per label. You lose the savings inside one event.
- **Generic 58mm thermal receipt printers** (~AED 250). ESC/POS receipt paper has no adhesive, and the cheap ones fail under sustained load. Not worth the risk on the day.
- **AirPrint from an iPad.** Label sizing through iOS print dialogs is unreliable and there is no way to script it. Don't.

## Counter device and print agent

Each counter laptop runs a small local Node service (`apps/print-agent`) on `localhost:9110`. The web console posts a print job to it; the agent renders the ZPL and opens a TCP socket to the printer. If the agent is unreachable, the console falls back to a browser print dialog with exact `@page` sizing so you're degraded, not dead.

## Sticker layout (51 × 25 mm)

```
LAYLA A.                      bold, auto-shrink, 2 lines max
IN 14:32     OUT 15:32
BOUNCY CASTLE      R-7K2M-1
[Code128 barcode of child code]
```

**Do not print the guardian's mobile number on the sticker.** It's tempting for lost children, but it puts a parent's number on a child's chest in a hall full of strangers. Instead the sticker carries the code and the zone; any staffer can scan or type the code and get the guardian's details and a one-tap call. Same outcome, no exposure.

## If the Zebra doesn't arrive by Thursday

Three days is tight for procurement. Call a Dubai or Abu Dhabi POS supplier tomorrow morning and ask for stock on the shelf, not an order. If it can't be in your hands by Thursday, fall back in this order:

1. **Any label printer you can buy off the shelf today**, driven through the browser print fallback with `@page` sizing. Slower and fussier than ZPL, but it prints.
2. **A4 label sheets in an office laser printer.** 24-up address labels, printed in batches. The staffer peels rather than tears. Ugly, works.
3. **Blank stickers and a marker.** The system still does the lookup, the timer, the emails and the pickup queue — the sticker is only identification and a printed time. Losing the printer is an inconvenience; losing the timer is not.

Order the Zebras anyway. You have four more events in this pipeline and the second deployment pays for them.

## Pre-event checklist

- Print 50 stickers and test adhesion on cotton, polyester and a costume cape
- Configure static IPs on all three printers and label them physically
- Rehearse a printer swap: unplug one, plug in the spare, confirm printing resumes with a config change and no restart
- Confirm the 5G SIM has data and the router failover works with the hall wifi unplugged
