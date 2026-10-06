import type { State } from '../../types.ts';
import { format, nextRunAfter } from '../format.ts';
import type { ViewPost } from '../model.ts';
import { groupPosts } from '../model.ts';
import { badge, card } from './card.ts';
import { esc } from './html.ts';
import { layout } from './layout.ts';

/** The feed: a status header, then posts grouped by how recently they changed. */
export function indexPage(posts: ViewPost[], state: State, now: Date): string {
  const checked = new Date(state.last_checked ?? now);
  const groups = groupPosts(posts, now)
    .map(
      (group) => `<section class="group">
<h2 class="grp${group.today ? ' today' : ''}"><span>${esc(group.label)}</span><small>${group.items.length}</small></h2>
<ul class="list">${group.items.map(card).join('\n')}</ul>
</section>`,
    )
    .join('\n');

  const body = `<section class="hero">
  <h1>Annonces</h1>
  <p class="status">
    <span class="pill"><i class="dot" aria-hidden="true"></i>Vérifié le ${format.dayMonth.format(checked)} à ${format.hour.format(checked)}</span>
    <span class="pill soft">Prochaine vérification vers ${format.hour.format(nextRunAfter(now))} <small>GMT</small></span>
  </p>
</section>
${groups}`;

  return layout({ title: 'FS Feed — annonces de la Faculté des Sciences', body });
}

/** One announcement: cleaned body, attached images, and a link back to the original. */
export function postPage(post: ViewPost, bodyHtml: string): string {
  const gallery = post.gallery
    .map((image) => `<a href="../img/${image.file}"><img src="../img/${image.file}" width="${image.w}" height="${image.h}" alt="" loading="lazy"></a>`)
    .join('\n');

  const edited = post.rev > 1 ? `<span class="chip">modifié ${format.stamp.format(new Date(post.updated_at))}</span>` : '';
  const published = post.date ? format.dayLong.format(new Date(post.date)) : '';

  const body = `<nav class="crumb"><a href="../index.html">← Toutes les annonces</a></nav>
<article class="post">
  <div class="meta">${badge(post)}<time datetime="${esc(post.date ?? '')}">${published}</time>
    ${edited}</div>
  <h1 dir="auto">${esc(post.title)}</h1>
  <div class="prose">${bodyHtml}</div>
  ${gallery ? `<div class="gallery">${gallery}</div>` : ''}
  <p class="orig"><a class="btn" href="${esc(post.url)}" rel="noopener">Voir sur le site de la faculté ↗</a></p>
</article>`;

  return layout({ title: `${post.title} — FS Feed`, body, depth: 1, description: post.excerpt || post.title });
}
