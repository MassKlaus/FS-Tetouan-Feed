import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { resolveUrl } from '../net.ts';
import type { ImageRef } from '../types.ts';

/*
 * Post bodies come from a WYSIWYG editor and are untrusted. We keep a strict
 * whitelist of tags and attributes, drop everything else, and rebuild what we
 * need (links, images, text direction) ourselves. Anything executable must be
 * unrepresentable in the output; src/checks/sanitize.test.ts attacks this file.
 */

const KEEP_TAGS = new Set([
  'p', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'br', 'hr', 'sup', 'sub',
  'h3', 'h4', 'h5', 'h6', 'blockquote',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'img',
]);

/** Removed together with their content. Unknown tags not listed here are unwrapped (children kept). */
const DROP_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
  'select', 'textarea', 'noscript', 'svg', 'video', 'audio', 'link', 'meta',
  'colgroup', 'col',
  // exotic containers: their content is not reachable as normal children, so never unwrap them
  'template', 'base', 'source', 'track', 'frame', 'frameset', 'applet', 'param', 'canvas', 'map', 'area',
  'math', 'dialog', 'portal', 'slot',
]);

/** Tags rewritten to a kept equivalent. Headings are demoted so a post never competes with the page title. */
const RENAME_TAGS: Record<string, string> = { b: 'strong', i: 'em', h1: 'h3', h2: 'h3', h5: 'h4', h6: 'h4' };

/** The only attributes that survive, per tag. */
const KEEP_ATTRIBUTES: Record<string, string[]> = {
  a: ['href'],
  img: ['src', 'alt'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
};

const FILE_LINK = /\.(pdf|docx?|xlsx?|pptx?|zip|rar)(\?|#|$)/i;
const SAFE_LINK = /^(https?|mailto|tel):/i;
const ARABIC_LETTERS = /[؀-ۿݐ-ݿ]/g;
const LATIN_LETTERS = /[A-Za-zÀ-ÿ]/g;

/** Blocks that count as "the same paragraph" when deciding whether an image sits next to a file link. */
const BLOCK_SELECTOR = 'p, h3, h4, li, td, th, div, blockquote';

export interface ImageContext {
  /** The image shares a block with an attachment link. */
  nearFile: boolean;
}

/** Decides what happens to an image: a mirrored file to point at, or null to drop it. */
export type ImageResolver = (src: string, context: ImageContext) => Promise<ImageRef | null>;

export interface CleanedBody {
  html: string;
  /** Plain text, whitespace collapsed. Source of the excerpt. */
  text: string;
  /** Number of attachment links. */
  files: number;
}

const isBlank = (text: string): boolean => text.replace(/[\s ​]+/g, '') === '';

/** True when a block is mostly Arabic and should be laid out right-to-left. */
function isRtl(text: string): boolean {
  const arabic = (text.match(ARABIC_LETTERS) ?? []).length;
  const latin = (text.match(LATIN_LETTERS) ?? []).length;
  return arabic > 0 && arabic >= latin;
}

const isBr = (node: AnyNode | null): boolean => node !== null && 'name' in node && node.name === 'br';

/** Previous sibling that is not just whitespace. */
function previousSignificant(node: AnyNode | null): AnyNode | null {
  let current = node?.prev ?? null;
  while (current && 'data' in current && typeof current.data === 'string' && isBlank(current.data)) {
    current = current.prev;
  }
  return current;
}

/**
 * Turn raw post markup into a small, style-free fragment.
 * Images are handed to `resolveImage`, which mirrors them and says what to point at.
 */
export async function cleanBody(rawHtml: string, resolveImage: ImageResolver): Promise<CleanedBody> {
  const $ = cheerio.load(`<div id="root">${rawHtml}</div>`, null, false);
  const root = $('#root');

  // Comments, directives and CDATA: Word conditional comments and mutation-XSS carriers.
  root
    .find('*')
    .addBack()
    .contents()
    .filter((_, node) => ['comment', 'directive', 'cdata'].includes(node.type))
    .remove();

  // Tags and attributes. Children are visited before parents so unwrapping is safe.
  for (const el of root.find('*').get().reverse()) {
    const tag = el.tagName.toLowerCase();
    if (DROP_TAGS.has(tag)) {
      $(el).remove();
      continue;
    }
    const target = RENAME_TAGS[tag] ?? tag;
    if (!KEEP_TAGS.has(target)) {
      $(el).replaceWith($(el).contents());
      continue;
    }
    if (target !== tag) el.tagName = target;
    const allowed = KEEP_ATTRIBUTES[target] ?? [];
    for (const name of Object.keys(el.attribs)) {
      if (!allowed.includes(name)) $(el).removeAttr(name);
    }
  }

  // Links: absolute, http(s)/mailto/tel only. Anything else loses its link but keeps its text.
  for (const a of root.find('a').get()) {
    const href = $(a).attr('href');
    const absolute = href ? resolveUrl(href) : null;
    if (!absolute || !SAFE_LINK.test(absolute)) {
      $(a).replaceWith($(a).contents());
      continue;
    }
    $(a).attr('href', absolute);
    if (FILE_LINK.test(absolute)) $(a).attr('class', 'file');
  }

  // Images: mirrored locally, or removed.
  for (const img of root.find('img').get()) {
    const src = $(img).attr('src');
    const block = $(img).parentsUntil('#root', BLOCK_SELECTOR).first();
    const scope = block.length ? block : $(img).parent();
    const nearFile = scope.find('a.file').length > 0 || $(img).siblings('a.file').length > 0;

    const info = src ? await resolveImage(src, { nearFile }) : null;
    if (!info) {
      $(img).remove();
      continue;
    }
    $(img).attr({ src: `../img/${info.file}`, width: String(info.w), height: String(info.h), loading: 'lazy' });
    if (!$(img).attr('alt')) $(img).attr('alt', '');
  }

  // Empty wrappers left behind (children first), then stray line breaks.
  for (const el of root.find('p, strong, em, u, sup, sub, a, li, blockquote, h3, h4').get().reverse()) {
    const $el = $(el);
    if ($el.find('img, table').length) continue;
    if (isBlank($el.text())) $el.remove();
  }
  for (const br of root.find('br').get()) {
    const before = previousSignificant(br);
    const beforeThat = previousSignificant(before);
    const leading = previousSignificant(br) === null;
    if ((isBr(before) && isBr(beforeThat)) || leading) $(br).remove();
  }

  // Text direction, per block, so mixed French/Arabic posts lay out correctly.
  for (const el of root.find('p, li, ul, ol, td, th, table, h3, h4, blockquote').get()) {
    if (isRtl($(el).text())) $(el).attr({ dir: 'rtl', lang: 'ar' });
  }

  return {
    html: (root.html() ?? '').replace(/\n{3,}/g, '\n\n').trim(),
    text: root.text().replace(/[\s ]+/g, ' ').trim(),
    files: root.find('a.file').length,
  };
}
