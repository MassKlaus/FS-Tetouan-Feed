import { SITE } from '../../config.ts';
import type { State } from '../../types.ts';
import type { ViewPost } from '../model.ts';
import { esc } from './html.ts';

/** Atom feed of the most recently changed posts, for readers who want notifications. */
export function feedXml(posts: ViewPost[], state: State, now: Date): string {
  const items = posts.slice(0, SITE.feedLength);
  const updated = items[0]?.updated_at ?? state.last_checked ?? now.toISOString();

  const entries = items
    .map(
      (post) => `<entry>
<title>${esc(post.title)}</title>
<id>${SITE.url}/p/${post.id}.html</id>
<link href="${SITE.url}/p/${post.id}.html" />
<updated>${new Date(post.updated_at).toISOString()}</updated>
<summary>${esc(post.excerpt || post.title)}</summary>
</entry>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="fr">
<title>FS Feed — Faculté des Sciences de Tétouan</title>
<id>${SITE.url}/</id>
<link href="${SITE.url}/" />
<link rel="self" href="${SITE.url}/feed.xml" />
<updated>${new Date(updated).toISOString()}</updated>
${entries}
</feed>
`;
}
