import { describe, it, expect } from 'vitest';
import {
  gutenbergTextCandidates, gutenbergUrlPriority, stripJinaReaderWrapper,
  isGutenbergReadableBook, looksLikeGutenbergStory
} from '../src/lib/fetch.js';

describe('Gutenberg fetch helpers', () => {
  it('prefers files/{id}-0.txt over cache/epub URLs', () => {
    const urls = gutenbergTextCandidates({ id: 27467 });
    expect(urls[0]).toMatch(/files\/27467\/27467-0\.txt$/);
    expect(gutenbergUrlPriority(urls[0])).toBeLessThan(
      gutenbergUrlPriority('https://www.gutenberg.org/cache/epub/27467/pg27467.txt')
    );
  });

  it('includes Gutendex format URLs but skips readme sidecars', () => {
    const urls = gutenbergTextCandidates({
      id: 22788,
      formats: {
        'text/plain; charset=us-ascii': 'https://www.gutenberg.org/files/22788/22788-readme.txt',
        'text/html': 'https://www.gutenberg.org/files/22788/22788-index.html'
      }
    });
    expect(urls.some(u => u.includes('readme'))).toBe(false);
    expect(urls.some(u => /files\/22788\/22788-0\.txt$/.test(u))).toBe(true);
  });

  it('rejects audio-only Gutendex entries', () => {
    const audioBook = {
      id: 22788,
      title: 'The Federalist Papers',
      media_type: 'Sound',
      formats: {
        'text/plain; charset=us-ascii': 'https://www.gutenberg.org/files/22788/22788-readme.txt'
      }
    };
    expect(isGutenbergReadableBook(audioBook)).toBe(false);
    expect(isGutenbergReadableBook({ id: 11, media_type: 'Text' })).toBe(true);
  });

  it('validates downloaded story text', () => {
    const header = '*** START OF THE PROJECT GUTENBERG EBOOK ***\n\nChapter one.\n';
    expect(looksLikeGutenbergStory(header + 'word '.repeat(100))).toBe(true);
    expect(looksLikeGutenbergStory('This eBook is for audio listening only.')).toBe(false);
  });

  it('strips jina.ai reader wrapper', () => {
    const raw = `Title: Foo

URL Source: https://www.gutenberg.org/cache/epub/1/pg1.txt

Markdown Content:
The Project Gutenberg eBook of Alice

Chapter One`;
    expect(stripJinaReaderWrapper(raw)).toBe(`The Project Gutenberg eBook of Alice

Chapter One`);
  });
});
