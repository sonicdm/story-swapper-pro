import { describe, it, expect } from 'vitest';
import {
  isPoeticOrArchaicForm, isAbstractPoeticContext, isIdiomPart,
  looksLikeProperName, resolveProperNounCategory, isPastTenseForm, normalizeForPos, isPrepositionWord
} from '../src/lib/grammar.js';

function tok(text, atSentenceStart = false) {
  return {
    text,
    norm: text.toLowerCase().replace(/^['']+|['']+$/g, ''),
    atSentenceStart
  };
}

function wordTokens(words) {
  return words.map((text, i) => ({
    ...tok(text, i === 0),
    index: i
  }));
}

describe('grammar guards', () => {
  it('detects poetic contractions', () => {
    expect(isPoeticOrArchaicForm(tok("o'er"))).toBe(true);
    expect(isPoeticOrArchaicForm(tok("toss'd"))).toBe(true);
    expect(isPoeticOrArchaicForm(tok("skreigh'd"))).toBe(true);
    expect(isPoeticOrArchaicForm(tok('climbed'))).toBe(false);
  });

  it('expands archaic forms for POS', () => {
    expect(normalizeForPos("o'er")).toBe('over');
    expect(isPrepositionWord("o'er")).toBe(true);
  });

  it('skips abstract poetic frames', () => {
    expect(isAbstractPoeticContext('fear', 'when', 'chilled')).toBe(true);
    expect(isAbstractPoeticContext('rest', 'at', '')).toBe(true);
    expect(isAbstractPoeticContext('care', 'and', '')).toBe(true);
    expect(isAbstractPoeticContext('hill', 'the', '')).toBe(false);
  });

  it('protects idioms', () => {
    const tokens = wordTokens(['instead', 'of', 'eight']);
    expect(isIdiomPart(tokens[0], tokens, 0)).toBe(true);
    expect(isIdiomPart(tokens[1], tokens, 1)).toBe(true);

    const atRest = wordTokens(['at', 'rest', 'when']);
    expect(isIdiomPart(atRest[1], atRest, 1)).toBe(true);

    const eachOther = wordTokens(['each', "other's", 'health']);
    expect(isIdiomPart(eachOther[1], eachOther, 1)).toBe(true);

    const everybodyElse = wordTokens(['everybody', "else's", 'health']);
    expect(isIdiomPart(everybodyElse[0], everybodyElse, 0)).toBe(true);
    expect(isIdiomPart(everybodyElse[1], everybodyElse, 1)).toBe(true);

    const thinkOf = wordTokens(['to', 'think', 'of', 'others']);
    expect(isIdiomPart(thinkOf[1], thinkOf, 1)).toBe(true);
    expect(isIdiomPart(thinkOf[2], thinkOf, 2)).toBe(true);
    expect(isIdiomPart(thinkOf[3], thinkOf, 3)).toBe(true);

    const oneEvening = wordTokens(['one', 'evening', 'after']);
    expect(isIdiomPart(oneEvening[1], oneEvening, 1)).toBe(true);

    const takeSeat = wordTokens(['take', 'a', 'seat']);
    expect(isIdiomPart(takeSeat[2], takeSeat, 2)).toBe(true);

    const takeTime = wordTokens(['take', 'your', 'time']);
    expect(isIdiomPart(takeTime[2], takeTime, 2)).toBe(true);

    const goodMan = wordTokens(['my', 'good', 'man']);
    expect(isIdiomPart(goodMan[1], goodMan, 1)).toBe(true);
    expect(isIdiomPart(goodMan[2], goodMan, 2)).toBe(true);

    const returnedPoole = wordTokens(['week', 'returned', 'Poole']);
    expect(isIdiomPart(returnedPoole[1], returnedPoole, 1)).toBe(true);
  });

  it('treats mid-sentence caps as proper names (Sandy)', () => {
    expect(looksLikeProperName(tok('Sandy', false))).toBe(true);
    expect(looksLikeProperName(tok('The', true))).toBe(false);
  });

  it('maps proper nouns to Mad Libs wildcard categories', () => {
    expect(resolveProperNounCategory(tok('Sandy', false))).toBe('name of someone in the room');
    expect(resolveProperNounCategory(tok('London', true))).toBe('place');
    expect(resolveProperNounCategory(tok('Henry', true))).toBe('name of someone in the room');
    expect(resolveProperNounCategory(tok('March', true))).toBeNull();
  });

  it('knows irregular past forms', () => {
    expect(isPastTenseForm('ran')).toBe(true);
    expect(isPastTenseForm('stood')).toBe(true);
    expect(isPastTenseForm('climbed')).toBe(true);
  });
});
