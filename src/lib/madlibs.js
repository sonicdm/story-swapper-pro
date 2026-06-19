import templates from '../data/madlibs-templates.json';
import {
  normalizeMadLibBlank,
  madLibBlankToTag,
  madlibsApiStoryToTemplate,
  STREAMLIT_HINT_ALIASES,
  TAG_FOR_CATEGORY
} from './madlib-api-format.js';
import {
  FORMAT_ORDER,
  FORMAT_LABELS,
  COLLECTIONS,
  COLLECTION_LABELS,
  TAG_ORDER,
  TAG_LABELS,
  filterMadLibTemplates
} from './madlib-taxonomy.js';

export { normalizeMadLibBlank, madLibBlankToTag, madlibsApiStoryToTemplate };
export {
  FORMAT_ORDER,
  FORMAT_LABELS,
  COLLECTIONS,
  COLLECTION_LABELS,
  TAG_ORDER,
  TAG_LABELS,
  filterMadLibTemplates
};

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

/** All bundled template titles (sorted). */
export function listBundledMadLibTitles(filter = null) {
  const items = listBundledMadLibItems();
  const filtered = filter ? filterMadLibTemplates(items, filter) : items;
  return filtered.map(i => i.title).sort((a, b) => a.localeCompare(b));
}

/** Flat list of templates with browse metadata. */
export function listBundledMadLibItems() {
  return listBundledMadLibTitlesRaw().map(title => ({
    title,
    ...getMadLibMeta(title)
  }));
}

function listBundledMadLibTitlesRaw() {
  return Object.keys(templates).sort((a, b) => a.localeCompare(b));
}

/** Catalog grouped by format for UI optgroups. */
export function listBundledMadLibCatalog(filter = null) {
  const items = filter ? filterMadLibTemplates(listBundledMadLibItems(), filter) : listBundledMadLibItems();
  const groups = new Map(FORMAT_ORDER.map(f => [f, []]));
  for (const item of items) {
    const fmt = item.format || 'story';
    if (!groups.has(fmt)) groups.set(fmt, []);
    groups.get(fmt).push(item);
  }
  return FORMAT_ORDER
    .filter(f => groups.get(f)?.length)
    .map(f => ({
      id: f,
      label: FORMAT_LABELS[f] || f,
      items: groups.get(f).sort((a, b) => a.title.localeCompare(b.title))
    }));
}

export function getMadLibMeta(title, entry = templates[title]) {
  if (!entry) {
    return {
      blankCount: 0,
      wordCount: 0,
      category: 'classics',
      collection: 'classic',
      format: 'story',
      tags: []
    };
  }
  const blankCount = entry.blankCount
    ?? (typeof entry.text === 'string' ? (entry.text.match(/\{[^}]+\}/g)?.length ?? 0) : entry.blanks?.length ?? 0);
  const wordCount = entry.wordCount ?? 0;
  return {
    blankCount,
    wordCount,
    category: entry.category || 'classics',
    collection: entry.collection || (entry.category === 'classics' ? 'classic' : entry.category === 'official' ? 'official' : entry.category === 'woo-jr' ? 'woo-jr' : 'original'),
    format: entry.format || 'story',
    tags: Array.isArray(entry.tags) ? [...entry.tags] : []
  };
}

export function getRandomBundledMadLibTitle(exclude = '', filter = null) {
  const titles = listBundledMadLibTitles(filter).filter(t => t !== exclude);
  if (!titles.length) return '';
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
