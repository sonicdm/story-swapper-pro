import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadWordPoolsFromObject,
  loadPosIndexFromObject,
  randomWordForCategory,
  randomWordsForCategories,
  lookupPosFromIndex,
  poolKeyForCategory,
  resetDictionaryCache
} from '../src/lib/dictionary.js';

describe('dictionary (static WordNet assets)', () => {
  beforeEach(() => {
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

  it('picks WordNet pool words by category', async () => {
    const noun = await randomWordForCategory('noun', () => 0);
    expect(['table', 'dragon', 'kitchen']).toContain(noun);
    const verb = await randomWordForCategory('past-tense verb', () => 0.99);
    expect(['jump', 'retain', 'whisper']).toContain(verb);
  });

  it('batch-fills categories', async () => {
    const words = await randomWordsForCategories(['noun', 'adjective'], () => 0);
    expect(words).toEqual(['table', 'crimson']);
  });

  it('maps category to pool key', () => {
    expect(poolKeyForCategory('past-tense verb')).toBe('verb');
    expect(poolKeyForCategory('color')).toBe('adjective');
    expect(poolKeyForCategory('animal')).toBe('noun');
  });
});
