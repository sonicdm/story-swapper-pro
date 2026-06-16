import { describe, it, expect, beforeEach } from 'vitest';
import { tokenize } from '../src/lib/text.js';
import {
  applyReplacement, buildFinalStory, fixArticle, startsWithVowelSound
} from '../src/lib/game.js';
import { classifyTokensHeuristic, selectReplacementCandidates } from '../src/lib/classify.js';
import { selectMixedCandidates } from '../src/lib/placeholders.js';
import { appState } from '../src/lib/state.js';

function prompt(tokenIndex, category, extra = {}) {
  return {
    tokenIndex,
    originalWord: extra.originalWord ?? 'word',
    category,
    label: category,
    preservePlural: false,
    preservePossessive: false,
    ...extra
  };
}

describe('article correction (a/an)', () => {
  it('detects vowel-sound words', () => {
    expect(startsWithVowelSound('apple')).toBe(true);
    expect(startsWithVowelSound('hour')).toBe(true);
    expect(startsWithVowelSound('unicorn')).toBe(false);
    expect(startsWithVowelSound('European')).toBe(false);
  });

  it('fixes articles before swaps', () => {
    expect(fixArticle('a', 'apple')).toBe('an');
    expect(fixArticle('an', 'dog')).toBe('a');
    expect(fixArticle('A', 'elephant')).toBe('An');
    expect(fixArticle('AN', 'cat')).toBe('A');
    expect(fixArticle('THE', 'apple')).toBe('AN');
  });
});

describe('buildFinalStory', () => {
  beforeEach(() => {
    appState.finalHtml = '';
    appState.finalPlainText = '';
  });

  it('swaps words and fixes a → an before vowel sounds', () => {
    const text = 'The wizard picked up a red hat.';
    const tokens = tokenize(text);
    const red = tokens.find(t => t.norm === 'red');
    const hat = tokens.find(t => t.norm === 'hat');
    const { plain, html } = buildFinalStory(tokens, [
      prompt(red.index, 'color', { originalWord: 'red' }),
      prompt(hat.index, 'object', { originalWord: 'hat' })
    ], ['orange', 'egg']);

    expect(plain).toContain('an orange');
    expect(plain).toContain('egg');
    expect(plain).not.toContain('a orange');
    expect(html).toContain('<mark class="swap"');
  });

  it('preserves whitespace and punctuation around swaps', () => {
    const text = 'Hello, world!';
    const tokens = tokenize(text);
    const world = tokens.find(t => t.norm === 'world');
    const { plain } = buildFinalStory(tokens, [
      prompt(world.index, 'noun', { originalWord: 'world' })
    ], ['universe']);
    expect(plain).toBe('Hello, universe!');
  });

  it('handles template blanks with grammar fitting', () => {
    const text = 'She was {verb ending in -ing} loudly.';
    const tokens = tokenize(text);
    const blank = tokens.find(t => t.type === 'blank');
    const { plain } = buildFinalStory(tokens, [
      prompt(blank.index, 'verb ending in -ing', {
        originalWord: '{verb ending in -ing}',
        isPlaceholder: true,
        label: 'verb ending in -ing'
      })
    ], ['dance']);
    expect(plain).toContain('dancing');
  });

  it('escapes HTML in player answers', () => {
    const text = 'The cat sat.';
    const tokens = tokenize(text);
    const cat = tokens.find(t => t.norm === 'cat');
    const { html, plain } = buildFinalStory(tokens, [
      prompt(cat.index, 'animal', { originalWord: 'cat' })
    ], ['<script>alert(1)</script>']);
    expect(plain).toContain('<script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('tolerates missing replacement entries without crashing', () => {
    const text = 'One two three.';
    const tokens = tokenize(text);
    const two = tokens.find(t => t.norm === 'two');
    const { plain } = buildFinalStory(tokens, [
      prompt(two.index, 'number', { originalWord: 'two' })
    ], []);
    expect(plain).toContain('two');
  });

  it('keeps original when replacement is blank', () => {
    const text = 'A big dog barked.';
    const tokens = tokenize(text);
    const dog = tokens.find(t => t.norm === 'dog');
    const { plain } = buildFinalStory(tokens, [
      prompt(dog.index, 'animal', { originalWord: 'dog' })
    ], ['   ']);
    expect(plain).toContain('dog');
  });
});

describe('end-to-end prompt pipeline', () => {
  it('selects candidates and builds a coherent reveal', () => {
    const text = [
      'The quiet forest held many secrets near the old stone bridge.',
      'A brave traveler walked slowly through the mist toward the river.',
      'Birds sang while the wind whispered across the meadow all morning.'
    ].join(' ');
    const tokens = tokenize(text);
    const cls = classifyTokensHeuristic(tokens);
    const picks = selectMixedCandidates(tokens, cls, {
      revealLength: 400,
      promptSetting: '6',
      seed: 7
    });
    expect(picks.length).toBeGreaterThanOrEqual(6);

    const replacements = picks.map((p, i) => `swap${i}`);
    const { plain } = buildFinalStory(tokens, picks, replacements);
    for (const word of replacements) {
      expect(plain).toContain(word);
    }
  });

  it('allows partial selection when passage is sparse', () => {
    const text = 'The big dog ran fast.';
    const tokens = tokenize(text);
    const cls = classifyTokensHeuristic(tokens);
    const picks = selectReplacementCandidates(tokens, cls, {
      count: 12,
      seed: 1,
      allowPartial: true
    });
    expect(picks.length).toBeLessThan(6);
    expect(picks.length).toBeGreaterThan(0);
  });

  it('throws when too few swappable words and partial not allowed', () => {
    const text = 'Go. Be. Do.';
    const tokens = tokenize(text);
    const cls = classifyTokensHeuristic(tokens);
    expect(() => selectReplacementCandidates(tokens, cls, { count: 12, seed: 1 }))
      .toThrow(/too few replaceable/i);
  });
});
