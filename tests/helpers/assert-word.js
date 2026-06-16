import { expect } from 'vitest';
import { wordReport, selectWithSeed } from './analyze.js';

function formatReport(report) {
  if (!report.found) return `word "${report.key}" not found in text`;
  const lines = [
    `"${report.text}" (norm: ${report.norm})`,
    `  categories: [${report.categories.join(', ')}]`,
    `  confidence: ${report.confidence.toFixed(2)}`,
    `  pickCategory: ${report.pickCategory ?? '(none)'}`,
    `  swap-eligible: ${report.eligible}`
  ];
  if (report.poolCategory) lines.push(`  pool category: ${report.poolCategory}`);
  return lines.join('\n');
}

/**
 * Assert a single word spec from a fixture.
 * @param {object} analysis - from analyzeText()
 * @param {string} key - word key in fixture
 * @param {object} spec - expected properties
 */
export function assertWordSpec(analysis, key, spec = {}) {
  const report = wordReport(analysis, key, spec);
  expect(report.found, `Expected word "${key}" in passage`).toBe(true);

  const ctx = `\n${formatReport(report)}`;

  if (spec.eligible === false || spec.skip === true) {
    expect(report.eligible, `should NOT be swap-eligible${ctx}`).toBe(false);
  }
  if (spec.eligible === true) {
    expect(report.eligible, `should be swap-eligible${ctx}`).toBe(true);
  }

  if (spec.categoriesInclude?.length) {
    for (const cat of spec.categoriesInclude) {
      expect(report.categories, `missing category "${cat}"${ctx}`).toContain(cat);
    }
  }

  if (spec.categoriesExclude?.length) {
    for (const cat of spec.categoriesExclude) {
      expect(report.categories, `should not include "${cat}"${ctx}`).not.toContain(cat);
    }
  }

  if (spec.pickCategory != null) {
    expect(report.pickCategory, `pickCategory mismatch${ctx}`).toBe(spec.pickCategory);
  }

  if (spec.poolCategory != null) {
    expect(report.poolCategory, `poolCategory mismatch${ctx}`).toBe(spec.poolCategory);
  }

  if (spec.minConfidence != null) {
    expect(report.confidence, `confidence too low${ctx}`).toBeGreaterThanOrEqual(spec.minConfidence);
  }

  if (spec.maxConfidence != null) {
    expect(report.confidence, `confidence too high${ctx}`).toBeLessThanOrEqual(spec.maxConfidence);
  }

  if (spec.noCategories === true) {
    expect(report.categories, `expected no categories${ctx}`).toHaveLength(0);
  }

  return report;
}

export function assertMustNotSwap(analysis, words, spec = {}) {
  for (const entry of words) {
    const key = typeof entry === 'string' ? entry : entry.word;
    const wordSpec = typeof entry === 'string' ? spec : { ...spec, ...entry };
    assertWordSpec(analysis, key, { eligible: false, ...wordSpec });
  }
}

export function assertSelectionExcludes(analysis, mustNotSwap, selection) {
  const picks = selectWithSeed(analysis, selection);
  const picked = picks.map(p => p.originalWord);
  for (const word of mustNotSwap) {
    expect(picked, `selection should not include "${word}"; got: ${picked.join(', ')}`).not.toContain(word);
  }
  return picks;
}
