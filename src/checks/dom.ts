import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { isTag } from 'domhandler';

/** Every element on a page (cheerio types the `*` selector as any node, text included). */
export const allElements = ($: CheerioAPI): Element[] => $('*').toArray().filter(isTag);
