import { $, $$, setStatus, switchTab as activateTab, countWords } from './dom.js';
import { appState } from './state.js';
import { SAMPLES } from '../data/samples.js';
import {
  startFromCreateDraft, startFromGutenberg, startFromPoem, startFromSample, startFromMadLib,
  revealStory, copyFinalStory, downloadFinalStory, fillRandomPrompts,
  rerollWords, rerollSection, resetGame
} from './game.js';
import {
  fetchGutendexResults, fetchRandomReadableBook, fetchPoem, poemToText,
  gutenbergBlockedOnFileProtocol
} from './fetch.js';
import {
  listBundledMadLibCatalog, getMadLibMeta, getRandomBundledMadLibTitle,
  COLLECTIONS, COLLECTION_LABELS, FORMAT_ORDER, TAG_ORDER, TAG_LABELS, FORMAT_LABELS
} from './madlibs.js';
import { loadNlpEngine, awaitWinkEngine } from './nlp-engine.js';
import { computeAutoSwapCandidates } from './auto-swap-candidates.js';
import { createBlankEditor } from './create-blank-editor.js';
import { classifyTokensHeuristic, classifyTokensWithNlp } from './classify.js';
import { tokenize } from './text.js';
import { normalizeTemplateSyntax } from './madlibs.js';
import { hasPlaceholders } from './placeholders.js';
import { firstHeadingTitle } from './template-model.js';
import {
  EDITOR_BLANK_TAGS,
  customTemplateKey,
  deleteCustomTemplate,
  loadCustomTemplates,
  parseCustomTemplatePack,
  saveCustomTemplates,
  serializeCustomTemplatePack,
  unsupportedPlaceholderTags,
  upsertCustomTemplate,
  validBlankCount,
  validateCustomTemplate
} from './custom-templates.js';

function renderGutenbergResults(results) {
  const list = $('#gutenberg-results');
  list.innerHTML = '';
  appState.gutenbergResults = results;
  if (!results.length) {
    list.classList.add('hidden');
    setStatus('No books found. Try different search terms.', 'error');
    return;
  }
  results.forEach((book, i) => {
    const li = document.createElement('li');
    li.dataset.index = String(i);
    li.appendChild(document.createTextNode(book.title || ''));
    const authors = (book.authors || []).map(a => a.name).join(', ');
    if (authors) {
      const small = document.createElement('small');
      small.textContent = authors;
      li.appendChild(small);
    }
    li.addEventListener('click', () => {
      list.querySelectorAll('li').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
      appState.selectedBook = book;
      updateGutenbergSelection();
    });
    list.appendChild(li);
  });
  list.classList.remove('hidden');
}

const SETTINGS_KEY = 'storySwapper:settings';
const LENGTH_SELECTS = ['#editor-length', '#gutenberg-length', '#sample-length', '#poem-length'];
const AUTO_SWAP_TABS = new Set(['create', 'gutenberg', 'poem', 'sample']);

/** Active Mad Lib collection + tag filter chips. */
const madlibActiveCollections = new Set();
const madlibActiveTags = new Set();
let madlibFilterTimer = null;
const editorActiveTags = new Set(['everyday']);
let currentCustomTemplateId = '';
let createEditor = null;
let editorDirty = false;
let lastSavedSnapshot = '';

function getMadLibBrowseFilter() {
  return {
    search: $('#madlibs-filter')?.value || '',
    collections: [...madlibActiveCollections],
    tags: [...madlibActiveTags]
  };
}

function renderMadLibCollectionChips() {
  const container = $('#madlibs-collection-chips');
  if (!container) return;
  container.innerHTML = '';
  for (const collection of COLLECTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-chip collection-chip' + (madlibActiveCollections.has(collection) ? ' active' : '');
    btn.textContent = COLLECTION_LABELS[collection] || collection;
    btn.dataset.collection = collection;
    btn.setAttribute('aria-pressed', madlibActiveCollections.has(collection) ? 'true' : 'false');
    btn.addEventListener('click', () => {
      if (madlibActiveCollections.has(collection)) madlibActiveCollections.delete(collection);
      else madlibActiveCollections.add(collection);
      renderMadLibCollectionChips();
      renderMadLibSelect(getMadLibBrowseFilter(), $('#madlibs-select')?.value);
    });
    container.appendChild(btn);
  }
}

