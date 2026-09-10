/**
 * A deliberately small Markdown renderer for the waiver body.
 *
 * The waiver is seed data we author ourselves, so it needs exactly four
 * constructs and no more: `## headings`, paragraphs, `- lists` and `**bold**`.
 * Everything is escaped first, so even if the text is later edited by someone
 * pasting from a word processor, nothing it contains can execute.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export function renderWaiverMarkdown(source: string): string {
  const out: string[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    out.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    list = [];
  };

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!line) { flushList(); continue; }
    if (line.startsWith('## ')) { flushList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('- ')) { list.push(line.slice(2)); continue; }
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  return out.join('');
}
