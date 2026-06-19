import { $, $$, setStatus, showPhase, switchTab as activateTab } from './dom.js';
import { appState } from './state.js';
import { SAMPLES } from '../data/samples.js';
import {
  startFromPaste, startFromGutenberg, startFromPoem, startFromSample, startFromMadLib,
  revealStory, copyFinalStory, downloadFinalStory, fillRandomPrompts,
  rerollWords, rerollSection, resetGame
} from './game.js';
import {
  fetchGutendexResults, fetchRandomReadableBook, fetchPoem, poemToText,
  gutenbergBlockedOnFileProtocol
} from './fetch.js';
import {
  listBundledMadLibCatalog, getMadLibMeta, getRandomBundledMadLibTitle,
  COLLECTIONS, COLLECTION_LABELS, TAG_ORDER, TAG_LABELS, FORMAT_LABELS
} from './madlibs.js';
import { loadNlpEngine, awaitWinkEngine } from './nlp-engine.js';

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
    const authors = (book.authors || []).map(a => a.name).join(', ');
    li.innerHTML = `${book.title}${authors ? `<small>${authors}</small>` : ''}`;
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
const LENGTH_SELECTS = ['#paste-length', '#gutenberg-length', '#sample-length', '#poem-length'];
const AUTO_SWAP_TABS = new Set(['paste', 'gutenberg', 'poem', 'sample']);

/** Active Mad Lib collection + tag filter chips. */
const madlibActiveCollections = new Set();
const madlibActiveTags = new Set();

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
      length: $('#paste-length')?.value,
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
      opt.value = item.title;
      opt.textContent = item.title;
      og.appendChild(opt);
      if (!firstVisible) firstVisible = item.title;
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
  switchTab(settings.tab || 'madlibs');
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

  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  $('#btn-paste-start').addEventListener('click', startFromPaste);

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
      setStatus('Could not search public domain books. Try Examples or Paste.', 'error');
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
      setStatus('Random book failed. Try Examples or Paste.', 'error');
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
    setStatus(`Selected: ${title}`, 'success');
  });
  $('#btn-madlibs-load').addEventListener('click', () => startFromMadLib());
  $('#madlibs-select')?.addEventListener('change', () => {
    updateMadLibMeta();
    saveSettings();
  });
  $('#madlibs-filter')?.addEventListener('input', () => {
    renderMadLibSelect(getMadLibBrowseFilter(), $('#madlibs-select')?.value);
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