function renderMadLibTagChips() {
  const container = $('#madlibs-tag-chips');
  if (!container) return;
  container.innerHTML = '';
  for (const tag of TAG_ORDER) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-chip' + (madlibActiveTags.has(tag) ? ' active' : '');
    btn.textContent = TAG_LABELS[tag] || tag;
    btn.dataset.tag = tag;
    btn.setAttribute('aria-pressed', madlibActiveTags.has(tag) ? 'true' : 'false');
    btn.addEventListener('click', () => {
      if (madlibActiveTags.has(tag)) madlibActiveTags.delete(tag);
      else madlibActiveTags.add(tag);
      renderMadLibTagChips();
      renderMadLibSelect(getMadLibBrowseFilter(), $('#madlibs-select')?.value);
    });
    container.appendChild(btn);
  }
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch (_) {
    return {};
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      tab: appState.sourceType,
      length: $('#editor-length')?.value,
      promptCount: $('#prompt-count')?.value,
      showOriginals: $('#toggle-originals')?.checked || false,
      madlibsTitle: $('#madlibs-select')?.value || ''
    }));
  } catch (_) { /* ignore quota / privacy mode */ }
}

function updateSourceSpecificUI() {
  const tab = appState.sourceType;
  const autoSwap = AUTO_SWAP_TABS.has(tab);
  $('#auto-swap-settings')?.classList.toggle('hidden', !autoSwap);
}

function updateMadLibMeta() {
  const el = $('#madlibs-meta');
  const title = $('#madlibs-select')?.value;
  if (!el || !title) {
    if (el) el.textContent = '';
    return;
  }
  const meta = getMadLibMeta(title);
  const words = meta.wordCount ? `~${meta.wordCount} words` : '';
  const collectionLabel = COLLECTION_LABELS[meta.collection] || meta.collection;
  const formatLabel = FORMAT_LABELS[meta.format] || meta.format;
  const tagText = meta.tags?.length
    ? meta.tags.map(t => TAG_LABELS[t] || t).join(', ')
    : '';
  const parts = [
    collectionLabel,
    formatLabel,
    `${meta.blankCount} blanks`,
    words,
    tagText
  ].filter(Boolean);
  el.textContent = parts.join(' · ');
}

function updateGutenbergSelection() {
  const el = $('#gutenberg-selected');
  if (!el) return;
  const book = appState.selectedBook;
  if (!book) {
    el.textContent = '';
    return;
  }
  const authors = (book.authors || []).map(a => a.name).join(', ');
  el.textContent = `Selected: ${book.title}${authors ? ` by ${authors}` : ''}`;
}

function updatePoemSelection() {
  const el = $('#poem-selected');
  if (!el) return;
  if (!appState.selectedPoem) {
    el.textContent = '';
    return;
  }
  el.textContent = `Selected: ${appState.selectedPoem.title}`;
}

function getEditorText() {
  const ta = $('#editor-source');
  if (ta) return ta.value;
  return createEditor?.getText() || '';
}

function syncEditorFromSource() {
  const ta = $('#editor-source');
  if (ta && createEditor) createEditor.replaceText(ta.value);
}

function syncEditorSource(text) {
  const ta = $('#editor-source');
  if (ta && ta.value !== text) ta.value = text;
}

function updateEditorRenderVisibility(text) {
  const hasText = Boolean(String(text || '').trim());
  $('#editor-render')?.classList.toggle('hidden', !hasText);
  $('#editor-tap-hint')?.classList.toggle('hidden', !hasText);
}

function getEditorSourceSelection() {
  const ta = $('#editor-source');
  if (!ta) return null;
  const start = ta.selectionStart ?? 0;
  const end = ta.selectionEnd ?? 0;
  return { start, end, cursor: start };
}

function taSetSelection(start, end) {
  const ta = $('#editor-source');
  if (!ta) return;
  ta.focus();
  ta.setSelectionRange(start, end);
}

function setEditorText(text) {
  createEditor?.setText(text || '');
  syncEditorSource(text || '');
  updateEditorRenderVisibility(text || '');
  markEditorSavedSnapshot();
}

function markEditorSavedSnapshot() {
  lastSavedSnapshot = JSON.stringify(editorDraftInput());
  editorDirty = false;
  updateCreateTabDirtyIndicator();
}

