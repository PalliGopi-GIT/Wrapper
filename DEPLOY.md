# Deploying Cadence on Vercel

Cadence ships as one Vercel project:

```
Browser
  dist/index.html          studio (editor, dashboard, AI compose)
  dist/viewer.html         read-only shared deck viewer
        │
        ▼
api/[...route].ts          one Node.js Hono function
  /api/me                  Clerk-authenticated identity
  /api/decks               deck CRUD + optimistic revisions
  /api/decks/:id/versions  named snapshots
  /api/decks/:id/shares    share links, grants, analytics
  /api/share/:token        viewer access + event tracking
  /api/assets              R2 upload / presigned read
  /api/exports/pptx        native PPTX generation → R2
  /api/ai/*                AI Gateway proxy + quotas
  /api/webhooks/clerk      Svix-verified user sync
  /api/cron/gc             nightly cleanup
        │
        ├── Neon Postgres        (Drizzle, pooled HTTP)
        ├── Cloudflare R2        (private assets + exports)
        ├── Clerk                (browser + server auth)
        └── Vercel AI Gateway    (server-side models only)
```

The UI is a static Vite bundle. The API is a single serverless function. There is no separate server to operate.

---

## Deploy before adding service keys

Builds do not require service keys. Without Clerk configuration the browser displays a setup message; account features need Clerk and Neon. Add VITE_CLERK_PUBLISHABLE_KEY and redeploy to enable sign-in. Other keys enable their corresponding services. See DEPLOYMENT-REVIEW.md for findings and limits.

## 1. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** for Production and Preview. Only `VITE_`-prefixed values reach the browser.

| Variable | Scope | Required | Value / notes |
|---|---|---|---|
| `DATABASE_URL` | runtime | yes | Neon **pooled** string (`-pooler` host) |
| `DATABASE_URL_UNPOOLED` | migration only | for migrations | Neon **direct** string; used by `npm run db:migrate` |
| `VITE_CLERK_PUBLISHABLE_KEY` | build + browser | yes | `pk_live_…` for production, `pk_test_…` for preview/dev |
| `CLERK_SECRET_KEY` | runtime | yes | `sk_live_…` / `sk_test_…`; never expose to the browser |
| `CLERK_WEBHOOK_SIGNING_SECRET` | runtime | yes | `whsec_…` from the Clerk webhook endpoint |
| `R2_ENDPOINT` | runtime | yes | `https://<account-id>.r2.cloudflarestorage.com/<bucket>` |
| `R2_BUCKET` | runtime | yes | e.g. `assets` (also parsed from `R2_ENDPOINT` if omitted) |
| `R2_ACCESS_KEY_ID` | runtime | yes | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | runtime | yes | R2 API token secret |
| `AI_GATEWAY_API_KEY` | runtime | yes | Vercel AI Gateway key |
| `AI_GATEWAY_BASE_URL` | runtime | no | defaults to `https://ai-gateway.vercel.sh/v1` |
| `CRON_SECRET` | runtime | yes | random string; Vercel sends it as `Authorization: Bearer …` |
| `APP_ORIGIN` | runtime | yes | production origin; comma-separated preview origins are allowed |
| `R2_PUBLIC_URL` | optional | no | public bucket URL; **do not use for confidential deck assets** |

`APP_ORIGIN` examples:

```bash
APP_ORIGIN=https://cadence.example.com
# or, for preview deployments:
APP_ORIGIN=https://cadence.example.com,https://cadence-git-main-team.vercel.app
```

`VITE_CLERK_PUBLISHABLE_KEY` is read at build time. Changing it requires a redeploy.

---

## 2. Neon Postgres

1. Create a Neon project and keep the default branch (`main`).
2. Copy both connection strings:
   - **Pooled** → `DATABASE_URL`
   - **Direct** → `DATABASE_URL_UNPOOLED`
3. Apply the schema as an explicit release step, before deploying schema changes:

```bash
npm ci --include=dev
DATABASE_URL_UNPOOLED="postgres://…" npm run db:migrate
```

Migrations are **not** part of the Vercel build. This keeps the build independent of database credentials, so a missing or sleeping database cannot fail a deploy. Run `npm run db:migrate` from CI or locally before a release that changes `db/schema.ts`. Verify migration status in your own Neon project before enabling the app.

For preview deployments, install the **Neon ↔ Vercel integration** so each preview gets its own branch and `DATABASE_URL` is injected automatically. Without it, previews share the production database.

---

## 3. Clerk

1. Create/select a Clerk application. The app uses one Clerk instance for creators and viewers; the role lives in Postgres and `publicMetadata.role`.
2. Copy the publishable and secret keys into Vercel.
3. Enable sign-in methods (email code + Google are recommended).
4. Add the webhook:

```text
POST https://<your-domain>/api/webhooks/clerk
Events: user.created, user.updated, user.deleted
```

