import { describe, it, expect } from 'vitest';
import {
  FORMAT_ORDER,
  TAG_ORDER,
  filterMadLibTemplates,
  validateTaxonomy,
  inferCollectionFromFolder
} from '../src/lib/madlib-taxonomy.js';
import {
  listBundledMadLibTitles,
  listBundledMadLibCatalog,
  listBundledMadLibItems,
  getMadLibMeta,
  getRandomBundledMadLibTitle,
  FORMAT_LABELS
} from '../src/lib/madlibs.js';
import { readOriginalTemplates } from './helpers/madlib-catalog.js';

const files = readOriginalTemplates();

function titlesForCollection(collection) {
  return files
    .filter(f => (f.data.collection || inferCollectionFromFolder(f.folder)) === collection)
    .map(f => f.title)
    .sort((a, b) => a.localeCompare(b));
}

describe('madlib taxonomy filter', () => {
  const items = [
    { title: 'IT Incident Report', tags: ['tech', 'workplace'], format: 'incident-report' },
    { title: 'Treasure Map Instructions', tags: ['fantasy', 'travel'], format: 'how-to' },
    { title: 'Blockbuster Rental Night', tags: ['retro-web'], format: 'checklist' }
  ];

  it('filters by title search', () => {
    const out = filterMadLibTemplates(items, { search: 'treasure' });
    expect(out.map(i => i.title)).toEqual(['Treasure Map Instructions']);
  });

  it('filters by single tag (OR)', () => {
    const out = filterMadLibTemplates(items, { tags: ['tech'] });
    expect(out.map(i => i.title)).toEqual(['IT Incident Report']);
  });

  it('filters by multiple tags (OR)', () => {
    const out = filterMadLibTemplates(items, { tags: ['tech', 'retro-web'] });
    expect(out.map(i => i.title)).toEqual(['IT Incident Report', 'Blockbuster Rental Night']);
  });

  it('combines search and tags (AND)', () => {
    const out = filterMadLibTemplates(items, { search: 'incident', tags: ['tech'] });
    expect(out.map(i => i.title)).toEqual(['IT Incident Report']);
  });

  it('returns empty when nothing matches', () => {
    expect(filterMadLibTemplates(items, { search: 'zzz' })).toEqual([]);
    expect(filterMadLibTemplates(items, { tags: ['spooky'] })).toEqual([]);
  });

  it('filters by collection', () => {
    const withCollection = [
      { title: 'Star Wars', collection: 'classic', tags: ['media'] },
      { title: 'The Blank Page', collection: 'official', tags: ['media'] }
    ];
    expect(filterMadLibTemplates(withCollection, { collections: ['official'] }).map(i => i.title))
      .toEqual(['The Blank Page']);
  });
});

describe('madlib taxonomy bundle', () => {
  it('groups catalog by format', () => {
    const catalog = listBundledMadLibCatalog();
    expect(catalog.length).toBeGreaterThan(5);
    expect(catalog.every(g => FORMAT_ORDER.includes(g.id))).toBe(true);
    expect(catalog.every(g => FORMAT_LABELS[g.id])).toBe(true);
    const ids = catalog.map(g => g.id);
    expect([...ids].sort((a, b) => FORMAT_ORDER.indexOf(a) - FORMAT_ORDER.indexOf(b))).toEqual(ids);
    const total = catalog.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(listBundledMadLibTitles().length);
  });

  it('preserves taxonomy metadata on items', () => {
    const meta = getMadLibMeta('IT Incident Report');
    expect(meta.format).toBe('incident-report');
    expect(meta.collection).toBe('original');
    expect(meta.tags).toContain('tech');
    expect(meta.category).toBe('themed');
    expect(meta.blankCount).toBeGreaterThan(0);
  });

  it('filters bundled titles by tag', () => {
    const tech = listBundledMadLibTitles({ tags: ['tech'] });
    expect(tech.length).toBeGreaterThan(5);
    expect(tech).toContain('IT Incident Report');
    expect(tech).not.toContain('Treasure Map Instructions');
  });

  it('random respects active filter', () => {
    const title = getRandomBundledMadLibTitle('', { tags: ['retro-web'] });
    const meta = getMadLibMeta(title);
    expect(meta.tags).toContain('retro-web');
  });

  it('filters bundled titles by official collection', () => {
    const expected = titlesForCollection('official');
    const official = listBundledMadLibTitles({ collections: ['official'] }).sort();
    expect(official).toEqual(expected);
    if (expected.length) {
      expect(getMadLibMeta(expected[0]).collection).toBe('official');
    }
  });

  it('filters bundled titles by woo-jr collection', () => {
    const expected = titlesForCollection('woo-jr');
    const wooJr = listBundledMadLibTitles({ collections: ['woo-jr'] }).sort();
    expect(wooJr).toEqual(expected);
    if (expected.length) {
      expect(getMadLibMeta(expected[0]).collection).toBe('woo-jr');
    }
  });

  it('every bundled item has format and tags', () => {
    for (const item of listBundledMadLibItems()) {
      validateTaxonomy(item.title, {
        collection: item.collection,
        format: item.format,
        tags: item.tags
      });
    }
  });

  it('uses all tag enum values at least once across catalog', () => {
    const used = new Set(listBundledMadLibItems().flatMap(i => i.tags));
    for (const tag of TAG_ORDER) {
      expect(used.has(tag), `tag ${tag} unused`).toBe(true);
    }
  });
});
