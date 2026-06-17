#!/usr/bin/env node
/**
 * One-time migration: text[] + blanks[] → single {tag} text string.
 * Usage: node scripts/migrate-madlib-to-tags.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { madlibsApiStoryToTemplate } from '../src/lib/madlib-api-format.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'src', 'data');
const originalsDir = path.join(dataDir, 'madlib-originals');
const classicsPath = path.join(dataDir, 'madlibs-classics.json');

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isLegacyShape(entry) {
  return Array.isArray(entry?.text) && Array.isArray(entry?.blanks);
}

function toTagString(entry) {
  if (typeof entry.text === 'string' && entry.text.includes('{')) {
    return entry.text.trim();
  }
  if (isLegacyShape(entry)) {
    return madlibsApiStoryToTemplate(entry);
  }
  throw new Error(`Invalid entry shape for "${entry.title}"`);
}

/** Context-based tag fixes from verb-tense audit (applied after conversion). */
const TENSE_FIXES = [
  { title: 'Letter from Camp', from: /every morning we \{verb\}/, to: 'every morning we {past-tense verb}' },
  { title: 'Apology Letter', from: /should not have \{verb\}/, to: 'should not have {past-tense verb}' },
  { title: 'How to Host a Party', from: /you last \{verb ending in -ing\} in public/, to: 'you last {past-tense verb} in public' },
  { title: 'Pet Sitter Instructions', from: /after she \{verb\} politely/, to: 'after she {past-tense verb} politely' },
  { title: "Matilda's Walk Report", from: /Matilda \{verb\} at a/, to: 'Matilda {past-tense verb} at a' },
  { title: "Zebby's Incident Report", from: /Zebby \{verb\} under the couch, then \{verb\}/, to: 'Zebby {past-tense verb} under the couch, then {past-tense verb}' },
  { title: 'AIM Away Message', from: /who \{verb\} who on the bus/, to: 'who {past-tense verb} who on the bus' },
  { title: 'A Spooky Campfire Story', from: /guide us back by \{verb\} the/, to: 'guide us back by {verb ending in -ing} the' },
  { title: 'Weird News', from: /had a history of \{verb\}/, to: 'had a history of {verb ending in -ing}' },
  { title: 'Weird News', from: /after witnessing him \{verb\} with a/, to: 'after witnessing him {verb ending in -ing} with a' },
  { title: 'Trip to the Park', from: /My friend and I \{verb\} all the way home/, to: 'My friend and I {past-tense verb} all the way home' }
];

function applyTenseFixes(title, text) {
  let out = text;
  for (const fix of TENSE_FIXES) {
    if (fix.title !== title) continue;
    out = out.replace(fix.from, fix.to);
  }
  return out;
}

function writeStory(subdir, { title, category, text }) {
  const dir = path.join(originalsDir, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slugify(title)}.json`);
  const payload = { title, category: category || subdir, text };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
  return file;
}

function migrateEntry(title, entry, category) {
  let text = applyTenseFixes(title, toTagString({ ...entry, title: entry.title || title }));
  return { title: entry.title || title, category, text };
}

function main() {
  let count = 0;

  if (fs.existsSync(classicsPath)) {
    const classics = JSON.parse(fs.readFileSync(classicsPath, 'utf8'));
    for (const [title, entry] of Object.entries(classics)) {
      const story = migrateEntry(title, entry, 'classics');
      const file = writeStory('classics', story);
      console.log(`  classics/${path.basename(file)}`);
      count++;
    }
  }

  for (const sub of ['legacy', 'generic', 'themed']) {
    const dir = path.join(originalsDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.json'))) {
      const full = path.join(dir, f);
      const entry = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (!isLegacyShape(entry) && typeof entry.text === 'string') {
        console.log(`  skip ${sub}/${f} (already migrated)`);
        continue;
      }
      const story = migrateEntry(entry.title, entry, sub);
      fs.writeFileSync(full, JSON.stringify(story, null, 2) + '\n');
      console.log(`  ${sub}/${f}`);
      count++;
    }
  }

  console.log(`\nMigrated ${count} template(s).`);
  console.log('Next: delete madlibs-classics.json and seed-madlib-originals.mjs, then npm run sync:madlibs');
}

main();