function updateCreateTabDirtyIndicator() {
  const tab = $('#tab-create');
  if (!tab) return;
  const dirty = editorDirty && appState.sourceType === 'create';
  tab.dataset.unsaved = dirty ? 'true' : 'false';
  tab.setAttribute('aria-label', dirty ? 'Create (unsaved draft)' : 'Create');
}

function editorClassifications(text) {
  const tokens = tokenize(text);
  const classifications = appState.nlpEngine && appState.nlpEngine.name !== 'heuristic'
    ? classifyTokensWithNlp(tokens, appState.nlpEngine)
    : classifyTokensHeuristic(tokens);
  return { tokens, classifications };
}

function editorDraftInput() {
  return {
    id: currentCustomTemplateId,
    title: $('#editor-title')?.value || '',
    text: getEditorText(),
    format: $('#editor-format')?.value || 'story',
    tags: [...editorActiveTags]
  };
}

function setEditorTags(tags) {
  editorActiveTags.clear();
  const valid = (Array.isArray(tags) ? tags : []).filter(t => TAG_ORDER.includes(t)).slice(0, 3);
  for (const tag of valid.length ? valid : ['everyday']) editorActiveTags.add(tag);
}

function renderEditorFormatOptions() {
  const select = $('#editor-format');
  if (!select) return;
  select.innerHTML = '';
  for (const format of FORMAT_ORDER) {
    const opt = document.createElement('option');
    opt.value = format;
    opt.textContent = FORMAT_LABELS[format] || format;
    select.appendChild(opt);
  }
}

function renderEditorTagChips() {
  const container = $('#editor-tag-chips');
  if (!container) return;
  container.innerHTML = '';
  for (const tag of TAG_ORDER) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-chip' + (editorActiveTags.has(tag) ? ' active' : '');
    btn.textContent = TAG_LABELS[tag] || tag;
    btn.setAttribute('aria-pressed', editorActiveTags.has(tag) ? 'true' : 'false');
    btn.addEventListener('click', () => {
      if (editorActiveTags.has(tag)) {
        editorActiveTags.delete(tag);
      } else if (editorActiveTags.size < 3) {
        editorActiveTags.add(tag);
      } else {
        setStatus('Choose up to 3 tags.', 'error');
      }
      renderEditorTagChips();
      updateEditorStatsAndPreview();
    });
    container.appendChild(btn);
  }
}

function updateEditorStatsAndPreview() {
  const text = getEditorText();
  const title = $('#editor-title')?.value || '';
  const stats = $('#editor-stats');
  const validationEl = $('#editor-validation');
  const blanks = validBlankCount(text);
  const words = countWords(text);
  const unsupported = unsupportedPlaceholderTags(text);

  if (!title.trim()) {
    const headingTitle = firstHeadingTitle(text);
    if (headingTitle) $('#editor-title').value = headingTitle;
  }

  $('#editor-length-field')?.classList.toggle('hidden', blanks > 0);

  if (stats) {
    const mode = blanks ? 'template mode' : 'plain text auto-swap mode';
    stats.textContent = `${words} words · ${blanks} blanks · ${mode}${editorDirty ? ' · unsaved' : ''}`;
  }
  if (validationEl) {
    const validation = validateCustomTemplate(
      { title: $('#editor-title')?.value || title, text, format: $('#editor-format')?.value, tags: [...editorActiveTags] },
      loadCustomTemplates(),
      currentCustomTemplateId
    );
    validationEl.className = 'editor-validation';
    if (!text.trim()) {
      validationEl.textContent = 'Paste plain text to play, or add {noun}-style blanks to save a template.';
    } else if (unsupported.length) {
      validationEl.classList.add('error');
      validationEl.textContent = `Unsupported blank tags: ${unsupported.join(', ')}.`;
    } else if (validation.errors.length) {
      validationEl.classList.add('warn');
      validationEl.textContent = validation.errors.join(' ');
    } else if (validation.warnings.length) {
      validationEl.classList.add('warn');
      validationEl.textContent = validation.warnings.join(' ');
    } else {
      validationEl.textContent = 'Ready to save or play.';
    }
  }

  const snapshot = JSON.stringify(editorDraftInput());
  editorDirty = snapshot !== lastSavedSnapshot;
  updateCreateTabDirtyIndicator();
}

