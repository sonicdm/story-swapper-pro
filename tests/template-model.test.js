import { describe, it, expect } from 'vitest';
import {
  applyBlankAtRange,
  applyBlankCandidates,
  firstHeadingTitle,
  parseTemplateTokens,
  restoreBlankAtRange,
  setBlockType,
  toggleBold,
  toggleItalic
} from '../src/lib/template-model.js';

describe('template-model', () => {
  it('applies blank at character range', () => {
    const text = 'Hello world today';
    const result = applyBlankAtRange(text, 6, 11, 'noun');
    expect(result).toBe('Hello {noun} today');
  });

  it('restores blank to original word', () => {
    const text = 'Hello {noun} today';
    const result = restoreBlankAtRange(text, 6, 12, 'world');
    expect(result).toBe('Hello world today');
  });

  it('applies blank inside bold markdown', () => {
    const text = '**Requester:** Morgan';
    const result = applyBlankAtRange(text, 15, 21, 'person');
    expect(result).toBe('**Requester:** {person}');
  });

  it('toggles bold on selection', () => {
    const text = 'Hello world';
    expect(toggleBold(text, 0, 5)).toBe('**Hello** world');
    expect(toggleBold('**Hello** world', 0, 9)).toBe('Hello world');
  });

  it('toggles italic on selection', () => {
    const text = 'Hello world';
    expect(toggleItalic(text, 6, 11)).toBe('Hello *world*');
  });

  it('sets heading block type', () => {
    const text = 'My Title\n\nBody text';
    const result = setBlockType(text, 0, 'h2');
    expect(result.startsWith('## My Title')).toBe(true);
  });

  it('sets list block type', () => {
    const text = 'Bring snacks';
    expect(setBlockType(text, 0, 'list')).toBe('- Bring snacks');
  });

  it('parses template tokens including blanks', () => {
    const tokens = parseTemplateTokens('On {day of week}, Morgan went.');
    const blanks = tokens.filter(t => t.isBlank);
    const words = tokens.filter(t => t.isWord);
    expect(blanks).toHaveLength(1);
    expect(words.some(w => w.norm === 'morgan')).toBe(true);
  });

  it('extracts first heading for title sync', () => {
    expect(firstHeadingTitle('## Road Trip Memo\n\nBody')).toBe('Road Trip Memo');
  });

  it('applies multiple candidates right-to-left', () => {
    const text = 'Morgan packed a red suitcase';
    const tokens = parseTemplateTokens(text);
    const morgan = tokens.find(t => t.norm === 'morgan');
    const red = tokens.find(t => t.norm === 'red');
    const result = applyBlankCandidates(text, [
      { category: 'adjective', token: red },
      { category: 'person', token: morgan }
    ]);
    expect(result).toBe('{person} packed a {adjective} suitcase');
  });
});
