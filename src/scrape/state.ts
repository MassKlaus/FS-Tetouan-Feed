import fs from 'node:fs/promises';
import path from 'node:path';
import { PATHS } from '../config.ts';
import type { State } from '../types.ts';

/** Make sure the folders the scraper writes into exist. */
export async function ensureDataDirs(): Promise<void> {
  await fs.mkdir(PATHS.postBodies, { recursive: true });
  await fs.mkdir(PATHS.images, { recursive: true });
}

/** Load the committed state, or start empty on the very first run. */
export async function loadState(): Promise<State> {
  try {
    const stored = JSON.parse(await fs.readFile(PATHS.stateFile, 'utf8')) as Partial<State>;
    return { ...stored, posts: stored.posts ?? {}, ignored_images: stored.ignored_images ?? [] };
  } catch {
    return { posts: {}, ignored_images: [] };
  }
}

/** Keys are post ids, so JSON lists them in ascending numeric order on its own. */
export async function saveState(state: State): Promise<void> {
  await fs.writeFile(PATHS.stateFile, JSON.stringify(state, null, 1));
}

export const saveBody = (id: number, html: string): Promise<void> =>
  fs.writeFile(path.join(PATHS.postBodies, `${id}.html`), html);

/** Delete mirrored files that no post references any more. */
export async function pruneImages(state: State): Promise<void> {
  const used = new Set<string>();
  for (const post of Object.values(state.posts)) {
    for (const image of post.imgs) used.add(image.file);
    if (post.thumb) used.add(post.thumb.file);
  }
  for (const file of await fs.readdir(PATHS.images)) {
    if (!used.has(file)) await fs.unlink(path.join(PATHS.images, file));
  }
}
