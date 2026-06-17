# Story Swapper — NLP test suite

Regression tests for word classification, swap eligibility, and replacement grammar.

## Quick start

```bash
npm test              # fast: compromise only (wink fixtures skipped)
npm run test:full     # all fixtures including wink-nlp
npm run test:coverage # build generated data, then full suite + v8 coverage report
npm run test:watch    # build generated data once, then watch mode
```

## Adding a regression case

1. Create `tests/fixtures/your-case.json`:

```json
{
  "id": "my-regression",
  "name": "Human-readable title",
  "engine": "compromise",
  "text": "The passage where something broke.",
  "words": {
    "badword": {
      "eligible": false,
      "categoriesExclude": ["noun"]
    },
    "goodword": {
      "eligible": true,
      "pickCategory": "adjective"
    }
  },
  "mustNotSwap": ["badword", "ProperName"],
  "selection": { "count": 12, "seed": 42 }
}
```

### Word spec fields

| Field | Meaning |
|-------|---------|
| `matchText` | Match by exact surface form (`Sandy` vs `sandy`) |
| `occurrence` | 0-based index when the norm appears multiple times |
| `eligible` / `skip` | Should the word appear in the swap pool? |
| `categoriesInclude` | Must have all listed categories |
| `categoriesExclude` | Must not have any listed category |
| `pickCategory` | Expected prompt category |
| `noCategories` | Word should be fully skipped (empty categories) |
| `minConfidence` / `maxConfidence` | Confidence bounds |

### Template mode (`{verb}`, `{noun}`, …)

Paste or sample text with `{category}` tags uses **template mode**: every tag becomes a prompt in order. With **Auto** prompt count, only those tags are used (no NLP extras). Set a fixed prompt count to add auto-detected swaps in hybrid passages. Bare `___` counts as `{noun}`.

Supported tags include `{verb}`, `{past-tense verb}`, `{verb ending in -ing}`, `{adjective}`, `{adverb}`, `{noun}`, `{plural noun}`, `{animal}`, `{place}`, `{object}`, `{food}`, `{job}`, `{vehicle}`, `{clothing item}`, `{emotion}`, `{sound}`, `{silly word}`, `{body part}`, `{person}`, `{number}`, `{color}`, `{day of week}`.

Auto-detected swaps use **wildcard prompts**: a word like `man` may ask for a **name of someone in the room**, `red` for a **color**, or `yelled` for a **sound effect** instead of a plain grammar label.

For untagged auto-swap passages, **Auto** prompt count follows Mad Lib-style density: about 18 prompts per 150 words, capped by distinct usable source words after detection and dictionary validation.

## Auto word choice (dictionary)

`tests/auto-choice.test.js` covers:

- **Auto-pick** — seeded selection with WordNet validation (drops `seldom`, `still`, fixes POS mismatches)
- **Surprise me** — requires WordNet assets; curated category lists are preferred and `word-pools.json` is the fallback random source
- **Fixture** — `hemingway-farewell.json` (included in `npm run test:full`)

Generated assets are required: `npm run build:dict` for WordNet files and `npm run sync:madlibs` for bundled templates. Missing WordNet assets are treated as a runtime error, not a silent fallback. These commands run before `npm run dev`, `npm run build`, `npm test`, `npm run test:full`, `npm run test:coverage`, and `npm run test:watch`. If you run `vitest` directly, run both commands first.

## Test framework audit notes

- Vitest covers NLP classification, replacement grammar, template validation, markdown conversion, and generated Mad Lib metadata in a Node environment.
- Coverage currently tracks `src/lib/**/*.js` and `src/data/**/*.js`; `src/main.js` is intentionally outside the unit coverage target because it is browser UI orchestration.
- The GitHub Pages workflow runs `npm test` before building `dist/`, so deploys now have the same generated-data and regression gate as local test runs.
- Remaining high-value improvement: add a small browser smoke suite, ideally Playwright, for the built app at `/story-swapper-pro/` covering load, Mad Lib start, random fill, reveal, copy/download controls, and base-path asset loading.

## Debug a failure

```bash
node scripts/inspect-text.mjs marys-dream
node scripts/inspect-text.mjs --list
```

## Layout

```
tests/
  fixtures/           JSON regression cases (add new ones here)
  helpers/
    analyze.js        tokenize + classify + pool
    assert-word.js    fixture assertions
    load-fixtures.js
    nlp-session.js    shared NLP engine
  classify.fixtures.test.js
  grammar.test.js     pure unit tests (no NLP)
  replacement.test.js verb/plural fitting
```
