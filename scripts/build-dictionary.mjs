#!/usr/bin/env node
/**
 * Build static WordNet assets for browser + GitHub Pages (same files for dev and deploy).
 * Output: public/pos-index.json, public/word-pools.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { gzipSync } from 'zlib';
import { STOP_WORDS, MODALS, VERB_FALSE } from '../src/lib/constants.js';

const POS_MAP = { n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbDir = join(root, 'node_modules', 'en-wordnet', 'database', '3.0');
const outDir = join(root, 'public');

function taggedSenseCount(parts) {
  const pointerCount = Number(parts[3] || 0);
  const tagIndex = 5 + pointerCount;
  const count = Number(parts[tagIndex] || 0);
  return Number.isFinite(count) ? count : 0;
}

function isPoolLemma(lemma, posName, tagCount) {
  if (lemma.length < 3 || lemma.length > 14) return false;
  if (!/^[a-z]+$/.test(lemma)) return false;
  if (tagCount < 1) return false;
  if (STOP_WORDS.has(lemma)) return false;
  if (posName === 'verb' && (MODALS.has(lemma) || VERB_FALSE.has(lemma))) return false;
  return true;
}

function parseIndexFile(path, posChar) {
  const posName = POS_MAP[posChar];
  const text = readFileSync(path, 'utf8');
  const posMap = new Map();
  const pool = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith(' ')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const lemma = parts[0].replace(/_/g, ' ').toLowerCase();
    if (!lemma || !/^[a-z0-9'-]+$/i.test(lemma)) continue;
    if (!posMap.has(lemma)) posMap.set(lemma, new Set());
    posMap.get(lemma).add(posName);
    if (isPoolLemma(lemma, posName, taggedSenseCount(parts))) pool.push(lemma);
  }
  return { posMap, pool };
}

function mergePosMaps(maps) {
  const merged = new Map();
  for (const m of maps) {
    for (const [lemma, posSet] of m) {
      if (!merged.has(lemma)) merged.set(lemma, new Set());
      for (const p of posSet) merged.get(lemma).add(p);
    }
  }
  return merged;
}

const files = [
  ['index.noun', 'n'],
  ['index.verb', 'v'],
  ['index.adj', 'a'],
  ['index.adv', 'r']
];

const parsed = files.map(([file, pos]) => parseIndexFile(join(dbDir, file), pos));
const merged = mergePosMaps(parsed.map(p => p.posMap));

/** @type {Record<string, string[]>} */
const index = {};
for (const [lemma, posSet] of merged) {
  index[lemma] = [...posSet].sort();
}

const wordPools = {
  noun: parsed[0].pool,
  verb: parsed[1].pool,
  adjective: parsed[2].pool,
  adverb: parsed[3].pool
};

mkdirSync(outDir, { recursive: true });

const indexJson = JSON.stringify(index);
writeFileSync(join(outDir, 'pos-index.json'), indexJson);
writeFileSync(join(outDir, 'pos-index.json.gz'), gzipSync(indexJson));

const poolsJson = JSON.stringify(wordPools);
writeFileSync(join(outDir, 'word-pools.json'), poolsJson);

const idxMb = (Buffer.byteLength(indexJson) / 1024 / 1024).toFixed(2);
const poolMb = (Buffer.byteLength(poolsJson) / 1024 / 1024).toFixed(2);
console.log(`pos-index: ${Object.keys(index).length} lemmas, ${idxMb} MB`);
console.log(
  `word-pools: noun=${wordPools.noun.length} verb=${wordPools.verb.length} `
  + `adj=${wordPools.adjective.length} adv=${wordPools.adverb.length}, ${poolMb} MB`
);
