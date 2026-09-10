import { describe, expect, it } from 'vitest';
import { code128Modules, code128Svg, encodeCode128B } from './code128.js';

describe('code 128 subset B', () => {
  it('brackets the payload with start B and stop', () => {
    const codes = encodeCode128B('R-7K2M-1');
    expect(codes[0]).toBe(104);
    expect(codes.at(-1)).toBe(106);
    expect(codes).toHaveLength('R-7K2M-1'.length + 3);
  });

  it('computes the published check digit for the reference string', () => {
    // The worked example every reference uses is "PJJ123C", which checks to
    // 54 under Start A. We encode subset B, so the start value is 104 rather
    // than 103 and the same string checks to 55.
    const codes = encodeCode128B('PJJ123C');
    expect(codes.at(-2)).toBe(55);
  });

  it('encodes every symbol as eleven modules, and stop as thirteen', () => {
    const modules = code128Modules('R-7K2M-1');
    const total = modules.reduce((a, b) => a + b, 0);
    expect(total).toBe(11 * (encodeCode128B('R-7K2M-1').length - 1) + 13);
  });

  it('renders an svg that inherits colour', () => {
    const svg = code128Svg('R-7K2M-1');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('fill="currentColor"');
    expect(svg).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
