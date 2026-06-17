import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { tokenize } from '../src/lib/text.js';
import {
  classifyTokensWithNlp, selectReplacementCandidates, buildSwapPool
} from '../src/lib/classify.js';
import {
  validatePoolItem, wordNetPosFor, filterPoolWithDictionary
} from '../src/lib/dictionary-pos.js';
import {
  randomWordForCategory,
  randomWordsForCategories,
  lookupPosFromIndex,
  poolKeyForCategory,
  resetDictionaryCache
} from '../src/lib/dictionary.js';
import { selectMixedCandidates } from '../src/lib/placeholders.js';
import { WORD_LISTS } from '../src/lib/constants.js';
import { getEngine } from './helpers/nlp-session.js';
import { analyzeTextWithDictionary, selectWithSeed } from './helpers/analyze.js';
import { builtDictionaryAvailable, loadBuiltDictionary } from './helpers/built-dictionary.mjs';

const HAS_DICT = builtDictionaryAvailable();

function assertPickPassesDictionary(pick, posIndex) {
  const item = {
    norm: pick.originalWord.toLowerCase(),
    category: pick.category,
    original: pick.originalWord,
    properNoun: pick.properNoun
  };
  const validated = validatePoolItem(item, posIndex);
  expect(validated, `"${pick.originalWord}" should pass WordNet validation as ${pick.category}`).not.toBeNull();
}

describe.skipIf(!HAS_DICT)('auto-pick (WordNet-validated candidate selection)', () => {
  let posIndex;
  let engine;

  beforeAll(async () => {
    engine = await getEngine('compromise');
  });

  beforeEach(() => {
    resetDictionaryCache();
    ({ posIndex } = loadBuiltDictionary());
  });

  it('drops function adverbs and ambiguous words from the swap pool', async () => {
    const text = 'I still retain seldom in mind. The victim stood near the river.';
    const analysis = await analyzeTextWithDictionary(text, engine);
    expect(analysis.poolByNorm.has('seldom')).toBe(false);
    expect(analysis.poolByNorm.has('still')).toBe(false);
    expect(analysis.poolByNorm.get('retain')?.category).toBe('verb');
    expect(analysis.poolByNorm.has('river')).toBe(true);
    expect(['noun', 'place']).toContain(analysis.poolByNorm.get('river')?.category);
  });

  it('seeded auto-pick excludes words rejected by the dictionary', async () => {
    const text = 'Account of the affair. I still retain in my scrap-book. There had seldom been a tragedy.';
    const analysis = await analyzeTextWithDictionary(text, engine);
    const picks = selectWithSeed(analysis, { count: 8, seed: 42, allowPartial: true });
    const picked = picks.map(p => p.originalWord.toLowerCase());
    expect(picked).not.toContain('seldom');
    expect(picked).not.toContain('still');
    for (const pick of picks) {
      assertPickPassesDictionary(pick, posIndex);
    }
  });

  it('selectMixedCandidates passes dictionaryPos through to auto extras', async () => {
    const text = 'The {noun} walked slowly. I still retain hope by the river.';
    const tokens = tokenize(text);
    const classifications = classifyTokensWithNlp(tokens, engine);
    const pool = buildSwapPool(tokens, classifications);
    const dictionaryPos = lookupPosFromIndex(pool.map(p => p.norm), posIndex);
    const picks = selectMixedCandidates(tokens, classifications, {
      revealLength: 400,
      promptSetting: '8',
      seed: 11,
      dictionaryPos
    });
    const autoPicks = picks.filter(p => !p.isPlaceholder);
    expect(autoPicks.length).toBeGreaterThan(0);
    for (const pick of autoPicks) {
      assertPickPassesDictionary(pick, posIndex);
    }
    expect(autoPicks.map(p => p.originalWord.toLowerCase())).not.toContain('still');
  });

  it('every seeded pick has WordNet POS compatible with its prompt category', async () => {
    const text = [
      'Beyond the village the road was cleared.',
      'Holes appeared where the cars had driven.',
      'Doctors hoped they would reach the river before dark.'
    ].join(' ');
    const analysis = await analyzeTextWithDictionary(text, engine);
    const picks = selectWithSeed(analysis, { count: 5, seed: 99, allowPartial: true });
    expect(picks.length).toBeGreaterThanOrEqual(4);
    for (const pick of picks) {
      assertPickPassesDictionary(pick, posIndex);
      const validated = validatePoolItem({
        norm: pick.originalWord.toLowerCase(),
        category: pick.category,
        original: pick.originalWord
      }, posIndex);
      if (wordNetPosFor(posIndex, pick.originalWord)) {
        expect(validated?.category).toBe(pick.category);
      }
    }
  });

  it('dictionary filter removes marginal words from the raw swap pool', async () => {
    const text = 'I still retain seldom by the river.';
    const tokens = tokenize(text);
    const classifications = classifyTokensWithNlp(tokens, engine);
    const rawPool = buildSwapPool(tokens, classifications);
    const dictionaryPos = lookupPosFromIndex(rawPool.map(p => p.norm), posIndex);
    const filtered = filterPoolWithDictionary(rawPool, dictionaryPos);
    expect(rawPool.some(p => p.norm === 'seldom')).toBe(true);
    expect(filtered.some(p => p.norm === 'seldom')).toBe(false);
    expect(filtered.some(p => p.norm === 'still')).toBe(false);
    expect(filtered.some(p => p.norm === 'river')).toBe(true);
  });

  it('classifies capitalized names as person-in-room prompts', async () => {
    const text = 'Henry walked from London to Paris. Chion waved at Mary.';
    const analysis = await analyzeTextWithDictionary(text, engine);
    expect(analysis.poolByText.get('Henry')?.category).toBe('name of someone in the room');
    expect(analysis.poolByText.get('Mary')?.category).toBe('name of someone in the room');
    expect(analysis.poolByText.get('London')?.category).toBe('place');
    expect(analysis.poolByText.get('Paris')?.category).toBe('place');
  });
});

