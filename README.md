# FS Feed

A lightweight, zero-JavaScript mirror of the announcements of the Faculté des Sciences de Tétouan
(https://fs.uae.ac.ma). It scrapes the news, cleans the HTML, mirrors images as small WebP, and
builds a static site that is fast on a bad connection and shows what is new at a glance.

Written in TypeScript on Node 20.11+ (run with `tsx`, no compile step).

> **Vibe-coded.** This project was built by conversation with an AI coding assistant (Claude Code).
> A human chose the idea, the stack, the design and every trade-off; the assistant wrote the code,
> and the human did not read most of it line by line. What that means in practice:
>
> - **Checked by machine, not audited by a person.** The code is typechecked, the HTML cleaner is
>   attacked by 34 hostile payloads (`npm test`), and the built site is scanned for anything that could
>   run script (`npm run check`). There has been no independent security review.
> - **Verified against the real site, once.** The scraper was developed against fs.uae.ac.ma as it
>   looked in October 2026. If the faculty redesigns its pages, parsing will break, and it is meant to
>   fail visibly rather than guess.
> - **Not everything has been exercised.** The GitHub Actions workflow and the Cloudflare deploy have
>   not been run yet, and several branches (post deletion, long gaps in post ids) have never fired on
>   real data.
> - **Unofficial.** Not affiliated with the Faculté des Sciences de Tétouan or Université Abdelmalek
>   Essaâdi. It is a student-made, read-only mirror that always links back to the original posts.
>
> Read it before you trust it, and treat the original site as the source of truth for anything that
> matters, such as deadlines.

## Commands

```bash
npm install
npm run scrape      # fetch new and changed posts into data/        (network)
npm run build       # render data/ into dist/
npm run all         # scrape + build
npm run serve       # preview dist/ at http://localhost:4173
npm run typecheck   # tsc --noEmit
npm test            # 34 hostile-HTML payloads against the cleaner
npm run check       # dist/ has no broken asset refs and nothing that can run script
```

Environment knobs: `REFETCH=100` (re-check every stored post), `SILENT_REHASH=1`
(refresh hashes without flagging edits), `MISS_LIMIT`, `DELAY_MS`, `BUILD_NOW=<ISO>`
(freeze the build clock), `SITE_URL` (absolute URLs in the Atom feed).

## How it works

```
fs.uae.ac.ma ──scrape──▶ data/ ──build──▶ dist/ ──▶ Cloudflare Pages
                          ▲
            GitHub Actions cron (00, 06, 12, 18 GMT) commits data/
```

1. **Discover.** The site has no feed or sitemap. Post pages are `/actualite/{id}-{anything}` and the
   id alone decides the page. We probe upward from the highest known id (stopping after 20 misses in
   a row), use the homepage and every page's "latest news" sidebar as hints, and re-check the newest
   10 stored posts for edits.
2. **Clean.** Post bodies come from a WYSIWYG editor and are untrusted. A strict whitelist keeps
   basic text, tables and links, drops everything else, tags Arabic blocks right-to-left, and removes
   pasted file-type icons. Images are mirrored locally as WebP.
3. **Track.** Each post keeps a content hash, `first_seen`, `updated_at` and a revision number. A new
   hash means an edit. `updated_at` orders the feed.
4. **Build.** Pages are rendered at build time, so pills (NEW, UPDATED) and groups (Aujourd'hui,
   Hier, ...) are the same for every visitor. Assets are fingerprinted and cached forever; HTML
   revalidates.

## Layout

| Path | What |
|---|---|
| `src/scrape/` | `index` (entry), `discover`, `parse`, `process`, `upsert`, `state` |
| `src/clean/` | `html` (whitelist cleaner), `images` (mirroring, thumbnails, icon detection) |
| `src/build/` | `index` (entry), `model` (order, groups, pills), `format`, `assets`, `templates/` |
| `src/checks/` | `refs`, `safe`, `sanitize.test` |
| `src/config.ts` | every path, constant and env knob |
| `src/types.ts` | `Post`, `State`, `ParsedPage` |
| `assets/style.css` | the only stylesheet |
| `data/` | committed state: `data.json`, `posts/{id}.html` bodies, `img/` |
| `dist/` | build output (git-ignored) |
| `.github/workflows/scrape.yml` | the cron |

## Things worth knowing

- **Backfilled posts** (everything that existed at the first run) get `updated_at = their own date` and
  `first_seen = null`, so history does not look new.
- **Changed the cleaner?** Run `SILENT_REHASH=1 REFETCH=100 npm run scrape` once. Otherwise every
  post whose cleaned output changed is flagged as edited.
- **The hash input is a stored format.** Its key order (see `processPost`) is part of every saved hash.
- **Known hole:** the probe only walks upward, so a post published later with an id *below* the current
  maximum is never found.
- **Time:** everything is displayed in UTC because Morocco is on GMT and Node's bundled tz data is stale.
- **Their TLS cert** shows as revoked on Windows (`CRYPT_E_REVOKED`); Node's `fetch` verifies it fine.
- **Cloudflare Pages:** `dist/_headers` sets `no-cache` on HTML and data, `immutable` on fingerprinted
  assets, and a strict CSP. Build command: `npm ci && npm run build && npm run check`, output `dist`.
- **Not built yet:** archive page, splitting `last_checked` out of `data.json`, an events tab.
# FS-Tetouan-Feed
