import { $, setStatus, showPhase, countWords, switchTab } from './dom.js';
import { appState } from './state.js';
import { SAMPLES } from '../data/samples.js';
import { AUTO_PROMPTS, CATEGORY_LABELS, CATEGORY_HINTS } from './constants.js';
import {
  cleanGutenbergText, detectSections, selectSection, trimToWordLimit, tokenize
} from './text.js';
import {
  classifyTokensHeuristic, classifyTokensWithNlp, resolvePromptCount,
  selectReplacementCandidates
} from './classify.js';
import { fetchGutenbergText, fetchPoem, poemToText, fetchMadLibRandom, fetchMadLibByTitle } from './fetch.js';
import { normalizeTemplateSyntax } from './madlibs.js';
import pluralize from 'pluralize';
import { phraseLooksPlural, isPastTenseForm } from './grammar.js';
import { hasPlaceholders, selectMixedCandidates, countPlaceholders, placeholderOriginalForCategory } from './placeholders.js';
import { lookupPosForPool, randomWordsForCategories } from './dictionary.js';
import { renderMadLibMarkdown, swapPlaceholder } from './story-markdown.js';

function renderPromptForm(candidates) {
  const form = $('#prompt-form');
  form.innerHTML = '';
  const tpl = $('#prompt-template');
  candidates.forEach((c, i) => {
    const node = tpl.content.cloneNode(true);
    const label = node.querySelector('label');
    const hint = node.querySelector('.hint');
    const input = node.querySelector('input');
    const id = `prompt-${i}`;
    label.setAttribute('for', id);
    label.innerHTML = `<span class="prompt-num">${i + 1}</span> ${c.label}`;
    hint.textContent = c.hint || '';
    hint.style.display = c.hint ? 'block' : 'none';
    input.id = id;
    input.name = id;
    input.dataset.index = String(i);
    const art = /^[aeiou]/i.test(c.label) ? 'an' : 'a';
    input.placeholder = `Type ${art} ${c.label}…`;
    input.setAttribute('aria-required', 'true');
    form.appendChild(node);
  });
  appState.candidates = candidates;
  appState.prompts = candidates;
}

const IRREGULAR_PAST = {
  go: 'went', run: 'ran', see: 'saw', eat: 'ate', come: 'came', take: 'took',
  give: 'gave', make: 'made', find: 'found', think: 'thought', know: 'knew',
  fall: 'fell', fly: 'flew', sing: 'sang', swim: 'swam', drink: 'drank',
  ring: 'rang', sit: 'sat', stand: 'stood', sleep: 'slept', keep: 'kept',
  leave: 'left', feel: 'felt', hold: 'held', bring: 'brought', buy: 'bought',
  catch: 'caught', teach: 'taught', win: 'won', begin: 'began', break: 'broke',
  speak: 'spoke', steal: 'stole', throw: 'threw', grow: 'grew', draw: 'drew',
  ride: 'rode', drive: 'drove', write: 'wrote', rise: 'rose', wear: 'wore',
  bite: 'bit', hide: 'hid', shake: 'shook', freeze: 'froze', choose: 'chose',
  grind: 'ground', bind: 'bound', wind: 'wound'
};

function doubleFinal(v) {
  const vowelGroups = (v.match(/[aeiouy]+/g) || []).length;
  return vowelGroups === 1 && /[^aeiou][aeiou][^aeiouwxy]$/.test(v);
}
function toGerund(v) {
  if (/ing$/i.test(v) && v.length > 4) return v;
  if (v.endsWith('ie')) return v.slice(0, -2) + 'ying';
  if (v.endsWith('e') && !v.endsWith('ee') && !v.endsWith('ye') && v.length > 2) return v.slice(0, -1) + 'ing';
  if (doubleFinal(v)) return v + v.slice(-1) + 'ing';
  return v + 'ing';
}
function toPast(v) {
  if (IRREGULAR_PAST[v]) return IRREGULAR_PAST[v];
  if (isPastTenseForm(v)) return v;
  if (v.endsWith('e')) return v + 'd';
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ied';
  if (doubleFinal(v)) return v + v.slice(-1) + 'ed';
  return v + 'ed';
}
function toThirdPerson(v) {
  if (/[^s]s$/i.test(v) && !/ss$/i.test(v)) return v;
  if (/(s|sh|ch|x|z|o)$/.test(v)) return v + 'es';
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ies';
  return v + 's';
}
function pluralizeWord(w) {
  return pluralize.plural(w);
}

