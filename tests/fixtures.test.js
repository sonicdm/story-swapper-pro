import { describe, it, expect } from 'vitest';
import path from 'path';
import { CATEGORY_LABELS } from '../src/lib/constants.js';
import { loadFixtures } from './helpers/load-fixtures.js';

const fixtures = await loadFixtures();
const CATEGORY_SET = new Set(Object.keys(CATEGORY_LABELS));
const ENGINE_SET = new Set(['compromise', 'compromise+wink']);

function expectCategory(category, context) {
  expect(CATEGORY_SET.has(category), `${context}: invalid category "${category}"`).toBe(true);
}

describe('fixture catalog schema', () => {
  it('loads unique fixture ids', () => {
    expect(fixtures.length).toBeGreaterThan(0);
    expect(new Set(fixtures.map(f => f.id)).size).toBe(fixtures.length);
  });

  for (const fixture of fixtures) {
    it(`validates ${fixture._file}`, () => {
      const basename = path.basename(fixture._file, '.json');
      expect(fixture.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(fixture.id).toBe(basename);
      expect(typeof fixture.name).toBe('string');
      expect(fixture.name.trim().length).toBeGreaterThan(0);
      expect(typeof fixture.text).toBe('string');
      expect(fixture.text.trim().split(/\s+/).length).toBeGreaterThan(3);

      if (fixture.engine != null) {
        expect(ENGINE_SET.has(fixture.engine), fixture.id).toBe(true);
      }

      if (fixture.words != null) {
        expect(fixture.words && typeof fixture.words).toBe('object');
        for (const [word, spec] of Object.entries(fixture.words)) {
          expect(word.trim().length, fixture.id).toBeGreaterThan(0);
          expect(spec && typeof spec, `${fixture.id}:${word}`).toBe('object');
          for (const key of ['categoriesInclude', 'categoriesExclude']) {
            if (spec[key] != null) {
              expect(Array.isArray(spec[key]), `${fixture.id}:${word}:${key}`).toBe(true);
              for (const category of spec[key]) expectCategory(category, `${fixture.id}:${word}:${key}`);
            }
          }
          for (const key of ['pickCategory', 'poolCategory']) {
            if (spec[key] != null) expectCategory(spec[key], `${fixture.id}:${word}:${key}`);
          }
          for (const key of ['eligible', 'skip', 'matchText', 'noCategories']) {
            if (spec[key] != null) expect(typeof spec[key], `${fixture.id}:${word}:${key}`).toBe('boolean');
          }
          for (const key of ['occurrence', 'minConfidence', 'maxConfidence']) {
            if (spec[key] != null) expect(typeof spec[key], `${fixture.id}:${word}:${key}`).toBe('number');
          }
        }
      }

      if (fixture.mustNotSwap != null) {
        expect(Array.isArray(fixture.mustNotSwap), fixture.id).toBe(true);
        for (const entry of fixture.mustNotSwap) {
          if (typeof entry === 'string') {
            expect(entry.trim().length, fixture.id).toBeGreaterThan(0);
          } else {
            expect(typeof entry.word, fixture.id).toBe('string');
            expect(entry.word.trim().length, fixture.id).toBeGreaterThan(0);
          }
        }
      }

      if (fixture.selection != null) {
        expect(typeof fixture.selection.count, `${fixture.id}:selection.count`).toBe('number');
        expect(typeof fixture.selection.seed, `${fixture.id}:selection.seed`).toBe('number');
        if (fixture.selection.minDistance != null) {
          expect(typeof fixture.selection.minDistance, `${fixture.id}:selection.minDistance`).toBe('number');
        }
        if (fixture.selection.allowPartial != null) {
          expect(typeof fixture.selection.allowPartial, `${fixture.id}:selection.allowPartial`).toBe('boolean');
        }
      }
    });
  }
});
