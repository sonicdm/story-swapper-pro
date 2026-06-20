import { tokenize } from './text.js';
import { tagForCategory, EDITOR_BLANK_TAGS } from './custom-templates.js';

/** Replace a character range in text. */
export function replaceRange(text, start, end, insert) {
  return `${String(text).slice(0, start)}${insert}${String(text).slice(end)}`;
}

/** Apply a blank tag at character range (category id or tag label). */
export function applyBlankAtRange(text, start, end, categoryOrTag) {
  const tag = EDITOR_BLANK_TAGS.includes(categoryOrTag)
    ? categoryOrTag
    : tagForCategory(categoryOrTag);
  return replaceRange(text, start, end, `{${tag}}`);
}

/** Restore a blank token span to its original word. */
export function restoreBlankAtRange(text, start, end, originalWord) {
  return replaceRange(text, start, end, originalWord);
}

/** Find start of line containing offset. */
export function lineStartAt(text, offset) {
  const idx = Math.max(0, Math.min(offset, text.length));
  const nl = text.lastIndexOf('\n', idx - 1);
  return nl === -1 ? 0 : nl + 1;
}

/** Find end of line containing offset (exclusive). */
export function lineEndAt(text, offset) {
  const idx = Math.max(0, Math.min(offset, text.length));
  const nl = text.indexOf('\n', idx);
  return nl === -1 ? text.length : nl;
}

/** Wrap selection with markdown inline markers (bold/italic). */
export function wrapSelection(text, start, end, marker) {
  const sel = text.slice(start, end);
  if (!sel) return text;
  const wrapped = `${marker}${sel}${marker}`;
  return replaceRange(text, start, end, wrapped);
}

/** Toggle bold on selection. */
export function toggleBold(text, start, end) {
  const sel = text.slice(start, end);
  if (sel.startsWith('**') && sel.endsWith('**') && sel.length > 4) {
    return replaceRange(text, start, end, sel.slice(2, -2));
  }
  return wrapSelection(text, start, end, '**');
}

/** Toggle italic on selection. */
export function toggleItalic(text, start, end) {
  const sel = text.slice(start, end);
  if (sel.startsWith('*') && sel.endsWith('*') && !sel.startsWith('**') && sel.length > 2) {
    return replaceRange(text, start, end, sel.slice(1, -1));
  }
  return wrapSelection(text, start, end, '*');
}

const HEADING_PREFIX = { h1: '# ', h2: '## ', h3: '### ' };

/** Set block type for the line containing offset. */
export function setBlockType(text, offset, type) {
  const start = lineStartAt(text, offset);
  const end = lineEndAt(text, offset);
  let line = text.slice(start, end);

  line = line.replace(/^#{1,3}\s+/, '');
  line = line.replace(/^[-*]\s+/, '');

  if (type === 'list') {
    line = `- ${line}`;
  } else if (type === 'h1' || type === 'h2' || type === 'h3') {
    line = `${HEADING_PREFIX[type]}${line}`;
  }

  return replaceRange(text, start, end, line);
}

/** Parse inline tokens for a full template string with global offsets. */
export function parseTemplateTokens(text) {
  const tokens = tokenize(text);
  return tokens.map(tok => ({
    ...tok,
    isBlank: tok.type === 'blank',
    isWord: tok.type === 'word'
  }));
}

/** Extract first ## heading text for title sync. */
export function firstHeadingTitle(text) {
  const m = String(text || '').match(/^##\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

/** Insert blank tag at cursor position. */
export function insertBlankTag(text, offset, tagLabel) {
  const insert = `{${tagLabel}}`;
  return replaceRange(text, offset, offset, insert);
}

/** Apply multiple blank replacements (right-to-left by start offset). */
export function applyBlankCandidates(text, candidates) {
  const sorted = [...candidates].sort((a, b) => {
    const aStart = a.token?.start ?? a.start;
    const bStart = b.token?.start ?? b.start;
    return bStart - aStart;
  });
  let result = text;
  for (const candidate of sorted) {
    const start = candidate.token?.start ?? candidate.start;
    const end = candidate.token?.end ?? candidate.end;
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    result = applyBlankAtRange(result, start, end, candidate.category);
  }
  return result;
}