function fitVerbForm(replacement, original, category) {
  const parts = replacement.split(' ');
  let last = parts[parts.length - 1].toLowerCase();
  const o = original.toLowerCase();
  if (category === 'past-tense verb' || isPastTenseForm(o)) {
    last = toPast(last);
  } else if (category === 'verb ending in -ing' || o.endsWith('ing')) {
    last = toGerund(last);
  } else if (o.endsWith('s') && !o.endsWith('ss') && !o.endsWith('us')) {
    last = toThirdPerson(last);
  }
  parts[parts.length - 1] = last;
  return parts.join(' ');
}

function startsWithVowelSound(word) {
  const w = word.toLowerCase().replace(/^[^a-z]+/, '');
  if (!w) return false;
  if (/^(hour|honest|honou?r|heir)/.test(w)) return true;
  if (/^(uni|use|usu|usa|euro|ewe|once|one|unit)/.test(w)) return false;
  if (/^u[bcdfghjklmnpqrstvwxyz][aeiou]/.test(w)) return false;
  return /^[aeiou]/.test(w);
}

function fixArticle(originalArticle, nextWord) {
  let art = startsWithVowelSound(nextWord) ? 'an' : 'a';
  if (originalArticle.length === 1 && /^[A-Z]$/.test(originalArticle)) {
    art = art.charAt(0).toUpperCase() + art.slice(1);
  } else if (originalArticle === originalArticle.toUpperCase() && originalArticle.length > 1) {
    art = art.toUpperCase();
  } else if (/^[A-Z]/.test(originalArticle)) {
    art = art.charAt(0).toUpperCase() + art.slice(1);
  }
  return art;
}

