# Web app download plan

FRV as an installable web app (PWA) for desktop and mobile.

**Status:** planned, not started. Written 12 October 2026. Nothing in this file is wired into the app or the build.

## Context
Fazal wants FRV installable on phones and desktops "like a Google web app": an icon on the home screen or dock that opens FRV in its own window, with no app store involved. Today frvasap.com has no manifest, no service worker and no icons (`/favicon.ico` returns 404), so browsers offer no install option.

Decisions made (12 Oct 2026):
- **Install from the browser only.** Chrome/Edge on desktop and Android offer "Install app"; on iPhone it's Safari Share → Add to Home Screen. No stores.
- **Online-only, with a branded offline screen.** Nothing from a claim is cached on devices, and there are no offline drafts.
- **Icon:** the gold logo on near-black `#0a0a0a`.
- **Name:** short `FRV`, full `Nova Havens FRV`.

Approach:
- Use the Next.js built-in `app/manifest.ts`, plus a hand-written `public/sw.js` of about 60 lines. No `next-pwa` or Serwist: their job is precaching and caching strategies, and online-only uses neither. They also add build steps that break on Next upgrades.
- Since Chrome 108/112, installing doesn't need a service worker. The worker exists only to show the offline screen.

Ship it as one PR with conventional commits (`feat(pwa):`, `fix(report):`, `fix(intake):`, `docs:`).

## 1. App icons — `feat(pwa)`
- **New `scripts/make-icons.sh`.** It uses ImageMagick (`magick` or `convert`). The outputs are deterministic and committed, because Vercel has no ImageMagick.
  - Read `public/brand/nova-havens-logo.png` and trim its transparent margin; the mark is 257×239. The PDF reads this file, so it stays where it is.
  - Never enlarge the mark (`-resize 'NxN>'`), and strip timestamps so a re-run produces identical bytes.
- **Outputs:**

  | File | Size | Purpose |
  |:--|:--|:--|
  | `public/icons/icon-192.png` | 192 | Rounded dark tile, `any`. Also the image on the offline screen. |
  | `public/icons/icon-512.png` | 512 | Rounded dark tile, `any`. Mark at its native 256px. |
  | `public/icons/maskable-512.png` | 512 | Opaque, full bleed. Mark at about 50%, well inside the 80% safe circle. |
  | `src/app/apple-icon.png` | 180 | Opaque, full bleed. iOS rounds the corners itself. |
  | `src/app/favicon.ico` | 16/32/48 | Favicon. |

## 2. Manifest and install metadata — `feat(pwa)`
- **New `src/app/manifest.ts`** (`MetadataRoute.Manifest`, static, no env). Fields:
  - Identity: `id: '/'` (never change it), `name`, `short_name`, description, `start_url` and `scope` `'/'`, `display: 'standalone'`.
  - Colours: `background_color` and `theme_color` both `#0a0a0a`, so the splash matches the icon.
  - The three icons above as separate `purpose` entries.
  - Shortcut "New FRV" → `/claims/new`.
  - No `launch_handler`: it would navigate an open window away from a half-filled form.
- **`src/app/layout.tsx` metadata:** add
  - `applicationName: 'FRV'`
  - `appleWebApp: { capable: true, title: 'FRV', statusBarStyle: 'default' }`
  - `formatDetection: { telephone: false }`
  - `other: { 'apple-mobile-web-app-capable': 'yes' }`. Next 15.5 only emits `mobile-web-app-capable` (checked in `next/dist/lib/metadata/generate/basic.js`).
- **`src/app/layout.tsx` viewport:** a new `export const viewport` with `themeColor` light `#fafafa` / dark `#000000` (the `--surface-sunken` values) and `colorScheme: 'light dark'`.
  - Don't set `viewport-fit=cover`, which would need safe-area padding everywhere.
  - Don't set `maximumScale`.
- **Render `<ServiceWorkerRegister />`** in `<body>`.

## 3. Offline screen and service worker — `feat(pwa)`
- **New `public/offline.html`.** Self-contained, with inline CSS that copies the `globals.css` tokens, including a dark-mode block.
  - Content: system fonts; `/icons/icon-192.png`; "You're offline"; "FRV needs a connection to look up comparables and lock a figure. Nothing is kept on this device, so reconnect and try again."
  - `<a href="">Try again</a>` reloads the exact URL. A small script reloads automatically when the `online` event fires.
  - It's plain HTML rather than an App Router page because that page's hashed `/_next` chunks change every build and wouldn't be cached.
