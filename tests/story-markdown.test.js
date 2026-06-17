import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  renderMadLibMarkdown,
  swapPlaceholder,
  parseBlocks,
  renderInline
} from '../src/lib/story-markdown.js';
import { buildFinalStory } from '../src/lib/game.js';
import { tokenize } from '../src/lib/text.js';

const matildaJson = JSON.parse(fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'madlib-originals', 'themed', 'matilda-s-walk-report.json'),
  'utf8'
));

describe('story-markdown', () => {
  it('renders headings', () => {
    const html = renderMadLibMarkdown('## Walk Report\n\n**Dog:** Matilda', []);
    expect(html).toContain('<h2>Walk Report</h2>');
    expect(html).toContain('<strong>Dog:</strong>');
  });

  it('renders unordered lists', () => {
    const html = renderMadLibMarkdown('- First item\n- Second item', []);
    expect(html).toBe('<ul><li>First item</li><li>Second item</li></ul>');
  });

  it('renders bold and italic inline', () => {
    expect(renderInline('**bold** and *italic*')).toBe('<strong>bold</strong> and <em>italic</em>');
  });

  it('uses br for single newlines inside paragraphs', () => {
    const html = renderMadLibMarkdown('Line one\nLine two', []);
    expect(html).toBe('<p>Line one<br>Line two</p>');
  });

  it('injects swap marks at placeholders', () => {
    const plain = `## Title\n\nWeather: ${swapPlaceholder(0)}`;
    const mark = '<mark class="swap">sunny</mark>';
    const html = renderMadLibMarkdown(plain, [mark]);
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<mark class="swap">sunny</mark>');
    expect(html).not.toContain(swapPlaceholder(0));
  });

  it('does not parse markdown inside user swaps', () => {
    const plain = `## Report\n\nNotes: ${swapPlaceholder(0)}`;
    const mark = '<mark class="swap"># fake heading</mark>';
    const html = renderMadLibMarkdown(plain, [mark]);
    expect(html.match(/<h2>/g)?.length).toBe(1);
    expect(html).toContain('# fake heading');
    expect(html).not.toContain('<h2># fake heading</h2>');
  });

  it('does not treat swap content as list items', () => {
    const plain = `Summary:\n\n${swapPlaceholder(0)}`;
    const mark = '<mark class="swap">- not a list</mark>';
    const html = renderMadLibMarkdown(plain, [mark]);
    expect(html).not.toContain('<ul>');
    expect(html).toContain('- not a list');
  });

  it('parseBlocks identifies block types', () => {
    const blocks = parseBlocks('## Hi\n\nHello world\n\n- one\n- two');
    expect(blocks.map(b => b.type)).toEqual(['heading', 'paragraph', 'list']);
  });
});

describe('buildFinalStory madlibs markdown integration', () => {
  it('renders markdown headings for a seeded template', () => {
    const body = matildaJson.text;
    const tokens = tokenize(body);
    const blanks = tokens.filter(t => t.type === 'blank');
    const prompts = blanks.map((t) => ({
      tokenIndex: t.index,
      originalWord: t.text,
      category: t.blankCategory,
      label: t.blankCategory,
      isPlaceholder: true
    }));
    const replacements = blanks.map((_, i) => `word${i}`);
    const { html, useMarkdown } = buildFinalStory(tokens, prompts, replacements, { useMarkdown: true });
    expect(useMarkdown).toBe(true);
    expect(html).toContain('<h2>Walk Report</h2>');
    expect(html).toContain('<mark class="swap"');
  });
});
