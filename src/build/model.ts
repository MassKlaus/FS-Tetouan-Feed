import { SITE } from '../config.ts';
import type { Post, State } from '../types.ts';
import { capitalize, daysBetween, format, hoursSince } from './format.ts';

/** A post plus what the page needs to know about it right now. */
export interface ViewPost extends Post {
  isNew: boolean;
  isUpdated: boolean;
}

export interface PostGroup {
  label: string;
  today: boolean;
  items: ViewPost[];
}

export const TODAY_LABEL = 'Aujourd’hui';

/**
 * Posts in feed order: most recently changed first, newest id breaking ties.
 * Pills are decided here, at build time, so every visitor sees the same page.
 */
export function toViewPosts(state: State, now: Date): ViewPost[] {
  return Object.values(state.posts)
    .filter((post) => !post.deleted)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id)
    .map((post) => {
      const isNew = post.first_seen !== null && hoursSince(now, post.first_seen) < SITE.badgeHours;
      const isUpdated = !isNew && post.rev > 1 && hoursSince(now, post.updated_at) < SITE.badgeHours;
      return { ...post, isNew, isUpdated };
    });
}

function groupLabel(post: Post, now: Date): string {
  const changed = new Date(post.updated_at);
  const days = daysBetween(now, changed);
  if (days <= 0) return TODAY_LABEL;
  if (days === 1) return 'Hier';
  if (days < 7) return 'Cette semaine';
  return capitalize(format.monthYear.format(changed));
}

/** Consecutive posts sharing a label form a group (the input is already in feed order). */
export function groupPosts(posts: ViewPost[], now: Date): PostGroup[] {
  const groups: PostGroup[] = [];
  for (const post of posts) {
    const label = groupLabel(post, now);
    let group = groups.at(-1);
    if (group?.label !== label) {
      group = { label, today: label === TODAY_LABEL, items: [] };
      groups.push(group);
    }
    group.items.push(post);
  }
  return groups;
}
