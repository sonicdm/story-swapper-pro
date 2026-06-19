#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  inferCollectionFromFolder,
  validateTaxonomy
} from '../src/lib/madlib-taxonomy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const originalsDir = path.join(root, 'src', 'data', 'madlib-originals');
const outPath = path.join(root, 'src', 'data', 'madlibs-templates.json');

const CATEGORY_LABELS = {
  classics: 'Classics',
  legacy: 'Legacy',
  generic: 'Generic',
  themed: 'Themed',
  official: 'Official',
  'woo-jr': 'Woo! Jr'
};

const SUBDIRS = ['classics', 'legacy', 'generic', 'themed', 'official', 'woo-jr'];

function countWords(text) {
  const m = String(text).match(/\b[\w''-]+\b/g);
  return m ? m.length : 0;
}

function countBlanks(text) {
  const m = String(text).match(/\{[^}]+\}/g);
  return m ? m.length : 0;
}

function validateStory(title, entry, folderCategory) {
  if (!entry?.text) {
    throw new Error(`${title}: missing text`);
  }
  if (Array.isArray(entry.text)) {
    throw new Error(
      `${title}: legacy text[]/blanks[] format — run node scripts/migrate-madlib-to-tags.mjs`
    );
  }
  if (typeof entry.text !== 'string') {
    throw new Error(`${title}: text must be a string`);
  }
  const text = entry.text.trim();
  if (!text.includes('{')) {
    throw new Error(`${title}: text must contain {tag} placeholders`);
  }
  const blankCount = countBlanks(text);
  if (blankCount < 8) {
    throw new Error(`${title}: expected at least 8 blanks, got ${blankCount}`);
  }
  if (blankCount > 18) {
    console.warn(`  warn: ${title} has ${blankCount} blanks (typical 8–18)`);
  }
  const words = countWords(text);
  if (words < 60 || words > 200) {
    console.warn(`  warn: ${title} is ~${words} words (target 80–140)`);
  }

  const collection = entry.collection || inferCollectionFromFolder(folderCategory);
  const format = entry.format;
  const tags = entry.tags;
  validateTaxonomy(title, { collection, format, tags }, { requireAll: true });

  return {
    text,
    category: entry.category || folderCategory,
    collection,
    format,
    tags: [...tags],
    blankCount,
    wordCount: words
  };
}

function walkOriginals() {
  const out = {};
  if (!fs.existsSync(originalsDir)) return out;
  for (const sub of SUBDIRS) {
    const dir = path.join(originalsDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const full = path.join(dir, file);
      const entry = JSON.parse(fs.readFileSync(full, 'utf8'));
      const title = entry.title || file.replace(/\.json$/, '').replace(/-/g, ' ');
      if (out[title]) throw new Error(`Duplicate title: ${title}`);
      out[title] = validateStory(title, entry, sub);
    }
  }
  return out;
}

function main() {
  const bundle = walkOriginals();
  const titles = Object.keys(bundle).sort((a, b) => a.localeCompare(b));
  const ordered = {};
  for (const t of titles) ordered[t] = bundle[t];
  fs.writeFileSync(outPath, JSON.stringify(ordered, null, 2) + '\n');
  const byCat = {};
  for (const [, e] of Object.entries(ordered)) {
    byCat[e.category] = (byCat[e.category] || 0) + 1;
  }
  console.log(`Wrote ${titles.length} templates → ${path.relative(root, outPath)}`);
  for (const [cat, n] of Object.entries(byCat).sort()) {
    console.log(`  ${CATEGORY_LABELS[cat] || cat}: ${n}`);
  }
}

main();
