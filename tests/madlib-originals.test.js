import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  madLibBlankToTag,
  listBundledMadLibTitles,
  listBundledMadLibCatalog,
  getBundledMadLib,
  getMadLibMeta
} from '../src/lib/madlibs.js';
import { tokenize } from '../src/lib/text.js';
import { SAMPLES } from '../src/data/samples.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalsDir = path.join(root, 'src', 'data', 'madlib-originals');

function countBlanks(text) {
  return (text.match(/\{[^}]+\}/g) || []).length;
}

function walkOriginalJsonFiles() {
  const files = [];
  for (const sub of ['classics', 'legacy', 'generic', 'themed']) {
    const dir = path.join(originalsDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.json'))) {
      files.push({ sub, path: path.join(dir, f), data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) });
    }
  }
  return files;
}

describe('madlib originals JSON', () => {
  const files = walkOriginalJsonFiles();

  it('has expected original file counts', () => {
    expect(files.filter(f => f.sub === 'classics').length).toBe(16);
    expect(files.filter(f => f.sub === 'legacy').length).toBe(2);
    expect(files.filter(f => f.sub === 'generic').length).toBe(21);
    expect(files.filter(f => f.sub === 'themed').length).toBe(18);
  });

  for (const { sub, path: filePath, data } of files) {
    const title = data.title || path.basename(filePath, '.json');
    it(`validates ${sub}/${path.basename(filePath)}`, () => {
      expect(typeof data.text).toBe('string');
      expect(data.text).toMatch(/\{/);
      const blankCount = countBlanks(data.text);
      const minBlanks = sub === 'classics' ? 8 : 8;
      expect(blankCount).toBeGreaterThanOrEqual(minBlanks);
      if (sub !== 'classics') {
        expect(blankCount).toBeLessThanOrEqual(18);
      }
      const tokens = tokenize(data.text);
      expect(tokens.filter(t => t.type === 'blank').length).toBe(blankCount);
    });
  }

  it('retrofitted templates include markdown structure', () => {
    const matilda = files.find(f => f.data.title === "Matilda's Walk Report");
    const superhero = files.find(f => f.data.title === 'Superhero Job Application');
    const doctor = files.find(f => f.data.title === "Doctor's Report");
    expect(matilda?.data.text).toMatch(/^## /);
    expect(superhero?.data.text).toMatch(/^## /);
    expect(doctor?.data.text).toMatch(/^## /);
  });

  it('migrated legacy templates still tokenize with correct blank count', () => {
    for (const title of ['Superhero Job Application', 'Letter from Camp']) {
      const file = files.find(f => f.data.title === title);
      expect(file, title).toBeTruthy();
      const tokens = tokenize(file.data.text);
      expect(tokens.filter(t => t.type === 'blank').length).toBe(countBlanks(file.data.text));
    }
  });
});

describe('madlibs bundle', () => {
  it('bundle has ~57 templates with categories', () => {
    const titles = listBundledMadLibTitles();
    expect(titles.length).toBeGreaterThanOrEqual(48);
    const catalog = listBundledMadLibCatalog();
    expect(catalog.map(g => g.id)).toEqual(expect.arrayContaining(['classics', 'legacy', 'generic', 'themed']));
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
  });

  it('bundled entries use string text with {tags}', () => {
    const doctor = getBundledMadLib("Doctor's Report");
    expect(typeof doctor?.text).toBe('string');
    expect(doctor?.text).toMatch(/\{adjective\}/);
    expect(madLibBlankToTag('name')).toBe('person');
  });
});
