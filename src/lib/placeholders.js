import { CATEGORY_LABELS, CATEGORY_HINTS } from './constants.js';
import { resolvePromptCount, selectReplacementCandidates } from './classify.js';

/** Map placeholder tag (inside braces) to internal category id. */
const PLACEHOLDER_ALIASES = {
  verb: 'verb',
  verbs: 'verb',
  adjective: 'adjective',
  adjectives: 'adjective',
  adj: 'adjective',
  noun: 'noun',
  nouns: 'noun',
  'plural noun': 'plural noun',
  'plural nouns': 'plural noun',
  plural: 'plural noun',
  plurals: 'plural noun',
  'past-tense verb': 'past-tense verb',
  'past tense verb': 'past-tense verb',
  'past tense': 'past-tense verb',
  past: 'past-tense verb',
  animal: 'animal',
  animals: 'animal',
  place: 'place',
  places: 'place',
  emotion: 'emotion',
  emotions: 'emotion',
  object: 'object',
  objects: 'object',
  sound: 'sound',
  sounds: 'sound',
  number: 'number',
  numbers: 'number',
  'body part': 'body part',
  'body parts': 'body part',
  bodypart: 'body part',
  bodyparts: 'body part',
  name: 'name of someone in the room',
  person: 'name of someone in the room',
  someone: 'name of someone in the room',
  color: 'color',
  colours: 'color',
  colour: 'color',
  colors: 'color',
  food: 'food',
  foods: 'food',
  job: 'job',
  jobs: 'job',
  occupation: 'job',
  vehicle: 'vehicle',
  vehicles: 'vehicle',
  clothing: 'clothing item',
  'clothing item': 'clothing item',
  clothes: 'clothing item',
  garment: 'clothing item',
  silly: 'silly word',
  'silly word': 'silly word',
  adverb: 'adverb',
  adverbs: 'adverb',
  adv: 'adverb',
  ing: 'verb ending in -ing',
  'verb ending in -ing': 'verb ending in -ing',
  'verb ing': 'verb ending in -ing',
  gerund: 'verb ending in -ing',
  'he or she': 'name of someone in the room',
  'his or her': 'name of someone in the room',
  'foreign country': 'place',
  'a place': 'place',
  'type of liquid': 'food',
  'part of the body': 'body part',
  'part of body': 'body part',
  'another body part': 'body part',
  'article of clothing': 'clothing item',
  'adjective ending in -est': 'adjective',
  'noun; place': 'place',
  'plural noun; type of job': 'job',
  celebrity: 'name of someone in the room'
};

const PLACEHOLDER_RE = /\{[^{}]+\}/;

export function resolvePlaceholderCategory(raw) {
  const key = (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return PLACEHOLDER_ALIASES[key] || null;
}

export function hasPlaceholders(text) {
  return PLACEHOLDER_RE.test(text)
    || /_{3,}/.test(text)
    || /<[^<>]+>/.test(text)
    || /--[A-Z][A-Z0-9_ ]+--/.test(text);
}

/** Build prompt list from {tag} blank tokens (template / Mad Libs mode). */
export function selectPlaceholderCandidates(tokens) {
  const blanks = tokens.filter(t => t.type === 'blank');
  if (!blanks.length) return [];

  return blanks.map(tok => {
    const category = tok.blankCategory || 'noun';
    return {
      tokenIndex: tok.index,
      originalWord: tok.text,
      category,
      label: CATEGORY_LABELS[category] || category,
      hint: CATEGORY_HINTS[category] || '',
      isPlaceholder: true,
      preservePossessive: false,
      preservePlural: category === 'plural noun'
    };
  });
}

/**
 * Tagged blanks first; NLP extras only when prompt count is a fixed number above tag count.
 * With promptSetting "auto" and {tags} present, uses tags only (classic Mad Libs form).
 */
export function selectMixedCandidates(tokens, classifications, options) {
  const { revealLength, promptSetting, seed, dictionaryPos: dictIn = null } = options;
  const placeholders = selectPlaceholderCandidates(tokens);

  const dictOpts = dictIn?.size ? { dictionaryPos: dictIn } : {};

  if (!placeholders.length) {
    return selectReplacementCandidates(tokens, classifications, {
      count: resolvePromptCount(revealLength, promptSetting),
      seed,
      allowPartial: true,
      ...dictOpts
    });
  }

  if (promptSetting === 'auto') {
    return placeholders;
  }

  const reserved = new Set(placeholders.map(p => p.tokenIndex));
  const targetCount = Math.max(
    resolvePromptCount(revealLength, promptSetting),
    placeholders.length
  );
  const extraCount = targetCount - placeholders.length;

  if (extraCount <= 0) {
    return placeholders;
  }

  const extras = selectReplacementCandidates(tokens, classifications, {
    count: extraCount,
    seed,
    excludeTokenIndices: reserved,
    allowPartial: true,
    ...dictOpts
  });

  return [...placeholders, ...extras];
}

export function countPlaceholders(tokens) {
  return tokens.filter(t => t.type === 'blank').length;
}

/** Synthetic original for grammar fitting when there is no real source word. */
export function placeholderOriginalForCategory(category) {
  switch (category) {
    case 'past-tense verb': return 'walked';
    case 'verb ending in -ing': return 'walking';
    case 'verb': return 'walk';
    case 'plural noun': return 'things';
    case 'adjective': return 'brave';
    case 'color': return 'red';
    default: return 'word';
  }
}

export { PLACEHOLDER_ALIASES };
