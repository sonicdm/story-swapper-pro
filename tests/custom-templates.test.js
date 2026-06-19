import { describe, it, expect } from 'vitest';
import {
  CUSTOM_TEMPLATE_STORAGE_KEY,
  buildCustomTemplate,
  customTemplateKey,
  customTemplateToCatalogItem,
  loadCustomTemplates,
  parseCustomTemplatePack,
  saveCustomTemplates,
  serializeCustomTemplatePack,
  unsupportedPlaceholderTags,
  validateCustomTemplate
} from '../src/lib/custom-templates.js';

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
}

describe('custom templates', () => {
  it('validates supported and unsupported blank tags', () => {
    const valid = validateCustomTemplate({
      title: 'Test',
      text: 'Hello {noun}, go to {place}.',
      format: 'story',
      tags: ['everyday']
    });
    expect(valid.errors).toEqual([]);
    expect(valid.blankCount).toBe(2);

    expect(unsupportedPlaceholderTags('Hello {wizard mood}.')).toEqual(['wizard mood']);
    const invalid = validateCustomTemplate({
      title: 'Broken',
      text: 'Hello {wizard mood}.',
      format: 'story',
      tags: ['everyday']
    });
    expect(invalid.errors.join(' ')).toMatch(/Unsupported blank tags/);
  });

  it('round-trips through browser storage', () => {
    const storage = memoryStorage();
    const template = buildCustomTemplate({
      title: 'Tiny Memo',
      text: '## Memo\n\nBring a {adjective} {object}.',
      format: 'announcement',
      tags: ['workplace']
    }, [], { now: '2026-06-19T00:00:00.000Z' });

    saveCustomTemplates([template], storage);
    const loaded = loadCustomTemplates(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe('Tiny Memo');
    expect(loaded[0].text).toContain('## Memo');
  });

  it('ignores corrupt storage', () => {
    const storage = memoryStorage({ [CUSTOM_TEMPLATE_STORAGE_KEY]: '{bad json' });
    expect(loadCustomTemplates(storage)).toEqual([]);
  });

  it('exports and imports packs with new ids and copy titles', () => {
    const existing = [buildCustomTemplate({
      title: 'Tiny Memo',
      text: 'Hello {noun}.',
      format: 'story',
      tags: ['everyday']
    })];
    const exported = serializeCustomTemplatePack(existing);
    const imported = parseCustomTemplatePack(exported, existing, {
      now: '2026-06-19T00:00:00.000Z'
    });

    expect(imported.errors).toEqual([]);
    expect(imported.templates).toHaveLength(1);
    expect(imported.templates[0].id).not.toBe(existing[0].id);
    expect(imported.templates[0].title).toBe('Tiny Memo Copy 2');
  });

  it('creates catalog metadata for runtime custom templates', () => {
    const template = buildCustomTemplate({
      title: 'Checklist',
      text: '- Pack {food}\n- Wear {color} {clothing item}',
      format: 'checklist',
      tags: ['travel', 'food']
    });
    const item = customTemplateToCatalogItem(template);
    expect(item.key).toBe(customTemplateKey(template.id));
    expect(item.collection).toBe('custom');
    expect(item.blankCount).toBe(3);
    expect(item.tags).toEqual(['travel', 'food']);
  });
});
