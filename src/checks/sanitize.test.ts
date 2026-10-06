/**
 * Feed hostile markup through the cleaner and prove nothing executable survives.
 *   npm test
 */
import * as cheerio from 'cheerio';
import { cleanBody } from '../clean/html.ts';
import { allElements } from './dom.ts';

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'class'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  td: ['colspan', 'rowspan', 'dir', 'lang'],
  th: ['colspan', 'rowspan', 'dir', 'lang'],
};
const ANY_TAG_ATTRIBUTES = ['dir', 'lang'];

/** Markup and text that must never appear. Attribute values are checked structurally instead. */
const FORBIDDEN =
  /<\s*(script|iframe|svg|math|style|form|object|embed|base|meta|link|template|noscript|input|button|video|audio)\b|\son[a-z]+\s*=|javascript:|vbscript:|data:text|<!--|-->/i;

const payloads: Record<string, string> = {
  script: '<p>a</p><script>alert(1)</script>',
  imgOnerror: '<img src=x onerror=alert(1)>',
  imgSrcJs: '<img src="javascript:alert(1)">',
  hrefJs: '<a href="javascript:alert(1)">x</a>',
  hrefJsEntity: '<a href="&#106;avascript:alert(1)">x</a>',
  hrefJsTab: '<a href=" jav&#x09;ascript:alert(1)">x</a>',
  hrefJsNewline: '<a href="java\nscript:alert(1)">x</a>',
  hrefJsCase: '<a href="JaVaScRiPt:alert(1)">x</a>',
  hrefData: '<a href="data:text/html,<script>alert(1)</script>">x</a>',
  hrefVb: '<a href="vbscript:msgbox(1)">x</a>',
  svgOnload: '<svg onload=alert(1)><circle/></svg>',
  svgScript: '<svg><script>alert(1)</script></svg>',
  iframe: '<iframe src="javascript:alert(1)"></iframe>',
  iframeSrcdoc: '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  onclick: '<p onclick="alert(1)" onmouseover="alert(2)">hi</p>',
  styleAttr: '<p style="background:url(javascript:alert(1))">hi</p>',
  styleTag: '<style>@import "javascript:alert(1)"</style><p>x</p>',
  form: '<form action="https://evil.example"><input name=x><button>go</button></form>',
  object: '<object data="javascript:alert(1)"></object><embed src="x.swf">',
  base: '<base href="https://evil.example/"><a href="/x">x</a>',
  meta: '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  link: '<link rel="stylesheet" href="https://evil.example/x.css">',
  template: '<template><script>alert(1)</script><img src=x onerror=alert(1)></template>',
  noscript: '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
  mxss: '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">',
  mxss2: '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">',
  comment: '<!--[if gte mso 9]><xml><script>alert(1)</script></xml><![endif]--><p>x</p>',
  cdata: '<![CDATA[<script>alert(1)</script>]]>',
  nested: '<scr<script>ipt>alert(1)</scr</script>ipt>',
  attrBreak: '<a href="https://ok.example/" onfocus="alert(1)" autofocus>x</a>',
  classId: '<p id="x" class="y" data-x="1" onload="z()">t</p>',
  tableEvent: '<table onclick=alert(1)><tr><td onmouseover=alert(1) colspan="2">x</td></tr></table>',
  video: '<video src=x onerror=alert(1)><source src=x onerror=alert(1)></video>',
  imgAlt: '<img src="https://ok.example/a.png" alt="&quot; onerror=&quot;alert(1)">',
};

/** Pretend every image mirrors fine, so <img> survives and its attributes get audited. */
const mirrorEverything = async () => ({ file: 'x.webp', w: 10, h: 10 });

function audit(output: string): string[] {
  const problems: string[] = [];

  const skeleton = output.replace(/="[^"]*"/g, '=""');
  const forbidden = FORBIDDEN.exec(skeleton);
  if (forbidden) problems.push(`matches ${forbidden[0]}`);

  const $ = cheerio.load(output, null, false);
  for (const el of allElements($)) {
    const allowed = [...(ALLOWED_ATTRIBUTES[el.tagName] ?? []), ...ANY_TAG_ATTRIBUTES];
    for (const attribute of Object.keys(el.attribs)) {
      if (!allowed.includes(attribute)) problems.push(`<${el.tagName}> has attribute ${attribute}`);
    }
    if (el.tagName === 'a' && !/^(https?:|mailto:|tel:)/i.test(el.attribs.href ?? '')) {
      problems.push(`a[href] ${(el.attribs.href ?? '').slice(0, 40)}`);
    }
    if (el.tagName === 'img' && !/^\.\.\/img\/[\w.-]+\.webp$/.test(el.attribs.src ?? '')) {
      problems.push(`img[src] ${el.attribs.src}`);
    }
  }
  return problems;
}

let failed = 0;
for (const [name, html] of Object.entries(payloads)) {
  const { html: output } = await cleanBody(html, mirrorEverything);
  const problems = audit(output);
  if (problems.length) {
    failed++;
    console.log(`FAIL ${name}\n     in : ${html.slice(0, 90)}\n     out: ${output.slice(0, 160)}\n     ${problems.join('; ')}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

const total = Object.keys(payloads).length;
console.log(failed ? `\n${failed} of ${total} payloads leaked` : `\nall ${total} payloads neutralised`);
process.exit(failed ? 1 : 0);
