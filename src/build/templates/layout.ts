import { SITE } from '../../config.ts';
import { esc } from './html.ts';
import { icon, SPRITE } from './icons.ts';

interface LayoutInput {
  title: string;
  body: string;
  /** How many folders deep the page is, to build relative links. 0 = site root, 1 = p/. */
  depth?: number;
  description?: string;
}

const DEFAULT_DESCRIPTION = 'Les annonces de la Faculté des Sciences de Tétouan, en version légère.';

/** The page shell shared by every page: head, header, footer. */
export function layout({ title, body, depth = 0, description = DEFAULT_DESCRIPTION }: LayoutInput): string {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light dark">
<link rel="alternate" type="application/atom+xml" title="FS Feed" href="${up}feed.xml">
<link rel="stylesheet" href="${up}assets/style.css">
</head>
<body>
${SPRITE}
<header class="top"><div class="wrap">
  <a class="brand" href="${up || './'}"><span class="mark">FS</span> Feed</a>
  <div class="top-end">
    <span class="tag">Faculté des Sciences de Tétouan</span>
    <a class="gh" href="${SITE.repoUrl}" rel="noopener" aria-label="Code source sur GitHub" title="Code source sur GitHub">${icon('github')}</a>
  </div>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="wrap foot">
  Copie légère, non officielle. Source : <a href="https://fs.uae.ac.ma" rel="noopener">fs.uae.ac.ma</a> ·
  <a href="${up}feed.xml">Flux Atom</a> · <a href="${up}data.json">data.json</a> ·
  <a href="${SITE.repoUrl}" rel="noopener">Code sur GitHub</a>
</footer>
</body>
</html>
`;
}
