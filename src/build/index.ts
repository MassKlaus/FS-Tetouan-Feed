/**
 * Render data/ into a zero-JS static site in dist/.
 *
 *   npm run build
 *   BUILD_NOW=2026-10-06T12:00:00Z npm run build    freeze the clock (pills, groups, "next check")
 *   SITE_URL=https://example.pages.dev npm run build   absolute URLs for the Atom feed
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { PATHS } from '../config.ts';
import type { Post, State } from '../types.ts';
import { fingerprintAssets, HEADERS } from './assets.ts';
import { toViewPosts } from './model.ts';
import { feedXml } from './templates/feed.ts';
import { indexPage, postPage } from './templates/pages.ts';

const now = new Date(process.env.BUILD_NOW ?? Date.now());
const state = JSON.parse(await fs.readFile(PATHS.stateFile, 'utf8')) as State;
const posts = toViewPosts(state, now);
const { dist } = PATHS;

// start from an empty dist/
await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(path.join(dist, 'p'), { recursive: true });
await fs.mkdir(path.join(dist, 'assets'), { recursive: true });
await fs.cp(PATHS.images, path.join(dist, 'img'), { recursive: true });
await fs.copyFile(PATHS.stylesheet, path.join(dist, 'assets', 'style.css'));

// pages
await fs.writeFile(path.join(dist, 'index.html'), indexPage(posts, state, now));
for (const post of posts) {
  const body = await fs.readFile(path.join(PATHS.postBodies, `${post.id}.html`), 'utf8').catch(() => '');
  await fs.writeFile(path.join(dist, 'p', `${post.id}.html`), postPage(post, body));
}
await fs.writeFile(path.join(dist, 'feed.xml'), feedXml(posts, state, now));
await fs.writeFile(path.join(dist, 'data.json'), JSON.stringify(publicState(state)));

// cache busting: rename assets by content hash and rewrite references
const textFiles = [
  path.join(dist, 'index.html'),
  path.join(dist, 'feed.xml'),
  path.join(dist, 'data.json'),
  ...posts.map((post) => path.join(dist, 'p', `${post.id}.html`)),
];
await fingerprintAssets(dist, textFiles);
await fs.writeFile(path.join(dist, '_headers'), HEADERS);

const indexKb = Math.trunc((await fs.stat(path.join(dist, 'index.html'))).size / 1024);
console.log(
  `built ${posts.length} posts · index ${indexKb} KB · new ${posts.filter((p) => p.isNew).length} · updated ${posts.filter((p) => p.isUpdated).length}`,
);

/** The published data.json: the state without the image bookkeeping the scraper needs. */
function publicState(source: State): Omit<State, 'posts'> & { posts: Record<string, Omit<Post, 'imgs' | 'gallery'>> } {
  const posts = Object.fromEntries(
    Object.entries(source.posts).map(([id, { imgs: _imgs, gallery: _gallery, ...rest }]) => [id, rest]),
  );
  return { ...source, posts };
}
