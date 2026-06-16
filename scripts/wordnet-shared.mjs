import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { STOP_WORDS, MODALS, VERB_FALSE } from '../src/lib/constants.js';

const POS_MAP = { n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb' };

export function wordnetDatabaseDir(root) {
  return join(root, 'node_modules', 'en-wordnet', 'database', '3.0');
}

export function parseIndexFile(path, posChar) {
  const posName = POS_MAP[posChar];
  const text = readFileSync(path, 'utf8');
  const map = new Map();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith(' ')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const lemma = parts[0].replace(/_/g, ' ').toLowerCase();
    if (!lemma || !/^[a-z0-9'-]+$/i.test(lemma)) continue;
    if (!map.has(lemma)) map.set(lemma, new Set());
    map.get(lemma).add(posName);
  }
  return map;
}

export function mergePosMaps(maps) {
  const merged = new Map();
  for (const m of maps) {
    for (const [lemma, posSet] of m) {
      if (!merged.has(lemma)) merged.set(lemma, new Set());
      for (const p of posSet) merged.get(lemma).add(p);
    }
  }
  return merged;
}

export function isSwapWorthyLemma(lemma, posName) {
  if (!lemma || lemma.length < 3 || lemma.length > 14) return false;
  if (!/^[a-z]+$/.test(lemma)) return false;
  if (STOP_WORDS.has(lemma)) return false;
  if (posName === 'verb' && (MODALS.has(lemma) || VERB_FALSE.has(lemma))) return false;
  return true;
}

/** Lemma → sorted POS list (for pos-index.json). */
export function buildPosIndexObject(merged) {
  const index = {};
  for (const [lemma, posSet] of merged) {
    index[lemma] = [...posSet].sort();
  }
  return index;
}

/** POS → lemma arrays (for word-pools.json / server random picks). */
export function buildWordPoolsObject(merged, perPosMaps) {
  const pools = { noun: [], verb: [], adjective: [], adverb: [] };
  const seen = { noun: new Set(), verb: new Set(), adjective: new Set(), adverb: new Set() };

  for (const [posName, posMap] of Object.entries(perPosMaps)) {
    for (const lemma of posMap.keys()) {
      if (!isSwapWorthyLemma(lemma, posName)) continue;
      if (seen[posName].has(lemma)) continue;
      seen[posName].add(lemma);
      pools[posName].push(lemma);
    }
  }

  for (const key of Object.keys(pools)) {
    pools[key].sort();
  }
  return pools;
}

export function loadWordnetData(root = join(dirname(fileURLToPath(import.meta.url)), '..')) {
  const dbDir = wordnetDatabaseDir(root);
  const files = [
    ['index.noun', 'n', 'noun'],
    ['index.verb', 'v', 'verb'],
    ['index.adj', 'a', 'adjective'],
    ['index.adv', 'r', 'adverb']
  ];
  const perPosMaps = {};
  const maps = files.map(([file, posChar, posName]) => {
    const m = parseIndexFile(join(dbDir, file), posChar);
    perPosMaps[posName] = m;
    return m;
  });
  const merged = mergePosMaps(maps);
  return {
    merged,
    perPosMaps,
    posIndex: buildPosIndexObject(merged),
    wordPools: buildWordPoolsObject(merged, perPosMaps)
  };
}
