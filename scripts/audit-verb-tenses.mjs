#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function normalizeCat(c) {
  if (c === "verb ending in 'ing'" || c === 'verb ending in -ing') return 'verb ending in ing';
  if (c === 'past-tense verb') return 'past-tense verb';
  if (c === 'verb') return 'verb';
  return c;
}

function expectedTense(before, after) {
  const pre = before.toLowerCase().replace(/\*\*/g, '');
  const post = after.toLowerCase().replace(/\*\*/g, '');

  const base = [
    /\bto $/, /\bnot $/, /\bplease $/, /\bwill $/, /\bmay $/, /\bmust $/, /\bcannot $/, /\bcan $/,
    /\bable to $/, /\blearned to $/, /\btaught us to $/, /\bwants to $/, /\btries to $/,
    /\battempted to $/, /\bforgot to $/, /\bhow to $/, /\bdo not $/, /\bteach her to $/,
    /\bunable to $/, /\bpower to $/, /\bwho must $/, /\bwho can $/, /\bwho wants to $/,
    /\bwhen a parent needs the phone, $/, /\bmay not $/
  ];
  for (const p of base) if (p.test(pre)) return 'verb';

  const past = [
    /\bsomeone $/, /\bevery morning we $/, /\bafter she $/, /\bthen $/,
    /\bmatilda $/, /\bzebby $/, /\bshould not have $/, /\byou last $/
  ];
  for (const p of past) if (p.test(pre)) return 'past-tense verb';
  if (/who $/.test(pre) && /^ who/.test(post)) return 'past-tense verb';

  const ing = [
    /\bfor $/, /\bby $/, /\bwhile $/, /\bspent youth $/, /\bpursue $/,
    /\bdeeply sorry for $/, /\bfix attempted by $/
  ];
  for (const p of ing) if (p.test(pre)) return 'verb ending in ing';

  if (/please/i.test(before) && /\bthen $/.test(pre)) return 'verb';

  return null;
}

function auditStory(title, text) {
  const issues = [];
  const re = /\{([^}]+)\}/g;
  let m;
  let lastEnd = 0;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    const cat = m[1].trim();
    if (!/verb|past-tense/i.test(cat)) {
      i++;
      lastEnd = m.index + m[0].length;
      continue;
    }
    const before = text.slice(Math.max(0, m.index - 80), m.index).replace(/\s+/g, ' ');
    const afterEnd = Math.min(text.length, m.index + m[0].length + 80);
    const after = text.slice(m.index + m[0].length, afterEnd).replace(/\s+/g, ' ');
    const exp = expectedTense(before, after);
    const norm = normalizeCat(cat);
    if (exp && exp !== norm) {
      issues.push({ title, i, current: cat, expected: exp === 'verb ending in ing' ? 'verb ending in -ing' : exp, before, after });
    }
    i++;
    lastEnd = m.index + m[0].length;
  }
  return issues;
}

function loadAll() {
  const stories = [];
  const dir = path.join(root, 'src/data/madlib-originals');
  for (const sub of ['classics', 'legacy', 'generic', 'themed']) {
    const subdir = path.join(dir, sub);
    if (!fs.existsSync(subdir)) continue;
    for (const f of fs.readdirSync(subdir).filter(x => x.endsWith('.json'))) {
      const data = JSON.parse(fs.readFileSync(path.join(subdir, f), 'utf8'));
      if (typeof data.text !== 'string') continue;
      stories.push({ title: data.title, text: data.text });
    }
  }
  return stories;
}

const issues = loadAll().flatMap(({ title, text }) => auditStory(title, text));
for (const x of issues) {
  console.log(`${x.title} [${x.i}] ${x.current} → ${x.expected}`);
  console.log(`  …${x.before}[${x.current}]${x.after}…`);
}
console.log(`\n${issues.length} mismatch(es)`);
