# Deployment review

## Architecture

Cadence is a Vite + vanilla TypeScript presentation studio with two HTML entries (studio and shared viewer). The editor uses a client store, theme/layout renderer, AI generation/normalization, and browser exporters. Authenticated dashboard/editor flows call a Hono API. Neon/Drizzle stores users, decks, revisions, shares, access grants, assets, usage and export records. Clerk provides sessions and signed webhooks; R2 stores uploaded assets and server PPTX exports; AI Gateway supplies model responses. A daily cron cleans stale objects and records.

Only `api/[...route].ts` belongs under `api/`. API implementation lives in `server/_lib` and `server/routes`. Shared model, AI and PPTX code remains in `src`. SQL migrations are explicit release steps, independent of the build.

## Findings and changes

- Original `npm ci --include=dev` and `npm run build` succeeded without service keys. No compiler error was reproduced.
- Route/helper files under `api/` could be discovered as extra functions. Moved them outside the function discovery directory to preserve the intended single-function architecture.
- Replaced the function default callback with the documented Node Web Standard `{ fetch }` export. Removed the ambiguous `runtime: nodejs` config; package.json selects Node 24.x.
- Both browser entry points previously awaited Clerk without error handling, causing a blank page when its key or external bundle was unavailable. They now show a readable setup/error message. This does not bypass authentication or provide a functional offline account.
- Authenticated API requests return 503 when account/database configuration is absent. Health and unknown-route responses remain available without keys.
- Restrict sign-in redirects to local paths.
- Production runtime logs on 2026-11-07 identified `ERR_MODULE_NOT_FOUND` for `/var/task/server/_lib/app`: emitted ESM retained extensionless relative imports. Added explicit `.js` specifiers throughout the function's transitive local imports, including shared AI/model/export modules. TypeScript resolves these to source `.ts` files; deployed Node resolves emitted `.js` files.
- Added `scripts/deploy-native-smoke.mjs`, which emits JavaScript and imports the API with plain Node. Unlike the tsx smoke check, this catches Node ESM resolution failures before deployment.

## Vercel setup

Import the repository root with Vite, Node 24.x, install `npm ci --include=dev`, build `npm run vercel-build`, output `dist`. Existing vercel.json controls these settings. No service API key is necessary to compile the app or serve its setup page and API health.

For working accounts and persistent decks, configure `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL` and `APP_ORIGIN`. The VITE key is embedded at build time, so redeploy after adding it. Apply migrations with `npm run db:migrate` using `DATABASE_URL_UNPOOLED` (or DATABASE_URL).

For uploads/server exports configure R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY; configure bucket CORS. AI needs AI_GATEWAY_API_KEY. User-sync webhooks need CLERK_WEBHOOK_SIGNING_SECRET. Scheduled cleanup needs CRON_SECRET plus database/storage configuration. Set secrets directly in Vercel; do not commit them. See DEPLOY.md for service setup.

## Remaining limits

The production failure was reproduced and its runtime log inspected. The import fix passes the plain-Node smoke check, full Vite build and native PPTX contract check locally; deployed verification is still pending. The local machine has Node 22.23.2; Vercel uses Node 24.x. Clerk and Neon variables were still absent during the latest environment-name check. Cloud service flows require credentials and a migrated database. `/api/health` reports environment-variable presence, not live service connectivity.

The initial npm audit reported 8 findings (4 moderate, 3 high, 1 critical), including jsPDF and Vite. These are separate dependency/security work; no forced major upgrades were applied during deployment repair. ARCHITECTURE.md contains historical planning sections; use this review and current source for the implemented layout.

## Verification commands

```sh
npm ci --include=dev
npm run build
node scripts/deploy-native-smoke.mjs
npx tsx scripts/deploy-smoke.ts
npx tsx scripts/pptx-contract.ts
```

After deployment, check `/`, `/sign-in`, a nested editor URL, `/s/test`, `/api/health`, and `/api/not-a-route`. Test authenticated persistence, uploads, AI and exports after adding credentials.
