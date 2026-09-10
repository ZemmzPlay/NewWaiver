import { describe, expect, it } from 'vitest';
import { renderWaiverMarkdown } from './markdown';

describe('waiver markdown', () => {
  it('renders the four constructs the waiver uses', () => {
    const html = renderWaiverMarkdown('## Rules\n\nSocks **required**.\n\n- No shoes\n- No props');
    expect(html).toBe('<h2>Rules</h2><p>Socks <strong>required</strong>.</p><ul><li>No shoes</li><li>No props</li></ul>');
  });

  it('escapes before it formats, so pasted text cannot execute', () => {
    expect(renderWaiverMarkdown('<img src=x onerror=alert(1)>'))
      .toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  });
});
