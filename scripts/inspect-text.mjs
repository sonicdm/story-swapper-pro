#!/usr/bin/env node
/** Debug helper: print word-level analysis for a fixture or raw text. */
import { loadFixture, loadFixtures } from '../tests/helpers/load-fixtures.js';
import { getEngine } from '../tests/helpers/nlp-session.js';
import { analyzeText, analyzeTextWithDictionary, wordReport } from '../tests/helpers/analyze.js';

const args = process.argv.slice(2);
const useDictionary = args.includes('--dict');
const filteredArgs = args.filter(a => a !== '--dict');

async function main() {
  if (filteredArgs.includes('--list') || (filteredArgs.length === 0 && args.includes('--list'))) {
    const fixtures = await loadFixtures();
    for (const f of fixtures) {
      console.log(`${f.id.padEnd(28)} ${f.name}`);
    }
    return;
  }

  let text;
  let engineMode = 'compromise+wink';
  let wordFilter = null;

  if (filteredArgs[0] && !filteredArgs[0].startsWith('-')) {
    try {
      const fixture = await loadFixture(filteredArgs[0]);
      text = fixture.text;
      engineMode = fixture.engine || engineMode;
      if (fixture.words) wordFilter = Object.keys(fixture.words);
      console.log(`# ${fixture.name} (${fixture.id})\n`);
    } catch {
      text = filteredArgs.join(' ');
    }
  } else {
    console.error('Usage: node scripts/inspect-text.mjs <fixture-id|--list> [--dict]');
    console.error('       node scripts/inspect-text.mjs "paste raw text here" [--dict]');
    process.exit(1);
  }

  const engine = await getEngine(engineMode);
  const analysis = useDictionary
    ? await analyzeTextWithDictionary(text, engine)
    : analyzeText(text, engine);

  console.log(`Engine: ${analysis.engineName}${useDictionary ? ' + en-dictionary' : ''}`);
  console.log(`Words: ${analysis.wordTokens.length}  Swap pool: ${analysis.pool.length}\n`);

  const keys = wordFilter
    || analysis.wordTokens.map(t => t.text).filter((t, i, a) => a.indexOf(t) === i);

  for (const key of keys) {
    const spec = wordFilter ? { matchText: /^[A-Z]/.test(key) } : {};
    const report = wordReport(analysis, key, spec);
    if (!report.found) {
      console.log(`? ${key} — not found`);
      continue;
    }
    const flag = report.eligible ? 'SWAP' : 'skip';
    const wn = report.wordNetPos?.length ? ` WN:${report.wordNetPos.join('/')}` : '';
    const note = report.dictionaryNote && !report.dictionaryNote.keep
      ? ' [dict:drop]'
      : report.poolCategory && report.poolCategory !== report.pickCategory
        ? ` [dict:${report.poolCategory}]`
        : '';
    console.log(
      `${flag.padEnd(5)} ${report.text.padEnd(14)} [${report.categories.join(', ')}]`
      + ` → ${report.pickCategory ?? '-'} (${report.confidence.toFixed(2)})${wn}${note}`
    );
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
