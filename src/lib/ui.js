import { $, $$, setStatus, showPhase, switchTab as activateTab } from './dom.js';
import { appState } from './state.js';
import { SAMPLES } from '../data/samples.js';
import {
  startFromPaste, startFromGutenberg, startFromPoem, startFromSample, startFromMadLib,
  revealStory, copyFinalStory, downloadFinalStory, fillRandomPrompts,
  rerollWords, rerollSection, resetGame
} from './game.js';
import {
  fetchGutendexResults, fetchRandomReadableBook, gutenbergBlockedOnFileProtocol
} from './fetch.js';
import { listBundledMadLibTitles } from './madlibs.js';
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
    });
    list.appendChild(li);
  });
  list.classList.remove('hidden');
}

const SETTINGS_KEY = 'storySwapper:settings';
const LENGTH_SELECTS = ['#paste-length', '#gutenberg-length', '#sample-length', '#madlibs-length'];

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
      showOriginals: $('#toggle-originals')?.checked || false
    }));
  } catch (_) { /* ignore quota / privacy mode */ }
}

function applySettings(settings) {
  if (settings.length) {
    LENGTH_SELECTS.forEach(sel => {
      const el = $(sel);
      if (el && [...el.options].some(o => o.value === settings.length)) el.value = settings.length;
    });
  }
  if (settings.promptCount && $('#prompt-count')) $('#prompt-count').value = settings.promptCount;
  if (settings.tab) switchTab(settings.tab);
}

function switchTab(tabName) {
  activateTab(tabName);
  appState.sourceType = tabName;
  saveSettings();
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
    opt.textContent = 'No samples available';
    sampleSelect.appendChild(opt);
    setStatus('Sample stories failed to load. Try npm run dev or rebuild the app.', 'error');
  } else {
    SAMPLES.forEach((s, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = s.title;
      sampleSelect.appendChild(opt);
    });
  }

  const madlibsSelect = $('#madlibs-select');
  if (madlibsSelect) {
    madlibsSelect.innerHTML = '';
    listBundledMadLibTitles().forEach(title => {
      const opt = document.createElement('option');
      opt.value = title;
      opt.textContent = title;
      madlibsSelect.appendChild(opt);
    });
  }

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
      setStatus('Could not search public domain books. Try Sample or Paste.', 'error');
    }
  });

  $('#btn-gutenberg-random').addEventListener('click', async () => {
    setStatus('Finding a random story…', 'info');
    try {
      const cat = $('#gutenberg-category').value;
      const book = await fetchRandomReadableBook(cat);
      appState.selectedBook = book;
      await startFromGutenberg(book);
    } catch (_) {
      setStatus('Random story failed. Try Sample or Paste.', 'error');
    }
  });

  $('#btn-gutenberg-load').addEventListener('click', () => startFromGutenberg(appState.selectedBook));

  $('#btn-poem-random').addEventListener('click', () => startFromPoem('', '', true));
  $('#btn-poem-search').addEventListener('click', () => {
    startFromPoem($('#poem-author').value.trim(), $('#poem-title').value.trim());
  });
  $('#btn-poem-load').addEventListener('click', () => {
    startFromPoem($('#poem-author').value.trim(), $('#poem-title').value.trim(), !$('#poem-author').value.trim() && !$('#poem-title').value.trim());
  });

  $('#btn-sample-load').addEventListener('click', startFromSample);

  $('#btn-madlibs-random').addEventListener('click', () => startFromMadLib(true));
  $('#btn-madlibs-load').addEventListener('click', () => startFromMadLib(false));

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
export { renderGutenbergResults, switchTab, initApp };
