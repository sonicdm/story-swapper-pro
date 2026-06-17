/**
 * Mad Libs API blank-label → {tag} conversion (no bundled JSON import).
 * Used by madlibs.js and migration scripts.
 */

const MADLIB_BLANK_ALIASES = {
  noun: 'noun',
  nouns: 'noun',
  'plural noun': 'plural noun',
  'plural nouns': 'plural noun',
  plural: 'plural noun',
  plurals: 'plural noun',
  animals: 'animal',
  animal: 'animal',
  adjective: 'adjective',
  adjectives: 'adjective',
  adj: 'adjective',
  'adjective ending in -est': 'adjective',
  adverb: 'adverb',
  adverbs: 'adverb',
  adv: 'adverb',
  verb: 'verb',
  verbs: 'verb',
  'past tense verb': 'past-tense verb',
  'past tense': 'past-tense verb',
  past: 'past-tense verb',
  'verb ending in ing': 'verb ending in -ing',
  "verb ending in 'ing'": 'verb ending in -ing',
  'verb ending in -ing': 'verb ending in -ing',
  'verb ing': 'verb ending in -ing',
  gerund: 'verb ending in -ing',
  ing: 'verb ending in -ing',
  name: 'name of someone in the room',
  person: 'name of someone in the room',
  someone: 'name of someone in the room',
  celebrity: 'name of someone in the room',
  'he or she': 'name of someone in the room',
  'his or her': 'name of someone in the room',
  'foreign country': 'place',
  'a place': 'place',
  place: 'place',
  places: 'place',
  'noun; place': 'place',
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
  'part of the body': 'body part',
  'part of body': 'body part',
  'another body part': 'body part',
  color: 'color',
  colour: 'color',
  colours: 'color',
  colors: 'color',
  food: 'food',
  foods: 'food',
  'type of liquid': 'food',
  job: 'job',
  jobs: 'job',
  occupation: 'job',
  'plural noun; type of job': 'job',
  vehicle: 'vehicle',
  vehicles: 'vehicle',
  clothing: 'clothing item',
  'clothing item': 'clothing item',
  clothes: 'clothing item',
  garment: 'clothing item',
  'article of clothing': 'clothing item',
  silly: 'silly word',
  'silly word': 'silly word'
};

export const STREAMLIT_HINT_ALIASES = {
  animal_plural: 'animal',
  body_plural: 'body part',
  food_plural: 'food'
};

const TAG_FOR_CATEGORY = {
  'name of someone in the room': 'person',
  'verb ending in -ing': 'verb ending in -ing',
  'past-tense verb': 'past-tense verb',
  'body part': 'body part',
  'clothing item': 'clothing item',
  'silly word': 'silly word',
  'plural noun': 'plural noun'
};

/** Normalize a Mad Libs blank label to an internal category id, or null. */
export function normalizeMadLibBlank(raw) {
  const key = (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  return MADLIB_BLANK_ALIASES[key] || null;
}

/** Pick the best {tag} string for a blank label (falls back to noun). */
export function madLibBlankToTag(raw) {
  const category = normalizeMadLibBlank(raw)
    || (TAG_FOR_CATEGORY[raw] ? raw : null);
  if (!category) return 'noun';
  return TAG_FOR_CATEGORY[category] || category;
}

/** Interleave madlibs-api text[] + blanks[] into a {tag} template string. */
export function madlibsApiStoryToTemplate({ text, blanks }) {
  const parts = Array.isArray(text) ? text : [];
  const labels = Array.isArray(blanks) ? blanks : [];
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    out += parts[i];
    if (i < labels.length) {
      out += `{${madLibBlankToTag(labels[i])}}`;
    }
  }
  return out.trim();
}

export { TAG_FOR_CATEGORY };
