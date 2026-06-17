import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/lib/text.js';
import {
  classifyTokensHeuristic, pickCategory, buildSwapPool
} from '../src/lib/classify.js';
import {
  resolvePlaceholderCategory, selectPlaceholderCandidates
} from '../src/lib/placeholders.js';
import { CATEGORY_LABELS, CATEGORY_HINTS, CATEGORY_WEIGHTS } from '../src/lib/constants.js';
import { getCompromiseEngine } from './helpers/nlp-session.js';
import { analyzeText } from './helpers/analyze.js';
import { assertWordSpec } from './helpers/assert-word.js';

const RECOMMENDED_CATEGORIES = [
  'adjective', 'verb', 'past-tense verb', 'verb ending in -ing', 'noun', 'plural noun',
  'name of someone in the room', 'place', 'animal', 'body part', 'object', 'food',
  'color', 'emotion', 'sound', 'number', 'job', 'vehicle', 'clothing item', 'silly word',
  'day of week'
];

describe('Mad Libs category catalog', () => {
  it('defines labels, hints, and weights for recommended categories', () => {
    for (const cat of RECOMMENDED_CATEGORIES) {
      expect(CATEGORY_LABELS[cat], `label for ${cat}`).toBeTruthy();
      expect(CATEGORY_HINTS[cat], `hint for ${cat}`).toBeTruthy();
      expect(CATEGORY_WEIGHTS[cat], `weight for ${cat}`).toBeGreaterThan(0);
    }
  });

  it('resolves new template tag aliases', () => {
    expect(resolvePlaceholderCategory('food')).toBe('food');
    expect(resolvePlaceholderCategory('job')).toBe('job');
    expect(resolvePlaceholderCategory('vehicle')).toBe('vehicle');
    expect(resolvePlaceholderCategory('clothing item')).toBe('clothing item');
    expect(resolvePlaceholderCategory('silly word')).toBe('silly word');
    expect(resolvePlaceholderCategory('verb ending in -ing')).toBe('verb ending in -ing');
    expect(resolvePlaceholderCategory('gerund')).toBe('verb ending in -ing');
    expect(resolvePlaceholderCategory('adverb')).toBe('adverb');
    expect(resolvePlaceholderCategory('day of the week')).toBe('day of week');
  });

  it('builds template candidates for extended tags', () => {
    const text = 'The {food} drove a {vehicle} in a {color} {clothing item}.';
    const picks = selectPlaceholderCandidates(tokenize(text));
    expect(picks.map(p => p.category)).toEqual(['food', 'vehicle', 'color', 'clothing item']);
  });
});

describe('wildcard prompt remapping', () => {
  it('prefers semantic prompts over grammar labels (heuristic)', () => {
    const text = 'The man opened a red box and yelled about pizza.';
    const tokens = tokenize(text);
    const cls = classifyTokensHeuristic(tokens);
    const words = tokens.filter(t => t.type === 'word');

    const cases = [
      ['man', 'name of someone in the room'],
      ['red', 'color'],
      ['box', 'object'],
      ['yelled', 'sound'],
      ['pizza', 'food']
    ];
    for (const [word, expected] of cases) {
      const tok = words.find(t => t.norm === word);
      expect(pickCategory(cls.get(tok.index).categories, tok)).toBe(expected);
    }
  });

  it('remaps via NLP path', async () => {
    const engine = await getCompromiseEngine();
    const text = 'The doctor wore a hat and drove a car. She was running.';
    const analysis = analyzeText(text, engine);

    assertWordSpec(analysis, 'doctor', { pickCategory: 'job' });
    assertWordSpec(analysis, 'hat', { pickCategory: 'clothing item' });
    assertWordSpec(analysis, 'car', { pickCategory: 'vehicle' });
    assertWordSpec(analysis, 'running', { pickCategory: 'verb ending in -ing' });
  });

  it('includes wildcard picks in swap pool with fun labels', () => {
    const text = 'The stranger ate pizza near a red car.';
    const tokens = tokenize(text);
    const cls = classifyTokensHeuristic(tokens);
    const pool = buildSwapPool(tokens, cls);
    const pizza = pool.find(p => p.norm === 'pizza');
    expect(pizza?.category).toBe('food');
    const car = pool.find(p => p.norm === 'car');
    expect(car?.category).toBe('vehicle');
  });

  it('classifies weekdays and skips reporting verbs in the swap pool', () => {
    const text = 'One rainy Tuesday, Clara said, and vanished around the corner.';
    const tokens = tokenize(text);
    const cls = classifyTokensHeuristic(tokens);
    const pool = buildSwapPool(tokens, cls);
    expect(pool.find(p => p.norm === 'one')?.category).toBe('number');
    expect(pool.find(p => p.norm === 'tuesday')?.category).toBe('day of week');
    expect(pool.some(p => p.norm === 'said')).toBe(false);
  });

  it('keeps dense auto-swap grammar picks sane', () => {
    const text = 'She could hear whispers from behind a brass door that listens. The whispers spoke of cinnamon storms, rivers of honey, and wrapped itself around her shoulders.';
    const tokens = tokenize(text);
    const cls = classifyTokensHeuristic(tokens);
    const pool = buildSwapPool(tokens, cls);

    expect(pool.find(p => p.norm === 'itself')).toBeUndefined();
    expect(pool.find(p => p.norm === 'brass')?.category).toBe('color');
    expect(pool.find(p => p.norm === 'listens')?.category).toBe('verb');
    expect(pool.filter(p => p.norm === 'whispers').every(p => p.category === 'plural noun')).toBe(true);
    expect(pool.find(p => p.norm === 'storms')?.category).toBe('plural noun');
  });
});
