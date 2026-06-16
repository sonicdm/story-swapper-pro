# Story Swapper

Mad Libs-style word swap game built with Vite. Play **46 bundled Mad Libs**, try **Examples** for NLP auto-swap demos, paste your own text, pull from Project Gutenberg, or load a poem — then fill in the blanks and reveal your ridiculous story.

## Quick start

```bash
cd story-swapper-pro
npm install
npm run dev            # build dict + sync Mad Libs JSON, then dev server
npm run build          # → dist/ (includes dictionary assets for GitHub Pages)
npm run sync:madlibs   # merge classics + originals → madlibs-templates.json
npm run preview        # serve production build (static; refresh browser after rebuild)
npm run preview:watch  # rebuild dist on save + preview (refresh browser to see changes)
```

| Command | Hot reload? | What it does |
|---------|-------------|--------------|
| `npm run dev` | Yes (HMR) | Dev server, fastest feedback; Gutenberg downloads via built-in `/api/gutenberg` proxy |
| `npm run preview` | No | One-shot production build already in `dist/` |
| `npm run preview:watch` | Rebuild on save | Updates `dist/` when you save; **refresh the tab** to load new assets |
| `python -m http.server` | No | Static files only; run `npm run build` manually after edits |

**If Examples or buttons do nothing:** the app must load its JavaScript bundle over HTTP. Do not open `dist/index.html` as a `file://` URL. Use `npm run dev`, `npm run preview`, or:

```bash
cd story-swapper-pro/dist
python -m http.server 8080
# open http://localhost:8080/
```

From the project root, `python -m http.server` also works if you open `http://localhost:8080/` (redirects to `dist/`).

## Features

- **Spoiler-free prompts** — part of speech + a friendly example hint; originals stay hidden until reveal.
- **Smart word detection** — compromise (POS + entities) with optional winkNLP refinement and pluralize for grammar-aware swaps.
- **Surprise me** — auto-fill every blank with a random word for its category.
- **Show the original words** — reveal-screen toggle and hover tooltips.
- **Download .txt** and copy-to-clipboard.
- **Remembers settings** — length, prompt count, tab, Mad Libs pick, and peek preference via `localStorage`.
- Sources: **Mad Libs** (46 bundled templates), **Examples** (prose NLP demos), paste, Project Gutenberg (Gutendex), PoetryDB.
- **Mad Libs tab** — filter, optgroups (Classics / Legacy / Generic / Themed), Random then Start; full template always (never cropped).
- **Examples tab** — short prose for smart word detection; one hybrid passage with `{tags}` plus optional auto-swaps.
- **Template blanks** — `{verb}`, `{noun}`, Rosetta-style `<noun>`, streamlit-games `<word::category/>` hints, and workergnome `--NOUN--` markers on Paste. Mad Libs use classic blank labels via JSON `text[]`/`blanks[]`.

## Tab roles

| Tab | Purpose |
|-----|---------|
| **Mad Libs** | Fill-in-the-blank templates only — tag prompts, no length trim |
| **Examples** | NLP auto-swap demos (4 prose + 1 hybrid) |
| **Paste** | Any text + `{tag}` templates |
| **Public Domain** | Gutendex search / random book → excerpt |
| **Poem** | PoetryDB search / random poem |

## Project layout

```
story-swapper-pro/
  scripts/
    sync-madlib-templates.mjs   # merge JSON sources → bundle
    brace-template-to-json.mjs  # convert {tag} strings for migration
    seed-madlib-originals.mjs   # regenerates generic/themed JSON (optional)
  src/
    data/
      samples.js                # Examples tab only (prose + hybrid)
      madlibs-classics.json     # 16 madlibz classics (source)
      madlib-originals/
        legacy/                 # migrated {tag} templates
        generic/                # 14 new originals
        themed/                 # 14 themed originals (pets, IT, 90s/00s, etc.)
      madlibs-templates.json    # GENERATED — do not hand-edit
    lib/
  public/                       # copied as-is to dist/ (.nojekyll for GitHub Pages)
  dist/                         # production build output (gitignored)
```

Run `npm run sync:madlibs` after editing any JSON under `madlibs-classics.json` or `madlib-originals/`. Dev and build run sync automatically.

## Deploy to GitHub Pages

### Option A — GitHub Actions (recommended)

