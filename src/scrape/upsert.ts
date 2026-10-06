import { postPublicUrl } from '../net.ts';
import type { ParsedPage, Post } from '../types.ts';
import type { ProcessedPost } from './process.ts';

export type Change = 'created' | 'updated' | 'rehashed' | 'unchanged';

interface UpsertInput {
  id: number;
  page: ParsedPage;
  processed: ProcessedPost;
  previous: Post | undefined;
  /** ISO timestamp of this run. */
  now: string;
  /** First run ever: posts already existed before we looked, so they must not look new. */
  isBackfill: boolean;
  /** Cleaner rules changed: refresh the hash without counting an edit. */
  silent: boolean;
}

/**
 * Decide what a fetched post means for the stored state.
 *  - unknown id → created (`first_seen` and `updated_at` are now; backfilled posts use their own date)
 *  - hash changed → updated (`updated_at` is now, `rev` goes up)
 *  - otherwise untouched
 */
export function upsertPost({ id, page, processed, previous, now, isBackfill, silent }: UpsertInput): { post: Post; change: Change } {
  // Field order here is the order in data.json.
  const fresh = {
    id,
    title: page.title,
    date: page.date,
    url: postPublicUrl(id, page.title),
    excerpt: processed.excerpt,
    files: processed.files,
    thumb: processed.thumb,
    gallery: processed.gallery,
    imgs: processed.imgs,
    hash: processed.hash,
    deleted: false,
  };

  if (!previous) {
    const post: Post = {
      ...fresh,
      first_seen: isBackfill ? null : now,
      updated_at: isBackfill ? `${page.date ?? '1970-01-01'}T00:00:00.000Z` : now,
      rev: 1,
    };
    return { post, change: 'created' };
  }

  if (previous.hash !== processed.hash) {
    const edit = silent ? {} : { updated_at: now, rev: previous.rev + 1 };
    const post: Post = { ...previous, ...fresh, first_seen: previous.first_seen, ...edit };
    return { post, change: silent ? 'rehashed' : 'updated' };
  }

  return { post: { ...previous, deleted: false }, change: 'unchanged' };
}
