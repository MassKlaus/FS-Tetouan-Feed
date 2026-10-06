import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { IMAGES, PATHS } from '../config.ts';
import { fetchBuffer, resolveUrl } from '../net.ts';
import type { ImageRef } from '../types.ts';
import { sha1 } from '../util.ts';

/** A freshly mirrored image, plus the original bytes (needed to cut the thumbnail). */
export interface MirroredImage extends ImageRef {
  source: Buffer;
}

/** Stable identity of an image source: its absolute URL, or a hash of the inline data. */
export const imageKey = (src: string): string | null =>
  src.startsWith('data:') ? `data:${sha1(src)}` : resolveUrl(src);

/** Editors paste small square file-type icons next to attachment links; we draw our own. */
export function looksLikeIcon({ w, h }: ImageRef): boolean {
  const ratio = w / h;
  return Math.max(w, h) <= IMAGES.iconMaxSide && ratio > 0.85 && ratio < 1.18;
}

/** Fetch (or decode) an image, shrink it, and store it as WebP named `{postId}-{index}.webp`. */
export async function mirrorImage(src: string, postId: number, index: number): Promise<MirroredImage | null> {
  const source = await loadSource(src);
  if (!source?.length) return null;

  try {
    const file = `${postId}-${index}.webp`;
    const { data, info } = await sharp(source, { animated: false })
      .rotate()
      .resize({ width: IMAGES.maxWidth, withoutEnlargement: true })
      .webp({ quality: IMAGES.quality })
      .toBuffer({ resolveWithObject: true });
    await fs.writeFile(path.join(PATHS.images, file), data);
    return { file, w: info.width, h: info.height, source };
  } catch {
    return null; // not an image we can decode
  }
}

/** Cut a card thumbnail (cropped from the top, where posters carry their headline). */
export async function makeThumb(source: Buffer, postId: number): Promise<ImageRef> {
  const { width, height, quality } = IMAGES.thumb;
  const file = `${postId}-t.webp`;
  const { data, info } = await sharp(source, { animated: false })
    .rotate()
    .resize({ width, height, fit: 'cover', position: 'top' })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });
  await fs.writeFile(path.join(PATHS.images, file), data);
  return { file, w: info.width, h: info.height };
}

async function loadSource(src: string): Promise<Buffer | null> {
  if (src.startsWith('data:')) {
    const base64 = src.slice(src.indexOf(',') + 1).replace(/\s+/g, '');
    return Buffer.from(base64, 'base64');
  }
  const url = resolveUrl(src);
  if (!url) return null;
  return fetchBuffer(url).catch(() => null);
}