function applyReplacement(original, replacement, meta) {
  let word = replacement.trim().replace(/\s+/g, ' ');
  if (!word) return original;

  const grammarOriginal = meta.isPlaceholder
    ? placeholderOriginalForCategory(meta.category)
    : original;

  if (meta.category === 'verb' || meta.category === 'past-tense verb' || meta.category === 'verb ending in -ing') {
    word = fitVerbForm(word, grammarOriginal, meta.category);
  } else if (meta.preservePlural && !phraseLooksPlural(word)) {
    const parts = word.split(' ');
    parts[parts.length - 1] = pluralizeWord(parts[parts.length - 1]);
    word = parts.join(' ');
  }

  if (meta.preservePossessive && !/['\u2019]s$/i.test(word) && /['\u2019]s$/i.test(original)) {
    word = word.replace(/['\u2019]s$/i, '') + "'s";
  }

  if (original === original.toUpperCase() && original.length > 1) return word.toUpperCase();
  if (/^[A-Z]/.test(original)) word = word.charAt(0).toUpperCase() + word.slice(1);
  return word;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeSwapMarkHtml(applied, meta) {
  const safe = escapeHtml(applied);
  const origLabel = meta.isPlaceholder
    ? `[${meta.label || meta.category}]`
    : (meta.originalWord ?? meta.original ?? '');
  const origSafe = escapeHtml(origLabel);
  return `<mark class="swap" title="was: ${origSafe}" aria-label="Your word: ${safe}, originally ${origSafe}" data-original="${origSafe}">${safe}</mark>`;
}

function buildFinalStory(tokens, prompts, replacements, options = {}) {
  const useMarkdown = options.useMarkdown === true;
  const replaceMap = new Map();
  prompts.forEach((p, i) => {
    replaceMap.set(p.tokenIndex, { replacement: replacements[i] ?? '', meta: p });
  });

  const htmlParts = [];
  const plainParts = [];
  const markdownParts = [];
  const swapHtml = [];
  let swapIndex = 0;
  let lastWord = null;

  for (const tok of tokens) {
    if (replaceMap.has(tok.index)) {
      const { replacement, meta } = replaceMap.get(tok.index);
      const applied = applyReplacement(meta.originalWord, replacement, meta);

      if (lastWord && (lastWord.norm === 'a' || lastWord.norm === 'an')) {
        const fixed = fixArticle(lastWord.text, applied);
        if (fixed !== lastWord.text) {
          plainParts[lastWord.plainIdx] = fixed;
          htmlParts[lastWord.htmlIdx] = escapeHtml(fixed);
          if (useMarkdown) markdownParts[lastWord.mdIdx] = fixed;
        }
      }

      htmlParts.push(makeSwapMarkHtml(applied, meta));
      plainParts.push(applied);
      if (useMarkdown) {
        swapHtml.push(makeSwapMarkHtml(applied, meta));
        markdownParts.push(swapPlaceholder(swapIndex++));
      }
      lastWord = {
        norm: applied.toLowerCase(),
        text: applied,
        plainIdx: plainParts.length - 1,
        htmlIdx: htmlParts.length - 1,
        mdIdx: useMarkdown ? markdownParts.length - 1 : undefined
      };
    } else {
      const esc = tok.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      htmlParts.push(esc);
      plainParts.push(tok.text);
      if (useMarkdown) markdownParts.push(tok.text);
      if (tok.type === 'word') {
        lastWord = {
          norm: tok.norm,
          text: tok.text,
          plainIdx: plainParts.length - 1,
          htmlIdx: htmlParts.length - 1,
          mdIdx: useMarkdown ? markdownParts.length - 1 : undefined
        };
      }
    }
  }

  const html = htmlParts.join('');
  const plain = plainParts.join('');
  const markdownPlain = useMarkdown ? markdownParts.join('') : '';
  appState.finalHtml = useMarkdown ? renderMadLibMarkdown(markdownPlain, swapHtml) : html;
  appState.finalPlainText = plain;
  return useMarkdown
    ? { html: appState.finalHtml, plain, markdownPlain, swapHtml, useMarkdown: true }
    : { html, plain, useMarkdown: false };
}

async function fillRandomPrompts() {
  setStatus('Picking random words…', 'info');
  try {
    const categories = appState.candidates.map(c => c.category);
    const words = await randomWordsForCategories(categories);
    const inputs = $('#prompt-form').querySelectorAll('input');
    appState.candidates.forEach((c, i) => {
      if (inputs[i]) inputs[i].value = words[i];
    });
    setStatus('Filled with random words — reveal them or tweak first!', 'info');
  } catch (err) {
    setStatus(err.message || 'Could not load word list.', 'error');
  }
}

function downloadFinalStory() {
  const text = appState.finalPlainText || '';
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const base = (appState.loadedSourceTitle || 'story-swapper').replace(/[^\w-]+/g, '_').slice(0, 40) || 'story-swapper';
  a.href = url;
  a.download = `${base}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus('Story downloaded.', 'success');
}

async function copyFinalStory() {
  try {
    await navigator.clipboard.writeText(appState.finalPlainText);
    setStatus('Story copied to clipboard!', 'success');
  } catch (_) {
    setStatus('Copy did not work — select and copy the story text below.', 'error');
    const ta = document.createElement('textarea');
    ta.value = appState.finalPlainText;
    ta.style.width = '100%';
    ta.style.minHeight = '120px';
    $('#story-output').after(ta);
    ta.select();
  }
}

function resetGame() {
  appState.tokens = [];
  appState.candidates = [];
  appState.prompts = [];
  appState.replacements = {};
  appState.finalHtml = '';
  appState.finalPlainText = '';
  showPhase('source');
  setStatus('');
  $('#btn-reroll-section').classList.add('hidden');
}

async function prepareGameFromSource(rawText, title, isGutenberg = false) {
  showPhase('loading');
  $('#loading-message').textContent = 'Preparing your story…';
  try {
    appState.rawText = rawText;
    appState.loadedSourceTitle = title;
    appState.cleanText = isGutenberg
      ? cleanGutenbergText(rawText)
      : normalizeTemplateSyntax(rawText.replace(/\r\n/g, '\n').trim());

    if (appState.sourceType === 'madlibs') {
      appState.detectedSections = [];
      appState.selectedSection = { text: appState.cleanText, title: title, index: 0 };
      appState.selectedSectionIndex = 0;
      appState.selectedText = appState.cleanText;
      appState.revealLength = countWords(appState.cleanText);
    } else {
      appState.detectedSections = detectSections(appState.cleanText);
      appState.collectionMode = appState.sourceType === 'gutenberg'
        ? $('#gutenberg-collection').value
        : 'auto';
      const section = selectSection(
        appState.cleanText,
        appState.detectedSections,
        appState.collectionMode,
        appState.selectedSectionIndex
      );
      appState.selectedSection = section;
      appState.selectedSectionIndex = section.index;
      appState.selectedText = trimToWordLimit(section.text, appState.revealLength);
    }
    appState.tokens = tokenize(appState.selectedText);

    const minWords = appState.sourceType === 'madlibs' ? 20 : 80;
    if (countWords(appState.selectedText) < minWords && countPlaceholders(appState.tokens) === 0) {
      throw new Error('This text is too short. Try a longer excerpt or paste more text.');
    }

    appState.hasTaggedBlanks = hasPlaceholders(appState.selectedText);

    if (appState.nlpEngine && appState.nlpEngine.name !== 'heuristic') {
      appState.classifications = classifyTokensWithNlp(appState.tokens, appState.nlpEngine);
    } else {
      appState.classifications = classifyTokensHeuristic(appState.tokens);
    }

    const dictionaryPos = await lookupPosForPool(appState.tokens, appState.classifications);

    appState.candidates = selectMixedCandidates(appState.tokens, appState.classifications, {
      revealLength: appState.revealLength,
      promptSetting: appState.promptCount,
      dictionaryPos
    });

    if (!appState.candidates.length) {
      throw new Error('No words to swap. Add {noun}-style tags or try a longer passage.');
    }

    renderPromptForm(appState.candidates);
    showPhase('prompts');
    const tagged = appState.candidates.filter(c => c.isPlaceholder).length;
    const modeNote = tagged
      ? tagged === appState.candidates.length
        ? ` (${tagged} template blanks)`
        : ` (${tagged} tagged + ${appState.candidates.length - tagged} auto)`
      : '';
    setStatus(`Ready! Fill in ${appState.candidates.length} words${modeNote}.`, 'info');
  } catch (err) {
    showPhase('source');
    setStatus(err.message || 'Something went wrong preparing the story.', 'error');
  }
}

async function startFromPaste() {
  const text = $('#paste-text').value.trim();
  if (!text) { setStatus('Please paste some text first.', 'error'); return; }
  appState.sourceType = 'paste';
  appState.revealLength = parseInt($('#paste-length').value, 10);
  appState.promptCount = $('#prompt-count').value;
  await prepareGameFromSource(text, 'Pasted text', false);
}

async function startFromGutenberg(book) {
  if (!book) {
    setStatus('Select a book from search results first.', 'error');
    return;
  }
  showPhase('loading');
  $('#loading-message').textContent = 'Downloading book text…';
  setStatus('');
  try {
    const raw = await fetchGutenbergText(book);
    appState.sourceType = 'gutenberg';
    appState.selectedBook = book;
    appState.revealLength = parseInt($('#gutenberg-length').value, 10);
    appState.promptCount = $('#prompt-count').value;
    const authors = (book.authors || []).map(a => a.name).join(', ');
    await prepareGameFromSource(raw, book.title + (authors ? ` by ${authors}` : ''), true);
  } catch (err) {
    showPhase('source');
    switchTab('gutenberg');
    appState.sourceType = 'gutenberg';
    if (location.protocol === 'file:' || err?.message === 'gutenberg-file-protocol') {
      setStatus(
        'Public Domain book downloads do not work when opening this HTML file directly. Use Examples or Paste, or serve the folder: python -m http.server 8080',
        'error'
      );
    } else if (err?.message === 'gutenberg-audio-only') {
      setStatus('That book is audio-only — no story text to swap. Search for another title or try Random again.', 'error');
    } else if (err?.message === 'gutenberg-no-text') {
      setStatus('Could not find readable text for this book. Try another title or use Random.', 'error');
    } else {
      setStatus('Could not download this book. Try another title, Sample, or Paste.', 'error');
    }
  }
}

async function startFromPoem(poemData) {
  if (!poemData?.text) {
    setStatus('Pick a poem first — try Random or Search.', 'error');
    return;
  }
  showPhase('loading');
  try {
    const { text, title: poemTitle } = poemData;
    if (countWords(text) < 40) throw new Error('Poem too short');
    appState.sourceType = 'poem';
    appState.revealLength = Math.min(parseInt($('#poem-length')?.value || '250', 10), countWords(text));
    appState.promptCount = $('#prompt-count').value;
    appState.collectionMode = 'beginning';
    await prepareGameFromSource(text, poemTitle, false);
  } catch (_) {
    showPhase('source');
    switchTab('poem');
    setStatus('Could not load a poem right now. Try Examples or Paste.', 'error');
  }
}

async function startFromSample() {
  const idx = parseInt($('#sample-select').value, 10);
  const sample = SAMPLES[idx];
  if (!sample) return;
  appState.sourceType = 'sample';
  appState.revealLength = parseInt($('#sample-length').value, 10);
  appState.promptCount = $('#prompt-count').value;
  await prepareGameFromSource(sample.text, sample.title, false);
}

async function startFromMadLib() {
  showPhase('loading');
  $('#loading-message').textContent = 'Loading Mad Libs template…';
  setStatus('');
  try {
    const title = $('#madlibs-select')?.value;
    const story = title ? await fetchMadLibByTitle(title) : await fetchMadLibRandom();
    appState.sourceType = 'madlibs';
    appState.promptCount = 'auto';
    appState.collectionMode = 'beginning';
    const credit = story.source === 'bundled' ? ' (offline)' : '';
    await prepareGameFromSource(story.text, `Mad Libs: ${story.title}${credit}`, false);
  } catch (err) {
    showPhase('source');
    switchTab('madlibs');
    appState.sourceType = 'madlibs';
    if (err?.message === 'madlibs-not-found') {
      setStatus('Could not find that template. Pick another from the list or try Random.', 'error');
    } else {
      setStatus('Could not load a Mad Libs template. Bundled classics should still work offline.', 'error');
    }
  }
}

function revealStory() {
  const form = $('#prompt-form');
  const inputs = form.querySelectorAll('input');
  const replacements = [];
  for (let i = 0; i < inputs.length; i++) {
    const val = inputs[i].value.trim();
    if (!val) {
      setStatus(`Please fill in prompt ${i + 1}.`, 'error');
      inputs[i].focus();
      return;
    }
    replacements.push(val);
  }
  appState.replacements = replacements;
  const useMarkdown = appState.sourceType === 'madlibs';
  const result = buildFinalStory(appState.tokens, appState.candidates, replacements, { useMarkdown });
  const output = $('#story-output');
  output.innerHTML = result.html;
  output.classList.toggle('story-reveal--markdown', useMarkdown);
  output.classList.toggle('show-originals', !!$('#toggle-originals')?.checked);
  const wc = countWords(appState.selectedText);
  const sectionTitle = appState.selectedSection?.title;
  $('#story-summary').innerHTML = `
    <strong>Source:</strong> ${appState.loadedSourceTitle}<br>
    ${sectionTitle ? `<strong>Section:</strong> ${sectionTitle}<br>` : ''}
    <strong>Words:</strong> ${wc} · <strong>Swaps:</strong> ${replacements.length}
  `;
  const rerollSec = $('#btn-reroll-section');
  if (appState.detectedSections.length > 1 && appState.collectionMode === 'auto') {
    rerollSec.classList.remove('hidden');
  } else {
    rerollSec.classList.add('hidden');
  }
  showPhase('reveal');
  setStatus('');
}

async function rerollWords() {
  const tagged = appState.candidates.filter(c => c.isPlaceholder);
  if (tagged.length && tagged.length === appState.candidates.length) {
    setStatus('All prompts are tagged blanks — use Surprise me or edit your answers.', 'info');
    return;
  }
  try {
    const promptNum = resolvePromptCount(appState.revealLength, appState.promptCount);
    const reserved = new Set(tagged.map(c => c.tokenIndex));
    const extraCount = Math.max(0, promptNum - tagged.length);
    if (extraCount <= 0) {
      setStatus('Tagged blanks fill the prompt list — no auto picks to reroll.', 'info');
      return;
    }
    const dictionaryPos = await lookupPosForPool(appState.tokens, appState.classifications);
    const extras = selectReplacementCandidates(appState.tokens, appState.classifications, {
      count: extraCount,
      excludeTokenIndices: reserved,
      ...(dictionaryPos?.size ? { dictionaryPos } : {})
    });
    appState.candidates = [...tagged, ...extras];
    renderPromptForm(appState.candidates);
    showPhase('prompts');
    setStatus('New auto-picked words — tagged blanks unchanged.', 'info');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function rerollSection() {
  if (appState.detectedSections.length <= 1) return;
  appState.collectionMode = 'auto';
  const section = selectSection(
    appState.cleanText,
    appState.detectedSections,
    'auto',
    appState.selectedSectionIndex
  );
  appState.selectedSection = section;
  appState.selectedSectionIndex = section.index;
  appState.selectedText = trimToWordLimit(section.text, appState.revealLength);
  appState.tokens = tokenize(appState.selectedText);
  if (appState.nlpEngine && appState.nlpEngine.name !== 'heuristic') {
    appState.classifications = classifyTokensWithNlp(appState.tokens, appState.nlpEngine);
  } else {
    appState.classifications = classifyTokensHeuristic(appState.tokens);
  }
  await rerollWords();
}
export {
  renderPromptForm, applyReplacement, buildFinalStory, copyFinalStory,
  downloadFinalStory, fillRandomPrompts, fixArticle, startsWithVowelSound,
  resetGame, prepareGameFromSource, startFromPaste, startFromGutenberg,
  startFromPoem, startFromSample, startFromMadLib, revealStory, rerollWords, rerollSection
};
