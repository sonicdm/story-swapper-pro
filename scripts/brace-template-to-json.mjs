#!/usr/bin/env node
/**
 * Convert a {tag} template string to madlibs-api JSON (text[] + blanks[]).
 * Usage: node scripts/brace-template-to-json.mjs "Title" "text with {noun} here"
 */
const TAG_TO_BLANK = {
  noun: 'noun',
  'plural noun': 'plural noun',
  adjective: 'adjective',
  adverb: 'adverb',
  verb: 'verb',
  'past-tense verb': 'past tense verb',
  'verb ending in -ing': "verb ending in 'ing'",
  person: 'name',
  place: 'a place',
  color: 'color',
  animal: 'animal',
  object: 'object',
  'body part': 'body part',
  food: 'food',
  number: 'number',
  emotion: 'emotion',
  job: 'job',
  vehicle: 'vehicle',
  'clothing item': 'clothing item',
  'silly word': 'silly word',
  sound: 'sound'
};

export function braceTemplateToJson(title, text) {
  const re = /\{([^}]+)\}/g;
  const textParts = [];
  const blanks = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    textParts.push(text.slice(last, m.index));
    const tag = m[1].trim().toLowerCase();
    blanks.push(TAG_TO_BLANK[tag] || tag);
    last = m.index + m[0].length;
  }
  textParts.push(text.slice(last));
  return { title, text: textParts, blanks };
}

if (process.argv[1]?.includes('brace-template-to-json')) {
  const title = process.argv[2];
  const body = process.argv.slice(3).join(' ') || process.stdin.read?.()?.toString();
  if (!title || !body) {
    console.error('Usage: node scripts/brace-template-to-json.mjs "Title" "template {noun} text"');
    process.exit(1);
  }
  console.log(JSON.stringify(braceTemplateToJson(title, body), null, 2));
}
