import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadPosIndexFromObject, loadWordPoolsFromObject } from '../../src/lib/dictionary.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Load committed/built WordNet JSON from public/ (same files dev + GitHub Pages use). */
export function loadBuiltDictionary() {
  const posPath = join(root, 'public', 'pos-index.json');
  const poolsPath = join(root, 'public', 'word-pools.json');
  if (!existsSync(posPath) || !existsSync(poolsPath)) {
    throw new Error('Dictionary assets missing — run: npm run build:dict');
  }
  const posIndex = loadPosIndexFromObject(JSON.parse(readFileSync(posPath, 'utf8')));
  const wordPools = loadWordPoolsFromObject(JSON.parse(readFileSync(poolsPath, 'utf8')));
  return { posIndex, wordPools };
}

export function builtDictionaryAvailable() {
  return existsSync(join(root, 'public', 'pos-index.json'))
    && existsSync(join(root, 'public', 'word-pools.json'));
}
