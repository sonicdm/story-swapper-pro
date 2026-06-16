import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/lib/text.js';
import {
  classifyTokensHeuristic, classifyTokensWithNlp, pickCategory, buildSwapPool
} from '../src/lib/classify.js';
import { isKnownColor, isColorWord } from '../src/lib/grammar.js';
import { getCompromiseEngine } from './helpers/nlp-session.js';
import { analyzeText, wordReport } from './helpers/analyze.js';
import { assertWordSpec } from './helpers/assert-word.js';

describe('color grammar helpers', () => {
  it('knows color vocabulary', () => {
    expect(isKnownColor('crimson')).toBe(true);
    expect(isKnownColor('teal')).toBe(true);
    expect(isKnownColor('tiny')).toBe(false);
    expect(isKnownColor('happy')).toBe(false);
  });

  it('treats color words as color slots, not generic adjectives', () => {
    expect(isColorWord('green', 'a', 'door')).toBe(true);
    expect(isColorWord('crimson', 'of', 'silk')).toBe(true);
    expect(isColorWord('blue', 'deep', '')).toBe(true);
    expect(isColorWord('tiny', 'a', 'door')).toBe(false);
  });
});

describe('color auto-classification (heuristic)', () => {
  const text = 'A tiny green door and a violet sky with silver thread.';
  const tokens = tokenize(text);
  const cls = classifyTokensHeuristic(tokens);

  it('classifies green as color', () => {
    assertWordSpec({ tokens, wordTokens: tokens.filter(t => t.type === 'word'), classifications: cls, pool: buildSwapPool(tokens, cls), poolByNorm: new Map(), poolByText: new Map(), text, engineName: 'heuristic' },
      'green', { pickCategory: 'color', categoriesInclude: ['color'] });
  });

  it('classifies violet and silver as color', () => {
    for (const word of ['violet', 'silver']) {
      const tok = tokens.filter(t => t.type === 'word').find(t => t.norm === word);
      const c = cls.get(tok.index);
      expect(c.categories, word).toContain('color');
      expect(pickCategory(c.categories, tok)).toBe('color');
    }
  });

  it('keeps tiny as adjective, not color', () => {
    const tok = tokens.filter(t => t.type === 'word').find(t => t.norm === 'tiny');
    const c = cls.get(tok.index);
    expect(c.categories).not.toContain('color');
    expect(pickCategory(c.categories, tok)).toBe('adjective');
  });
});

describe('color auto-classification (NLP)', () => {
  it('prefers color over adjective for known hues', async () => {
    const engine = await getCompromiseEngine();
    const text = 'Her cape was bright purple. The crimson sun set over a golden field.';
    const analysis = analyzeText(text, engine);

    assertWordSpec(analysis, 'purple', {
      pickCategory: 'color',
      categoriesInclude: ['color']
    });
    assertWordSpec(analysis, 'crimson', {
      pickCategory: 'color',
      categoriesInclude: ['color']
    });
    assertWordSpec(analysis, 'golden', {
      pickCategory: 'color',
      categoriesInclude: ['color']
    });
    assertWordSpec(analysis, 'bright', {
      pickCategory: 'adjective',
      categoriesExclude: ['color']
    });
  });

  it('assigns color category in swap pool', async () => {
    const engine = await getCompromiseEngine();
    const text = 'The hero wore a scarlet cape. The night sky was deep indigo.';
    const analysis = analyzeText(text, engine);
    const scarlet = wordReport(analysis, 'scarlet');
    expect(scarlet.pickCategory).toBe('color');
    if (scarlet.eligible) {
      expect(scarlet.poolCategory).toBe('color');
    }
  });
});

describe('color vs tagged placeholders', () => {
  it('does not double-count {color} blanks as NLP color words', () => {
    const text = 'Preferred cape color: {color}. The green door creaked.';
    const tokens = tokenize(text);
    const blanks = tokens.filter(t => t.type === 'blank');
    expect(blanks[0].blankCategory).toBe('color');

    const cls = classifyTokensHeuristic(tokens);
    const green = tokens.filter(t => t.type === 'word').find(t => t.norm === 'green');
    expect(pickCategory(cls.get(green.index).categories, green)).toBe('color');
  });
});
