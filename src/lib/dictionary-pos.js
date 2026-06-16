import { isPastTenseForm } from './grammar.js';

/** Frequency / function adverbs — not fun swap targets even when WordNet says adverb. */
const LOW_VALUE_ADVERBS = new Set([
  'seldom', 'often', 'always', 'never', 'still', 'yet', 'already', 'usually', 'sometimes',
  'rarely', 'frequently', 'generally', 'merely', 'barely', 'hardly', 'nearly', 'almost',
  'quite', 'rather', 'too', 'very', 'just', 'only', 'even', 'also', 'then', 'now', 'here', 'there'
]);

const NOUN_LIKE = new Set([
  'noun', 'plural noun', 'animal', 'body part', 'place', 'emotion',
  'name of someone in the room', 'object', 'food', 'job', 'vehicle',
  'clothing item', 'sound', 'silly word', 'number', 'color'
]);

/** Words ending in -ing that are not gerunds (bring, sing, ring…). */
const NOT_GERUND_ING = new Set([
  'bring', 'cling', 'fling', 'ring', 'sing', 'sling', 'spring', 'sting', 'string',
  'swing', 'thing', 'wing', 'wring'
]);

function isGerundSurfaceForm(word) {
  const o = (word || '').toLowerCase();
  if (!o.endsWith('ing') || o.length <= 4 || NOT_GERUND_ING.has(o)) return false;
  return true;
}

const VERB_LIKE = new Set(['verb', 'past-tense verb', 'verb ending in -ing']);

/** Normalize en-dictionary / WordNet POS keys. */
export function normalizeWordNetPos(pos) {
  if (pos === 'adjective satellite') return 'adjective';
  return pos;
}

/** @param {Map<string, Set<string>>} posMap lemma → POS set */
export function wordNetPosFor(posMap, lemma) {
  return posMap.get((lemma || '').toLowerCase()) || null;
}

function posSetHas(posSet, kind) {
  if (!posSet) return false;
  if (kind === 'adjective') {
    return posSet.has('adjective') || posSet.has('adjective satellite');
  }
  return posSet.has(kind);
}

/** Whether an assigned prompt category is compatible with WordNet POS. */
export function categoryMatchesWordNet(category, posSet, original = '') {
  if (!posSet || !posSet.size) return true;

  const o = (original || '').toLowerCase();

  if (category === 'adverb') return posSetHas(posSet, 'adverb');
  if (category === 'adjective') return posSetHas(posSet, 'adjective');

  if (VERB_LIKE.has(category)) {
    if (!posSetHas(posSet, 'verb')) return false;
    if (category === 'verb ending in -ing' && !isGerundSurfaceForm(o)) return false;
    if (category === 'past-tense verb' && !isPastTenseForm(o) && !posSetHas(posSet, 'verb')) return false;
    return true;
  }

  if (NOUN_LIKE.has(category)) {
    return posSetHas(posSet, 'noun');
  }

  return true;
}

/** Pick a better grammar category when WordNet disagrees with the assignment. */
export function reconcileCategory(category, posSet, original = '') {
  if (!posSet || !posSet.size) {
    return { keep: true, category };
  }

  if (categoryMatchesWordNet(category, posSet, original)) {
    return { keep: true, category };
  }

  const o = (original || '').toLowerCase();

  if (VERB_LIKE.has(category) && posSetHas(posSet, 'verb')) {
    if (isGerundSurfaceForm(o)) return { keep: true, category: 'verb ending in -ing' };
    if (isPastTenseForm(o)) return { keep: true, category: 'past-tense verb' };
    return { keep: true, category: 'verb' };
  }

  if (NOUN_LIKE.has(category) && posSetHas(posSet, 'adverb') && !posSetHas(posSet, 'noun')) {
    return { keep: true, category: 'adverb' };
  }

  if (NOUN_LIKE.has(category) && posSetHas(posSet, 'adjective') && !posSetHas(posSet, 'noun')) {
    return { keep: true, category: 'adjective' };
  }

  if (category === 'adjective' && posSetHas(posSet, 'adverb') && !posSetHas(posSet, 'adjective')) {
    return { keep: true, category: 'adverb' };
  }

  const fallbacks = [];
  if (posSetHas(posSet, 'adverb')) fallbacks.push('adverb');
  if (posSetHas(posSet, 'adjective')) fallbacks.push('adjective');
  if (posSetHas(posSet, 'verb')) {
    fallbacks.push(isGerundSurfaceForm(o) ? 'verb ending in -ing' : isPastTenseForm(o) ? 'past-tense verb' : 'verb');
  }
  if (posSetHas(posSet, 'noun')) fallbacks.push('noun');

  if (fallbacks.length === 1) {
    return { keep: true, category: fallbacks[0] };
  }

  return { keep: false, category, reason: 'pos-mismatch' };
}

/** Words with multiple open-class POS in WordNet — too risky to auto-swap. */
export function isAmbiguousPos(posSet) {
  if (!posSet || posSet.size <= 1) return false;
  const open = ['noun', 'verb', 'adjective', 'adverb'].filter(p => posSetHas(posSet, p));
  return open.length > 1;
}

/** Closed-class or low-value when WordNet lists a single POS. */
function shouldDropFromPool(lemma, category, posSet) {
  if (isAmbiguousPos(posSet)) return true;
  if (posSet?.size === 1 && posSetHas(posSet, 'adverb')) return true;
  if (category === 'adverb' && LOW_VALUE_ADVERBS.has(lemma.toLowerCase())) return true;
  return false;
}

/** @param {{ norm: string, category: string, original?: string, properNoun?: boolean }} item */
export function validatePoolItem(item, posMap) {
  const original = item.original || item.norm;
  if (item.properNoun) return item;
  if (/^[A-Z]/.test(original) && (item.category === 'name of someone in the room' || item.category === 'place')) {
    return item;
  }

  const posSet = wordNetPosFor(posMap, item.norm);
  if (!posSet) return item;

  const { keep, category } = reconcileCategory(item.category, posSet, item.original || item.norm);
  if (!keep) return null;
  if (shouldDropFromPool(item.norm, category, posSet)) return null;
  if (category === item.category) return item;
  return { ...item, category };
}

/** Batch-validate swap-pool entries; drops or reclassifies mismatches. */
export function filterPoolWithDictionary(pool, posMap) {
  if (!posMap || !posMap.size) return pool;
  return pool
    .map(item => validatePoolItem(item, posMap))
    .filter(Boolean);
}
