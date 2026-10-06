import { SOURCE } from './config.ts';
import { describeError, sleep } from './util.ts';

/**
 * GET a URL and read the body. Non-2xx answers give `null`; network errors are
 * retried, then thrown.
 */
async function request<T>(url: string, read: (res: Response) => Promise<T>, retries = 2): Promise<T | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': SOURCE.userAgent },
        signal: AbortSignal.timeout(30_000),
      });
      return res.ok ? await read(res) : null;
    } catch (error) {
      lastError = error;
      await sleep(500 * (attempt + 1));
    }
  }
  throw new Error(`fetch failed for ${url}: ${describeError(lastError)}`);
}

export const fetchText = (url: string): Promise<string | null> => request(url, (res) => res.text());

export const fetchBuffer = (url: string): Promise<Buffer | null> =>
  request(url, async (res) => Buffer.from(await res.arrayBuffer()));

/** Resolve a link found in a post body. Relative links are relative to /actualite/. */
export function resolveUrl(href: string): string | null {
  try {
    return new URL(href.trim(), `${SOURCE.baseUrl}/actualite/`).href;
  } catch {
    return null;
  }
}

/** URL we request for a post. The faculty site only looks at the number, so any slug works. */
export const postFetchUrl = (id: number): string => `${SOURCE.baseUrl}/actualite/${id}-x`;

/** Link we show to readers: the same page, with the title as slug like the site does itself. */
export const postPublicUrl = (id: number, title: string): string =>
  `${SOURCE.baseUrl}/actualite/${id}-${encodeURIComponent(title)}`;