describe.skipIf(!HAS_DICT)('surprise me (curated random fill with required WordNet)', () => {
  let wordPools;

  beforeEach(() => {
    resetDictionaryCache();
    ({ wordPools } = loadBuiltDictionary());
  });

  it('picks curated nouns for noun prompts', async () => {
    const word = await randomWordForCategory('noun', () => 0);
    expect(WORD_LISTS.objects).toContain(word);
  });

  it('picks curated verbs for verb-form prompts', async () => {
    for (const cat of ['verb', 'past-tense verb', 'verb ending in -ing']) {
      const word = await randomWordForCategory(cat, () => 0);
      expect(WORD_LISTS.verbs, `${cat} should draw from curated verbs`).toContain(word);
    }
  });

  it('keeps WordNet pool mapping available for category POS groups', () => {
    const cases = [
      ['animal', 'noun'],
      ['place', 'noun'],
      ['object', 'noun'],
      ['color', 'adjective'],
      ['adjective', 'adjective']
    ];
    for (const [category, poolKey] of cases) {
      expect(poolKeyForCategory(category), `${category} → ${poolKey}`).toBe(poolKey);
    }
  });

  it('prefers curated words for semantic prompts', async () => {
    const cases = [
      ['animal', WORD_LISTS.animals],
      ['place', WORD_LISTS.places],
      ['object', WORD_LISTS.objects],
      ['food', WORD_LISTS.foods],
      ['color', WORD_LISTS.colors],
      ['day of week', WORD_LISTS.weekdays]
    ];
    for (const [category, list] of cases) {
      const word = await randomWordForCategory(category, () => 0);
      expect(word, category).toBe(list[0]);
    }
  });

  it('batch fill returns one pool word per category', async () => {
    const categories = ['noun', 'verb', 'adjective', 'animal', 'color'];
    const words = await randomWordsForCategories(categories, () => 0);
    expect(words).toHaveLength(categories.length);
    expect(words[0]).toBe(WORD_LISTS.objects[0]);
    expect(words[1]).toBe(WORD_LISTS.verbs[0]);
    expect(words[2]).toBe(WORD_LISTS.adjectives[0]);
    expect(words[3]).toBe(WORD_LISTS.animals[0]);
    expect(words[4]).toBe(WORD_LISTS.colors[0]);
  });

  it('deterministic rng picks stable words from built pools', async () => {
    const a = await randomWordsForCategories(['noun', 'verb'], () => 0);
    const b = await randomWordsForCategories(['noun', 'verb'], () => 0);
    expect(a).toEqual(b);
    expect(a[0]).toBe(WORD_LISTS.objects[0]);
    expect(a[1]).toBe(WORD_LISTS.verbs[0]);
  });
});

describe('auto-choice (unit, no built assets required)', () => {
  beforeEach(() => resetDictionaryCache());

  it('validates pick categories against an in-memory POS map', () => {
    const posIndex = new Map([
      ['river', new Set(['noun'])],
      ['hoped', new Set(['verb'])],
      ['still', new Set(['noun', 'verb', 'adjective', 'adverb'])]
    ]);
    assertPickPassesDictionary(
      { originalWord: 'river', category: 'noun' },
      posIndex
    );
    assertPickPassesDictionary(
      { originalWord: 'hoped', category: 'verb' },
      posIndex
    );
    const still = validatePoolItem(
      { norm: 'still', category: 'adjective', original: 'still' },
      posIndex
    );
    expect(still).toBeNull();
  });
});
