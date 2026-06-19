import { resolvePlaceholderCategory } from './placeholders.js';
import { FORMAT_ORDER, TAG_ORDER } from './madlib-taxonomy.js';
import { TAG_FOR_CATEGORY } from './madlib-api-format.js';

export const CUSTOM_TEMPLATE_STORAGE_KEY = 'storySwapper:customTemplates:v1';
export const CUSTOM_TEMPLATE_COLLECTION = 'custom';
export const CUSTOM_TEMPLATE_VERSION = 1;

export const EDITOR_BLANK_TAGS = [
  'noun',
  'plural noun',
  'adjective',
  'adverb',
  'verb',
  'past-tense verb',
  'verb ending in -ing',
  'person',
  'place',
  'animal',
  'object',
  'food',
  'color',
  'number',
  'emotion',
  'body part',
  'job',
  'vehicle',
  'clothing item',
  'sound',
  'silly word',
  'day of week'
];

const DEFAULT_TAGS = ['everyday'];
const WORD_RE = /\b[\w'-]+\b/g;
const PLACEHOLDER_RE = /\{([^{}]+)\}/g;

function storageOrNull() {
  try {
    return globalThis.localStorage || null;
  } catch (_) {
    return null;
  }
}

function makeTemplateId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function countWordsLocal(text) {
  const m = String(text || '').match(WORD_RE);
  return m ? m.length : 0;
}

export function tagForCategory(category) {
  return TAG_FOR_CATEGORY[category] || category;
}

export function customTemplateKey(id) {
  return `custom:${id}`;
}

export function isCustomTemplateKey(key) {
  return String(key || '').startsWith('custom:');
}

export function customIdFromKey(key) {
  return isCustomTemplateKey(key) ? String(key).slice('custom:'.length) : '';
}

export function placeholderTags(text) {
  return [...String(text || '').matchAll(PLACEHOLDER_RE)].map(m => m[1].trim()).filter(Boolean);
}

export function unsupportedPlaceholderTags(text) {
  const bad = new Set();
  for (const tag of placeholderTags(text)) {
    if (!resolvePlaceholderCategory(tag)) bad.add(tag);
  }
  return [...bad].sort((a, b) => a.localeCompare(b));
}

export function validBlankCount(text) {
  return placeholderTags(text).filter(tag => resolvePlaceholderCategory(tag)).length;
}

function normalizeTags(tags) {
  const picked = Array.isArray(tags) ? tags : [];
  const valid = picked.filter(t => TAG_ORDER.includes(t));
  return [...new Set(valid)].slice(0, 3);
}

function uniqueTitle(title, existing) {
  const base = String(title || 'Untitled Template').trim() || 'Untitled Template';
  const used = new Set(existing.map(t => String(t.title || '').toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; i < 1000; i++) {
    const next = `${base} Copy ${i}`;
    if (!used.has(next.toLowerCase())) return next;
  }
  return `${base} Copy`;
}

export function validateCustomTemplate(input, existing = [], currentId = '') {
  const title = String(input?.title || '').trim();
  const text = String(input?.text || '').replace(/\r\n/g, '\n').trim();
  const format = FORMAT_ORDER.includes(input?.format) ? input.format : 'story';
  const tags = normalizeTags(input?.tags);
  const badTags = unsupportedPlaceholderTags(text);
  const blankCount = validBlankCount(text);
  const wordCount = countWordsLocal(text);
  const errors = [];
  const warnings = [];

  if (!title) errors.push('Title is required.');
  if (!text) errors.push('Template text is required.');
  if (badTags.length) errors.push(`Unsupported blank tags: ${badTags.join(', ')}.`);
  if (blankCount < 1) errors.push('Add at least one supported blank tag before saving.');
  if (!FORMAT_ORDER.includes(format)) errors.push(`Unsupported format: ${input?.format}.`);
  if (tags.length < 1 || tags.length > 3) errors.push('Choose 1 to 3 topic tags.');

  const duplicate = existing.find(t => {
    return String(t.id || '') !== String(currentId || '')
      && String(t.title || '').trim().toLowerCase() === title.toLowerCase();
  });
  if (duplicate) warnings.push('Another saved template already uses this title.');
  if (blankCount > 0 && blankCount < 8) warnings.push('Most Mad Libs work better with at least 8 blanks.');
  if (blankCount > 18) warnings.push('This has more than 18 blanks, which may feel long on phones.');
  if (wordCount > 180) warnings.push('This is longer than most built-in templates.');

  return { errors, warnings, title, text, format, tags: tags.length ? tags : DEFAULT_TAGS, blankCount, wordCount };
}

export function buildCustomTemplate(input, existing = [], options = {}) {
  const currentId = options.forceNewId ? '' : String(input?.id || '');
  const validation = validateCustomTemplate(input, existing, currentId);
  if (validation.errors.length) {
    throw new Error(validation.errors.join('\n'));
  }
  const createdAt = input?.createdAt || options.now || nowIso();
  return {
    id: options.forceNewId ? makeTemplateId() : (input?.id || makeTemplateId()),
    title: validation.title,
    text: validation.text,
    collection: CUSTOM_TEMPLATE_COLLECTION,
    category: CUSTOM_TEMPLATE_COLLECTION,
    format: validation.format,
    tags: validation.tags,
    createdAt,
    updatedAt: options.now || nowIso()
  };
}

function normalizeStoredTemplate(input) {
  try {
    return buildCustomTemplate({
      ...input,
      id: input?.id || makeTemplateId(),
      tags: normalizeTags(input?.tags).length ? input.tags : DEFAULT_TAGS
    }, [], { now: input?.updatedAt || nowIso() });
  } catch (_) {
    return null;
  }
}

export function loadCustomTemplates(storage = storageOrNull()) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(CUSTOM_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : parsed.templates;
    if (!Array.isArray(entries)) return [];
    return entries.map(normalizeStoredTemplate).filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function saveCustomTemplates(templates, storage = storageOrNull()) {
  if (!storage) throw new Error('Browser storage is unavailable.');
  const normalized = templates.map(normalizeStoredTemplate).filter(Boolean);
  storage.setItem(CUSTOM_TEMPLATE_STORAGE_KEY, JSON.stringify({
    version: CUSTOM_TEMPLATE_VERSION,
    templates: normalized
  }));
  return normalized;
}

export function upsertCustomTemplate(template, storage = storageOrNull()) {
  const existing = loadCustomTemplates(storage);
  const next = buildCustomTemplate(template, existing);
  const without = existing.filter(t => t.id !== next.id);
  saveCustomTemplates([...without, next], storage);
  return next;
}

export function deleteCustomTemplate(id, storage = storageOrNull()) {
  const existing = loadCustomTemplates(storage);
  const next = existing.filter(t => t.id !== id);
  saveCustomTemplates(next, storage);
  return next;
}

export function customTemplateToCatalogItem(template) {
  const blankCount = validBlankCount(template.text);
  return {
    key: customTemplateKey(template.id),
    title: template.title,
    text: template.text,
    category: CUSTOM_TEMPLATE_COLLECTION,
    collection: CUSTOM_TEMPLATE_COLLECTION,
    format: template.format || 'story',
    tags: normalizeTags(template.tags).length ? normalizeTags(template.tags) : DEFAULT_TAGS,
    blankCount,
    wordCount: countWordsLocal(template.text),
    source: CUSTOM_TEMPLATE_COLLECTION,
    customId: template.id
  };
}

export function listCustomMadLibItems(storage = storageOrNull()) {
  return loadCustomTemplates(storage).map(customTemplateToCatalogItem);
}

export function getCustomTemplateByKey(key, storage = storageOrNull()) {
  const id = customIdFromKey(key);
  if (!id) return null;
  return loadCustomTemplates(storage).find(t => t.id === id) || null;
}

export function serializeCustomTemplatePack(templates) {
  return JSON.stringify({
    version: CUSTOM_TEMPLATE_VERSION,
    templates: templates.map(t => ({
      title: t.title,
      text: t.text,
      format: t.format || 'story',
      tags: normalizeTags(t.tags).length ? normalizeTags(t.tags) : DEFAULT_TAGS
    }))
  }, null, 2);
}

export function parseCustomTemplatePack(raw, existing = [], options = {}) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {
    return { templates: [], errors: ['Import file is not valid JSON.'] };
  }

  const entries = Array.isArray(data)
    ? data
    : Array.isArray(data?.templates)
      ? data.templates
      : data && typeof data === 'object'
        ? [data]
        : [];

  if (!entries.length) return { templates: [], errors: ['No templates found in import file.'] };

  const accepted = [];
  const errors = [];
  const running = [...existing];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const titled = {
        ...entry,
        title: uniqueTitle(entry?.title, running),
        tags: normalizeTags(entry?.tags).length ? entry.tags : DEFAULT_TAGS
      };
      const template = buildCustomTemplate(titled, running, {
        forceNewId: true,
        now: options.now || nowIso()
      });
      accepted.push(template);
      running.push(template);
    } catch (err) {
      errors.push(`Template ${i + 1}: ${err.message}`);
    }
  }

  return { templates: accepted, errors };
}
