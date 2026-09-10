import { describe, expect, it } from 'vitest';
import { ar } from './ar.js';
import { en } from './en.js';
import { dictionary, direction, isLocale, localiseDigits, LOCALES } from './index.js';

type Node = Record<string, unknown>;

/** Every leaf path, so a missing branch shows up as a path and not a `false`. */
function paths(node: Node, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) return paths(value as Node, path);
    return [`${path}:${Array.isArray(value) ? 'array' : typeof value}`];
  });
}

describe('dictionaries', () => {
  it('have identical shapes, so no English can leak into an Arabic screen', () => {
    expect(paths(ar as unknown as Node).sort()).toEqual(paths(en as unknown as Node).sort());
  });

  it('translate every string — nothing was copied across untouched', () => {
    const skip = new Set([
      // The two the toggle needs written in the *other* language.
      'meta.switchTo',
      // A phone number placeholder is the same in both.
      'guardianStep.mobilePlaceholder',
    ]);
    const flat = (node: Node, prefix = ''): [string, unknown][] =>
      Object.entries(node).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) return flat(value as Node, path);
        return [[path, value] as [string, unknown]];
      });

    const arFlat = new Map(flat(ar as unknown as Node));
    for (const [path, value] of flat(en as unknown as Node)) {
      if (typeof value !== 'string' || skip.has(path)) continue;
      expect(arFlat.get(path), path).not.toBe(value);
    }
  });

  it('resolves a locale, a direction and a dictionary', () => {
    expect(LOCALES).toEqual(['en', 'ar']);
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(direction('ar')).toBe('rtl');
    expect(direction('en')).toBe('ltr');
    expect(dictionary('ar')).toBe(ar);
  });

  it('localises digits for Arabic prose only', () => {
    expect(localiseDigits(30, 'ar')).toBe('٣٠');
    expect(localiseDigits(30, 'en')).toBe('30');
    // A registration code must never go through this — staff read it back.
    expect(localiseDigits('482109', 'en')).toBe('482109');
  });
});

describe('name joining, which is read aloud at the counter', () => {
  it('uses each language’s own conjunction', () => {
    expect(en.common.joinNames(['Layla'])).toBe('Layla');
    expect(en.common.joinNames(['Yousef', 'Layla'])).toBe('Yousef and Layla');
    expect(en.common.joinNames(['A', 'B', 'C'])).toBe('A, B and C');

    // Waw attaches to the following word; the separator is an Arabic comma.
    expect(ar.common.joinNames(['نور'])).toBe('نور');
    expect(ar.common.joinNames(['نور', 'عمر'])).toBe('نور وعمر');
    expect(ar.common.joinNames(['أ', 'ب', 'ج'])).toBe('أ، ب وج');
  });

  it('never joins with something nobody says out loud', () => {
    for (const dict of [en, ar]) {
      expect(dict.common.joinNames(['A', 'B'])).not.toContain('+');
    }
  });

  it('greets in the language the console is in', () => {
    expect(en.counter.greeting('Nabil', 'Yousef and Layla'))
      .toBe('Welcome Nabil — and hello Yousef and Layla!');
    expect(ar.counter.greeting('فاطمة', 'نور')).toContain('أهلاً فاطمة');
  });
});
