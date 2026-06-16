import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Dictionary from 'en-dictionary';
import { normalizeWordNetPos } from '../../src/lib/dictionary-pos.js';
import { loadPosIndexFromObject, lookupPosFromIndex } from '../../src/lib/dictionary.js';

let dictPromise = null;
let builtIndexMap = null;

function wordnetDatabasePath() {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', '..', 'node_modules', 'en-wordnet', 'database', '3.0');
}

function getBuiltPosIndex() {
  if (builtIndexMap) return builtIndexMap;
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const jsonPath = join(root, 'public', 'pos-index.json');
  if (!existsSync(jsonPath)) return null;
  const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
  builtIndexMap = loadPosIndexFromObject(data);
  return builtIndexMap;
}

/** Lazy singleton — ~0.5s first call, then cached. */
export async function getDictionary() {
  if (!dictPromise) {
    dictPromise = (async () => {
      const dictionary = new Dictionary(wordnetDatabasePath());
      await dictionary.init();
      return dictionary;
    })();
  }
  return dictPromise;
}

/**
 * Batch POS lookup via en-dictionary searchSimpleFor.
 * @returns {Promise<Map<string, Set<string>>>} lemma → POS set
 */
export async function lookupPosBatch(lemmas) {
  const unique = [...new Set(lemmas.map(w => w.toLowerCase()).filter(Boolean))];
  if (!unique.length) return new Map();

  const dictionary = await getDictionary();
  const result = dictionary.searchSimpleFor(unique);
  const posMap = new Map();

  for (const lemma of unique) {
    const entry = result.get(lemma);
    if (!entry) continue;
    const posSet = new Set();
    for (const pos of entry.keys()) {
      posSet.add(normalizeWordNetPos(pos));
    }
    if (posSet.size) posMap.set(lemma, posSet);
  }

  return posMap;
}

/** Prefer static pos-index (same as browser); fall back to en-dictionary. */
export async function lookupPosForPool(pool) {
  const index = getBuiltPosIndex();
  if (index?.size) {
    return lookupPosFromIndex(pool.map(item => item.norm), index);
  }
  return lookupPosBatch(pool.map(item => item.norm));
}
