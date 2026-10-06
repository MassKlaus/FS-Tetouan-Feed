/**
 * Last line of defence: scan the built site for anything that could run script.
 * Exits non-zero so CI refuses to publish.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { PATHS } from '../config.ts';
import { allElements } from './dom.ts';
import { walk } from './files.ts';

const { dist } = PATHS;
const URL_ATTRIBUTES = ['href', 'src', 'action', 'formaction', 'poster', 'data', 'srcset', 'xlink:href'];
const FORBIDDEN_ELEMENTS = 'script, iframe, frame, object, embed, applet, form, base, template, noscript, meta[http-equiv]';

const problems: string[] = [];

for (const file of walk(dist)) {
  const name = path.relative(dist, file);
  const content = () => fs.readFileSync(file, 'utf8');

  if (name.endsWith('.html')) {
    checkHtml(name, content());
  } else if (name.endsWith('.css')) {
    if (/@import|expression\(|javascript:|url\(\s*['"]?https?:/i.test(content())) problems.push(`${name}: suspicious CSS`);
  } else if (name.endsWith('.xml') || name.endsWith('.json')) {
    if (/<script|javascript:/i.test(content())) problems.push(`${name}: script-like content`);
  }
}

const headers = fs.readFileSync(path.join(dist, '_headers'), 'utf8');
if (!/Content-Security-Policy:.*default-src 'none'/.test(headers)) problems.push('_headers: missing strict CSP');
if (/script-src[^;\n]*(unsafe-inline|unsafe-eval|\*)/.test(headers)) problems.push('_headers: CSP allows scripts');

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} safety problem(s)`);
  process.exit(1);
}
console.log('safe: no scripts, handlers, inline styles, javascript:/data: URLs or external loads; strict CSP present');

function checkHtml(name: string, html: string): void {
  const $ = cheerio.load(html);
  const report = (message: string) => problems.push(`${name}: ${message}`);

  if ($(FORBIDDEN_ELEMENTS).length) report('forbidden element');
  if ($('style').length) report('inline <style>');

  for (const el of allElements($)) {
    for (const [attribute, value] of Object.entries(el.attribs)) {
      if (/^on/i.test(attribute)) report(`event handler ${attribute} on <${el.tagName}>`);
      if (attribute === 'style') report(`inline style on <${el.tagName}>`);
      if (URL_ATTRIBUTES.includes(attribute) && /^\s*(javascript|vbscript|data):/i.test(value)) {
        report(`${attribute}="${value.slice(0, 40)}" on <${el.tagName}>`);
      }
    }
  }

  // external references must be plain links the visitor clicks, never loaded resources
  $('img[src], link[href]').each((_, el) => {
    const url = el.attribs.src ?? el.attribs.href ?? '';
    if (/^(https?:)?\/\//i.test(url)) report(`loads external resource ${url.slice(0, 60)}`);
  });
}
