# Story Swapper — Claude Code instructions

Mad Libs-style Vite web app. Live site: https://sonicdm.github.io/story-swapper-pro/

## Stack

- **Runtime:** vanilla ES modules in `src/lib/` — no React/Vue
- **Build:** Vite 6, base path via `VITE_BASE_PATH` (GitHub Pages uses `/story-swapper-pro/`)
- **NLP:** compromise, optional wink-nlp, WordNet (`public/pos-index.json`, `public/word-pools.json`)
- **Tests:** Vitest (unit), Playwright (browser smoke against `dist/`)

## Commands

Run from `story-swapper-pro/`:

```bash
npm install
npm run dev              # dev server; rebuilds dict + madlib bundle
npm run build            # production dist/
npm run test:unit        # Vitest
npm run test:browser     # build + Playwright (Pages base path)
npm run sync:madlibs     # regenerate src/data/madlibs-templates.json
```

Before deploy-worthy changes: `npm run test:unit` and, when UI/build touched, `npm run test:browser`.

## Layout

| Path | Purpose |
|------|---------|
| `src/index.html` | App shell, tab panels |
| `src/lib/ui.js` | Tab wiring, Create editor, status |
| `src/lib/game.js` | Play flow, swaps, reveal |
| `src/lib/create-blank-editor.js` | Tap-to-blank preview surface |
| `src/lib/auto-swap-candidates.js` | Shared Suggest + Play Draft pipeline |
| `src/lib/template-model.js` | Blank apply/restore, markdown format ops |
| `src/data/madlib-originals/` | **Source** for bundled templates (JSON per story) |
| `src/data/madlibs-templates.json` | **Generated** — never hand-edit |
| `src/data/samples.js` | Examples tab only (prose NLP demos) |
| `tests/` | Vitest + Playwright |
| `.github/workflows/deploy-pages.yml` | CI: test → build → browser smoke → Pages |

## Mad Lib templates

Add or edit JSON under `src/data/madlib-originals/{generic,themed,classics,...}/`.

Each file:

```json
{
  "title": "Unique Title",
  "category": "generic",
  "collection": "original",
  "format": "incident-report",
  "tags": ["workplace", "tech"],
  "text": "## Heading\\n\\nBody with {noun} and {adjective} blanks…"
}
```

Rules (enforced by `tests/madlib-originals.test.js`):

- `text` must start with `## ` (except `classics/` folder)
- At least **8** `{tag}` blanks; tags must tokenize cleanly
- `format` ∈ story, how-to, form, incident-report, announcement, letter, checklist, review, legal, speech, listing, log
- `tags`: 1–3 values from taxonomy in `src/lib/madlib-taxonomy.js`
- Titles must be unique across all JSON files

After adding/changing originals: `npm run sync:madlibs`.

## Create tab

- **Source of truth:** `#editor-source` textarea (markdown + `{category}` tags)
- **Preview:** `#editor-render` — tap-to-blank; Suggest highlights use `data-detail` (`original / category`)
- **Suggest** shares `computeAutoSwapCandidates()` with Play Draft (`useFullText: true` on Create)
- Custom templates: browser `localStorage` via `custom-templates.js`; not in git

## Coding conventions

- Match existing module style: plain functions, minimal abstractions, focused diffs
- Do not add npm dependencies unless explicitly requested
- Do not hand-edit `madlibs-templates.json`, `public/pos-index.json`, or `public/word-pools.json` (build scripts own these)
- Do not open `dist/index.html` as `file://`; serve over HTTP
- Prefer extending shared helpers (`auto-swap-candidates.js`, `template-model.js`) over duplicating game/Create logic

## Git & deploy

- Repo git root is `story-swapper-pro/` (not parent `RandomStuff/`)
- **Deploy:** push to `main` → GitHub Actions runs full test suite, builds with `VITE_BASE_PATH=/<repo-name>/`, deploys `dist/` to Pages
- Only commit when asked; never force-push `main`
- Update README template counts if the bundled catalog size changes materially

## Common tasks

| Task | Approach |
|------|----------|
| New Mad Lib | JSON in `madlib-originals/`, run sync, run unit tests |
| Create editor UX | `create-blank-editor.js`, `ui.js`, `src/index.html`, `styles.css` |
| Auto-swap behavior | `auto-swap-candidates.js`, `placeholders.js`, `classify.js` |
| Play/reveal UI | `game.js`, `styles.css` (`.story-reveal.show-originals`) |
| Browser tests | `tests/browser/`; paste via `#editor-source` |

## Out of scope unless requested

- Refactoring unrelated modules
- New markdown/docs files
- Changing WordNet build pipeline
- Committing or pushing without explicit user approval
