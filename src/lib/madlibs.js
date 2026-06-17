import templates from '../data/madlibs-templates.json';
import {
  normalizeMadLibBlank,
  madLibBlankToTag,
  madlibsApiStoryToTemplate,
  STREAMLIT_HINT_ALIASES,
  TAG_FOR_CATEGORY
} from './madlib-api-format.js';

export { normalizeMadLibBlank, madLibBlankToTag, madlibsApiStoryToTemplate };

/** Convert one bundled or API entry to a {tag} template string. */
export function madlibsTemplateEntryToText(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry.text === 'string' && !Array.isArray(entry.text)) {
    return entry.text.trim();
  }
  if (Array.isArray(entry.text) && Array.isArray(entry.blanks)) {
    return madlibsApiStoryToTemplate(entry);
  }
  return '';
}

/** Bundled classic templates (offline fallback, MIT via madlibz / madlibs-api). */
export function listBundledMadLibTitles() {
  return Object.keys(templates).sort((a, b) => a.localeCompare(b));
}

const CATEGORY_ORDER = ['classics', 'legacy', 'generic', 'themed'];
const CATEGORY_LABELS = {
  classics: 'Classics',
  legacy: 'Legacy',
  generic: 'Generic',
  themed: 'Themed'
};

/** Catalog grouped for UI optgroups. */
export function listBundledMadLibCatalog() {
  const groups = new Map(CATEGORY_ORDER.map(c => [c, []]));
  for (const title of listBundledMadLibTitles()) {
    const entry = templates[title];
    const cat = entry?.category || 'classics';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push({ title, ...getMadLibMeta(title, entry) });
  }
  return CATEGORY_ORDER
    .filter(c => groups.get(c)?.length)
    .map(c => ({ id: c, label: CATEGORY_LABELS[c] || c, items: groups.get(c) }));
}

export function getMadLibMeta(title, entry = templates[title]) {
  if (!entry) return { blankCount: 0, wordCount: 0, category: 'classics' };
  const blankCount = entry.blankCount
    ?? (typeof entry.text === 'string' ? (entry.text.match(/\{[^}]+\}/g)?.length ?? 0) : entry.blanks?.length ?? 0);
  const wordCount = entry.wordCount ?? 0;
  return { blankCount, wordCount, category: entry.category || 'classics' };
}

export function getRandomBundledMadLibTitle(exclude = '') {
  const titles = listBundledMadLibTitles().filter(t => t !== exclude);
  return titles[Math.floor(Math.random() * titles.length)];
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
  const body = Array.isArray(data.text)
    ? madlibsApiStoryToTemplate(data)
    : String(data.text);
  if (!body.includes('{')) throw new Error('madlibs-invalid');
  return { title, text: body, source: 'api' };
}
