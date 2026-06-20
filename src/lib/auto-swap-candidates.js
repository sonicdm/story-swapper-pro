import {
  cleanGutenbergText, detectSections, selectSection, trimToWordLimit, tokenize
} from './text.js';
import { classifyTokensHeuristic, classifyTokensWithNlp } from './classify.js';
import { normalizeTemplateSyntax } from './madlibs.js';
import { selectMixedCandidates, countPlaceholders } from './placeholders.js';
import { lookupPosForPool } from './dictionary.js';
import { countWords } from './dom.js';

/**
 * Resolve the text slice used for tokenization and auto-swap (mirrors prepareGameFromSource).
 */
export function resolveSwapContext(rawText, {
  forceTemplateMode = false,
  revealLength = 250,
  collectionMode = 'auto',
  selectedSectionIndex = null,
  isGutenberg = false,
  title = '',
  useFullText = false
} = {}) {
  const cleanText = isGutenberg
    ? cleanGutenbergText(rawText)
    : normalizeTemplateSyntax(String(rawText || '').replace(/\r\n/g, '\n').trim());

  const templateMode = forceTemplateMode;

  if (templateMode || useFullText) {
    return {
      cleanText,
      templateMode,
      detectedSections: [],
      selectedSection: { text: cleanText, title, index: 0 },
      selectedSectionIndex: 0,
      selectedText: cleanText,
      revealLength: templateMode ? countWords(cleanText) : revealLength
    };
  }

  const detectedSections = detectSections(cleanText);
  const section = selectSection(
    cleanText,
    detectedSections,
    collectionMode,
    selectedSectionIndex
  );

  return {
    cleanText,
    templateMode,
    detectedSections,
    selectedSection: section,
    selectedSectionIndex: section.index,
    selectedText: trimToWordLimit(section.text, revealLength),
    revealLength
  };
}

/**
 * Shared auto-swap candidate pipeline for Play Draft and Suggest Blanks.
 */
export async function computeAutoSwapCandidates(rawText, {
  nlpEngine = null,
  forceTemplateMode = false,
  revealLength = 250,
  promptSetting = 'auto',
  collectionMode = 'auto',
  selectedSectionIndex = null,
  isGutenberg = false,
  title = '',
  seed = null,
  useFullText = false,
  minWordsTemplate = 20,
  minWordsProse = 80,
  throwOnEmpty = false
} = {}) {
  const ctx = resolveSwapContext(rawText, {
    forceTemplateMode,
    revealLength,
    collectionMode,
    selectedSectionIndex,
    isGutenberg,
    title,
    useFullText
  });

  const tokens = tokenize(ctx.selectedText);
  const minWords = ctx.templateMode ? minWordsTemplate : minWordsProse;

  if (countWords(ctx.selectedText) < minWords && countPlaceholders(tokens) === 0) {
    const err = new Error('This text is too short. Try a longer excerpt or paste more text.');
    if (throwOnEmpty) throw err;
    return { ...ctx, tokens, classifications: [], candidates: [], error: err.message };
  }

  const classifications = nlpEngine && nlpEngine.name !== 'heuristic'
    ? classifyTokensWithNlp(tokens, nlpEngine)
    : classifyTokensHeuristic(tokens);

  let dictionaryPos = null;
  try {
    dictionaryPos = await lookupPosForPool(tokens, classifications);
  } catch (_) {
    dictionaryPos = null;
  }

  const effectiveRevealLength = ctx.templateMode ? ctx.revealLength : revealLength;
  const candidates = selectMixedCandidates(tokens, classifications, {
    revealLength: effectiveRevealLength,
    promptSetting,
    dictionaryPos,
    seed
  });

  if (!candidates.length && throwOnEmpty) {
    throw new Error('No words to swap. Add {noun}-style tags or try a longer passage.');
  }

  return {
    ...ctx,
    tokens,
    classifications,
    dictionaryPos,
    candidates,
    promptSetting,
    hasTaggedBlanks: countPlaceholders(tokens) > 0
  };
}
