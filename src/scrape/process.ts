import fs from 'node:fs/promises';
import path from 'node:path';
import { IMAGES, PATHS } from '../config.ts';
import type { ImageContext } from '../clean/html.ts';
import { cleanBody } from '../clean/html.ts';
import { imageKey, looksLikeIcon, makeThumb, mirrorImage } from '../clean/images.ts';
import type { ImageInfo, ImageRef, ParsedPage, Post } from '../types.ts';
import { excerptOf, hashOf } from '../util.ts';

/** Everything derived from a fetched page: cleaned body, mirrored images, fingerprint. */
export interface ProcessedPost {
  html: string;
  excerpt: string;
  files: number;
  gallery: ImageRef[];
  imgs: ImageInfo[];
  thumb: ImageRef | null;
  hash: string;
}

/**
 * Clean a post body and mirror its images.
 * `ignored` collects images judged decorative; the caller persists it.
 */
export async function processPost(
  id: number,
  page: ParsedPage,
  previous: Post | undefined,
  ignored: Set<string>,
): Promise<ProcessedPost> {
  const images = new PostImages(id, previous?.imgs ?? [], ignored);

  const { html, text, files } = await cleanBody(page.rawBody, images.resolve);
  const bodyKeys = new Set(images.list.map((image) => image.key));

  // Attached images come after the body, so we can tell the two apart.
  for (const src of page.carousel) await images.resolve(src, { nearFile: false });
  const gallery = images.list.filter((image) => !bodyKeys.has(image.key)).map(({ file, w, h }) => ({ file, w, h }));

  // The key order here is part of the stored hash format; see hashOf.
  const hash = hashOf({
    t: page.title,
    d: page.date,
    html,
    g: gallery.map((image) => image.file),
    k: images.list.map((image) => image.key),
  });

  let thumb = previous?.thumb ?? null;
  const thumbOutdated = thumb !== null && thumb.w !== IMAGES.thumb.width;
  if (images.list.length && (!thumb || hash !== previous?.hash || thumbOutdated)) {
    // the thumbnail shows the first attached image, else the first image in the text
    const cover = gallery[0] ? images.list.find((image) => image.file === gallery[0]!.file)! : images.list[0]!;
    thumb = await makeThumb(await images.original(cover), id);
  }

  return { html, excerpt: excerptOf(text), files, gallery, imgs: images.list, thumb, hash };
}

/** Mirrors the images of one post, reusing what an earlier run already stored. */
class PostImages {
  readonly list: ImageInfo[] = [];
  private readonly postId: number;
  private readonly stored: Map<string, ImageInfo>;
  private readonly ignored: Set<string>;
  /** Original bytes of images downloaded this run, kept to cut thumbnails. */
  private readonly downloaded = new Map<string, Buffer>();
  private counter = 0;

  constructor(postId: number, stored: ImageInfo[], ignored: Set<string>) {
    this.postId = postId;
    this.stored = new Map(stored.map((image) => [image.key, image]));
    this.ignored = ignored;
  }

  /** The `ImageResolver` handed to the cleaner. Returns null to drop the image. */
  resolve = async (src: string, context: ImageContext): Promise<ImageRef | null> => {
    const key = imageKey(src);
    if (!key || this.ignored.has(key)) return null;

    const already = this.list.find((image) => image.key === key);
    if (already) return already;

    const remembered = this.stored.get(key);
    const info = remembered ? this.reuse(remembered, context) : await this.download(src, key, context);
    if (info) this.list.push(info);
    return info;
  };

  /** Bytes of an image's original, from this run's download or, failing that, our mirrored copy. */
  async original(image: ImageInfo): Promise<Buffer> {
    return this.downloaded.get(image.key) ?? fs.readFile(path.join(PATHS.images, image.file));
  }

  private reuse(info: ImageInfo, context: ImageContext): ImageInfo | null {
    if (context.nearFile && looksLikeIcon(info)) {
      this.ignore(info.key, info); // stored by an earlier run; the unused file is pruned later
      return null;
    }
    this.counter = Math.max(this.counter, Number(info.file.match(/-(\d+)\.webp$/)?.[1] ?? 0));
    return info;
  }

  private async download(src: string, key: string, context: ImageContext): Promise<ImageInfo | null> {
    const mirrored = await mirrorImage(src, this.postId, ++this.counter);
    if (!mirrored) return null;

    if (context.nearFile && looksLikeIcon(mirrored)) {
      await fs.unlink(path.join(PATHS.images, mirrored.file)).catch(() => {});
      this.ignore(key, mirrored);
      return null;
    }
    this.downloaded.set(key, mirrored.source);
    return { key, file: mirrored.file, w: mirrored.w, h: mirrored.h };
  }

  private ignore(key: string, { w, h }: ImageRef): void {
    this.ignored.add(key);
    console.log(`  ! ${this.postId} dropped file-type icon (${w}x${h})`);
  }
}
