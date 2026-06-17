# Story Swapper

## Play

**Live app:** [https://sonicdm.github.io/story-swapper-pro/](https://sonicdm.github.io/story-swapper-pro/)

Mad Libs-style browser app built with Vite. It includes **57 bundled Mad Libs**, NLP-based auto-swap examples, pasted text, Project Gutenberg/Gutendex books, and PoetryDB poems.

## Quick start

For local development:

```bash
cd story-swapper-pro
npm install
npm run dev
```

Open the URL Vite prints.

For a production build:

```bash
npm run build
npm run preview
```

`npm run dev` and `npm run build` rebuild the WordNet dictionary and bundled Mad Lib templates. WordNet assets are required at runtime. Do not open `dist/index.html` as `file://`; serve `dist/` over HTTP with `npm run preview`, GitHub Pages, or another static server.

## Features

- **Hidden originals** — prompts show categories and hints; original words stay hidden until reveal.
- **NLP word detection** — compromise, optional winkNLP refinement, WordNet validation, and pluralize fitting.
- **Random fills** — fill individual blanks or the whole form with category-matched words.
- **Auto prompt density** — auto-swaps target roughly 18 blanks per 150 words, then cap to distinct usable source words.
- **Reveal controls** — highlight replacements, show original words, copy plain text, and download `.txt`.
- **Saved settings** — length, prompt count, tab, Mad Libs pick, and reveal preference via `localStorage`.
- Sources: **Mad Libs** (57 bundled templates), **Examples** (prose NLP demos), paste, Project Gutenberg (Gutendex), PoetryDB.
- **Mad Libs tab** — filter, optgroups (Classics / Legacy / Generic / Themed), Random then Start; full template always (never cropped).
- **Examples tab** — short prose for NLP word detection; one hybrid passage with `{tags}` plus optional auto-swaps.
- **Template blanks** — `{verb}`, `{noun}`, Rosetta-style `<noun>`, streamlit-games `<word::category/>` hints, and workergnome `--NOUN--` markers on Paste. Mad Libs templates are authored as a single `{tag}` string in JSON.

## Mad Lib authoring

Each story is one JSON file under `src/data/madlib-originals/`:

```json
{
  "title": "IT Incident Report",
  "category": "themed",
  "text": "## IT Incident Report\n\nCompany-wide {adjective} outage began at {number} AM…"
}
```

- `**text**` — full template with `{tag}` placeholders (same as the Paste tab)
- `**category**` — optional; inferred from folder (`classics`, `legacy`, `generic`, `themed`) if omitted

Common tags: `{noun}`, `{plural noun}`, `{adjective}`, `{adverb}`, `{verb}`, `{past-tense verb}`, `{verb ending in -ing}`, `{person}`, `{place}`, `{number}`, `{animal}`, `{object}`, `{body part}`, `{food}`, `{color}`, `{job}`, `{vehicle}`, `{clothing item}`, `{emotion}`, `{sound}`, `{silly word}`, `{day of week}`.

Run `npm run sync:madlibs` after editing any file under `madlib-originals/`. Dev and build run sync automatically.

## Tab roles


| Tab               | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| **Mad Libs**      | Fill-in-the-blank templates only — tag prompts, no length trim |
| **Examples**      | NLP auto-swap demos (4 prose + 1 hybrid)                       |
| **Paste**         | Any text + `{tag}` templates                                   |
| **Public Domain** | Gutendex search / random book → excerpt                        |
| **Poem**          | PoetryDB search / random poem                                  |


## Project layout

```
story-swapper-pro/
  scripts/
    sync-madlib-templates.mjs   # merge JSON sources → bundle
    migrate-madlib-to-tags.mjs  # one-time legacy format migration
  src/
    data/
      samples.js                # Examples tab only (prose + hybrid)
      madlib-originals/
        classics/               # 16 madlibz classics
        legacy/                 # 2 migrated templates
        generic/                # 21 originals
        themed/                 # 18 themed originals (pets, IT, 90s/00s)
      madlibs-templates.json    # GENERATED — do not hand-edit
    lib/
  public/                       # copied as-is to dist/
  dist/                         # production build output (gitignored)
```

## Deploy to GitHub Pages

### GitHub Actions

A workflow is included at `.github/workflows/deploy-pages.yml`. On push to `main`/`master`, it runs `npm test`, builds `dist/`, and deploys to GitHub Pages.

1. Push this repo to GitHub.
2. In **Settings → Pages**, set source to **GitHub Actions**.
3. Push to `main` or `master`.

The workflow sets `VITE_BASE_PATH=/<repo-name>/` so asset paths work on a project site (`username.github.io/repo-name/`).

### Manual Build

```bash
npm run build
# If deploying to username.github.io/my-repo/ (not the root site):
VITE_BASE_PATH=/my-repo/ npm run build
```

Upload `dist/` to your Pages branch or `docs/` folder.

### User/org root site

If the repo is `username.github.io` (site served from `/`), build with the default base:

```bash
npm run build
```

## Local testing of a Pages build

```bash
# Simulate a project site at /story-swapper-pro/
VITE_BASE_PATH=/story-swapper-pro/ npm run build
npm run preview
```

Then open the URL Vite prints (usually `http://localhost:4173/story-swapper-pro/`).

## Testing

NLP regressions live in `tests/fixtures/` as JSON cases. See [tests/README.md](tests/README.md).

```bash
npm test              # default suite (compromise only; wink fixtures skipped)
npm run test:full     # all fixtures including wink-nlp
npm run test:coverage # full suite + v8 coverage report
npm run test:watch    # prepare generated data, then watch mode
npm run test:inspect -- marys-dream   # debug word analysis for a fixture
```

## NLP stack

Word categories use a client-side pipeline:


| Library                                            | Role                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **WordNet** (`pos-index.json` + `word-pools.json`) | Required POS validation for auto-swaps; common-word random pools built from `en-wordnet` at compile time |
| **compromise** (`/three`)                          | Document-level POS hints, person/place tags, term-level merge                                            |
| **wink-nlp** + **wink-eng-lite-web-model**         | Optional second pass (~1 MB, lazy-loaded) for universal POS tags                                         |
| **pluralize**                                      | Plural detection and fitting replacements to plural slots                                                |


Heuristics cover irregular past verbs (`ran`, `stood`), comparative adjectives (`older`), proper-name skipping (`Sim`, `Chion`), idiom protection (`instead of`), and poetry/archaic forms (`o'er`, `toss'd`, `at rest`, `Sandy`).

`Surprise me` requires WordNet to load, then prefers curated category lists for all prompt types. The generated WordNet random pools remain available as a fallback; the full POS index is still used for auto-swap validation.

## Credits & acknowledgments

Story Swapper uses or references these projects:


| Source                                                                                                                                         | How it is used                                                                                                                                             | License                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| [HermanFasset/madlibz](http://madlibz.herokuapp.com)                                                                                           | Original fill-in-the-blank story templates                                                                                                                 | MIT                            |
| [chroline/madlibs-api](https://github.com/chroline/madlibs-api)                                                                                | Classic templates bundled in `src/data/madlibs-templates.json`; optional live random/story API at [madlibs-api.vercel.app](https://madlibs-api.vercel.app) | MIT                            |
| [joelgrus/streamlit-games](https://github.com/joelgrus/streamlit-games)                                                                        | `<word::category/>` blank-hint syntax                                                                                                                      | MIT                            |
| [workergnome/madlibs](https://github.com/workergnome/madlibs)                                                                                  | `--NOUN--` placeholder markers                                                                                                                             | MIT                            |
| [Rosetta Code — Mad Libs](https://rosettacode.org/wiki/Mad_Libs)                                                                               | Angle-bracket `<tag>` template syntax                                                                                                                      | (wiki content; see site terms) |
| [Improving Mad Libs with expressions](https://manningbooks.medium.com/improving-mad-libs-with-expressions-4d306683ab58) (Manning)              | Expression-style blank labels                                                                                                                              | Article                        |
| [What a _________ Job: How Mad Libs Are Written](https://www.vulture.com/2014/10/what-a-_________-job-how-mad-libs-are-written.html) (Vulture) | Mad Lib writing reference                                                                                                                                  | Article                        |
| [Project Gutenberg](https://www.gutenberg.org) + [Gutendex](https://gutendex.com)                                                              | Public-domain book search and text                                                                                                                         | Public domain texts            |
| [PoetryDB](https://poetrydb.org)                                                                                                               | Poem search API                                                                                                                                            | Open API                       |
| [WordNet](https://wordnet.princeton.edu) via [en-wordnet](https://github.com/moos/wordnet)                                                     | POS validation and Surprise-me word pools                                                                                                                  | WordNet license                |


Bundled templates support offline play and remote API fallback. Template text remains the property of its respective authors; see the linked repositories for attribution.

## Notes

- **Public Domain downloads** need a normal `http://` origin (GitHub Pages or `npm run dev`). Opening built files via `file://` blocks most book downloads; Examples, Paste, and Mad Libs still work.
- The older single-file `standalone.html` build has been removed in favor of this standard Vite output.

