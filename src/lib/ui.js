import { $, $$, setStatus, showPhase, switchTab as activateTab, countWords } from './dom.js';
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
import { renderMadLibMarkdown } from './story-markdown.js';
import { tokenize } from './text.js';
import { classifyTokensHeuristic, classifyTokensWithNlp, selectReplacementCandidates } from './classify.js';
import { lookupPosForPool } from './dictionary.js';
import {
  EDITOR_BLANK_TAGS,
  customTemplateKey,
  deleteCustomTemplate,
  loadCustomTemplates,
  parseCustomTemplatePack,
  saveCustomTemplates,
  serializeCustomTemplatePack,
  tagForCategory,
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
let editorSuggestions = [];

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

function editorDraftInput() {
  return {
    id: currentCustomTemplateId,
    title: $('#editor-title')?.value || '',
    text: $('#editor-text')?.value || '',
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

function renderEditorBlankToolbar() {
  const toolbar = $('#editor-blank-toolbar');
  if (!toolbar) return;
  toolbar.innerHTML = '';
  for (const tag of EDITOR_BLANK_TAGS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `{${tag}}`;
    btn.addEventListener('click', () => insertEditorTag(tag));
    toolbar.appendChild(btn);
  }
}

function insertEditorTag(tag) {
  const textarea = $('#editor-text');
  if (!textarea) return;
  const insert = `{${tag}}`;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = `${textarea.value.slice(0, start)}${insert}${textarea.value.slice(end)}`;
  const pos = start + insert.length;
  textarea.focus();
  textarea.setSelectionRange(pos, pos);
  updateEditorStatsAndPreview();
}

function updateEditorStatsAndPreview() {
  const text = $('#editor-text')?.value || '';
  const title = $('#editor-title')?.value || '';
  const stats = $('#editor-stats');
  const validationEl = $('#editor-validation');
  const preview = $('#editor-preview');
  const blanks = validBlankCount(text);
  const words = countWords(text);
  const unsupported = unsupportedPlaceholderTags(text);
  if (stats) {
    const mode = blanks ? 'template mode' : 'plain text auto-swap mode';
    stats.textContent = `${words} words · ${blanks} blanks · ${mode}`;
  }
  if (validationEl) {
    const validation = validateCustomTemplate(
      { title, text, format: $('#editor-format')?.value, tags: [...editorActiveTags] },
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
  if (preview) {
    const previewText = text.trim() || '*Markdown preview appears here.*';
    preview.innerHTML = renderMadLibMarkdown(previewText, []);
  }
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
  $('#editor-text').value = template.text || '';
  $('#editor-format').value = template.format || 'story';
  setEditorTags(template.tags);
  renderEditorTagChips();
  renderCustomTemplateSelect(template.id);
  updateEditorStatsAndPreview();
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

function renderEditorSuggestions() {
  const box = $('#editor-suggestions');
  if (!box) return;
  box.innerHTML = '';
  if (!editorSuggestions.length) {
    box.classList.add('hidden');
    return;
  }
  const title = document.createElement('h3');
  title.textContent = 'Suggested blanks';
  box.appendChild(title);
  const list = document.createElement('div');
  list.className = 'suggestion-list';
  for (const suggestion of editorSuggestions) {
    const label = document.createElement('label');
    label.className = 'suggestion-item';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = true;
    input.dataset.index = String(suggestion.index);
    const text = document.createElement('span');
    text.textContent = suggestion.originalWord;
    const meta = document.createElement('small');
    meta.textContent = `{${tagForCategory(suggestion.category)}}`;
    label.append(input, text, meta);
    list.appendChild(label);
  }
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'btn-secondary';
  apply.textContent = 'Apply Selected Blanks';
  apply.addEventListener('click', applySelectedSuggestions);
  box.append(list, apply);
  box.classList.remove('hidden');
}

async function suggestEditorBlanks() {
  const text = $('#editor-text')?.value || '';
  if (!text.trim()) {
    setStatus('Write or paste text before asking for suggestions.', 'error');
    return;
  }
  setStatus('Finding good blank candidates...', 'info');
  try {
    const tokens = tokenize(text);
    const classifications = appState.nlpEngine && appState.nlpEngine.name !== 'heuristic'
      ? classifyTokensWithNlp(tokens, appState.nlpEngine)
      : classifyTokensHeuristic(tokens);
    let dictionaryPos = null;
    try {
      dictionaryPos = await lookupPosForPool(tokens, classifications);
    } catch (_) {
      dictionaryPos = null;
    }
    const candidates = selectReplacementCandidates(tokens, classifications, {
      count: 12,
      allowPartial: true,
      dictionaryPos
    });
    editorSuggestions = candidates
      .map((candidate, index) => ({ ...candidate, index, token: tokens[candidate.tokenIndex] }))
      .filter(s => Number.isInteger(s.token?.start) && Number.isInteger(s.token?.end));
    renderEditorSuggestions();
    setStatus(editorSuggestions.length ? `Found ${editorSuggestions.length} blank suggestions.` : 'No good blank suggestions found.', editorSuggestions.length ? 'success' : 'error');
  } catch (err) {
    editorSuggestions = [];
    renderEditorSuggestions();
    setStatus(err.message || 'Could not suggest blanks for this text.', 'error');
  }
}

function applySelectedSuggestions() {
  const box = $('#editor-suggestions');
  const textarea = $('#editor-text');
  if (!box || !textarea) return;
  const selected = [...box.querySelectorAll('input[type="checkbox"]:checked')]
    .map(input => editorSuggestions.find(s => s.index === Number(input.dataset.index)))
    .filter(Boolean)
    .sort((a, b) => b.token.start - a.token.start);
  if (!selected.length) {
    setStatus('Select at least one suggestion to apply.', 'error');
    return;
  }
  let text = textarea.value;
  for (const suggestion of selected) {
    text = `${text.slice(0, suggestion.token.start)}{${tagForCategory(suggestion.category)}}${text.slice(suggestion.token.end)}`;
  }
  textarea.value = text;
  editorSuggestions = [];
  renderEditorSuggestions();
  updateEditorStatsAndPreview();
  setStatus(`Applied ${selected.length} suggested blanks.`, 'success');
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
  renderEditorBlankToolbar();
  renderCustomTemplateSelect();
  updateEditorStatsAndPreview();

  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  $('#btn-editor-play').addEventListener('click', startFromCreateDraft);
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
  $('#editor-text')?.addEventListener('input', () => {
    editorSuggestions = [];
    renderEditorSuggestions();
    updateEditorStatsAndPreview();
  });
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