Copy the signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`. The handler verifies Svix signatures and is idempotent through `webhook_events`.

5. Set `APP_ORIGIN` so `authenticateRequest` can enforce `authorizedParties`.
6. Production needs a Clerk **production instance on your own domain** (Clerk production does not run on `*.vercel.app`). Development keys are fine for preview and localhost.

The browser uses `@clerk/clerk-js` and loads Clerk's UI bundle from the instance's FAPI domain. The server verifies the session token / `__session` cookie on every request.

---

## 4. Cloudflare R2

1. Create the bucket (for example `assets`).
2. Create an R2 API token scoped to that bucket with **Object Read & Write**.
3. Set `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
4. Keep the bucket **private**. Reads go through `/api/assets/:id`, which checks access and redirects to a 10-minute presigned URL. Exports use the same presigned pattern.
5. Add a CORS policy for browser uploads and image rendering:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://your-domain.com",
      "https://*.vercel.app"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["content-type", "content-length"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

6. Use separate buckets for production and preview (`assets-prod`, `assets-dev`) so a preview cannot read production files.
7. The nightly cron removes pending uploads older than 24 h and exports older than 7 days. The architecture also recommends an R2 lifecycle rule on `x/` for 7 days.

If you enabled the `pub-…r2.dev` public URL, anyone with a key can read the bucket directly. Disable it for confidential decks.

---

## 5. Vercel AI Gateway

1. Create an AI Gateway key and set `AI_GATEWAY_API_KEY`.
2. The server allow-list lives in `server/_lib/ai.ts`. Add models there; never pass an arbitrary client slug through.
3. Per-user limits are enforced from `ai_usage` (30/hour, 200/day).
4. If the Gateway returns **402**, raise the limit in **Vercel → AI Gateway → Budgets & Spend**. The API surfaces the exact reason; Compose falls back to the offline draft.

---

## 6. Deploy

### Dashboard

1. Import the repository into Vercel.
2. Framework preset: **Vite** (the explicit `vercel.json` settings win).
3. Build command: `npm run vercel-build`.
4. Output directory: `dist`.
5. Install command: `npm ci --include=dev`.
6. Add every environment variable from §1 for Production and Preview.
7. Deploy.

### CLI

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production
# repeat for every variable in §1, then:
vercel --prod
```

`vercel.json` already configures:

- the Node function `api/[...route].ts` with `maxDuration: 300` and `memory: 1024`
- a build that does not need database credentials; migrations run separately
- `/s/:token` → `/viewer.html`
- SPA fallback to `/index.html` (excluding `/api`, `/assets`, `/viewer.html`)
- security headers and `noindex` on share pages
- the nightly `/api/cron/gc` cron

The cron route requires `CRON_SECRET`; Vercel sends it as a bearer token.

---

## 7. Post-deploy verification

```bash
curl https://<your-domain>/api/health
# {"ok":true,"ai":true,"db":true,"storage":true}
```

Then check the real flows:

1. Sign in with Clerk.
2. Create a deck, edit a slide, wait for autosave (1.5 s), reload — content persists.
3. Compose a deck (requires AI Gateway budget).
4. Export **PowerPoint (.pptx)** from the export menu. This calls `POST /api/exports/pptx`, stores the file in R2, and downloads it through a signed redirect.
5. Share the deck, open the link in a second browser, sign in as a different Clerk user, confirm the viewer renders and the creator sees the access grant.
6. Revoke the link and confirm the viewer gets `404` / “link no longer active”.
7. Upload an image from the inspector (requires the R2 CORS rule).

---

## 8. PPTX export service

`POST /api/exports/pptx` (creator only):

```json
{
  "deckId": "uuid",
  "deck": { "id": "uuid", "title": "…", "slides": [], "settings": {} }
}
```

The server checks deck ownership, rejects inline `data:` images, caps the body at 1 MB, renders through the native PptxGenJS engine, uploads to:

```
x/{userId}/{exportId}.pptx
```

and returns:

```json
{
  "exportId": "uuid",
  "downloadUrl": "/api/exports/uuid",
  "bytes": 47504,
  "meta": { "native": true, "slides": 1, "notes": 1, "charts": 0, "tables": 0 }
}
```

`GET /api/exports/:id` is owner-only and returns a `302` to a presigned R2 URL with `Content-Disposition: attachment`.

The exporter follows the PPT Master output contract: real text runs, autoshapes, native charts/tables, speaker notes, and no HTML-to-OOXML conversion or rasterised slides. The full PPT Master package is an agentic SVG→PPTX workflow; this deployment implements its native-output contract as a Vercel function rather than shipping the Python agent runtime.

---

## 9. Security checklist

- R2 bucket private; public `r2.dev` access disabled for confidential decks.
- `CLERK_SECRET_KEY`, R2 secrets, AI key, and `CRON_SECRET` are server-only.
- `APP_ORIGIN` includes every preview and production origin.
- Clerk webhook signature is verified and idempotent.
- `authorizedParties` is enforced by `authenticateRequest`.
- Neon backups / point-in-time restore enabled for production.
- AI quotas and asset-upload limits are enforced in the API.
- Share tokens are 128-bit random, revocation is checked on every request, and share pages are `noindex`.

---

## 10. Local development

```bash
npm ci --include=dev
cp .env.example .env.local
npm run db:migrate
npm run dev       # http://localhost:5173
npm run dev:api   # http://localhost:8787/api (Vite proxies /api)
```

The API loader reads `.env.local`; production reads Vercel's environment. The Vite dev plugin rewrites `/s/:token` to the viewer entry so share links work locally.

### Runtime and routing

Node.js 24.x is pinned in package.json. Vercel uses the Vite preset and installs from package-lock.json with npm ci. The SPA fallback excludes both /api and /api/*, so API requests cannot return the studio HTML.
