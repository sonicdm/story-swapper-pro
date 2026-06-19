import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  loadWordPoolsFromObject,
  loadPosIndexFromObject,
  randomWordForCategory,
  randomWordsForCategories,
  lookupPosFromIndex,
  poolKeyForCategory,
  resetDictionaryCache,
  fetchPosIndexData
} from '../src/lib/dictionary.js';
import { WORD_LISTS } from '../src/lib/constants.js';

describe('dictionary (static WordNet assets)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetDictionaryCache();
    loadWordPoolsFromObject({
      noun: ['table', 'dragon', 'kitchen'],
      verb: ['jump', 'retain', 'whisper'],
      adjective: ['crimson', 'brave', 'tiny'],
      adverb: ['quickly', 'loudly']
    });
    loadPosIndexFromObject({
      seldom: ['adverb'],
      retain: ['verb'],
      table: ['noun']
    });
  });

  it('looks up POS from loaded index', () => {
    const map = lookupPosFromIndex(['seldom', 'retain'], loadPosIndexFromObject({
      seldom: ['adverb'],
      retain: ['verb']
    }));
    expect(map.get('seldom')?.has('adverb')).toBe(true);
    expect(map.get('retain')?.has('verb')).toBe(true);
  });

  it('picks curated words by category after WordNet loads', async () => {
    const noun = await randomWordForCategory('noun', () => 0);
    expect(WORD_LISTS.objects).toContain(noun);
    const verb = await randomWordForCategory('past-tense verb', () => 0.99);
    expect(WORD_LISTS.verbs).toContain(verb);
  });

  it('prefers curated words for semantic categories', async () => {
    const animal = await randomWordForCategory('animal', () => 0);
    expect(animal).toBe(WORD_LISTS.animals[0]);
    const color = await randomWordForCategory('color', () => 0);
    expect(color).toBe(WORD_LISTS.colors[0]);
    const weekday = await randomWordForCategory('day of week', () => 0);
    expect(weekday).toBe(WORD_LISTS.weekdays[0]);
  });

  it('batch-fills categories', async () => {
    const words = await randomWordsForCategories(['noun', 'adjective', 'animal'], () => 0);
    expect(words).toEqual([WORD_LISTS.objects[0], WORD_LISTS.adjectives[0], WORD_LISTS.animals[0]]);
  });

  it('maps category to pool key', () => {
    expect(poolKeyForCategory('past-tense verb')).toBe('verb');
    expect(poolKeyForCategory('color')).toBe('adjective');
    expect(poolKeyForCategory('animal')).toBe('noun');
  });

  it('treats missing WordNet assets as a core load failure', async () => {
    resetDictionaryCache();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 404 });
    await expect(randomWordsForCategories(['noun'])).rejects.toThrow(/WordNet dictionary assets are unavailable/);
  });

  it('prefers gzip pos-index when DecompressionStream is available', async () => {
    if (typeof DecompressionStream === 'undefined') return;

    resetDictionaryCache();
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const gzPath = join(root, 'public', 'pos-index.json.gz');
    if (!existsSync(gzPath)) return;

    const gzBytes = readFileSync(gzPath);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('pos-index.json.gz')) {
        return {
          ok: true,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(gzBytes);
              controller.close();
            }
          })
        };
      }
      if (u.includes('pos-index.json')) {
        throw new Error('should prefer gzip pos-index');
      }
      return { ok: false, status: 404 };
    });

    const data = await fetchPosIndexData();
    expect(Object.keys(data).length).toBeGreaterThan(1000);
  });

  it('falls back to uncompressed pos-index when gzip fetch fails', async () => {
    resetDictionaryCache();
    const posData = { table: ['noun'] };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('pos-index.json.gz')) return { ok: false, status: 404 };
      if (String(url).includes('pos-index.json')) return { ok: true, json: async () => posData };
      return { ok: false, status: 404 };
    });
    const data = await fetchPosIndexData();
    expect(data).toEqual(posData);
  });
});
