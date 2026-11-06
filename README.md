# Cadence

An AI presentation studio. It composes a deck's narrative, then typesets it through one of ten real design systems — and exports files that survive PowerPoint.

**Production stack:** Vercel (static + Hono function) · Neon Postgres (Drizzle) · Clerk (auth) · Cloudflare R2 (images + exports) · Vercel AI Gateway (models). See `ARCHITECTURE.md` for the design and [`DEPLOY.md`](./DEPLOY.md) for the Vercel env matrix and release checklist.

```bash
npm install --include=dev
cp .env.example .env.local   # fill in Clerk, Neon, R2 and AI Gateway values
npm run db:migrate           # explicit release step; not part of the Vercel build
npm run dev                  # http://localhost:5173
npm run dev:api              # http://localhost:8787/api (Vite proxies /api)
npm run build                # typecheck + studio and viewer bundles in dist/
```

The studio requires sign-in and a database. The share viewer is a separate entry (`viewer.html`) so it does not ship the editor or export code.

---

## What the research changed

I compared the current generation of deck tools — Gamma, Beautiful.ai, Tome, Moda, Alai, Canva, Pitch, Plus AI, Copilot, SlidesAI, Prezi — and the same three failures kept appearing:

| Observed failure | What Cadence does instead |
| --- | --- |
| **Design convergence.** Every deck from a tool looks like every other deck from that tool (the "Gamma look"). Themes are usually colour swaps over one layout. | Ten design systems that differ in *typography, grid, rhythm, decoration and chart palette* — not hue. Switching theme changes the composition, not just the paint. |
| **Broken exports.** Web pages converted to OOXML lose fonts and charts, and trigger PowerPoint's repair dialog. | PowerPoint is generated natively: real text runs, autoshapes and native charts. No HTML is converted. Verified structurally (11 slides, chart parts, content types, zero unresolved relationships). |
| **Slide-level editing only.** You can fix a slide, but not restyle or restructure the argument. | Whole-deck operations: tighten, raise the register, restructure, cut by a third. Plus deck-level design controls (type scale, density, corners, accent) that apply everywhere. |

A fourth gap was more subtle: tools that *do* generate original layouts hand the keys to the model, so output quality is a lottery. Cadence separates the concerns — **the model writes the argument, the layout engine owns every pixel.** A strict JSON contract plus a semantic slide-type catalogue means the model can never produce a broken composition.

---

## The ten design systems

| | Theme | Character |
| --- | --- | --- |
| 1 | **Obsidian** | Executive minimal. Instrument Serif, hairline rules, champagne accent. |
| 2 | **Porcelain** | White gallery space. Tight sans, cobalt accent, nothing extra. |
| 3 | **Aurora** | Deep indigo mesh, glass panels, violet-to-mint light. |
| 4 | **Broadside** | Magazine editorial. Playfair, cream stock, true red. |
| 5 | **Terminal** | Phosphor console. Monospace, uppercase, technical grids. |
| 6 | **Swiss** | International style. Brutal grid, one red, grudging whitespace. |
| 7 | **Terracotta** | Warm paper, clay and sage, humanist serif. |
| 8 | **Meridian** | Black tie. Gold hairlines, wide air, couture serif. |
| 9 | **Blueprint** | Engineering drawing. Navy field, cyan rules, annotation ticks. |
| 10 | **Kinetic** | Poster energy. Archivo Black, acid lime, oversized numerals. |

Each theme is a full token set: colour ramp, display/body/mono families, four-step type scale, weight, tracking, case, line height, corner radius, rule weight, slide padding, chart palette and a decorative surface. Adding an eleventh is a single object in `src/design/themes.ts`; nothing else needs to know about it.

## The prompt architecture

`src/ai/prompts.ts` is deliberately layered:

1. **`BASE_SYSTEM`** — non-negotiable craft rules and the JSON contract. One idea per slide, titles that form a readable spine, bounded bullet and body lengths, a ban list of AI-slop phrases, no fabricated numbers or sources, and notes written as *what to say* rather than a summary.
2. **Ten archetypes** — investor pitch, product launch, sales proposal, business review, strategy, research, workshop, keynote, case study, all-hands. Each has a canonical narrative arc and a voice instruction, so a "pitch" and a "keynote" are structurally different decks, not the same template with different words.
3. **Per-theme briefs** — density calibration. Porcelain punishes a ninth word; Terminal wants version numbers and exact figures; Kinetic wants three words and no sub-clauses.
4. **Deck operations** — whole-deck rewrite, slide rewrite and slide insertion each get their own system prompt and a full-context user message.

The model returns semantic slide types (`statement`, `bullets`, `compare`, `process`, `matrix`, `chart`…). A normaliser coerces loose model output into the schema, infers types when they are missing, and drops anything unusable rather than rendering a broken slide.

## The layout engine

- Every slide is a fixed **1280 × 720** design surface, uniformly scaled for the canvas, thumbnails, sorter, presenter and exports. What you see is exactly what exports.
- 16 semantic layouts, each with variants (title: left/centre/rule; bullets: numbered/cards/two-column/plain).
- Charts are hand-drawn SVG, so they inherit the theme palette and stay crisp at any size.
- **Auto-fit**: after mount, each slide measures its own overflow and steps the type scale down until it fits. A regression sweep renders 1,200 composed slides (10 archetypes × 10 themes × 12 slides) and reports zero overflows.

