import { describe, it, expect } from 'vitest';
import {
  normalizeMadLibBlank,
  madlibsApiStoryToTemplate,
  normalizeTemplateSyntax,
  listBundledMadLibTitles,
  getBundledMadLib,
  parseMadLibApiResponse
} from '../src/lib/madlibs.js';
import { tokenize } from '../src/lib/text.js';
import { hasPlaceholders } from '../src/lib/placeholders.js';

describe('madlibs integration', () => {
  it('maps classic madlibs-api blank labels', () => {
    expect(normalizeMadLibBlank('foreign country')).toBe('place');
    expect(normalizeMadLibBlank('type of liquid')).toBe('food');
    expect(normalizeMadLibBlank("verb ending in 'ing'")).toBe('verb ending in -ing');
    expect(normalizeMadLibBlank('part of the body')).toBe('body part');
    expect(normalizeMadLibBlank('article of clothing')).toBe('clothing item');
    expect(normalizeMadLibBlank(' past tense verb ')).toBe('past-tense verb');
  });

  it('converts madlibs-api story shape to {tag} template', () => {
    const story = {
      title: 'Test',
      text: ['Hello ', ' world'],
      blanks: ['adjective']
    };
    expect(madlibsApiStoryToTemplate(story)).toBe('Hello {adjective} world');
  });

  it('normalizes Rosetta-style angle brackets', () => {
    const raw = '<' + 'name' + '> went for a walk and found a <' + 'noun' + '>.';
    const norm = normalizeTemplateSyntax(raw);
    expect(normalizeMadLibBlank('name')).toBe('name of someone in the room');
    expect(norm).toContain('{person}');
    expect(norm).toContain('{noun}');
    expect(hasPlaceholders(norm)).toBe(true);
  });

  it('normalizes streamlit-games hint syntax', () => {
    const raw = 'Dogs eat <shrubs::food_plural/> sometimes.';
    const norm = normalizeTemplateSyntax(raw);
    expect(norm).toContain('{food}');
  });

  it('normalizes workergnome --NOUN-- markers', () => {
    const norm = normalizeTemplateSyntax('The --NOUN-- sat on the --BODY PART--.');
    expect(norm).toBe('The {noun} sat on the {body part}.');
  });

  it('bundled templates load with blanks', () => {
    const titles = listBundledMadLibTitles();
    expect(titles.length).toBeGreaterThan(5);
    const spooky = getBundledMadLib('A Spooky Campfire Story');
    expect(spooky.title).toBe('A Spooky Campfire Story');
    expect(spooky.text).toMatch(/\{adjective\}/);
    const tokens = tokenize(spooky.text);
    expect(tokens.filter(t => t.type === 'blank').length).toBeGreaterThan(5);
  });

  it('parses API JSON responses', () => {
    const parsed = parseMadLibApiResponse({
      title: 'River',
      text: ['Cross the ', ' river'],
      blanks: ['adjective']
    });
    expect(parsed.text).toBe('Cross the {adjective} river');
    expect(parsed.source).toBe('api');
  });
});
