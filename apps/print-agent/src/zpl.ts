import { stickerSafeName } from '@carnival/shared';

/**
 * ZPL for a 51 x 25 mm direct thermal label at 203 dpi (8 dots/mm).
 *
 *   51mm = 408 dots wide, 25mm = 200 dots tall.
 *
 * Layout is HARDWARE.md's, to the line:
 *   LAYLA A.                      bold, auto-shrink, 2 lines max
 *   IN 14:32     OUT 15:32
 *   BOUNCY CASTLE      R-7K2M-1
 *   [Code128 barcode of child code]
 *
 * The guardian's mobile number is deliberately absent: it is tempting for lost
 * children, but it puts a parent's number on a child's chest in a hall full of
 * strangers. The code and the zone get the same outcome with no exposure.
 *
 * There is no colour in this file because a direct thermal head has one: black.
 */

const WIDTH_DOTS = 408;   // 51mm at 8 dots/mm
const HEIGHT_DOTS = 200;  // 25mm
const MARGIN = 12;

/**
 * A fixed vertical grid. The name font shrinks to fit its two lines, but the
 * rows below it never move — an auto-shrinking name that pushed the barcode
 * down would run it off the bottom of a 25mm label on exactly the long names
 * that need scanning most.
 */
const NAME_Y = 4;
const NAME_MAX_HEIGHT = 46;   // two lines fit above TIMES_Y
const TIMES_Y = 104;
const META_Y = 138;
const BARCODE_Y = 160;
const BARCODE_HEIGHT = 34;

export interface StickerJob {
  childName: string;
  childCode: string;
  zone: string;
  timeIn: string;
  timeOut: string;
  copies?: number;
}

/** ^ and ~ are ZPL control characters, and a caret in a name would corrupt the label. */
function sanitise(value: string): string {
  return value.replace(/[\^~]/g, ' ').trim();
}

/**
 * A Zebra's built-in fonts are Latin and ZPL does no text shaping, so an Arabic
 * name sent as-is prints as boxes or as nothing at all. Romanise it. The child
 * code below the name is the identifier that actually matters, and it is
 * digits, so a label whose name romanises badly is still fully usable.
 */
function printableName(value: string): string {
  const safe = stickerSafeName(sanitise(value));
  return safe.trim();
}

/**
 * The name shrinks rather than truncates. Two lines maximum, and the font drops
 * a step at a time until it fits, because a clipped name on a lost child is
 * worse than a small one.
 */
function nameFontHeight(name: string): number {
  if (name.length <= 12) return NAME_MAX_HEIGHT;
  if (name.length <= 18) return 38;
  if (name.length <= 26) return 30;
  return 24;
}

export function renderSticker(job: StickerJob): string {
  // Falls back to the child code if romanising leaves nothing printable — a
  // sticker with a code and a time on it still does its job; a blank one does
  // not.
  const name = (printableName(job.childName) || sanitise(job.childCode)).toUpperCase();
  const height = nameFontHeight(name);

  return [
    '^XA',
    '^CI28',                                   // UTF-8 input
    `^PW${WIDTH_DOTS}`,
    `^LL${HEIGHT_DOTS}`,
    '^LH0,0',
    '^MD10',                                   // a little extra darkness for cloth
    // Name — field block, two lines maximum, left aligned.
    `^CF0,${height}`,
    `^FO${MARGIN},${NAME_Y}^FB${WIDTH_DOTS - MARGIN * 2},2,0,L,0^FD${name}^FS`,
    // In and out times, the two things a staffer reads off a child's chest.
    '^CF0,28',
    `^FO${MARGIN},${TIMES_Y}^FDIN ${sanitise(job.timeIn)}^FS`,
    `^FO190,${TIMES_Y}^FDOUT ${sanitise(job.timeOut)}^FS`,
    // Zone and child code.
    '^CF0,20',
    `^FO${MARGIN},${META_Y}^FD${sanitise(job.zone).toUpperCase()}^FS`,
    `^FO250,${META_Y}^FD${sanitise(job.childCode)}^FS`,
    // Code 128 of the child code. No interpretation line — it is printed above.
    `^BY2,2,${BARCODE_HEIGHT}`,
    `^FO${MARGIN},${BARCODE_Y}^BCN,${BARCODE_HEIGHT},N,N,N^FD${sanitise(job.childCode)}^FS`,
    `^PQ${Math.max(1, Math.min(3, job.copies ?? 1))}`,
    '^XZ',
  ].join('\n');
}

export function renderBatch(jobs: StickerJob[]): string {
  return jobs.map(renderSticker).join('\n');
}
