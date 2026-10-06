/** A mirrored image file in data/img with its pixel size. */
export interface ImageRef {
  file: string;
  w: number;
  h: number;
}

/** A mirrored image as remembered per post. `key` identifies the source (URL, or hash of a data URI). */
export interface ImageInfo extends ImageRef {
  key: string;
}

/** One announcement, as stored in data/data.json. */
export interface Post {
  id: number;
  title: string;
  /** Publication date shown on the faculty site (YYYY-MM-DD). Day precision only. */
  date: string | null;
  /** Link back to the original post. */
  url: string;
  excerpt: string;
  /** Number of attachment links (PDF, Word, ...) in the body. */
  files: number;
  thumb: ImageRef | null;
  /** Images attached to the post (the site's carousel) that are not inside the body text. */
  gallery: ImageRef[];
  /** Every image we mirrored for this post, body and gallery. */
  imgs: ImageInfo[];
  /** Fingerprint of the cleaned content. A change means the post was edited. */
  hash: string;
  /** The post vanished from the faculty site. We keep a tombstone instead of forgetting it. */
  deleted: boolean;
  /** When we first saw the post. null for posts that already existed at our first run. */
  first_seen: string | null;
  /** Last time the content changed (or the post date, for posts that predate us). Drives ordering. */
  updated_at: string;
  /** 1 for the first version we saw, +1 for every edit. */
  rev: number;
}

export interface State {
  posts: Record<string, Post>;
  /** Decorative images (pasted file icons) we never mirror again. */
  ignored_images: string[];
  /** Last time a scrape ran. */
  last_checked?: string;
  /** Last time a scrape found something new or changed. */
  last_changed?: string;
}

/** What we extract from a post page on the faculty site. */
export interface ParsedPage {
  title: string;
  date: string | null;
  /** Source URLs of the attached images (the site's carousel). */
  carousel: string[];
  /** Ids from the "Dernière actualités" sidebar. Free hints about new posts. */
  sidebarIds: number[];
  /** The body markup, before cleaning. */
  rawBody: string;
}