## Export

| Format | Approach | Fidelity |
| --- | --- | --- |
| **PowerPoint (.pptx)** | Native OOXML via PptxGenJS — text boxes, autoshapes, native charts, real fonts, speaker notes | Fully editable, opens without repair |
| **PowerPoint (.pptx) — server** | Authenticated `POST /api/exports/pptx` → native PptxGenJS → R2 → signed download | Same native file, retained 7 days, export metadata |
| **PDF — print quality** | Print stylesheet at 13.333 × 7.5 in | Vector text, crisp type |
| **PDF — direct** | `html-to-image` → jsPDF | Raster, no dialog |
| **PNG images** | Per-slide 2× raster, zipped with notes | Presentation-ready |
| **Standalone HTML** | One file: styles inlined, keyboard navigation, notes, print CSS, auto-fit | Runs offline, shareable |
| **Markdown + notes** | Structured outline of the deck | For review and handoff |
| **Project (.json)** | Full deck state | Round-trips into the app |

## Editor

- Slide rail with live thumbnails, drag reorder, duplicate, delete.
- Direct on-canvas text editing — click any headline, bullet or caption. `Enter` commits, `Esc` cancels.
- Floating **Rewrite** action on any text element, plus a full inspector.
- Inspector with four tabs: **Content** (typed fields per layout), **Layout** (type + variant switcher), **Design** (theme, accent, type scale, density, corners, chrome, deck-level AI ops) and **Notes** (with talk-time estimate).
- Command palette (`⌘K`) over actions, slide insertion, themes and exports.
- Presenter mode with progress, timer, speaker notes (`N`) and fullscreen (`F`), plus a slide overview (`G`).
- Undo/redo across 80 steps, autosave to local storage, JSON import/export.

| Shortcut | Action |
| --- | --- |
| `⌘K` | Command palette |
| `⌘↵` | Compose a deck |
| `⌘Z` / `⇧⌘Z` | Undo / redo |
| `⌘D` | Duplicate slide |
| `P` | Present |
| `G` | Slide overview |
| `N` | Speaker notes |
| `⌘1` / `⌘2` | Toggle rail / inspector |
| `⌘S` | Save project file |

## Model access

Models are called by the API (`api/_lib/ai.ts`), never by the browser. Set `AI_GATEWAY_API_KEY` on the server. The client sends `{ operation, deckId, request }` to `/api/ai/*`; the server builds the prompt, enforces the model allow-list and per-user quotas, and logs every call to `ai_usage`.

Open **Settings** to see whether the server, database and storage are configured. If the Gateway is unavailable or a quota is exhausted, **Compose** falls back to the offline draft composer.

> If the Gateway returns **402**, the Vercel team has hit its AI Gateway spend limit — raise it under *AI Gateway → Budgets & Spend*. The API surfaces the exact reason rather than failing silently.

## Architecture

```
api/
  [...route].ts        Hono app → Vercel function
  _lib/                db · auth · access · r2 · ai · schemas · validation
  routes/              me · decks · versions · shares · viewer · assets · exports · ai · webhooks · cron
db/
  schema.ts            Drizzle schema (users, decks, versions, assets, shares, usage)
  migrations/          drizzle-kit output
src/
  app/                 Clerk init · typed API client · router · dashboard · editor
  viewer/              share viewer entry (read-only render + analytics)
  model/               Deck and slide schema, demo deck, slide factories
  design/              Theme tokens; themeVars() turns a theme + settings into CSS vars
  render/              Layout engine — one function per slide type, plus auto-fit
  ai/                  Prompt library, shared normaliser, offline composer
  export/              pptx · pdf · png · html · markdown · project
  ui/                  Shell, rail, canvas, inspector, palette, generator, presenter, sorter
  styles/              app.css (chrome) · slide.css (design systems + layouts)
viewer.html            second Vite entry
vercel.json            function config, rewrites, headers, cron
scripts/
  dev-api.ts    Local Hono server with .env.local loading
  migrate.ts    Applies db/migrations with DATABASE_URL_UNPOOLED
  db-smoke.ts   Insert/select/delete round-trip against Neon
  r2-smoke.ts   Live R2 PUT/HEAD/GET/DELETE check
  pptx-contract.ts  Asserts editable text, notes and native package structure
  export-verify.ts  Downloads the latest server export from R2 and inspects it
  cdp.mjs       Dependency-free Chrome DevTools harness
  sweep.js      Layout regression sweep across every theme and archetype
  pptx-test.ts  Native PPTX generation in Node, for OOXML validation
```

## Notes on fidelity

- Theme fonts load from Google Fonts. PowerPoint export maps each theme to the closest widely-installed face (Georgia, Arial, Consolas, Arial Black) and compensates through weight, size and tracking, so a deck never arrives in a substitute font it cannot render.
- Remote images are embedded during PPTX export and rasterised during PNG/PDF export; if a host blocks cross-origin reads the layout falls back gracefully rather than failing the export.
- The `scripts/` folder is development tooling, not part of the shipped bundle.
