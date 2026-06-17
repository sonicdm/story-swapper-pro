import { describe, it, expect } from 'vitest';
import {
  categoryMatchesWordNet, reconcileCategory, validatePoolItem, filterPoolWithDictionary
} from '../src/lib/dictionary-pos.js';
import { lookupPosBatch } from './helpers/dictionary.mjs';

describe('dictionary-pos (pure)', () => {
  it('matches adverb and rejects noun assignment for seldom', () => {
    const pos = new Set(['adverb']);
    expect(categoryMatchesWordNet('adverb', pos)).toBe(true);
    expect(categoryMatchesWordNet('noun', pos)).toBe(false);
    expect(reconcileCategory('noun', pos, 'seldom')).toEqual({ keep: true, category: 'adverb' });
  });

  it('rejects noun assignment for retain', () => {
    const pos = new Set(['verb']);
    expect(categoryMatchesWordNet('noun', pos, 'retain')).toBe(false);
    expect(reconcileCategory('noun', pos, 'retain')).toEqual({ keep: true, category: 'verb' });
  });

  it('fixes verb ending in -ing on non-ing imperative bring', () => {
    const pos = new Set(['verb']);
    expect(categoryMatchesWordNet('verb ending in -ing', pos, 'bring')).toBe(false);
    expect(reconcileCategory('verb ending in -ing', pos, 'bring')).toEqual({ keep: true, category: 'verb' });
  });

  it('keeps contextual past-tense verbs even when WordNet lists the inflected form as adjective', () => {
    const pos = new Set(['adjective']);
    expect(reconcileCategory('past-tense verb', pos, 'vanished')).toEqual({ keep: true, category: 'past-tense verb' });
  });
});

describe('en-dictionary integration', () => {
  it('looks up POS for misclassified words', async () => {
    const posMap = await lookupPosBatch(['seldom', 'retain', 'bring', 'victim', 'stayed']);
    expect(posMap.get('seldom')?.has('adverb')).toBe(true);
    expect(posMap.get('retain')?.has('verb')).toBe(true);
    expect(posMap.get('bring')?.has('verb')).toBe(true);
    expect(posMap.get('victim')?.has('noun')).toBe(true);
  });

  it('drops or reclassifies bad pool entries', async () => {
    const posMap = await lookupPosBatch(['seldom', 'retain', 'bring']);
    const pool = [
      { norm: 'seldom', category: 'noun', original: 'seldom' },
      { norm: 'retain', category: 'noun', original: 'retain' },
      { norm: 'bring', category: 'verb ending in -ing', original: 'bring' }
    ];
    const filtered = filterPoolWithDictionary(pool, posMap);
    expect(filtered.map(p => [p.norm, p.category])).toEqual([
      ['retain', 'verb'],
      ['bring', 'verb']
    ]);
  });

  it('drops function adverbs after reclassification', async () => {
    const posMap = await lookupPosBatch(['seldom']);
    const pool = [{ norm: 'seldom', category: 'noun', original: 'seldom' }];
    expect(filterPoolWithDictionary(pool, posMap)).toEqual([]);
  });

  it('drops ambiguous multi-POS words like still', async () => {
    const posMap = await lookupPosBatch(['still']);
    expect(posMap.get('still')?.size).toBeGreaterThan(1);
    const pool = [{ norm: 'still', category: 'adjective', original: 'still' }];
    expect(filterPoolWithDictionary(pool, posMap)).toEqual([]);
  });

  it('keeps unknown words not in WordNet', async () => {
    const posMap = await lookupPosBatch(['xyzzy']);
    expect(validatePoolItem({ norm: 'xyzzy', category: 'noun', original: 'xyzzy' }, posMap))
      .toEqual({ norm: 'xyzzy', category: 'noun', original: 'xyzzy' });
  });
});
