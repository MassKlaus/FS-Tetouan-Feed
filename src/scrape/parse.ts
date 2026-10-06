import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { ParsedPage } from '../types.ts';

const DATE = /\d{4}-\d{2}-\d{2}/;

/**
 * Extract a post from its page. Everything lives in `div.course-details`
 * (nested twice on the live site; the inner one is the post).
 *
 * Returns null for ids that don't exist: the site answers those with a generic
 * page that has no post title.
 */
export function parsePost(html: string): ParsedPage | null {
  const $ = cheerio.load(html);
  const outer = $('.course-details').first();
  const inner = outer.find('.course-details').first();
  const box = inner.length ? inner : outer;

  const title = box.find('h3.mb-20').first().text().trim();
  if (!title) return null;

  // The publication date is a bare text node right after the calendar icon.
  const dateNode = box.find('i.fa-calendar').first().get(0)?.nextSibling;
  const date = (dateNode && 'data' in dateNode ? dateNode.data : '').match(DATE)?.[0] ?? null;

  // Attached images (the site's carousel), kept apart from images inside the text.
  const carousel = box
    .find('#single-event-carousel img')
    .map((_, img) => $(img).attr('src'))
    .get();

  // The "latest news" sidebar lists the newest posts: free hints for discovery.
  const sidebarIds = $('.course-single-sidebar a[href*="actualite/"]')
    .map((_, a) => Number($(a).attr('href')?.match(/actualite\/(\d+)/)?.[1]))
    .get()
    .filter(Boolean);

  return { title, date, carousel, sidebarIds, rawBody: extractBody(box) };
}

/** The body is the box minus the title, the date line and the carousel. */
function extractBody(box: cheerio.Cheerio<Element>): string {
  const body = box.clone();
  body.find('h3.mb-20').first().remove();

  const icon = body.find('i.fa-calendar').first();
  const dateNode = icon.get(0)?.nextSibling;
  if (dateNode && 'data' in dateNode) dateNode.data = dateNode.data.replace(DATE, '');
  icon.remove();

  body.find('#single-event-carousel').closest('.row').remove();
  body.find('#single-event-carousel').remove();
  return body.html() ?? '';
}
