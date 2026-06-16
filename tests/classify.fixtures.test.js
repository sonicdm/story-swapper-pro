import { describe, it, expect, beforeAll } from 'vitest';
import { loadFixtures } from './helpers/load-fixtures.js';
import { getEngine } from './helpers/nlp-session.js';
import {
  assertWordSpec, assertMustNotSwap, assertSelectionExcludes
} from './helpers/assert-word.js';

const RUN_FULL = process.env.TEST_FULL === '1';
const fixtures = await loadFixtures();

function fixtureDescribe(fixture) {
  const needsWink = fixture.engine === 'compromise+wink';
  const skip = needsWink && !RUN_FULL;
  return skip ? describe.skip : describe;
}

for (const fixture of fixtures) {
  fixtureDescribe(fixture)(`fixture: ${fixture.id}`, () => {
    /** @type {import('./helpers/analyze.js').AnalyzeResult} */
    let analysis;

    beforeAll(async () => {
      const engine = await getEngine(fixture.engine || 'compromise');
      const { analyzeTextWithDictionary } = await import('./helpers/analyze.js');
      analysis = await analyzeTextWithDictionary(fixture.text, engine);
    });

    it('has enough word tokens', () => {
      expect(analysis.wordTokens.length).toBeGreaterThan(10);
    });

    if (fixture.words) {
      for (const [key, spec] of Object.entries(fixture.words)) {
        it(`word "${key}"`, () => {
          assertWordSpec(analysis, key, spec);
        });
      }
    }

    if (fixture.mustNotSwap?.length) {
      it('protected words are not swap-eligible', () => {
        assertMustNotSwap(analysis, fixture.mustNotSwap);
      });
    }

    if (fixture.selection && fixture.mustNotSwap?.length) {
      it(`seeded selection (${fixture.selection.seed}) excludes protected words`, () => {
        assertSelectionExcludes(analysis, fixture.mustNotSwap, fixture.selection);
      });
    }

    if (fixture.minPoolSize != null) {
      it(`swap pool has at least ${fixture.minPoolSize} entries`, () => {
        expect(analysis.pool.length).toBeGreaterThanOrEqual(fixture.minPoolSize);
      });
    }
  });
}

describe('fixture catalog', () => {
  it('loads at least one regression fixture', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });
});
