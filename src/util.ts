import { createHash } from 'node:crypto';

export const sha1 = (value: string | Buffer): string => createHash('sha1').update(value).digest('hex');

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fingerprint of a value. The key order of the object you pass is part of the
 * result, and stored hashes depend on it: changing the shape rehashes every post.
 */
export const hashOf = (value: unknown): string => sha1(JSON.stringify(value));

/** Shorten text to about `max` characters, cutting at a word boundary. */
export function excerptOf(text: string, max = 200): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 80)).trim() + '…';
}

/** Best-effort message for anything thrown, including fetch's wrapped network errors. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error.cause as { code?: string } | undefined)?.code;
    return code ?? error.message;
  }
  return String(error);
}
