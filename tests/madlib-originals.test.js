import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  madlibsApiStoryToTemplate,
  madLibBlankToTag,
  listBundledMadLibTitles,
  listBundledMadLibCatalog,
  getBundledMadLib,
  getMadLibMeta
} from '../src/lib/madlibs.js';
import { braceTemplateToJson } from '../scripts/brace-template-to-json.mjs';
import { tokenize } from '../src/lib/text.js';
import { SAMPLES } from '../src/data/samples.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalsDir = path.join(root, 'src', 'data', 'madlib-originals');

function walkOriginalJsonFiles() {
  const files = [];
  for (const sub of ['legacy', 'generic', 'themed']) {
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
    expect(files.filter(f => f.sub === 'legacy').length).toBe(2);
    expect(files.filter(f => f.sub === 'generic').length).toBe(14);
    expect(files.filter(f => f.sub === 'themed').length).toBe(14);
  });

  for (const { sub, path: filePath, data } of files) {
    const title = data.title || path.basename(filePath, '.json');
    it(`validates ${sub}/${path.basename(filePath)}`, () => {
      expect(data.text.length).toBe(data.blanks.length + 1);
      expect(data.blanks.length).toBeGreaterThanOrEqual(8);
      expect(data.blanks.length).toBeLessThanOrEqual(18);
      const body = madlibsApiStoryToTemplate(data);
      expect(body).toMatch(/\{/);
      const tokens = tokenize(body);
      expect(tokens.filter(t => t.type === 'blank').length).toBe(data.blanks.length);
    });
  }

  it('retrofitted templates include markdown structure in opening segment', () => {
    const matilda = files.find(f => f.data.title === "Matilda's Walk Report");
    const superhero = files.find(f => f.data.title === 'Superhero Job Application');
    const doctor = files.find(f => f.data.title === "Doctor's Report");
    expect(matilda?.data.text[0]).toMatch(/^## /);
    expect(superhero?.data.text[0]).toMatch(/^## /);
    expect(doctor?.data.text[0]).toMatch(/^## /);
  });

  it('migrated legacy templates still tokenize with correct blank count', () => {
    for (const title of ['Superhero Job Application', 'Letter from Camp']) {
      const file = files.find(f => f.data.title === title);
      expect(file, title).toBeTruthy();
      const body = madlibsApiStoryToTemplate(file.data);
      const tokens = tokenize(body);
      expect(tokens.filter(t => t.type === 'blank').length).toBe(file.data.blanks.length);
    }
  });
});

describe('madlibs bundle', () => {
  it('bundle has ~46 templates with categories', () => {
    const titles = listBundledMadLibTitles();
    expect(titles.length).toBeGreaterThanOrEqual(45);
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

  it('brace converter round-trips tags to classic blanks', () => {
    const json = braceTemplateToJson('Test', 'A {adjective} {noun} {verb}.');
    expect(json.blanks).toEqual(['adjective', 'noun', 'verb']);
    expect(madlibsApiStoryToTemplate(json)).toBe('A {adjective} {noun} {verb}.');
    expect(madLibBlankToTag('name')).toBe('person');
  });
});
