import { describe, expect, it } from 'vitest';
import { renderBatch, renderSticker } from './zpl.js';

const job = {
  childName: 'Layla A.', childCode: 'R-7K2M-1', zone: 'Bouncy Castles',
  timeIn: '14:32', timeOut: '15:32',
};

describe('ZPL sticker', () => {
  it('is a complete label at 51 x 25 mm, 203 dpi', () => {
    const zpl = renderSticker(job);
    expect(zpl.startsWith('^XA')).toBe(true);
    expect(zpl.trimEnd().endsWith('^XZ')).toBe(true);
    expect(zpl).toContain('^PW408');
    expect(zpl).toContain('^LL200');
  });

  it('carries the four lines HARDWARE.md specifies', () => {
    const zpl = renderSticker(job);
    expect(zpl).toContain('LAYLA A.');
    expect(zpl).toContain('IN 14:32');
    expect(zpl).toContain('OUT 15:32');
    expect(zpl).toContain('BOUNCY CASTLES');
    expect(zpl).toContain('R-7K2M-1');
    expect(zpl).toContain('^BCN,34,N,N,N');
  });

  it('never prints a phone number', () => {
    const zpl = renderSticker({ ...job, childName: 'Layla A.' });
    expect(zpl).not.toMatch(/\+?\d{7,}/);
  });

  it('shrinks a long name instead of clipping it', () => {
    const short = renderSticker(job);
    const long = renderSticker({ ...job, childName: 'Abdulrahman Al Mansoori Junior' });
    const size = (zpl: string) => Number(zpl.match(/\^CF0,(\d+)/)![1]);
    expect(size(long)).toBeLessThan(size(short));
    expect(long).toContain('ABDULRAHMAN AL MANSOORI JUNIOR');
  });

  it('strips the ZPL control characters out of a name', () => {
    const zpl = renderSticker({ ...job, childName: 'Lay^la ~A' });
    expect(zpl).toContain('LAY LA  A');
    expect(zpl.match(/\^FD/g)!.length).toBe(zpl.match(/\^FS/g)!.length);
  });

  it('clamps copies to something a counter can survive', () => {
    expect(renderSticker({ ...job, copies: 99 })).toContain('^PQ3');
    expect(renderSticker({ ...job, copies: 0 })).toContain('^PQ1');
  });

  it('keeps every row inside the 25 mm label and never overlaps the barcode', () => {
    const longest = renderSticker({ ...job, childName: 'Abdulrahman Al Mansoori Junior' });
    for (const zpl of [renderSticker(job), longest]) {
      const ys = [...zpl.matchAll(/\^FO\d+,(\d+)/g)].map((m) => Number(m[1]));
      // Every field origin sits on the label...
      expect(Math.max(...ys)).toBeLessThan(200);
      // ...and the barcode's 34-dot bar height still clears the bottom edge.
      const barcodeY = Number(zpl.match(/\^FO\d+,(\d+)\^BCN/)![1]);
      expect(barcodeY + 34).toBeLessThanOrEqual(200);
      // The metadata row sits strictly above the barcode, at any name length.
      const metaY = ys.filter((y) => y < barcodeY).sort((a, b) => b - a)[0]!;
      expect(metaY).toBeLessThan(barcodeY);
    }
  });

  it('never lets a two-line name reach the times row', () => {
    for (const name of ['Ali', 'Layla A.', 'Abdulrahman Al M.', 'Abdulrahman Al Mansoori Junior']) {
      const zpl = renderSticker({ ...job, childName: name });
      const height = Number(zpl.match(/\^CF0,(\d+)/)![1]);
      const nameY = Number(zpl.match(/\^FO\d+,(\d+)\^FB/)![1]);
      expect(nameY + height * 2).toBeLessThanOrEqual(104);
    }
  });

  it('romanises a name a Zebra cannot set, and never emits non-Latin', () => {
    const zpl = renderSticker({ ...job, childName: 'نور المنصوري' });
    expect(zpl).toContain('NUR AL MNSURI');
    // Nothing outside Latin-1 + Latin Extended-A reaches the printer.
    expect(zpl).not.toMatch(/[^\u0020-\u024F\n]/);
  });

  it('falls back to the child code when a name romanises to nothing', () => {
    const zpl = renderSticker({ ...job, childName: '✿✿✿' });
    expect(zpl).toContain('R-7K2M-1'.toUpperCase());
  });

  it('batches labels into one stream', () => {
    const batch = renderBatch([job, { ...job, childCode: 'R-7K2M-2' }]);
    expect(batch.match(/\^XA/g)).toHaveLength(2);
  });
});