- **New `public/sw.js`:**
  - `VERSION` constant; cache `frv-offline-${VERSION}`; `PRECACHE = ['/offline.html', '/icons/icon-192.png']`.
  - install: `addAll` with `cache: 'reload'`, then `skipWaiting`.
  - activate: delete old `frv-*` caches, then `clients.claim`.
  - fetch rules:
    - ignore non-GET (server actions; a form posted before hydration)
    - ignore cross-origin (Google Maps/Places, Vercel toolbar, Zillow)
    - ignore `/api/`, `/_next/`, `/_vercel/`, `/.well-known/` (PDF, imagery, health, chunks)
    - `mode === 'navigate'`: network-only; serve `offline.html` **only when fetch rejects**. No timeout fallback, so a slow `/report` isn't shown as "offline".
    - the precached paths: network-first, falling back to cache
    - everything else, including RSC `?_rsc=` fetches: untouched
  - No navigation preload. It would render PDFs twice.
  - No `cache.put` anywhere.
- **New `src/components/pwa/ServiceWorkerRegister.tsx`** (client component):
  - In production builds: register `/sw.js` with `{ scope: '/', updateViaCache: 'none' }` after `load`; failures are silent.
  - In dev: unregister any leftover worker.
- **`next.config.mjs`:** add `headers()` and leave the existing keys as they are.

  | Path | Headers |
  |:--|:--|
  | All | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |
  | Pages only (not `/api/`) | `X-Frame-Options: DENY`. Check that `/` matches. |
  | `/sw.js` | `Cache-Control: no-cache, no-store, must-revalidate`; JS content type; `CSP: default-src 'self'; script-src 'self'` |

- **Update rule:** bump `VERSION` only when a precached file changes. A test computes it (sha256, first 8 hex characters of the precached files) and prints the value to paste. Never delete `/sw.js`; to retire the worker, use the documented self-unregistering kill switch (in DECISIONS).

## 4. A way out of every screen — `fix(report)`
iOS standalone windows have no back button.
- **`src/app/report/page.tsx`:**
  - Add Workspace and New FRV links (`next/link`) to `.bar`.
  - Give "Download PDF" `target="_blank" rel="noopener"`, so it opens in a Safari sheet with Done, or a new tab on desktop.
- **`src/app/report/page.module.css`:**
  - `.bar` wraps.
  - Add nav link styles that copy `.back` from `claims/new/page.module.css`.
  - Add a `≤600px` rule: tighter padding and a full-width download button.
- **`src/components/report/ReportSheet.tsx:87`:** Zillow comp links get `target="_blank" rel="noopener noreferrer"`. `CandidateList.tsx:26` already does this.
- **New `src/app/not-found.tsx` and `src/app/error.tsx`:** branded screens with links home, replacing Next's defaults with no navigation. `error.tsx` also has a Try again button that calls `reset()`.

## 5. A dropped connection keeps the form — `fix(intake)`
Mobile data drops are the real-world "offline".
- **Today:** a rejected server action reaches the error boundary and wipes everything typed (`ClaimForm.tsx:82`, `:145`, `:165`, `:197`, `:240`).
- **Submit:** wrap `submitFrv` in the `useActionState` reducer with `try/catch`.
  - The `catch` must call `unstable_rethrow(error)` from `next/navigation`, because a successful submit throws `NEXT_REDIRECT`.
  - Then it returns `{ error: 'FRV could not reach the server, so this figure may not be locked. Your entries are still here; reconnect and submit again.' }`.
- **Other actions:** wrap `lookupListing`, `geocode` and `searchComps` in `try/catch` and use the note and failure shapes they already return.
- **Inputs:** set them to 16px on touch devices (`@media (pointer: coarse)` in `primitives.module.css` and `Stepper.module.css`), so iOS doesn't zoom on focus.

## Tests (vitest, node env)
- **`tests/sw.test.ts`:** load `public/sw.js` through `node:vm` with a fake `self`, `caches` and `fetch`. Requests are plain `{ method, mode, url, headers }` objects, because Node rejects `mode: 'navigate'`.
  - It responds to GET navigations (network, or `offline.html` when the network rejects) and to the icon.
  - It never responds to:
    - POST / `Next-Action`
    - RSC / prefetch
    - `/api/*`, including the PDF route
    - `/_next/*`
    - `/_vercel/*`
    - cross-origin Maps
  - Install precaches exactly PRECACHE, and every file exists. Activate deletes only old `frv-*` caches and keeps foreign ones.
  - `VERSION` matches the hash.
  - The source has no `.put(`.
  - `offline.html` references nothing outside PRECACHE: no `/_next/`, no `http(s)://`.
