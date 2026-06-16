import { describe, it, expect } from 'vitest';
import {
  cleanGutenbergText, trimToWordLimit, tokenize,
  detectSections, selectSection, isHeadingLine
} from '../src/lib/text.js';
import { appState } from '../src/lib/state.js';

describe('tokenize', () => {
  it('handles curly quotes and apostrophes in words', () => {
    const tokens = tokenize("It's a 'fine' day.");
    const words = tokens.filter(t => t.type === 'word').map(t => t.text);
    expect(words.some(w => w.includes("'") || w.includes('\u2019'))).toBe(true);
  });

  it('tokenizes unknown {tags} as noun blanks', () => {
    const tokens = tokenize('Hello {flarnblatz} there.');
    const blank = tokens.find(t => t.type === 'blank');
    expect(blank.blankCategory).toBe('noun');
    expect(blank.text).toBe('{flarnblatz}');
  });

  it('tracks sentence boundaries for proper-name detection', () => {
    const tokens = tokenize('Sandy ran. Sandy hid.');
    const sandys = tokens.filter(t => t.norm === 'sandy');
    expect(sandys[0].atSentenceStart).toBe(true);
    expect(sandys[1].atSentenceStart).toBe(true);
  });

  it('tokenizes graded compounds as one word', () => {
    const tokens = tokenize('perfect A.1.-ness and grown-ups');
    const words = tokens.filter(t => t.type === 'word').map(t => t.text);
    expect(words).toContain('A.1.-ness');
    expect(words).toContain('grown-ups');
    expect(words).not.toContain('ness');
  });

  it('preserves poetic apostrophe words', () => {
    const words = tokenize("o'er the toss'd sea").filter(t => t.type === 'word').map(t => t.text);
    expect(words).toContain("o'er");
    expect(words).toContain("toss'd");
  });

  it('preserves em-dash and punctuation tokens', () => {
    const tokens = tokenize('Wait—stop!');
    expect(tokens.some(t => t.text === '—')).toBe(true);
    expect(tokens.some(t => t.text === '!')).toBe(true);
  });
});

describe('cleanGutenbergText', () => {
  it('strips Gutenberg header and license boilerplate', () => {
    const raw = [
      '*** START OF THE PROJECT GUTENBERG EBOOK TEST ***',
      '',
      'CHAPTER I',
      '',
      'It was a dark and stormy night. The wind howled.',
      '',
      '*** END OF THE PROJECT GUTENBERG EBOOK TEST ***',
      'START: FULL LICENSE',
      'Legal text here.'
    ].join('\n');
    const cleaned = cleanGutenbergText(raw);
    expect(cleaned).toContain('dark and stormy');
    expect(cleaned).not.toMatch(/START OF THE PROJECT GUTENBERG/i);
    expect(cleaned).not.toMatch(/FULL LICENSE/i);
  });

  it('normalizes smart quotes', () => {
    const cleaned = cleanGutenbergText('She said \u201chello\u201d.');
    expect(cleaned).toContain('"hello"');
  });
});

describe('trimToWordLimit', () => {
  it('keeps full text when under limit', () => {
    const text = 'One two three four five.';
    expect(trimToWordLimit(text, 20)).toBe(text);
  });

  it('trims at sentence boundaries when possible', () => {
    const text = 'First sentence here. Second sentence follows. Third one too.';
    const trimmed = trimToWordLimit(text, 6);
    expect(trimmed.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(trimmed).toMatch(/\.$/);
  });

  it('falls back to word slice for text without sentence breaks', () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta';
    const trimmed = trimToWordLimit(text, 4);
    expect(trimmed).toBe('alpha beta gamma delta');
  });
});

describe('section detection', () => {
  it('detects chapter headings', () => {
    expect(isHeadingLine('CHAPTER III', true, true)).toBe(true);
    expect(isHeadingLine('TABLE OF CONTENTS', true, true)).toBe(false);
  });

  it('selects beginning mode without crashing on empty sections', () => {
    const text = 'Opening paragraph one.\n\nOpening paragraph two with more words here.';
    const section = selectSection(text, [], 'beginning', -1, 50);
    expect(section.text).toContain('Opening');
    expect(section.title).toBe('Beginning');
  });

  it('detects scored sections in book-like text', () => {
    const body = 'The hero walked on. "Hello," she said. He replied softly. '.repeat(40);
    const book = `CHAPTER ONE\n\n${body}\n\nCHAPTER TWO\n\n${body}`;
    const sections = detectSections(book);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].wordCount).toBeGreaterThanOrEqual(250);
  });
});

describe('template-only short passages', () => {
  it('supports Mad Libs forms shorter than auto-swap minimum', () => {
    const text = 'Name: {person}. Cape: {color}. Power: {verb}.';
    const tokens = tokenize(text);
    expect(tokens.filter(t => t.type === 'blank')).toHaveLength(3);
    appState.revealLength = 250;
    expect(tokens.map(t => t.text).join('')).toContain('{person}');
  });
});
