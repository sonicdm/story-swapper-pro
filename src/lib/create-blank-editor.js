import { escapeHtml } from './html-utils.js';
import { tokenize } from './text.js';
import {
  applyBlankAtRange,
  applyBlankCandidates,
  insertBlankTag,
  restoreBlankAtRange,
  setBlockType,
  toggleBold,
  toggleItalic
} from './template-model.js';
import { EDITOR_BLANK_TAGS, tagForCategory } from './custom-templates.js';
import { pickCategory } from './classify.js';

export const QUICK_BLANK_TAGS = ['noun', 'adjective', 'verb', 'place', 'person', 'number'];
const UNDO_LIMIT = 50;

function lineOffsets(text) {
  const lines = text.split('\n');
  let pos = 0;
  return lines.map(line => {
    const start = pos;
    pos += line.length + 1;
    return { line, start, end: start + line.length };
  });
}

export function blocksWithRanges(text) {
  const offsets = lineOffsets(text);
  let lineIdx = 0;
  const result = [];

  function skipBlankLines() {
    while (lineIdx < offsets.length && !offsets[lineIdx].line.trim()) lineIdx++;
  }

  skipBlankLines();
  while (lineIdx < offsets.length) {
    skipBlankLines();
    if (lineIdx >= offsets.length) break;

    const row = offsets[lineIdx];
    const line = row.line;
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const prefixLen = heading[1].length + 2;
      result.push({
        type: 'heading',
        level: heading[1].length,
        contentStart: row.start + prefixLen,
        contentEnd: row.end,
        lineStart: row.start
      });
      lineIdx++;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (lineIdx < offsets.length && /^[-*]\s+/.test(offsets[lineIdx].line)) {
        const itemLine = offsets[lineIdx].line;
        const m = itemLine.match(/^[-*]\s+(.+)$/);
        const contentStart = offsets[lineIdx].start + itemLine.length - m[1].length;
        items.push({ contentStart, contentEnd: offsets[lineIdx].end, lineStart: offsets[lineIdx].start });
        lineIdx++;
      }
      result.push({ type: 'list', items });
      continue;
    }

    const paraLines = [];
    while (lineIdx < offsets.length) {
      const l = offsets[lineIdx].line;
      if (!l.trim()) break;
      if (/^(#{1,3})\s+/.test(l) || /^[-*]\s+/.test(l)) break;
      paraLines.push({
        contentStart: offsets[lineIdx].start,
        contentEnd: offsets[lineIdx].end,
        lineStart: offsets[lineIdx].start
      });
      lineIdx++;
    }
    if (paraLines.length) result.push({ type: 'paragraph', lines: paraLines });
  }

  return result;
}

function tokensInRange(tokens, start, end) {
  return tokens.filter(t => t.start >= start && t.end <= end && (t.type === 'word' || t.type === 'blank'));
}

function formatMarkdownInline(escaped) {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function suggestionDetail(candidate, tok) {
  const orig = candidate?.originalWord ?? tok.text ?? '';
  const categoryLabel = candidate?.label || candidate?.category || 'word';
  return `${orig} / ${categoryLabel}`;
}

function renderToken(tok, suggestionsByStart, originsByStart) {
  if (tok.type === 'blank') {
    const cat = tok.blankCategory || 'noun';
    const label = tagForCategory(cat);
    const original = originsByStart.get(tok.start) || '';
    const origAttr = original ? ` data-original="${escapeHtml(original)}"` : '';
    return `<button type="button" class="blank-chip" data-start="${tok.start}" data-end="${tok.end}" data-category="${escapeHtml(cat)}" aria-label="Blank: ${escapeHtml(label)}"${origAttr}>{${escapeHtml(label)}}</button>`;
  }
  const candidate = suggestionsByStart.get(tok.start);
  const suggested = Boolean(candidate);
  const cls = suggested ? 'word-tap word-tap--suggested' : 'word-tap';
  if (suggested) {
    const detail = suggestionDetail(candidate, tok);
    const origSafe = escapeHtml(candidate.originalWord ?? tok.text);
    const catSafe = escapeHtml(candidate.label || candidate.category || 'word');
    const detailSafe = escapeHtml(detail);
    return `<button type="button" class="${cls}" data-start="${tok.start}" data-end="${tok.end}" data-token-index="${tok.index}" data-original="${origSafe}" data-category="${catSafe}" data-detail="${detailSafe}" title="Suggested: ${detailSafe}" aria-label="Suggested blank: ${escapeHtml(tok.text)} (${detailSafe})">${escapeHtml(tok.text)}</button>`;
  }
  return `<button type="button" class="${cls}" data-start="${tok.start}" data-end="${tok.end}" data-token-index="${tok.index}">${escapeHtml(tok.text)}</button>`;
}

function renderTokenSliceAbsolute(fullText, start, end, tokens, suggestionsByStart, originsByStart) {
  const localTokens = tokensInRange(tokens, start, end);
  if (!localTokens.length) {
    return formatMarkdownInline(escapeHtml(fullText.slice(start, end)));
  }

  let html = '';
  let pos = start;
  for (const tok of localTokens) {
    if (tok.start > pos) {
      html += formatMarkdownInline(escapeHtml(fullText.slice(pos, tok.start)));
    }
    html += renderToken(tok, suggestionsByStart, originsByStart);
    pos = tok.end;
  }
  if (pos < end) {
    html += formatMarkdownInline(escapeHtml(fullText.slice(pos, end)));
  }
  return html;
}

export function renderEditorHtml(text, tokens, suggestionsByStart, originsByStart = new Map()) {
  const blocks = blocksWithRanges(text);
  if (!text.trim()) {
    return '';
  }

  return blocks.map(block => {
    if (block.type === 'heading') {
      const tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
      const inner = renderTokenSliceAbsolute(
        text, block.contentStart, block.contentEnd, tokens, suggestionsByStart, originsByStart
      );
      return `<${tag} class="editor-block" data-line-start="${block.lineStart}">${inner}</${tag}>`;
    }
    if (block.type === 'list') {
      const items = block.items.map(item => {
        const inner = renderTokenSliceAbsolute(
          text, item.contentStart, item.contentEnd, tokens, suggestionsByStart, originsByStart
        );
        return `<li class="editor-block" data-line-start="${item.lineStart}">${inner}</li>`;
      }).join('');
      return `<ul class="editor-list">${items}</ul>`;
    }
    const lines = block.lines.map(line => {
      const inner = renderTokenSliceAbsolute(
        text, line.contentStart, line.contentEnd, tokens, suggestionsByStart, originsByStart
      );
      return `<span class="editor-para-line" data-line-start="${line.lineStart}">${inner}</span>`;
    }).join('<br>');
    return `<p class="editor-block editor-paragraph">${lines}</p>`;
  }).join('');
}

function selectionOffsets(root) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) return null;
  const startEl = sel.anchorNode?.nodeType === Node.TEXT_NODE
    ? sel.anchorNode.parentElement
    : sel.anchorNode;
  const endEl = sel.focusNode?.nodeType === Node.TEXT_NODE
    ? sel.focusNode.parentElement
    : sel.focusNode;
  const startBtn = startEl?.closest?.('[data-start]');
  const endBtn = endEl?.closest?.('[data-start]');
  if (!startBtn || !endBtn) return null;
  const start = Number(startBtn.dataset.start);
  const end = Number(endBtn.dataset.end);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

export function createBlankEditor(options = {}) {
  let mountEl = null;
  let text = '';
  let suggestionsByStart = new Map();
  let suggestions = [];
  let undoStack = [];
  const originsByStart = new Map();
  let getClassifications = options.getClassifications || (() => ({ tokens: [], classifications: [] }));
  let onChange = options.onChange || (() => {});
  let sheetEl = null;
  let sheetBackdrop = null;

  function pushUndo() {
    undoStack.push(text);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }

  function replaceText(next) {
    text = String(next ?? '');
    render();
    onChange(text);
  }

  function setText(next) {
    text = String(next ?? '');
    suggestionsByStart = new Map();
    suggestions = [];
    originsByStart.clear();
    render();
    onChange(text);
  }

  function getText() {
    return text;
  }

  function updateText(next) {
    pushUndo();
    text = next;
    render();
    onChange(text);
  }

  function render() {
    if (!mountEl) return;
    const tokens = tokenize(text);
    mountEl.innerHTML = renderEditorHtml(text, tokens, suggestionsByStart, originsByStart);
    mountEl.dataset.empty = text.trim() ? 'false' : 'true';
  }

  function closeCategorySheet() {
    sheetEl?.remove();
    sheetBackdrop?.remove();
    sheetEl = null;
    sheetBackdrop = null;
  }

  function openCategorySheet({ start, end, defaultCategory, mode = 'blank', originalWord = '' }) {
    closeCategorySheet();

    sheetBackdrop = document.createElement('div');
    sheetBackdrop.className = 'category-sheet-backdrop';
    sheetBackdrop.addEventListener('click', closeCategorySheet);

    sheetEl = document.createElement('div');
    sheetEl.className = 'category-sheet';
    sheetEl.setAttribute('role', 'dialog');
    sheetEl.setAttribute('aria-label', mode === 'restore' ? 'Blank options' : 'Choose blank category');

    const title = document.createElement('h3');
    title.textContent = mode === 'restore' ? 'Blank options' : 'Choose category';
    sheetEl.appendChild(title);

    if (mode === 'restore' && originalWord) {
      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'category-sheet-item';
      restoreBtn.textContent = `Restore "${originalWord}"`;
      restoreBtn.addEventListener('click', () => {
        originsByStart.delete(start);
        updateText(restoreBlankAtRange(text, start, end, originalWord));
        closeCategorySheet();
      });
      sheetEl.appendChild(restoreBtn);
    }

    if (mode === 'restore') {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'category-sheet-item';
      clearBtn.textContent = 'Remove blank';
      clearBtn.addEventListener('click', () => {
        originsByStart.delete(start);
        updateText(restoreBlankAtRange(text, start, end, ''));
        closeCategorySheet();
      });
      sheetEl.appendChild(clearBtn);
    }

    const grid = document.createElement('div');
    grid.className = 'category-sheet-grid';
    const defaultTag = tagForCategory(defaultCategory);
    for (const tag of EDITOR_BLANK_TAGS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'category-sheet-item' + (defaultTag === tag ? ' active' : '');
      btn.textContent = `{${tag}}`;
      btn.addEventListener('click', () => {
        if (mode === 'blank' && originalWord) originsByStart.set(start, originalWord);
        updateText(applyBlankAtRange(text, start, end, tag));
        closeCategorySheet();
      });
      grid.appendChild(btn);
    }
    sheetEl.appendChild(grid);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-secondary category-sheet-cancel';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', closeCategorySheet);
    sheetEl.appendChild(cancel);

    document.body.append(sheetBackdrop, sheetEl);
    sheetEl.querySelector('.category-sheet-item')?.focus();
  }

  function blankWord(start, end, category, originalWord) {
    originsByStart.set(start, originalWord);
    updateText(applyBlankAtRange(text, start, end, category));
  }

  function handleWordTap(start, end, tokenIndex) {
    const originalWord = text.slice(start, end);
    if (suggestionsByStart.has(start)) {
      const candidate = suggestionsByStart.get(start);
      blankWord(start, end, tagForCategory(candidate?.category || 'noun'), originalWord);
      suggestionsByStart.delete(start);
      suggestions = suggestions.filter(s => s.token?.start !== start);
      return;
    }
    const { tokens, classifications } = getClassifications(text);
    const tok = tokens.find(t => t.start === start);
    const cls = classifications[tok?.index];
    const prevWord = tokens.filter(t => t.type === 'word' && t.end <= start).pop()?.norm || '';
    const category = cls ? pickCategory(cls.categories, tok, prevWord, cls) : 'noun';
    openCategorySheet({ start, end, defaultCategory: category, originalWord });
  }

  function handleBlankTap(start, end, originalWord) {
    openCategorySheet({
      start,
      end,
      defaultCategory: 'noun',
      mode: 'restore',
      originalWord
    });
  }

  function onMountClick(e) {
    const word = e.target.closest('.word-tap');
    if (word) {
      e.preventDefault();
      handleWordTap(Number(word.dataset.start), Number(word.dataset.end), Number(word.dataset.tokenIndex));
      return;
    }
    const chip = e.target.closest('.blank-chip');
    if (chip) {
      e.preventDefault();
      handleBlankTap(
        Number(chip.dataset.start),
        Number(chip.dataset.end),
        chip.dataset.original || ''
      );
    }
  }

  function showSuggestions(candidates) {
    suggestions = (candidates || []).filter(c => c.token && Number.isInteger(c.token.start));
    suggestionsByStart = new Map(suggestions.map(s => [s.token.start, s]));
    render();
  }

  function clearSuggestions() {
    suggestions = [];
    suggestionsByStart = new Map();
    render();
  }

  function applyAllSuggestions() {
    if (!suggestions.length) return 0;
    const withTokens = suggestions
      .filter(s => s.token && Number.isInteger(s.token.start))
      .map(s => {
        if (s.token.type === 'word') originsByStart.set(s.token.start, s.token.text);
        return s;
      });
    updateText(applyBlankCandidates(text, withTokens));
    clearSuggestions();
    return withTokens.length;
  }

  function undo() {
    const prev = undoStack.pop();
    if (prev == null) return false;
    text = prev;
    render();
    onChange(text);
    return true;
  }

  function applyFormat(format, selectionStart, selectionEnd) {
    const start = selectionStart;
    const end = selectionEnd;
    if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
    const blockFormat = format === 'h1' || format === 'h2' || format === 'h3' || format === 'list' || format === 'paragraph';
    if (start === end && !blockFormat) return false;
    let next = text;
    if (format === 'bold') next = toggleBold(text, start, end);
    else if (format === 'italic') next = toggleItalic(text, start, end);
    else if (blockFormat) next = setBlockType(text, start, format);
    if (next !== text) {
      updateText(next);
      return true;
    }
    return false;
  }

  /** @deprecated use applyFormat with explicit selection from source textarea */
  function applyFormatFromRender(format) {
    const sel = selectionOffsets(mountEl);
    if (!sel) return false;
    return applyFormat(format, sel.start, sel.end);
  }

  function insertBlankAtCursor(offset) {
    const pos = Number.isInteger(offset) ? offset : text.length;
    updateText(insertBlankTag(text, pos, 'noun'));
  }

  function pasteText(raw) {
    if (!raw?.trim()) return;
    pushUndo();
    text = raw.replace(/\r\n/g, '\n').trim();
    clearSuggestions();
    originsByStart.clear();
    render();
    onChange(text);
  }

  function mount(selector) {
    mountEl = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!mountEl) return;
    mountEl.classList.add('create-blank-editor');
    mountEl.addEventListener('click', onMountClick);
    render();
  }

  function destroy() {
    closeCategorySheet();
    mountEl?.removeEventListener('click', onMountClick);
    mountEl = null;
  }

  return {
    mount,
    destroy,
    getText,
    setText,
    replaceText,
    showSuggestions,
    clearSuggestions,
    applyAllSuggestions,
    applyFormat,
    applyFormatFromRender,
    insertBlankAtCursor,
    insertBlankTagAtCursor(tagLabel, offset) {
      const pos = Number.isInteger(offset) ? offset : text.length;
      updateText(insertBlankTag(text, pos, tagLabel));
    },
    pasteText,
    undo,
    render
  };
}
