/** Every src/href into img/ or assets/ in the built pages must exist in dist/. */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../config.ts';

const { dist } = PATHS;
const pages = ['index.html', ...fs.readdirSync(path.join(dist, 'p')).map((file) => `p/${file}`)];

let checked = 0;
let broken = 0;
for (const page of pages) {
  const html = fs.readFileSync(path.join(dist, page), 'utf8');
  const folder = path.dirname(page) === '.' ? '' : 'p';
  for (const match of html.matchAll(/(?:src|href)="((?:\.\.\/)?(?:img|assets)\/[^"]+)"/g)) {
    checked++;
    const target = path.normalize(path.join(dist, folder, match[1]!));
    if (!fs.existsSync(target)) {
      broken++;
      console.log('missing:', page, match[1]);
    }
  }
}

console.log(`${checked} refs checked, ${broken} broken`);
process.exit(broken ? 1 : 0);
