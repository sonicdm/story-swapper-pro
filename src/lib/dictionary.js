import { normalizeWordNetPos } from './dictionary-pos.js';
import { buildSwapPool } from './classify.js';
import { WORD_LISTS, NUMBER_WORDS } from './constants.js';

let posIndex = null;
let wordPools = null;
let loadPromise = null;

const REQUIRED_POOL_KEYS = ['noun', 'verb', 'adjective', 'adverb'];

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
  'day of week': 'noun',
  'silly word': 'noun'
};

const CURATED_FOR_CATEGORY = {
  noun: () => [
    ...WORD_LISTS.objects,
    ...WORD_LISTS.animals,
    ...WORD_LISTS.places,
    ...WORD_LISTS.personNouns,
    ...WORD_LISTS.foods
  ],
  adjective: () => WORD_LISTS.adjectives,
  adverb: () => WORD_LISTS.adverbs,
  verb: () => WORD_LISTS.verbs,
  'past-tense verb': () => WORD_LISTS.verbs,
  'verb ending in -ing': () => WORD_LISTS.verbs,
  animal: () => WORD_LISTS.animals,
  'body part': () => WORD_LISTS.bodyParts,
  place: () => WORD_LISTS.places,
  emotion: () => WORD_LISTS.emotions,
  sound: () => WORD_LISTS.sounds,
  object: () => WORD_LISTS.objects,
  food: () => WORD_LISTS.foods,
  job: () => WORD_LISTS.jobs,
  vehicle: () => WORD_LISTS.vehicles,
  'clothing item': () => WORD_LISTS.clothing,
  'silly word': () => WORD_LISTS.sillyWords,
  'name of someone in the room': () => WORD_LISTS.names,
  'day of week': () => WORD_LISTS.weekdays,
  color: () => WORD_LISTS.colors,
  number: () => NUMBER_WORDS,
  'plural noun': () => [...WORD_LISTS.objects, ...WORD_LISTS.animals]
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

function wordNetLoadError(reason) {
  return new Error(`WordNet dictionary assets are unavailable: ${reason}. Run npm run build:dict and serve the app over HTTP.`);
}

function validateWordPoolsObject(pools) {
  for (const key of REQUIRED_POOL_KEYS) {
    if (!Array.isArray(pools?.[key]) || pools[key].length === 0) {
      throw wordNetLoadError(`missing ${key} pool`);
    }
  }
  return pools;
}

function parsePosIndexObject(data) {
  const map = new Map();
  for (const [lemma, posList] of Object.entries(data)) {
    const set = new Set(posList.map(normalizeWordNetPos));
    if (set.size) map.set(lemma, set);
  }
  if (!map.size) {
    throw wordNetLoadError('pos-index.json is empty');
  }
  return map;
}

/** Fetch pos-index JSON, preferring gzip when the browser supports DecompressionStream. */
export async function fetchPosIndexData() {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const gzRes = await fetch(assetUrl('pos-index.json.gz'));
      if (gzRes.ok) {
        const ds = new DecompressionStream('gzip');
        const text = await new Response(gzRes.body.pipeThrough(ds)).text();
        return JSON.parse(text);
      }
    } catch (_) {
      /* fall through to uncompressed JSON */
    }
  }
  const res = await fetch(assetUrl('pos-index.json'));
  if (!res.ok) throw wordNetLoadError(`pos-index.json returned ${res.status}`);
  return res.json();
}

/** Load WordNet assets once (dev server + GitHub Pages). */
export async function loadDictionary() {
  if (posIndex && wordPools) return { posIndex, wordPools };
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const [data, poolsRes] = await Promise.all([
        fetchPosIndexData(),
        fetch(assetUrl('word-pools.json'))
      ]);
      if (!poolsRes.ok) throw wordNetLoadError(`word-pools.json returned ${poolsRes.status}`);

      posIndex = parsePosIndexObject(data);
      wordPools = validateWordPoolsObject(await poolsRes.json());
    } catch (_) {
      posIndex = null;
      wordPools = null;
      if (_ instanceof Error && _.message.startsWith('WordNet dictionary assets are unavailable')) {
        throw _;
      }
      throw wordNetLoadError(_ instanceof Error ? _.message : 'failed to load assets');
    }
    return { posIndex, wordPools };
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    throw err;
  }
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
    case 'day of week': return pickFrom(WORD_LISTS.weekdays, rng);
    case 'silly word': return pickFrom(WORD_LISTS.sillyWords, rng);
    case 'name of someone in the room': return pickFrom(WORD_LISTS.personNouns, rng);
    case 'color': return pickFrom(WORD_LISTS.colors, rng);
    case 'number': return pickFrom(NUMBER_WORDS, rng);
    case 'plural noun': return pickFrom([...WORD_LISTS.objects, ...WORD_LISTS.animals], rng);
    default: return pickFrom([...WORD_LISTS.objects, ...WORD_LISTS.animals, ...WORD_LISTS.places], rng);
  }
}

function curatedWord(category, rng) {
  const list = CURATED_FOR_CATEGORY[category]?.();
  return pickFrom(list, rng);
}

function randomPoolWord(category, pools, rng) {
  const poolKey = POOL_FOR_CATEGORY[category];
  if (!poolKey) return null;
  const pool = pools?.[poolKey];
  if (!pool?.length) {
    throw wordNetLoadError(`missing ${poolKey} pool`);
  }
  return pool[Math.floor(rng() * pool.length)];
}

/** Random word for a Mad Libs category. Requires WordNet assets to be loaded. */
export async function randomWordForCategory(category, rng = Math.random) {
  const { wordPools: pools } = await loadDictionary();
  return curatedWord(category, rng)
    || randomPoolWord(category, pools, rng)
    || fallbackWord(category, rng)
    || 'word';
}

export async function randomWordsForCategories(categories, rng = Math.random) {
  const { wordPools: pools } = await loadDictionary();
  return categories.map(cat => {
    return curatedWord(cat, rng)
      || randomPoolWord(cat, pools, rng)
      || fallbackWord(cat, rng)
      || 'word';
  });
}

/** @deprecated use loadDictionary */
export const loadPosIndex = loadDictionary;

export function loadPosIndexFromObject(obj) {
  posIndex = parsePosIndexObject(obj);
  return posIndex;
}

export function loadWordPoolsFromObject(obj) {
  wordPools = validateWordPoolsObject(obj);
  return obj;
}

export function resetDictionaryCache() {
  posIndex = null;
  wordPools = null;
  loadPromise = null;
}

export const resetPosIndexCache = resetDictionaryCache;
