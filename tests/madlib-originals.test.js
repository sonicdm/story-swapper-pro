import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  madLibBlankToTag,
  listBundledMadLibTitles,
  listBundledMadLibCatalog,
  getBundledMadLib,
  getMadLibMeta
} from '../src/lib/madlibs.js';
import { tokenize } from '../src/lib/text.js';
import { SAMPLES } from '../src/data/samples.js';
import {
  COLLECTIONS,
  FORMAT_ORDER,
  TAG_ORDER,
  validateTaxonomy,
  inferCollectionFromFolder
} from '../src/lib/madlib-taxonomy.js';
import {
  countBlanks,
  countWords,
  readBundledTemplates,
  readOriginalTemplates
} from './helpers/madlib-catalog.js';

const files = readOriginalTemplates();
const bundle = readBundledTemplates();

function collectionFor(file) {
  return file.data.collection || inferCollectionFromFolder(file.folder);
}

describe('madlib originals JSON', () => {
  it('discovers template files dynamically', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(new Set(files.map(f => f.title)).size).toBe(files.length);
  });

  for (const file of files) {
    const { folder, filePath, data, title } = file;
    it(`validates ${folder}/${path.basename(filePath)}`, () => {
      expect(typeof data.text, file.relativePath).toBe('string');
      expect(data.text, file.relativePath).toMatch(/\{/);
      if (folder !== 'classics') {
        expect(data.text, file.relativePath).toMatch(/^## /);
      }

      const blankCount = countBlanks(data.text);
      expect(blankCount, file.relativePath).toBeGreaterThanOrEqual(8);

      const tokens = tokenize(data.text);
      expect(tokens.filter(t => t.type === 'blank').length, file.relativePath).toBe(blankCount);

      const collection = collectionFor(file);
      validateTaxonomy(title, { collection, format: data.format, tags: data.tags });
      expect(COLLECTIONS, file.relativePath).toContain(collection);
      expect(FORMAT_ORDER, file.relativePath).toContain(data.format);
      expect(data.tags.length, file.relativePath).toBeGreaterThanOrEqual(1);
      expect(data.tags.length, file.relativePath).toBeLessThanOrEqual(3);
      for (const tag of data.tags) {
        expect(TAG_ORDER, file.relativePath).toContain(tag);
      }
    });
  }

  it('migrated legacy templates still tokenize with correct blank count', () => {
    for (const title of ['Superhero Job Application', 'Letter from Camp']) {
      const file = files.find(f => f.title === title);
      expect(file, title).toBeTruthy();
      const tokens = tokenize(file.data.text);
      expect(tokens.filter(t => t.type === 'blank').length).toBe(countBlanks(file.data.text));
    }
  });
});

describe('madlibs generated bundle', () => {
  it('mirrors every discovered source template', () => {
    const sourceTitles = files.map(f => f.title).sort((a, b) => a.localeCompare(b));
    const bundledTitles = Object.keys(bundle).sort((a, b) => a.localeCompare(b));
    expect(bundledTitles).toEqual(sourceTitles);

    for (const file of files) {
      const entry = bundle[file.title];
      expect(entry, file.relativePath).toBeTruthy();
      expect(entry.text, file.relativePath).toBe(file.data.text.trim());
      expect(entry.category, file.relativePath).toBe(file.data.category || file.folder);
      expect(entry.collection, file.relativePath).toBe(collectionFor(file));
      expect(entry.format, file.relativePath).toBe(file.data.format);
      expect(entry.tags, file.relativePath).toEqual(file.data.tags);
      expect(entry.blankCount, file.relativePath).toBe(countBlanks(file.data.text));
      expect(entry.wordCount, file.relativePath).toBe(countWords(file.data.text));
    }
  });

  it('catalog groups all bundled templates by format', () => {
    const titles = listBundledMadLibTitles();
    expect(titles.length).toBe(files.length);
    const catalog = listBundledMadLibCatalog();
    expect(catalog.every(g => FORMAT_ORDER.includes(g.id))).toBe(true);
    expect(catalog.map(g => g.id)).not.toContain('generic');
    const total = catalog.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(titles.length);
  });

  it('legacy templates play from bundle not samples', () => {
    expect(SAMPLES.some(s => s.title.includes('Superhero'))).toBe(false);
    expect(SAMPLES.some(s => s.title.includes('Letter from Camp'))).toBe(false);
    expect(getBundledMadLib('Superhero Job Application')?.text).toMatch(/\{noun\}/);
    expect(getBundledMadLib('Letter from Camp')?.text).toMatch(/\{person\}/);
  });

  it('Evening Walk hybrid stays in examples only', () => {
    expect(SAMPLES.some(s => s.title.includes('Evening Walk'))).toBe(true);
    expect(listBundledMadLibTitles()).not.toContain('Evening Walk (Hybrid: tags + auto picks)');
  });

  it('exposes blank metadata for UI', () => {
    const meta = getMadLibMeta("Doctor's Report");
    expect(meta.blankCount).toBeGreaterThan(8);
    expect(meta.category).toBe('generic');
    expect(meta.format).toBe('incident-report');
    expect(meta.tags.length).toBeGreaterThan(0);
  });

  it('filters optional external collections when present', () => {
    for (const collection of ['official', 'woo-jr']) {
      const expected = files.filter(f => collectionFor(f) === collection).map(f => f.title).sort();
      const actual = listBundledMadLibTitles({ collections: [collection] }).sort();
      expect(actual).toEqual(expected);
    }
  });

  it('bundled entries use string text with {tags}', () => {
    const doctor = getBundledMadLib("Doctor's Report");
    expect(typeof doctor?.text).toBe('string');
    expect(doctor?.text).toMatch(/\{adjective\}/);
    expect(madLibBlankToTag('name')).toBe('person');
  });
});
