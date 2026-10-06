/**
 * Scrape fs.uae.ac.ma announcements into data/. CI runs this four times a day.
 *
 *   npm run scrape
 *   REFETCH=100 npm run scrape          re-check every stored post
 *   SILENT_REHASH=1 npm run scrape      cleaner changed: refresh hashes, don't flag edits
 */
import { SCRAPE } from '../config.ts';
import { discover } from './discover.ts';
import { processPost } from './process.ts';
import { ensureDataDirs, loadState, pruneImages, saveBody, saveState } from './state.ts';
import { upsertPost } from './upsert.ts';

const now = new Date().toISOString();
await ensureDataDirs();

const state = await loadState();
const isBackfill = Object.keys(state.posts).length === 0;
const ignored = new Set(state.ignored_images);

const { found, vanished, highestId } = await discover(state, isBackfill);

// Posts we re-checked and could no longer find keep a tombstone, so they leave the feed.
for (const id of vanished) {
  const post = state.posts[id];
  if (post && !post.deleted) {
    post.deleted = true;
    console.log(`  - ${id} gone, tombstoned`);
  }
}

let created = 0;
let updated = 0;
for (const [id, page] of found) {
  const previous = state.posts[id];
  const processed = await processPost(id, page, previous, ignored);
  const { post, change } = upsertPost({ id, page, processed, previous, now, isBackfill, silent: SCRAPE.silentRehash });

  state.posts[id] = post;
  await saveBody(id, processed.html);

  if (change === 'created') {
    created++;
    console.log(`  + ${id} ${page.title.slice(0, 70)}`);
  } else if (change === 'updated') {
    updated++;
    console.log(`  ~ ${id} changed`);
  } else if (change === 'rehashed') {
    console.log(`  ~ ${id} rehashed (silent)`);
  }
}

state.ignored_images = [...ignored];
state.last_checked = now;
if (created || updated || isBackfill) state.last_changed = now;

await pruneImages(state);
await saveState(state);

console.log(
  `done: ${created} new, ${updated} updated, ${found.size} fetched, top id ${highestId}${isBackfill ? ' (backfill)' : ''}`,
);
