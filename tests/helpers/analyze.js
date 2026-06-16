import { tokenize } from '../../src/lib/text.js';
import {
  classifyTokensWithNlp, pickCategory, buildSwapPool, selectReplacementCandidates
} from '../../src/lib/classify.js';
import {
  filterPoolWithDictionary, reconcileCategory, wordNetPosFor
} from '../../src/lib/dictionary-pos.js';
import { lookupPosForPool } from './dictionary.mjs';

/** Locate a word token by fixture key (norm or exact text). */
export function findWordToken(wordTokens, key, spec = {}) {
  if (spec.matchText) {
    return wordTokens.find(t => t.text === key);
  }
  const norm = key.toLowerCase();
  const matches = wordTokens.filter(t => t.norm === norm);
  if (matches.length <= 1) return matches[0];
  if (spec.occurrence != null) return matches[spec.occurrence];
  return matches[0];
}

export function analyzeText(text, engine, options = {}) {
  const tokens = tokenize(text);
  const wordTokens = tokens.filter(t => t.type === 'word');
  const classifications = classifyTokensWithNlp(tokens, engine);
  let pool = buildSwapPool(tokens, classifications);
  const dictionaryPos = options.dictionaryPos || null;
  if (dictionaryPos?.size) {
    pool = filterPoolWithDictionary(pool, dictionaryPos);
  }
  const poolByNorm = new Map(pool.map(p => [p.norm, p]));
  const poolByText = new Map(pool.map(p => [p.original, p]));

  return {
    text,
    tokens,
    wordTokens,
    classifications,
    pool,
    poolByNorm,
    poolByText,
    dictionaryPos,
    engineName: engine.name
  };
}

/** NLP analysis + en-dictionary POS validation on the swap pool. */
export async function analyzeTextWithDictionary(text, engine) {
  const tokens = tokenize(text);
  const wordTokens = tokens.filter(t => t.type === 'word');
  const classifications = classifyTokensWithNlp(tokens, engine);
  const rawPool = buildSwapPool(tokens, classifications);
  const dictionaryPos = await lookupPosForPool(rawPool);
  return analyzeText(text, engine, { dictionaryPos });
}

export function wordReport(analysis, key, spec = {}) {
  const tok = findWordToken(analysis.wordTokens, key, spec);
  if (!tok) return { found: false, key, spec };

  const cls = analysis.classifications.get(tok.index) || { categories: [], confidence: 0 };
  const poolEntry = analysis.pool.find(p => p.tokenIndex === tok.index)
    || analysis.poolByText.get(tok.text)
    || analysis.poolByNorm.get(tok.norm)
    || null;

  const wi = analysis.wordTokens.indexOf(tok);
  const prevWord = wi > 0 ? analysis.wordTokens[wi - 1].norm : '';

  return {
    found: true,
    key,
    text: tok.text,
    norm: tok.norm,
    categories: cls.categories,
    confidence: cls.confidence,
    pickCategory: cls.categories.length ? pickCategory(cls.categories, tok, prevWord, cls) : null,
    eligible: Boolean(poolEntry),
    poolCategory: poolEntry?.category ?? null,
    wordNetPos: analysis.dictionaryPos
      ? [...(wordNetPosFor(analysis.dictionaryPos, tok.norm) || [])]
      : null,
    dictionaryNote: analysis.dictionaryPos && poolEntry
      ? reconcileCategory(poolEntry.category, wordNetPosFor(analysis.dictionaryPos, tok.norm), tok.text)
      : null
  };
}

export function selectWithSeed(analysis, options) {
  const { count = 12, seed = 42, minDistance, allowPartial } = options;
  return selectReplacementCandidates(analysis.tokens, analysis.classifications, {
    count,
    seed,
    ...(minDistance != null ? { minDistance } : {}),
    ...(allowPartial != null ? { allowPartial } : {}),
    ...(analysis.dictionaryPos?.size ? { dictionaryPos: analysis.dictionaryPos } : {})
  });
}

export async function selectWithSeedAndDictionary(analysis, options) {
  const dictionaryPos = analysis.dictionaryPos || await lookupPosForPool(buildSwapPool(analysis.tokens, analysis.classifications));
  return selectReplacementCandidates(analysis.tokens, analysis.classifications, {
    ...options,
    dictionaryPos
  });
}
