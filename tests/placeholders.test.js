import { describe, it, expect } from 'vitest';
import {
  resolvePlaceholderCategory, hasPlaceholders, selectPlaceholderCandidates,
  selectMixedCandidates
} from '../src/lib/placeholders.js';
import { tokenize } from '../src/lib/text.js';
import { classifyTokensHeuristic } from '../src/lib/classify.js';

describe('placeholders', () => {
  it('resolves category aliases', () => {
    expect(resolvePlaceholderCategory('verb')).toBe('verb');
    expect(resolvePlaceholderCategory('Past Tense Verb')).toBe('past-tense verb');
    expect(resolvePlaceholderCategory('person')).toBe('name of someone in the room');
    expect(resolvePlaceholderCategory('adj')).toBe('adjective');
    expect(resolvePlaceholderCategory('color')).toBe('color');
    expect(resolvePlaceholderCategory('colour')).toBe('color');
    expect(resolvePlaceholderCategory('not-a-real-tag')).toBeNull();
  });

  it('detects placeholder syntax', () => {
    expect(hasPlaceholders('Hello {noun} world')).toBe(true);
    expect(hasPlaceholders('Hello ___ world')).toBe(true);
    expect(hasPlaceholders('No blanks here')).toBe(false);
  });

  it('tokenizes {category} as blank tokens', () => {
    const tokens = tokenize('Captain {noun} runs {verb}.');
    const blanks = tokens.filter(t => t.type === 'blank');
    expect(blanks).toHaveLength(2);
    expect(blanks[0].blankCategory).toBe('noun');
    expect(blanks[0].text).toBe('{noun}');
    expect(blanks[1].blankCategory).toBe('verb');
  });

  it('tokenizes ___ as noun blank', () => {
    const tokens = tokenize('Captain ___ runs.');
    const blanks = tokens.filter(t => t.type === 'blank');
    expect(blanks).toHaveLength(1);
    expect(blanks[0].blankCategory).toBe('noun');
  });

  it('builds candidates in document order', () => {
    const text = 'Captain {noun} from {place} can {verb}.';
    const tokens = tokenize(text);
    const picks = selectPlaceholderCandidates(tokens);
    expect(picks.map(p => p.category)).toEqual(['noun', 'place', 'verb']);
    expect(picks.every(p => p.isPlaceholder)).toBe(true);
  });

  it('returns empty list when no blanks', () => {
    expect(selectPlaceholderCandidates(tokenize('Hello world'))).toEqual([]);
  });

  it('auto prompt count uses only tags, no NLP extras', () => {
    const text = `The {adjective} {noun} walked through the quiet forest toward the old stone bridge by the river.`;
    const tokens = tokenize(text);
    const cls = classifyTokensHeuristic(tokens);
    const picks = selectMixedCandidates(tokens, cls, {
      revealLength: 400,
      promptSetting: 'auto'
    });
    expect(picks).toHaveLength(2);
    expect(picks.every(p => p.isPlaceholder)).toBe(true);
  });

  it('adds NLP extras when prompt count is a fixed number above tag count', () => {
    const text = `The {adjective} {noun} walked through the quiet forest toward the old stone bridge by the river.`;
    const tokens = tokenize(text);
    const cls = classifyTokensHeuristic(tokens);
    const picks = selectMixedCandidates(tokens, cls, {
      revealLength: 400,
      promptSetting: '8'
    });
    const tagged = picks.filter(p => p.isPlaceholder);
    expect(tagged).toHaveLength(2);
    expect(picks[0].isPlaceholder).toBe(true);
    expect(picks[1].isPlaceholder).toBe(true);
    expect(picks.length).toBeGreaterThan(2);
  });

  it('includes every tag even when tag count exceeds prompt setting', () => {
    const text = '{noun} {verb} {adjective} {place} {animal} {object} {emotion} {sound} {person} {noun}';
    const tokens = tokenize(text);
    const cls = classifyTokensHeuristic(tokens);
    const picks = selectMixedCandidates(tokens, cls, {
      revealLength: 150,
      promptSetting: '8'
    });
    expect(picks.filter(p => p.isPlaceholder)).toHaveLength(10);
  });
});