A workflow is included at `.github/workflows/deploy-pages.yml`. It builds on push to `main`/`master` and deploys `dist/` to GitHub Pages.

1. Push this repo to GitHub.
2. In **Settings → Pages**, set source to **GitHub Actions**.
3. Push to `main` — the workflow runs automatically.

The workflow sets `VITE_BASE_PATH=/<repo-name>/` so asset paths work on a project site (`username.github.io/repo-name/`).

### Option B — Manual

```bash
npm run build
# If deploying to username.github.io/my-repo/ (not the root site):
VITE_BASE_PATH=/my-repo/ npm run build
```

Upload the contents of `dist/` to your Pages branch or `docs/` folder.

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

NLP regressions live in `tests/fixtures/` as JSON cases. See [tests/README.md](tests/README.md) for how to add new ones.

```bash
npm test              # fast (compromise only; wink fixtures skipped)
npm run test:full     # all fixtures including wink-nlp
npm run test:watch    # watch mode
npm run test:inspect -- marys-dream   # debug word analysis for a fixture
```

## NLP stack

Word categories are chosen with a layered pipeline (all client-side):

| Library | Role |
|---------|------|
| **WordNet** (`pos-index.json` + `word-pools.json`) | POS validation for auto-swaps; random words for **Surprise me** (built from `en-wordnet` at compile time) |
| **compromise** (`/three`) | Document-level POS hints, person/place tags, term-level merge |
| **wink-nlp** + **wink-eng-lite-web-model** | Optional second pass (~1 MB, lazy-loaded) for universal POS tags |
| **pluralize** | Plural detection and fitting replacements to plural slots |

Heuristics fill gaps: irregular past verbs (`ran`, `stood`), comparative adjectives (`older`), proper-name skipping (`Sim`, `Chion`), idiom protection (`instead of`), and poetry/archaic forms (`o'er`, `toss'd`, `at rest`, `Sandy`).

## Credits & acknowledgments

Story Swapper builds on ideas and data from several Mad Libs and NLP projects:

| Source | How it is used | License |
|--------|----------------|---------|
| [HermanFasset/madlibz](http://madlibz.herokuapp.com) | Original fill-in-the-blank story templates | MIT |
| [chroline/madlibs-api](https://github.com/chroline/madlibs-api) | Classic templates bundled in `src/data/madlibs-templates.json`; optional live random/story API at [madlibs-api.vercel.app](https://madlibs-api.vercel.app) | MIT |
| [joelgrus/streamlit-games](https://github.com/joelgrus/streamlit-games) | Inspiration for `<word::category/>` blank-hint syntax (e.g. Wikipedia-style auto stories) | MIT |
| [workergnome/madlibs](https://github.com/workergnome/madlibs) | Inspiration for corpus `--NOUN--` placeholder markers | MIT |
| [Rosetta Code — Mad Libs](https://rosettacode.org/wiki/Mad_Libs) | Inspiration for angle-bracket `<tag>` template syntax | (wiki content; see site terms) |
| [Improving Mad Libs with expressions](https://manningbooks.medium.com/improving-mad-libs-with-expressions-4d306683ab58) (Manning) | Inspiration for richer blank labels and expression-style prompts | Article |
| [What a _________ Job: How Mad Libs Are Written](https://www.vulture.com/2014/10/what-a-_________-job-how-mad-libs-are-written.html) (Vulture) | Craft reference for original template writing (blanks-first, foolproof framing) | Article |
| [Project Gutenberg](https://www.gutenberg.org) + [Gutendex](https://gutendex.com) | Public-domain book search and text | Public domain texts |
| [PoetryDB](https://poetrydb.org) | Poem search API | Open API |
| [WordNet](https://wordnet.princeton.edu) via [en-wordnet](https://github.com/moos/wordnet) | POS validation and Surprise-me word pools | WordNet license |

Bundled Mad Libs templates are included for offline play and fall back automatically when the remote API is unavailable. Template text remains the property of its respective authors; see the linked repositories for full attribution.

## Notes

- **Public Domain downloads** need a normal `http://` origin (GitHub Pages or `npm run dev`). Opening built files via `file://` blocks most book downloads; Examples, Paste, and Mad Libs still work.
- The older single-file `standalone.html` build has been removed in favor of this standard Vite output.