- **`tests/manifest.test.ts`:** call `manifest()`.
  - `id` and `start_url` fall inside `scope`, and `display` is standalone.
  - It has any-192, any-512 and maskable-512 icons. Each file exists, and the width and height in its PNG header match `sizes`. The maskable and apple icons are opaque.
  - `favicon.ico` exists, and the shortcut route exists.

## Docs
- **`docs/DECISIONS.md`:** add a newest entry, "Installable app, online only (October 2026)".
  - Fazal, 12 Oct 2026: browser install only.
  - The worker caches only the offline screen and its icon. Claim data must not persist on devices, and figures come only from the server, so there are no offline drafts.
  - Hand-written rather than Serwist.
  - The VERSION rule, never deleting `sw.js`, and the kill-switch code.
  - Not built: stores, push, offline mode.
  - Note: `image-route.ts` already caches Street View and map images for an hour (`private, max-age=3600`). Left as is; Fazal's call.
- **`README.md`:**
  - Status row ✅ for the installable app.
  - New "Installed app" subsection under Deploying: install steps for each platform, and install from frvasap.com only, because `*.vercel.app` hosts would be separate apps.
  - Note that the PDF opens in a new tab.
  - Quick-start note: the worker only registers under `build`+`start`.
  - Add the new files to the architecture tree.
  - Update the test badge.
- **`CLAUDE.md` Deployment notes:**
  - The worker's passthrough rules, and never add page or API caching.
  - The VERSION and never-delete rules.
  - Icons come from `scripts/make-icons.sh`.
- **`.claude/skills/frv/SKILL.md` learnings:**
  - Every screen needs a way home in standalone mode; PDFs open with `_blank`.
  - The `appleWebApp` meta gap in Next 15.5.
  - Use `unstable_rethrow` in server-action `catch` blocks.
  - Verify installability with CDP `Page.getInstallabilityErrors`; Lighthouse has no PWA audit any more.
- **`frvcalcupdate` Logo recipe:** re-run `make-icons.sh` and then `npm test` for the new VERSION. iOS users must re-add the app to see a new icon.

## Verification
1. `npm run verify` with no env vars. Run `make-icons.sh` twice; the second run gives no diff.
2. `npm run build && npm start`, then a Playwright script in the scratchpad using `launchPersistentContext` (incognito reports "not installable") and the system Chromium.
   - **Installable:** the worker controls the page, and CDP `Page.getInstallabilityErrors` returns `[]`.
   - **Passthrough:** `response.fromServiceWorker()` is true only for document navigations. It's false for `_next/static`, `?_rsc=`, the `geocode` POST (`next-action`), the PDF (opens in a new page), and Maps.
   - **Caches:** after visiting `/`, `/claims/new`, `/report` and the PDF, `caches` holds exactly `offline.html` and `icon-192.png`.
   - **Offline:** `setOffline(true)`, then navigating to `/claims/new` shows "You're offline" with the image loaded. Clicking a `<Link>` while offline also lands there. Back online, Try again loads the page.
   - **Error handling:** with the context offline, blurring the loss address keeps the form intact.
   - **Screenshots:** the offline page in light and dark, and `/report` at 390×844 to check the bar wraps.
3. **`curl -I` locally:**
   - `/sw.js` headers.
   - `/manifest.webmanifest` is `application/manifest+json`.
   - `/favicon.ico` and `/apple-icon.png` return 200.
   - `/` has `X-Frame-Options`.
   - `/report` is still `no-store`.
4. **Production after merge** (it's public):
   - Repeat the curl and Playwright checks.
   - The PDF route still sends `Content-Disposition: inline` and no `X-Frame-Options`.
   - No test claims get submitted.
5. **Fazal on real devices:**
   - **Android Chrome:** Install; icon shape; dark splash; long-press "New FRV" shortcut; airplane mode shows the offline screen.
   - **iPhone Safari:** Add to Home Screen; icon and "FRV" label; standalone launch; readable status bar in light and dark; report links and PDF sheet; no zoom on focus.
   - **Desktop Chrome/Edge:** install icon in the address bar; title bar follows the theme.

## Not in this PR
- An in-app install button. Browsers already show install UI, and iOS can't be prompted from code.
- Manifest screenshots: `docs/assets` is stale, so capture fresh ones later.
- A page Content-Security-Policy, Report-Only first, allowing Google Maps/Places.
- App-store wrappers.
- Login. Production stays public, and installing doesn't change that.
