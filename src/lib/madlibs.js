import templates from '../data/madlibs-templates.json';

/**
 * Map classic Mad Libs blank labels (madlibs-api, madlibz, streamlit-games) to our {tag} names.
 * Inspired by HermanFasset/madlibz, chroline/madlibs-api, joelgrus/streamlit-games,
 * Rosetta Code <tag> templates, and workergnome/madlibs --NOUN-- markers.
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
  'name': 'name of someone in the room',
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

const STREAMLIT_HINT_ALIASES = {
  animal_plural: 'animal',
  body_plural: 'body part',
  food_plural: 'food'
};

/** Normalize a Mad Libs blank label to an internal category id, or null. */
export function normalizeMadLibBlank(raw) {
  const key = (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  return MADLIB_BLANK_ALIASES[key] || null;
}

const TAG_FOR_CATEGORY = {
  'name of someone in the room': 'person',
  'verb ending in -ing': 'verb ending in -ing',
  'past-tense verb': 'past-tense verb',
  'body part': 'body part',
  'clothing item': 'clothing item',
  'silly word': 'silly word',
  'plural noun': 'plural noun'
};

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

/** Convert one entry from madlibs-api templates.json. */
export function madlibsTemplateEntryToText(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  return madlibsApiStoryToTemplate(entry);
}

/** Bundled classic templates (offline fallback, MIT via madlibz / madlibs-api). */
export function listBundledMadLibTitles() {
  return Object.keys(templates).sort((a, b) => a.localeCompare(b));
}

export function getBundledMadLib(title) {
  const entry = templates[title];
  if (!entry) return null;
  return {
    title,
    text: madlibsTemplateEntryToText(entry),
    source: 'bundled'
  };
}

export function getRandomBundledMadLib() {
  const titles = listBundledMadLibTitles();
  const title = titles[Math.floor(Math.random() * titles.length)];
  return getBundledMadLib(title);
}

/**
 * Normalize alternate template syntax before tokenize:
 * - Rosetta Code / Manning-style <noun>, <he or she>
 * - streamlit-games <word::animal_plural/>
 * - workergnome corpus --NOUN--
 */
export function normalizeTemplateSyntax(text) {
  if (!text) return text;
  let out = text;

  out = out.replace(/<([^<>]+)>/g, (_m, inner) => {
    const trimmed = inner.trim();
    const hintPart = trimmed.includes('::') ? trimmed.split('::')[1] : '';
    const hint = hintPart.replace(/\/+$/, '').trim().toLowerCase();
    const wordPart = trimmed.split('::')[0].trim();
    const fromHint = hint ? (STREAMLIT_HINT_ALIASES[hint] || normalizeMadLibBlank(hint)) : null;
    const category = fromHint || normalizeMadLibBlank(wordPart);
    const tag = category
      ? (TAG_FOR_CATEGORY[category] || category)
      : madLibBlankToTag(wordPart);
    return `{${tag}}`;
  });

  out = out.replace(/--([A-Z][A-Z0-9_ ]+)--/g, (_m, label) => {
    const category = normalizeMadLibBlank(label.replace(/_/g, ' ').trim()) || 'noun';
    return `{${madLibBlankToTag(category)}}`;
  });

  return out;
}

export function parseMadLibApiResponse(data) {
  if (!data?.text) throw new Error('madlibs-invalid');
  const title = data.title || 'Mad Libs';
  const body = madlibsApiStoryToTemplate(data);
  if (!body.includes('{')) throw new Error('madlibs-invalid');
  return { title, text: body, source: 'api' };
}
