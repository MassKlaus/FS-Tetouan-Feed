import path from 'node:path';

/** Read a numeric env var; missing, blank or non-numeric values fall back to the default. */
function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

const root = path.resolve(import.meta.dirname, '..');

/** Where everything lives on disk. `data/` is the committed state, `dist/` is build output. */
export const PATHS = {
  root,
  stateFile: path.join(root, 'data', 'data.json'),
  postBodies: path.join(root, 'data', 'posts'),
  images: path.join(root, 'data', 'img'),
  stylesheet: path.join(root, 'assets', 'style.css'),
  dist: path.join(root, 'dist'),
} as const;

/** The site we mirror. */
export const SOURCE = {
  baseUrl: 'https://fs.uae.ac.ma',
  userAgent: 'fs-feed/1.0 (+student-run static mirror; polls 4x/day)',
} as const;

/** Scraper knobs. All overridable through the environment (see README). */
export const SCRAPE = {
  /** Stop probing for new post ids after this many consecutive misses. The widest real gap seen is 11. */
  missLimit: envNumber('MISS_LIMIT', 20),
  /** How many of the newest stored posts are re-fetched each run to catch edits. */
  refetchNewest: envNumber('REFETCH', 10),
  /** Pause between requests, to stay gentle on their server. */
  delayMs: envNumber('DELAY_MS', 150),
  /**
   * Set SILENT_REHASH=1 after changing the cleaner: hashes are refreshed without
   * marking every post as edited.
   */
  silentRehash: process.env.SILENT_REHASH === '1',
} as const;

export const IMAGES = {
  maxWidth: 800,
  quality: 74,
  thumb: { width: 640, height: 400, quality: 70 },
  /** Square images up to this size next to a file link are treated as pasted file-type icons. */
  iconMaxSide: 600,
} as const;

/** Site and build settings. */
export const SITE = {
  /** Absolute URL used in the Atom feed. */
  url: (process.env.SITE_URL ?? 'http://localhost:4173').replace(/\/$/, ''),
  /**
   * Morocco is on GMT. Node's bundled tz database lags behind the law,
   * so we display UTC, which is always correct.
   */
  timeZone: 'UTC',
  /** Hours (UTC) at which CI scrapes. Used for the "next check" estimate. */
  runHoursUtc: [0, 6, 12, 18],
  /** How long a post keeps its NEW / UPDATED pill. */
  badgeHours: 48,
  feedLength: 30,
  /** Shown in the page footer and README. */
  repoUrl: 'https://github.com/MassKlaus/FS-Tetouan-Feed',
} as const;