function onEditorChange(text) {
  syncEditorSource(text);
  updateEditorRenderVisibility(text);
  updateEditorStatsAndPreview();
}

function focusEditorSource() {
  const ta = $('#editor-source');
  if (!ta) return;
  ta.focus();
  const end = ta.value.length;
  ta.setSelectionRange(end, end);
}

function renderCustomTemplateSelect(preferredId = '') {
  const select = $('#custom-template-select');
  if (!select) return;
  const templates = loadCustomTemplates().sort((a, b) => a.title.localeCompare(b.title));
  select.innerHTML = '';
  if (!templates.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No saved templates';
    select.appendChild(opt);
  } else {
    for (const template of templates) {
      const opt = document.createElement('option');
      opt.value = template.id;
      opt.textContent = template.title;
      select.appendChild(opt);
    }
    if (preferredId && templates.some(t => t.id === preferredId)) {
      select.value = preferredId;
    }
  }
  const hasSelection = Boolean(select.value);
  $('#btn-editor-load').disabled = !hasSelection;
  $('#btn-editor-delete').disabled = !hasSelection;
  $('#btn-editor-export').disabled = !hasSelection;
  $('#btn-editor-export-all').disabled = !templates.length;
}

function loadCustomTemplateIntoEditor(template) {
  if (!template) return;
  currentCustomTemplateId = template.id;
  $('#editor-title').value = template.title || '';
  setEditorText(template.text || '');
  $('#editor-format').value = template.format || 'story';
  setEditorTags(template.tags);
  renderEditorTagChips();
  renderCustomTemplateSelect(template.id);
  setStatus(`Loaded "${template.title}".`, 'success');
}

function loadSelectedCustomTemplate() {
  const id = $('#custom-template-select')?.value;
  const template = loadCustomTemplates().find(t => t.id === id);
  if (!template) {
    setStatus('Pick a saved template first.', 'error');
    return;
  }
  loadCustomTemplateIntoEditor(template);
}

function refreshTemplateBrowsers(preferredKey = '') {
  renderCustomTemplateSelect(currentCustomTemplateId);
  renderMadLibSelect(getMadLibBrowseFilter(), preferredKey || $('#madlibs-select')?.value);
  updateEditorStatsAndPreview();
}

function saveEditorTemplate(copy = false) {
  const draft = editorDraftInput();
  if (copy) {
    draft.id = '';
    draft.title = draft.title ? `${draft.title} Copy` : 'Untitled Template Copy';
  }
  const validation = validateCustomTemplate(draft, loadCustomTemplates(), copy ? '' : currentCustomTemplateId);
  if (validation.errors.length) {
    updateEditorStatsAndPreview();
    setStatus(validation.errors.join(' '), 'error');
    return;
  }
  try {
    const saved = upsertCustomTemplate(draft);
    currentCustomTemplateId = saved.id;
    $('#editor-title').value = saved.title;
    markEditorSavedSnapshot();
    refreshTemplateBrowsers(customTemplateKey(saved.id));
    setStatus(`Saved "${saved.title}" to this browser.`, 'success');
  } catch (err) {
    setStatus(err.message || 'Could not save this template.', 'error');
  }
}

function deleteSelectedCustomTemplate() {
  const id = $('#custom-template-select')?.value || currentCustomTemplateId;
  if (!id) {
    setStatus('Pick a saved template first.', 'error');
    return;
  }
  const template = loadCustomTemplates().find(t => t.id === id);
  if (!template) {
    setStatus('That saved template is no longer available.', 'error');
    refreshTemplateBrowsers();
    return;
  }
  if (!confirm(`Delete "${template.title}" from this browser?`)) return;
  try {
    deleteCustomTemplate(id);
    if (currentCustomTemplateId === id) currentCustomTemplateId = '';
    refreshTemplateBrowsers();
    setStatus(`Deleted "${template.title}".`, 'success');
  } catch (err) {
    setStatus(err.message || 'Could not delete this template.', 'error');
  }
}

function slugifyName(name) {
  return (name || 'story-swapper-templates')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'story-swapper-templates';
}

