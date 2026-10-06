import { format } from '../format.ts';
import type { ViewPost } from '../model.ts';
import { esc } from './html.ts';
import { icon } from './icons.ts';

const fileCount = (count: number): string => `${count} fichier${count > 1 ? 's' : ''}`;

/** NEW / UPDATED pill, or nothing. */
export function badge(post: ViewPost): string {
  if (post.isNew) return '<span class="badge new">Nouveau</span>';
  if (post.isUpdated) return '<span class="badge upd">Mis à jour</span>';
  return '';
}

/** One announcement in the feed: image, title, excerpt, then a footer with files and dates. */
export function card(post: ViewPost): string {
  const pill = badge(post);
  return `<li><a class="card" href="p/${post.id}.html">
  ${cardImage(post)}
  <div class="txt">
    ${pill ? `<div class="meta">${pill}</div>` : ''}
    <h3 dir="auto">${esc(post.title)}</h3>
    ${post.excerpt ? `<p class="ex" dir="auto">${esc(post.excerpt)}</p>` : ''}
  </div>
  <div class="cf">${cardFiles(post)}<span class="cf-dates">${cardPublished(post)}${cardEdited(post)}</span></div>
</a></li>`;
}

/** The thumbnail, or a placeholder block with the same shape when the post has no image. */
function cardImage(post: ViewPost): string {
  if (post.thumb) {
    return `<img class="thumb" src="img/${post.thumb.file}" width="${post.thumb.w}" height="${post.thumb.h}" alt="" loading="lazy">`;
  }
  return `<div class="thumb ph" aria-hidden="true">${post.files ? 'PDF' : 'FS'}</div>`;
}

function cardFiles(post: ViewPost): string {
  if (!post.files) return '';
  const label = fileCount(post.files);
  return `<span class="cf-files" title="${label}">${icon('file')}<span class="sr">${label}</span><span aria-hidden="true">${post.files}</span></span>`;
}

function cardPublished(post: ViewPost): string {
  if (!post.date) return '';
  const date = new Date(post.date);
  return `<span title="Publié le ${format.dayLong.format(date)}">${icon('cal')}<span class="sr">Publié le </span><time datetime="${esc(post.date)}">${format.dayShort.format(date)}</time></span>`;
}

/** Only shown for posts that were actually edited since we first saw them. */
function cardEdited(post: ViewPost): string {
  if (post.rev <= 1) return '';
  const stamp = format.stamp.format(new Date(post.updated_at));
  return `<span title="Modifié le ${stamp}">${icon('edit')}<span class="sr">Modifié le </span><time datetime="${esc(post.updated_at)}">${stamp}</time></span>`;
}
