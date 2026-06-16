/** Opaque swap placeholders — never valid markdown syntax. */
export function swapPlaceholder(index) {
  return `\uE000${index}\uE001`;
}

const PLACEHOLDER_RE = /\uE000(\d+)\uE001/g;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(text) {
  const parts = text.split(PLACEHOLDER_RE);
  let html = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      html += swapPlaceholder(parts[i]);
      continue;
    }
    let chunk = escapeHtml(parts[i]);
    chunk = chunk.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    chunk = chunk.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html += chunk;
  }
  return html;
}

function isBlank(line) {
  return !line.trim();
}

function headingMatch(line) {
  const m = line.match(/^(#{1,3})\s+(.+)$/);
  if (!m) return null;
  const level = m[1].length;
  const tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
  return { tag, content: m[2] };
}

function listMatch(line) {
  const m = line.match(/^[-*]\s+(.+)$/);
  return m ? m[1] : null;
}

function parseBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && isBlank(lines[i])) i++;
    if (i >= lines.length) break;

    const heading = headingMatch(lines[i]);
    if (heading) {
      blocks.push({ type: 'heading', ...heading });
      i++;
      continue;
    }

    const listItem = listMatch(lines[i]);
    if (listItem) {
      const items = [];
      while (i < lines.length && listMatch(lines[i])) {
        items.push(listMatch(lines[i]));
        i++;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const paraLines = [];
    while (i < lines.length && !isBlank(lines[i]) && !headingMatch(lines[i]) && !listMatch(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', lines: paraLines });
  }
  return blocks;
}

function renderBlocks(blocks) {
  return blocks.map(block => {
    if (block.type === 'heading') {
      return `<${block.tag}>${renderInline(block.content)}</${block.tag}>`;
    }
    if (block.type === 'list') {
      const items = block.items.map(item => `<li>${renderInline(item)}</li>`).join('');
      return `<ul>${items}</ul>`;
    }
    const inner = block.lines.map(line => renderInline(line)).join('<br>');
    return `<p>${inner}</p>`;
  }).join('');
}

/**
 * Parse markdown in template text and inject pre-built swap mark HTML at placeholders.
 * @param {string} plainText - story with \uE000n\uE001 placeholders
 * @param {string[]} swapHtml - mark HTML per swap index
 */
export function renderMadLibMarkdown(plainText, swapHtml) {
  const blocks = parseBlocks(plainText);
  let html = renderBlocks(blocks);
  html = html.replace(PLACEHOLDER_RE, (_m, idx) => swapHtml[Number(idx)] ?? '');
  return html;
}

export { escapeHtml, renderInline, parseBlocks };