function downloadJson(filename, json) {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSelectedCustomTemplate() {
  const id = $('#custom-template-select')?.value || currentCustomTemplateId;
  const template = loadCustomTemplates().find(t => t.id === id);
  if (!template) {
    setStatus('Pick a saved template first.', 'error');
    return;
  }
  downloadJson(`${slugifyName(template.title)}.json`, serializeCustomTemplatePack([template]));
  setStatus(`Exported "${template.title}".`, 'success');
}

function exportAllCustomTemplates() {
  const templates = loadCustomTemplates();
  if (!templates.length) {
    setStatus('No saved templates to export.', 'error');
    return;
  }
  downloadJson('story-swapper-custom-templates.json', serializeCustomTemplatePack(templates));
  setStatus(`Exported ${templates.length} templates.`, 'success');
}

async function importCustomTemplateFile(file) {
  if (!file) return;
  try {
    const raw = await file.text();
    const existing = loadCustomTemplates();
    const result = parseCustomTemplatePack(raw, existing);
    if (!result.templates.length) {
      setStatus(result.errors.join(' ') || 'No valid templates found.', 'error');
      return;
    }
    saveCustomTemplates([...existing, ...result.templates]);
    currentCustomTemplateId = result.templates[result.templates.length - 1].id;
    loadCustomTemplateIntoEditor(result.templates[result.templates.length - 1]);
    refreshTemplateBrowsers(customTemplateKey(currentCustomTemplateId));
    const skipped = result.errors.length ? ` ${result.errors.length} skipped.` : '';
    setStatus(`Imported ${result.templates.length} templates.${skipped}`, result.errors.length ? 'info' : 'success');
  } catch (err) {
    setStatus(err.message || 'Could not import templates.', 'error');
  }
}

function showSuggestBar(count, promptSetting) {
  const bar = $('#editor-suggest-bar');
  const label = $('#editor-suggest-label');
  if (!bar || !label) return;
  if (!count) {
    bar.classList.add('hidden');
    return;
  }
  label.textContent = `${count} suggested swaps (${promptSetting === 'auto' ? 'auto density' : promptSetting + ' prompts'}) — tap highlighted words or Apply all`;
  bar.classList.remove('hidden');
}

async function suggestEditorBlanks() {
  syncEditorFromSource();
  const text = getEditorText();
  if (!text.trim()) {
    setStatus('Write or paste text before asking for suggestions.', 'error');
    return;
  }
  setStatus('Finding good blank candidates...', 'info');
  try {
    const forceTemplateMode = hasPlaceholders(normalizeTemplateSyntax(text));
    const revealLength = parseInt($('#editor-length')?.value || '250', 10);
    const promptSetting = forceTemplateMode ? 'auto' : ($('#prompt-count')?.value || 'auto');

    const result = await computeAutoSwapCandidates(text, {
      nlpEngine: appState.nlpEngine,
      forceTemplateMode,
      revealLength,
      promptSetting,
      collectionMode: 'auto',
      useFullText: true,
      minWordsProse: 20
    });

    if (result.error) {
      createEditor?.clearSuggestions();
      showSuggestBar(0);
      setStatus(result.error, 'error');
      return;
    }

    const autoCandidates = result.candidates
      .filter(c => !c.isPlaceholder)
      .map(c => ({ ...c, token: result.tokens[c.tokenIndex] }))
      .filter(c => c.token && Number.isInteger(c.token.start));

    createEditor?.showSuggestions(autoCandidates);
    updateEditorRenderVisibility(text);
    showSuggestBar(autoCandidates.length, promptSetting);
    setStatus(
      autoCandidates.length
        ? `Highlighted ${autoCandidates.length} swap candidates — tap words below or Apply all.`
        : 'No auto-swap candidates — template blanks only.',
      autoCandidates.length ? 'success' : 'info'
    );
  } catch (err) {
    createEditor?.clearSuggestions();
    showSuggestBar(0);
    setStatus(err.message || 'Could not suggest blanks for this text.', 'error');
  }
}

function applyAllSuggestions() {
  const count = createEditor?.applyAllSuggestions() || 0;
  syncEditorSource(createEditor?.getText() || '');
  showSuggestBar(0);
  updateEditorStatsAndPreview();
  setStatus(count ? `Applied ${count} suggested blanks.` : 'No suggestions to apply.', count ? 'success' : 'error');
}

function openMoreBlanksSheet() {
  const backdrop = document.createElement('div');
  backdrop.className = 'category-sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'category-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Insert blank');

  const title = document.createElement('h3');
  title.textContent = 'Insert blank';
  sheet.appendChild(title);

  const quick = document.createElement('div');
  quick.className = 'category-sheet-grid';
  for (const tag of EDITOR_BLANK_TAGS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-sheet-item';
    btn.textContent = `{${tag}}`;
    btn.addEventListener('click', () => {
      const sel = getEditorSourceSelection();
      createEditor?.insertBlankTagAtCursor(tag, sel?.cursor);
      syncEditorSource(createEditor.getText());
      updateEditorStatsAndPreview();
      close();
    });
    quick.appendChild(btn);
  }
  sheet.appendChild(quick);

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn-secondary category-sheet-cancel';
  cancel.textContent = 'Cancel';
  function close() {
    backdrop.remove();
    sheet.remove();
  }
  cancel.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  sheet.appendChild(cancel);
  document.body.append(backdrop, sheet);
}

function focusEditorForPaste() {
  focusEditorSource();
  setStatus('Paste or type in the template text box.', 'info');
}

function initCreateEditor() {
  createEditor = createBlankEditor({
    getClassifications: editorClassifications,
    onChange: onEditorChange
  });
  createEditor.mount('#editor-render');

  const ta = $('#editor-source');
  ta?.addEventListener('input', () => {
    createEditor?.replaceText(ta.value);
  });
  ta?.addEventListener('paste', () => {
    requestAnimationFrame(() => createEditor?.replaceText(ta.value));
  });

  updateEditorRenderVisibility('');
  markEditorSavedSnapshot();
}

function renderMadLibSelect(filter = {}, preferredTitle = '') {
  const select = $('#madlibs-select');
  if (!select) return;
  const browseFilter = typeof filter === 'string'
    ? { search: filter, collections: [...madlibActiveCollections], tags: [...madlibActiveTags] }
    : {
      search: filter.search ?? '',
      collections: filter.collections ?? [...madlibActiveCollections],
      tags: filter.tags ?? [...madlibActiveTags]
    };
  const catalog = listBundledMadLibCatalog(browseFilter);
  const hasFilter = browseFilter.search.trim() || browseFilter.tags.length || browseFilter.collections.length;
  select.innerHTML = '';
  let firstVisible = '';
  for (const group of catalog) {
    if (!group.items.length) continue;
    const og = document.createElement('optgroup');
    og.label = group.label;
    for (const item of group.items) {
      const opt = document.createElement('option');
      opt.value = item.key || item.title;
      opt.textContent = item.title;
      og.appendChild(opt);
      if (!firstVisible) firstVisible = opt.value;
    }
    select.appendChild(og);
  }
  if (!select.options.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = hasFilter ? 'No templates match' : 'No templates available';
    select.appendChild(opt);
  } else {
    const pick = preferredTitle && [...select.options].some(o => o.value === preferredTitle)
      ? preferredTitle
      : firstVisible;
    select.value = pick;
  }
  updateMadLibMeta();
}

function applySettings(settings) {
  if (settings.length) {
    LENGTH_SELECTS.forEach(sel => {
      const el = $(sel);
      if (el && [...el.options].some(o => o.value === settings.length)) el.value = settings.length;
    });
  }
  if (settings.promptCount && $('#prompt-count')) $('#prompt-count').value = settings.promptCount;
  const savedTab = settings.tab === 'paste' ? 'create' : settings.tab;
  switchTab(savedTab || 'madlibs');
  renderMadLibSelect({}, settings.madlibsTitle || '');
}

function switchTab(tabName) {
  activateTab(tabName);
  appState.sourceType = tabName;
  updateSourceSpecificUI();
  saveSettings();
}

async function pickRandomPoem() {
  setStatus('Finding a random poem…', 'info');
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const poems = await fetchPoem('', '');
      const poem = Array.isArray(poems) ? poems[0] : poems;
      const data = poemToText(poem);
      if (data.text.split(/\s+/).length >= 40) {
        appState.selectedPoem = data;
        updatePoemSelection();
        setStatus(`Selected: ${data.title}`, 'success');
        return;
      }
    }
    throw new Error('short');
  } catch (_) {
    setStatus('Random poem failed. Try search or Examples.', 'error');
  }
}

