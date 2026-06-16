import { normalizeWordNetPos } from './dictionary-pos.js';
import { buildSwapPool } from './classify.js';
import { WORD_LISTS } from './constants.js';

let posIndex = null;
let wordPools = null;
let loadPromise = null;

const NUMBER_WORDS = ['three', 'seven', 'twelve', 'forty', 'a hundred', 'a thousand', 'zero', 'nine', 'sixteen', 'a dozen'];

const POOL_FOR_CATEGORY = {
  noun: 'noun',
  'plural noun': 'noun',
  verb: 'verb',
  'past-tense verb': 'verb',
  'verb ending in -ing': 'verb',
  adjective: 'adjective',
  adverb: 'adverb',
  color: 'adjective',
  animal: 'noun',
  'body part': 'noun',
  place: 'noun',
  emotion: 'noun',
  sound: 'noun',
  object: 'noun',
  food: 'noun',
  job: 'noun',
  vehicle: 'noun',
  'clothing item': 'noun',
  'silly word': 'noun'
};

/** Which WordNet pool backs a Mad Libs category (for tests). */
export function poolKeyForCategory(category) {
  return POOL_FOR_CATEGORY[category] || 'noun';
}

function assetUrl(filename) {
  const prefix = (typeof import.meta.env !== 'undefined' ? import.meta.env.BASE_URL : '/') || '/';
  const base = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return `${base}${filename}`;
}

/** Load WordNet assets once (dev server + GitHub Pages). */
export async function loadDictionary() {
  if (posIndex && wordPools) return { posIndex, wordPools };
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const emptyPools = { noun: [], verb: [], adjective: [], adverb: [] };
    const map = new Map();
    try {
      const [posRes, poolsRes] = await Promise.all([
        fetch(assetUrl('pos-index.json')),
        fetch(assetUrl('word-pools.json'))
      ]);
      if (posRes.ok) {
        const data = await posRes.json();
        for (const [lemma, posList] of Object.entries(data)) {
          const set = new Set(posList.map(normalizeWordNetPos));
          if (set.size) map.set(lemma, set);
        }
      }
      if (poolsRes.ok) {
        wordPools = await poolsRes.json();
      } else {
        wordPools = emptyPools;
      }
      posIndex = map;
    } catch (_) {
      posIndex = map;
      wordPools = emptyPools;
    }
    return { posIndex, wordPools };
  })();

  return loadPromise;
}

export function lookupPosFromIndex(lemmas, posIndexMap) {
  const result = new Map();
  if (!posIndexMap?.size) return result;
  for (const raw of lemmas) {
    const lemma = raw.toLowerCase();
    const pos = posIndexMap.get(lemma);
    if (pos?.size) result.set(lemma, new Set(pos));
  }
  return result;
}

export async function lookupPosForPool(tokens, classifications) {
  const { posIndex: idx } = await loadDictionary();
  if (!idx?.size) return null;
  const pool = buildSwapPool(tokens, classifications);
  return lookupPosFromIndex(pool.map(p => p.norm), idx);
}

function pickFrom(arr, rng = Math.random) {
  if (!arr?.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

function fallbackWord(category, rng) {
  switch (category) {
    case 'adjective': return pickFrom(WORD_LISTS.adjectives, rng);
    case 'adverb': return pickFrom(WORD_LISTS.adverbs, rng);
    case 'verb':
    case 'past-tense verb':
    case 'verb ending in -ing': return pickFrom(WORD_LISTS.verbs, rng);
    case 'animal': return pickFrom(WORD_LISTS.animals, rng);
    case 'body part': return pickFrom(WORD_LISTS.bodyParts, rng);
    case 'place': return pickFrom(WORD_LISTS.places, rng);
    case 'emotion': return pickFrom(WORD_LISTS.emotions, rng);
    case 'sound': return pickFrom(WORD_LISTS.sounds, rng);
    case 'object': return pickFrom(WORD_LISTS.objects, rng);
    case 'food': return pickFrom(WORD_LISTS.foods, rng);
    case 'job': return pickFrom(WORD_LISTS.jobs, rng);
    case 'vehicle': return pickFrom(WORD_LISTS.vehicles, rng);
    case 'clothing item': return pickFrom(WORD_LISTS.clothing, rng);
    case 'silly word': return pickFrom(WORD_LISTS.sillyWords, rng);
    case 'name of someone in the room': return pickFrom(WORD_LISTS.personNouns, rng);
    case 'color': return pickFrom(WORD_LISTS.colors, rng);
    case 'number': return pickFrom(NUMBER_WORDS, rng);
    case 'plural noun': return pickFrom([...WORD_LISTS.objects, ...WORD_LISTS.animals], rng);
    default: return pickFrom([...WORD_LISTS.objects, ...WORD_LISTS.animals, ...WORD_LISTS.places], rng);
  }
}

/** Random WordNet word for a Mad Libs category (Surprise me). */
export async function randomWordForCategory(category, rng = Math.random) {
  const { wordPools: pools } = await loadDictionary();
  const poolKey = POOL_FOR_CATEGORY[category];
  if (poolKey && pools?.[poolKey]?.length) {
    return pools[poolKey][Math.floor(rng() * pools[poolKey].length)];
  }
  return fallbackWord(category, rng) || 'word';
}

export async function randomWordsForCategories(categories, rng = Math.random) {
  const { wordPools: pools } = await loadDictionary();
  return categories.map(cat => {
    const poolKey = POOL_FOR_CATEGORY[cat];
    if (poolKey && pools?.[poolKey]?.length) {
      const pool = pools[poolKey];
      return pool[Math.floor(rng() * pool.length)];
    }
    return fallbackWord(cat, rng) || 'word';
  });
}

/** @deprecated use loadDictionary */
export const loadPosIndex = loadDictionary;

export function loadPosIndexFromObject(obj) {
  const map = new Map();
  for (const [lemma, posList] of Object.entries(obj)) {
    map.set(lemma, new Set(posList.map(normalizeWordNetPos)));
  }
  posIndex = map;
  return map;
}

export function loadWordPoolsFromObject(obj) {
  wordPools = obj;
  return obj;
}

export function resetDictionaryCache() {
  posIndex = null;
  wordPools = null;
  loadPromise = null;
}

export const resetPosIndexCache = resetDictionaryCache;
