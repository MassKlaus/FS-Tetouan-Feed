import fs from 'node:fs/promises';
import path from 'node:path';
import { sha1 } from '../util.ts';

/**
 * Give every asset a name that changes when its content does (`style.3fa91c2e.css`)
 * and rewrite every reference to it, so assets can be cached forever.
 */
export async function fingerprintAssets(dist: string, textFiles: string[]): Promise<void> {
  const renames = new Map<string, string>();
  for (const folder of ['assets', 'img']) {
    for (const name of await fs.readdir(path.join(dist, folder))) {
      const file = path.join(dist, folder, name);
      const hash = sha1(await fs.readFile(file)).slice(0, 8);
      const { name: base, ext } = path.parse(name);
      const renamed = `${base}.${hash}${ext}`;
      await fs.rename(file, path.join(dist, folder, renamed));
      renames.set(name, renamed);
    }
  }

  // Asset names only contain [\w.-], so escaping the dot is enough. The boundary
  // checks stop `7-1.webp` from matching inside `17-1.webp`.
  const names = [...renames.keys()].map((name) => name.replaceAll('.', '\\.')).join('|');
  const reference = new RegExp(`(?<![\\w.-])(${names})(?![\\w-])`, 'g');
  for (const file of textFiles) {
    const source = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, source.replace(reference, (match) => renames.get(match) ?? match));
  }
}

/**
 * Cloudflare Pages `_headers`.
 *  - HTML and data revalidate on every visit (a 304 when unchanged).
 *  - Fingerprinted assets are cached for a year.
 *  - A strict CSP: the site has no script at all, so none is allowed.
 * Cache-Control rules must not overlap: Cloudflare merges matching rules' values.
 */
export const HEADERS = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/p/*
  Cache-Control: no-cache
/feed.xml
  Cache-Control: no-cache
/data.json
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
/img/*
  Cache-Control: public, max-age=31536000, immutable
`;
