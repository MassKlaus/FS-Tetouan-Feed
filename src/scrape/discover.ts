import { SCRAPE, SOURCE } from '../config.ts';
import { fetchText, postFetchUrl } from '../net.ts';
import type { ParsedPage, State } from '../types.ts';
import { sleep } from '../util.ts';
import { parsePost } from './parse.ts';

export interface Discovery {
  /** Every post page we fetched this run, new or already stored. */
  found: Map<number, ParsedPage>;
  /** Stored posts we re-checked and could no longer find. */
  vanished: number[];
  /** Highest post id that exists. */
  highestId: number;
}

/**
 * Finds posts to process. Three sources, in order:
 *  1. the newest stored posts, to notice edits and deletions
 *  2. hints: the homepage list and the "latest news" sidebar of every page fetched
 *  3. a probe upward from the highest known id, tolerating gaps in the numbering
 *
 * The probe is the source of truth. The homepage and sidebars are shortcuts
 * and a cross-check, since the homepage does not list every post.
 */
export async function discover(state: State, isBackfill: boolean): Promise<Discovery> {
  const crawler = new Crawler(state);
  const storedIds = Object.keys(state.posts).map(Number).sort((a, b) => b - a);

  // 1) recheck the newest stored posts
  const vanished: number[] = [];
  for (const id of storedIds.slice(0, SCRAPE.refetchNewest)) {
    if (!(await crawler.visit(id))) vanished.push(id);
  }

  // 2) the homepage lists some recent posts
  const homepage = (await fetchText(`${SOURCE.baseUrl}/`)) ?? '';
  const homepageIds = [...homepage.matchAll(/actualite\/(\d+)-/g)].map((match) => Number(match[1]));
  for (const id of homepageIds) crawler.hint(id);
  await crawler.followHints();

  // 3) probe upward until `missLimit` consecutive ids don't exist
  let highestId = Math.max(0, ...storedIds, ...crawler.found.keys());
  let cursor = isBackfill ? 1 : Math.max(0, ...storedIds, ...homepageIds, crawler.highestHint) + 1;
  let misses = 0;
  for (; misses < SCRAPE.missLimit; cursor++) {
    if (await crawler.visit(cursor)) {
      misses = 0;
      highestId = Math.max(highestId, cursor);
    } else {
      misses++;
    }
    // sidebars of the pages just fetched may reveal ids beyond the probe window
    highestId = Math.max(highestId, await crawler.followHints());
  }

  // health check: nobody should advertise ids above what we found
  const advertised = Math.max(0, ...homepageIds, ...[...crawler.found.values()].flatMap((page) => page.sidebarIds));
  if (advertised > highestId) {
    console.warn(`::warning::hint id ${advertised} is above highest found ${highestId}; raise MISS_LIMIT`);
  }

  return { found: crawler.found, vanished, highestId };
}

/** Fetches post pages once each and remembers what it learned along the way. */
class Crawler {
  readonly found = new Map<number, ParsedPage>();
  private readonly missed = new Set<number>();
  private readonly pending = new Set<number>();
  private readonly state: State;

  constructor(state: State) {
    this.state = state;
  }

  /** Highest id anyone has hinted at so far, whether or not it turned out to exist. */
  highestHint = 0;

  /** Remember an id worth fetching, unless we already know about it. */
  hint(id: number): void {
    if (this.found.has(id) || this.missed.has(id) || this.state.posts[id]) return;
    this.pending.add(id);
    this.highestHint = Math.max(this.highestHint, id);
  }

  /** Fetch a post. True if it exists. Each id is requested at most once per run. */
  async visit(id: number): Promise<boolean> {
    if (this.found.has(id)) return true;
    if (this.missed.has(id)) return false;

    const html = await fetchText(postFetchUrl(id));
    await sleep(SCRAPE.delayMs);
    const page = html ? parsePost(html) : null;
    if (!page) {
      this.missed.add(id);
      return false;
    }

    this.found.set(id, page);
    for (const sidebarId of page.sidebarIds) this.hint(sidebarId);
    return true;
  }

  /** Fetch every pending hint (fetching can add more). Returns the highest id that exists among them. */
  async followHints(): Promise<number> {
    let highest = 0;
    for (const id of [...this.pending]) {
      this.pending.delete(id);
      if (await this.visit(id)) highest = Math.max(highest, id);
    }
    return highest;
  }
}
