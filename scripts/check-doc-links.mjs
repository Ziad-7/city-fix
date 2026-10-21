#!/usr/bin/env node
// Checks that every relative link in the docs points to an existing file or folder.
//  - Markdown: README.md, CONTRIBUTING.md, docs/**/*.md, apps/*/README.md  ([text](target), ![alt](target))
//  - HTML: docs/design/**/*.html  (href="...", src="...")
// External links (http, https, mailto, tel, data, //), pure anchors (#x) and absolute paths are skipped.
// Anchors and query strings are stripped before the file check (the file must exist; the anchor is not verified).
// No dependencies. Usage: node scripts/check-doc-links.mjs   (run from anywhere)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist']);

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, test, out);
    else if (test(p)) out.push(p);
  }
  return out;
}

const inDesign = (p) => relative(root, p).split(sep).slice(0, 2).join('/') === 'docs/design';

const files = [];
for (const f of ['README.md', 'CONTRIBUTING.md']) if (existsSync(join(root, f))) files.push(join(root, f));
files.push(...walk(join(root, 'docs'), (p) => p.endsWith('.md') || (p.endsWith('.html') && inDesign(p))));
if (existsSync(join(root, 'apps'))) {
  for (const app of readdirSync(join(root, 'apps'))) {
    const r = join(root, 'apps', app, 'README.md');
    if (existsSync(r)) files.push(r);
  }
}

function stripCode(md) {
  // Blank out fenced and inline code so example links in code are not checked (line numbers are kept).
  return md
    .replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, (m) => m.replace(/[^\n]/g, ''))
    .replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
}

function extract(file, text) {
  const links = [];
  const add = (target, index, src) => links.push({ target, line: src.slice(0, index).split('\n').length });
  if (file.endsWith('.md')) {
    const src = stripCode(text);
    const re = /!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+["'][^)\n]*["'])?\s*\)/g;
    for (const m of src.matchAll(re)) add(m[1].replace(/^<|>$/g, ''), m.index, src);
    const ref = /^\s{0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/gm;
    for (const m of src.matchAll(ref)) add(m[1].replace(/^<|>$/g, ''), m.index, src);
  } else {
    const re = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
    for (const m of text.matchAll(re)) add(m[1] ?? m[2], m.index, text);
  }
  return links;
}

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const broken = [];
let checked = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const { target, line } of extract(file, text)) {
    if (!target || target.startsWith('#') || target.startsWith('/') || EXTERNAL.test(target)) continue;
    // Skip template placeholders such as {{x}} or ${x}.
    if (/[{}$]/.test(target)) continue;
    let path = target.split('#')[0].split('?')[0];
    if (!path) continue;
    try {
      path = decodeURIComponent(path);
    } catch {
      /* keep as is */
    }
    checked++;
    if (!existsSync(resolve(dirname(file), path))) {
      broken.push(`${relative(root, file)}:${line}  ->  ${target}`);
    }
  }
}

if (broken.length) {
  console.error(`Broken relative links (${broken.length}):`);
  for (const b of broken) console.error('  ' + b);
  process.exit(1);
}
console.log(`OK: ${checked} relative links in ${files.length} files all resolve.`);
