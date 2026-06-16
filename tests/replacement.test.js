import { describe, it, expect } from 'vitest';
import { applyReplacement } from '../src/lib/game.js';

describe('replacement fitting', () => {
  const meta = (category, extra = {}) => ({
    category,
    originalWord: extra.original || 'word',
    preservePlural: false,
    preservePossessive: false,
    ...extra
  });

  it('conjugates past-tense verbs', () => {
    expect(applyReplacement('ran', 'jump', meta('past-tense verb', { original: 'ran' })))
      .toBe('jumped');
    expect(applyReplacement('stood', 'grind', meta('past-tense verb', { original: 'stood' })))
      .toBe('ground');
  });

  it('preserves -ing form', () => {
    expect(applyReplacement('running', 'jump', meta('verb', { original: 'running' })))
      .toBe('jumping');
    expect(applyReplacement('running', 'tie', meta('verb ending in -ing', { original: 'running' })))
      .toBe('tying');
    expect(applyReplacement('walking', 'lie', meta('verb ending in -ing', { original: 'walking' })))
      .toBe('lying');
  });

  it('does not double-apply past tense or -ing', () => {
    expect(applyReplacement('died', 'farted', meta('past-tense verb', { original: 'died' })))
      .toBe('farted');
    expect(applyReplacement('died', 'fart', meta('past-tense verb', { original: 'died' })))
      .toBe('farted');
    expect(applyReplacement('sobbing', 'jabbing', meta('verb ending in -ing', { original: 'sobbing' })))
      .toBe('jabbing');
    expect(applyReplacement('grinning', 'poop', meta('verb ending in -ing', { original: 'grinning' })))
      .toBe('pooping');
  });

  it('preserves player words verbatim when already conjugated', () => {
    expect(applyReplacement('shouting', 'fuck', meta('verb ending in -ing', { original: 'shouting' })))
      .toBe('fucking');
  });

  it('uses placeholder grammar baseline for template blanks', () => {
    expect(applyReplacement('{past-tense verb}', 'explode', meta('past-tense verb', {
      originalWord: '{past-tense verb}',
      isPlaceholder: true
    }))).toBe('exploded');
  });

  it('returns original on empty replacement', () => {
    expect(applyReplacement('cat', '', meta('noun', { original: 'cat' }))).toBe('cat');
    expect(applyReplacement('cat', '  \t  ', meta('noun', { original: 'cat' }))).toBe('cat');
  });

  it('pluralizes when needed', () => {
    expect(applyReplacement('days', 'pickle', meta('plural noun', {
      original: 'days',
      preservePlural: true
    }))).toBe('pickles');
  });

  it('preserves possessive suffix', () => {
    expect(applyReplacement("Sim's", 'dragon', meta('noun', {
      original: "Sim's",
      preservePossessive: true
    }))).toBe("Dragon's");
  });

  it('fixes capitalization', () => {
    expect(applyReplacement('Moon', 'pickle', meta('noun', { original: 'Moon' })))
      .toBe('Pickle');
  });
});
