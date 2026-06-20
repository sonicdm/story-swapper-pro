import { describe, it, expect } from 'vitest';
import { computeAutoSwapCandidates } from '../src/lib/auto-swap-candidates.js';
import { classifyTokensHeuristic } from '../src/lib/classify.js';
import { selectMixedCandidates } from '../src/lib/placeholders.js';
import { tokenize, trimToWordLimit } from '../src/lib/text.js';
import { normalizeTemplateSyntax } from '../src/lib/madlibs.js';
import { hasPlaceholders } from '../src/lib/placeholders.js';
import { countWords } from '../src/lib/dom.js';
import { SAMPLES } from '../src/data/samples.js';

const PROSE_SAMPLE = SAMPLES[2].text;

function candidateKey(c) {
  return `${c.tokenIndex}:${c.category}`;
}

function candidateSet(candidates) {
  return new Set(candidates.map(candidateKey));
}

describe('computeAutoSwapCandidates', () => {
  it('matches selectMixedCandidates for plain prose with auto prompt count', async () => {
    const text = PROSE_SAMPLE;
    const revealLength = 250;
    const promptSetting = 'auto';

    const result = await computeAutoSwapCandidates(text, {
      nlpEngine: { name: 'heuristic' },
      forceTemplateMode: false,
      revealLength,
      promptSetting,
      collectionMode: 'auto',
      seed: 42
    });

    expect(result.error, result.error || '').toBeUndefined();
    const tokens = tokenize(result.selectedText);
    const classifications = classifyTokensHeuristic(tokens);
    const expected = selectMixedCandidates(tokens, classifications, {
      revealLength,
      promptSetting,
      dictionaryPos: result.dictionaryPos,
      seed: 42
    });

    expect(candidateSet(result.candidates)).toEqual(candidateSet(expected));
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('uses tags only when template mode and prompt is auto', async () => {
    const text = 'Hello {noun}, welcome to {place}.';
    const result = await computeAutoSwapCandidates(text, {
      nlpEngine: { name: 'heuristic' },
      forceTemplateMode: hasPlaceholders(normalizeTemplateSyntax(text)),
      revealLength: 250,
      promptSetting: 'auto'
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every(c => c.isPlaceholder)).toBe(true);
  });

  it('mirrors create draft settings for plain text', async () => {
    const text = trimToWordLimit(PROSE_SAMPLE, 250);
    const forceTemplateMode = hasPlaceholders(normalizeTemplateSyntax(text));
    expect(forceTemplateMode).toBe(false);

    const result = await computeAutoSwapCandidates(text, {
      nlpEngine: { name: 'heuristic' },
      forceTemplateMode,
      revealLength: 250,
      promptSetting: '12',
      collectionMode: 'auto'
    });

    expect(countWords(result.selectedText)).toBeGreaterThanOrEqual(80);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.length).toBeLessThanOrEqual(12);
  });
});
