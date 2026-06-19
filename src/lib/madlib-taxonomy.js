/** Mad Lib template browse taxonomy — format optgroups + tag filter chips. */

export const COLLECTIONS = ['classic', 'original', 'official', 'woo-jr'];

export const COLLECTION_LABELS = {
  classic: 'Classic',
  original: 'Original',
  official: 'Official',
  'woo-jr': 'Woo! Jr'
};

export const FORMAT_ORDER = [
  'story',
  'how-to',
  'form',
  'incident-report',
  'announcement',
  'letter',
  'checklist',
  'review',
  'legal',
  'speech',
  'listing',
  'log'
];

export const FORMAT_LABELS = {
  story: 'Stories',
  'how-to': 'How-To Guides',
  form: 'Forms & Applications',
  'incident-report': 'Incident Reports',
  announcement: 'Announcements',
  letter: 'Letters & Memos',
  checklist: 'Checklists & Plans',
  review: 'Reviews & Critiques',
  legal: 'Legal & Waivers',
  speech: 'Speeches & Scripts',
  listing: 'Listings & Profiles',
  log: 'Logs & Transcripts'
};

export const TAG_ORDER = [
  'everyday',
  'workplace',
  'tech',
  'civic',
  'school',
  'travel',
  'food',
  'media',
  'sports',
  'gaming',
  'retro-web',
  'fantasy',
  'sci-fi',
  'spooky',
  'seasonal',
  'pets',
  'kids',
  'parody-bureaucratic'
];

export const TAG_LABELS = {
  everyday: 'Everyday',
  workplace: 'Workplace',
  tech: 'Tech',
  civic: 'Civic',
  school: 'School',
  travel: 'Travel',
  food: 'Food',
  media: 'Media',
  sports: 'Sports',
  gaming: 'Gaming',
  'retro-web': 'Retro Web',
  fantasy: 'Fantasy',
  'sci-fi': 'Sci-Fi',
  spooky: 'Spooky',
  seasonal: 'Seasonal',
  pets: 'Pets',
  kids: 'Kids',
  'parody-bureaucratic': 'Bureaucratic'
};

const FORMAT_SET = new Set(FORMAT_ORDER);
const TAG_SET = new Set(TAG_ORDER);
const COLLECTION_SET = new Set(COLLECTIONS);

export function inferCollectionFromFolder(folder) {
  if (folder === 'classics') return 'classic';
  if (folder === 'official') return 'official';
  if (folder === 'woo-jr') return 'woo-jr';
  return 'original';
}

export function validateTaxonomy(title, { collection, format, tags }, { requireAll = true } = {}) {
  const errors = [];
  if (requireAll || collection != null) {
    if (!collection || !COLLECTION_SET.has(collection)) {
      errors.push(`invalid collection: ${collection}`);
    }
  }
  if (requireAll || format != null) {
    if (!format || !FORMAT_SET.has(format)) {
      errors.push(`invalid format: ${format}`);
    }
  }
  if (requireAll || tags != null) {
    if (!Array.isArray(tags) || tags.length < 1 || tags.length > 3) {
      errors.push(`expected 1–3 tags, got ${tags?.length ?? 0}`);
    } else {
      for (const t of tags) {
        if (!TAG_SET.has(t)) errors.push(`invalid tag: ${t}`);
      }
    }
  }
  if (errors.length) {
    throw new Error(`${title}: ${errors.join('; ')}`);
  }
}

/** Filter bundled templates by title search, collection chips, and tag chips (OR within tags). */
export function filterMadLibTemplates(items, { search = '', tags = [], collections = [] } = {}) {
  const needle = search.trim().toLowerCase();
  const activeTags = tags.filter(t => TAG_SET.has(t));
  const activeCollections = collections.filter(c => COLLECTION_SET.has(c));
  return items.filter(item => {
    if (needle && !item.title.toLowerCase().includes(needle)) return false;
    if (activeCollections.length && !activeCollections.includes(item.collection)) return false;
    if (activeTags.length && !activeTags.some(t => item.tags?.includes(t))) return false;
    return true;
  });
}
