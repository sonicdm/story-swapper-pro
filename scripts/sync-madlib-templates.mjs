#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'src', 'data');
const classicsPath = path.join(dataDir, 'madlibs-classics.json');
const originalsDir = path.join(dataDir, 'madlib-originals');
const outPath = path.join(dataDir, 'madlibs-templates.json');

const CATEGORY_LABELS = {
  classics: 'Classics',
  legacy: 'Legacy',
  generic: 'Generic',
  themed: 'Themed'
};

function countWords(text) {
  const m = String(text).match(/\b[\w''-]+\b/g);
  return m ? m.length : 0;
}

function validateStory(title, entry, category, { strictBlanks = true } = {}) {
  if (!entry?.text || !entry?.blanks) {
    throw new Error(`${title}: missing text or blanks`);
  }
  if (!Array.isArray(entry.text) || !Array.isArray(entry.blanks)) {
    throw new Error(`${title}: text and blanks must be arrays`);
  }
  if (entry.text.length !== entry.blanks.length + 1) {
    throw new Error(`${title}: text.length must be blanks.length + 1 (got ${entry.text.length} / ${entry.blanks.length})`);
  }
  const blankCount = entry.blanks.length;
  if (strictBlanks && (blankCount < 8 || blankCount > 18)) {
    throw new Error(`${title}: expected 8–18 blanks, got ${blankCount}`);
  }
  const body = entry.text.join('___') + entry.text[entry.text.length - 1];
  const words = countWords(body);
  if (words < 60 || words > 200) {
    console.warn(`  warn: ${title} is ~${words} words (target 80–140)`);
  }
  return {
    text: entry.text,
    blanks: entry.blanks,
    category: entry.category || category,
    blankCount,
    wordCount: words
  };
}

function loadClassics() {
  const raw = JSON.parse(fs.readFileSync(classicsPath, 'utf8'));
  const out = {};
  for (const [title, entry] of Object.entries(raw)) {
    out[title] = validateStory(title, entry, 'classics', { strictBlanks: false });
  }
  return out;
}

function walkOriginals() {
  const out = {};
  if (!fs.existsSync(originalsDir)) return out;
  for (const sub of ['legacy', 'generic', 'themed']) {
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
  const bundle = { ...loadClassics(), ...walkOriginals() };
  const titles = Object.keys(bundle).sort((a, b) => a.localeCompare(b));
  const ordered = {};
  for (const t of titles) ordered[t] = bundle[t];
  fs.writeFileSync(outPath, JSON.stringify(ordered, null, 2) + '\n');
  const byCat = {};
  for (const [t, e] of Object.entries(ordered)) {
    byCat[e.category] = (byCat[e.category] || 0) + 1;
  }
  console.log(`Wrote ${titles.length} templates → ${path.relative(root, outPath)}`);
  for (const [cat, n] of Object.entries(byCat).sort()) {
    console.log(`  ${CATEGORY_LABELS[cat] || cat}: ${n}`);
  }
}

main();