async function searchPoem() {
  setStatus('Searching poems…', 'info');
  try {
    const author = $('#poem-author').value.trim();
    const title = $('#poem-title').value.trim();
    if (!author && !title) {
      setStatus('Enter an author or title, or use Random.', 'error');
      return;
    }
    const poems = await fetchPoem(author, title);
    const poem = Array.isArray(poems) ? poems[Math.floor(Math.random() * poems.length)] : poems;
    appState.selectedPoem = poemToText(poem);
    updatePoemSelection();
    setStatus(`Selected: ${appState.selectedPoem.title}`, 'success');
  } catch (_) {
    setStatus('No poem found. Try different search terms.', 'error');
  }
}

function initApp() {
  const sampleSelect = $('#sample-select');
  if (!sampleSelect) {
    console.error('Story Swapper: #sample-select not found — UI failed to initialize.');
    return;
  }
  sampleSelect.innerHTML = '';
  if (!SAMPLES.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No examples available';
    sampleSelect.appendChild(opt);
    setStatus('Example stories failed to load. Try npm run dev or rebuild the app.', 'error');
  } else {
    SAMPLES.forEach((s, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = s.title;
      sampleSelect.appendChild(opt);
    });
  }

  renderMadLibCollectionChips();
  renderMadLibTagChips();
  renderMadLibSelect();
  renderEditorFormatOptions();
  renderEditorTagChips();
  initCreateEditor();
  renderCustomTemplateSelect();
  updateEditorStatsAndPreview();

  document.querySelectorAll('.create-format-toolbar .fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.format;
      if (format === 'paste') {
        focusEditorForPaste();
        return;
      }
      if (format === 'undo') {
        if (createEditor?.undo()) {
          syncEditorSource(createEditor.getText());
          updateEditorStatsAndPreview();
        }
        return;
      }
      const sel = getEditorSourceSelection();
      if (!sel) return;
      const applied = createEditor?.applyFormat(format, sel.start, sel.end)
        || (sel.start === sel.end && createEditor?.applyFormat(format, sel.cursor, sel.cursor));
      if (applied) {
        syncEditorSource(createEditor.getText());
        taSetSelection(sel.start, sel.end);
        updateEditorStatsAndPreview();
      }
    });
  });
  $('#btn-editor-more-blanks')?.addEventListener('click', openMoreBlanksSheet);
  $('#btn-editor-apply-suggest')?.addEventListener('click', applyAllSuggestions);
  $('#btn-editor-clear-suggest')?.addEventListener('click', () => {
    createEditor?.clearSuggestions();
    showSuggestBar(0);
  });

  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  $('#btn-editor-play').addEventListener('click', () => startFromCreateDraft(getEditorText()));
  $('#btn-editor-save').addEventListener('click', () => saveEditorTemplate(false));
  $('#btn-editor-save-copy').addEventListener('click', () => saveEditorTemplate(true));
  $('#btn-editor-suggest').addEventListener('click', suggestEditorBlanks);
  $('#btn-editor-load').addEventListener('click', loadSelectedCustomTemplate);
  $('#btn-editor-delete').addEventListener('click', deleteSelectedCustomTemplate);
  $('#btn-editor-export').addEventListener('click', exportSelectedCustomTemplate);
  $('#btn-editor-export-all').addEventListener('click', exportAllCustomTemplates);
  $('#btn-editor-import').addEventListener('click', () => $('#custom-import-file')?.click());
  $('#custom-template-select')?.addEventListener('change', () => {
    renderCustomTemplateSelect($('#custom-template-select')?.value || '');
  });
  $('#custom-import-file')?.addEventListener('change', async e => {
    await importCustomTemplateFile(e.target.files?.[0]);
    e.target.value = '';
  });
  $('#editor-title')?.addEventListener('input', updateEditorStatsAndPreview);
  $('#editor-format')?.addEventListener('change', updateEditorStatsAndPreview);

  $('#btn-gutenberg-search').addEventListener('click', async () => {
    setStatus('Searching…', 'info');
    try {
      const results = await fetchGutendexResults(
        $('#gutenberg-search').value.trim(),
        $('#gutenberg-category').value
      );
      renderGutenbergResults(results);
      setStatus(`Found ${results.length} books.`, 'success');
    } catch (_) {
      setStatus('Could not search public domain books. Try Examples or Create.', 'error');
    }
  });

  $('#btn-gutenberg-random').addEventListener('click', async () => {
    setStatus('Finding a random book…', 'info');
    try {
      const cat = $('#gutenberg-category').value;
      const book = await fetchRandomReadableBook(cat);
      appState.selectedBook = book;
      renderGutenbergResults([book]);
      const list = $('#gutenberg-results');
      list.querySelector('li')?.classList.add('selected');
      updateGutenbergSelection();
      setStatus(`Selected: ${book.title}`, 'success');
    } catch (_) {
      setStatus('Random book failed. Try Examples or Create.', 'error');
    }
  });

  $('#btn-gutenberg-load').addEventListener('click', () => startFromGutenberg(appState.selectedBook));

  $('#btn-poem-random').addEventListener('click', pickRandomPoem);
  $('#btn-poem-search').addEventListener('click', searchPoem);
  $('#btn-poem-load').addEventListener('click', () => startFromPoem(appState.selectedPoem));

  $('#btn-sample-load').addEventListener('click', startFromSample);

  $('#btn-madlibs-random').addEventListener('click', () => {
    const filter = getMadLibBrowseFilter();
    const title = getRandomBundledMadLibTitle($('#madlibs-select')?.value, filter);
    if (!title) {
      setStatus('No templates match your filters.', 'error');
      renderMadLibSelect(filter, '');
      return;
    }
    renderMadLibSelect(filter, title);
    const selected = $('#madlibs-select')?.selectedOptions?.[0]?.textContent || title;
    setStatus(`Selected: ${selected}`, 'success');
  });
  $('#btn-madlibs-load').addEventListener('click', () => startFromMadLib());
  $('#madlibs-select')?.addEventListener('change', () => {
    updateMadLibMeta();
    saveSettings();
  });
  $('#madlibs-filter')?.addEventListener('input', () => {
    clearTimeout(madlibFilterTimer);
    madlibFilterTimer = setTimeout(() => {
      renderMadLibSelect(getMadLibBrowseFilter(), $('#madlibs-select')?.value);
    }, 200);
  });

  $('#prompt-form').addEventListener('submit', e => { e.preventDefault(); revealStory(); });
  $('#btn-sticky-reveal').addEventListener('click', revealStory);
  $('#btn-surprise').addEventListener('click', fillRandomPrompts);

  $('#btn-copy').addEventListener('click', copyFinalStory);
  $('#btn-download').addEventListener('click', downloadFinalStory);
  $('#btn-play-again').addEventListener('click', rerollWords);
  $('#btn-reroll-words').addEventListener('click', rerollWords);
  $('#btn-reroll-section').addEventListener('click', rerollSection);
  $('#btn-new-source').addEventListener('click', resetGame);

  const peek = $('#toggle-originals');
  peek.addEventListener('change', () => {
    $('#story-output').classList.toggle('show-originals', peek.checked);
    saveSettings();
  });

  const settings = loadSettings();
  applySettings(settings);
  if (settings.showOriginals) peek.checked = true;
  updateSourceSpecificUI();

  if (gutenbergBlockedOnFileProtocol()) {
    $('#file-protocol-notice')?.classList.remove('hidden');
  }
  $('#prompt-count').addEventListener('change', saveSettings);
  LENGTH_SELECTS.forEach(sel => {
    $(sel)?.addEventListener('change', e => {
      LENGTH_SELECTS.forEach(other => {
        const el = $(other);
        if (el && el !== e.target && [...el.options].some(o => o.value === e.target.value)) {
          el.value = e.target.value;
        }
      });
      saveSettings();
    });
  });

  function setNlpStatus(engine) {
    const el = $('#nlp-status');
    if (!el) return;
    if (engine.name === 'compromise+wink') {
      el.textContent = 'Smart word detection ready (compromise + winkNLP)';
    } else if (engine.name === 'compromise') {
      el.textContent = 'Smart word detection ready (compromise)';
    } else {
      el.textContent = 'Using built-in word guesser (works offline)';
    }
  }

  loadNlpEngine().then(async engine => {
    appState.nlpEngine = engine;
    setNlpStatus(engine);
    await awaitWinkEngine(engine);
    setNlpStatus(engine);
  }).catch(() => {
    appState.nlpEngine = { name: 'heuristic', nlp: null };
    $('#nlp-status').textContent = 'Using built-in word guesser (works offline)';
  });
}
export { renderGutenbergResults, switchTab, initApp, renderMadLibSelect };
