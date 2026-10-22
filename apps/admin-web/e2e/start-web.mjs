// Starts an isolated `next dev` on a mirror of the app so it never collides with
// another dev server running from the same directory (Next 16 allows one per dir).
// Mirror lives in .next/e2e-app (dot-dir: ignored by tsc, eslint and vitest) and
// reuses the real node_modules through a junction.
import { cpSync, mkdirSync, rmSync, existsSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mirror = path.join(root, '.next', 'e2e-app');
const port = process.env.E2E_WEB_PORT ?? '3120';

rmSync(mirror, { recursive: true, force: true });
mkdirSync(mirror, { recursive: true });
for (const f of ['src', 'public', 'package.json', 'tsconfig.json', 'postcss.config.mjs']) {
  if (existsSync(path.join(root, f))) cpSync(path.join(root, f), path.join(mirror, f), { recursive: true });
}
cpSync(path.join(root, 'next.config.ts'), path.join(mirror, 'next.base.ts'));
writeFileSync(
  path.join(mirror, 'next.config.ts'),
  `import base from './next.base';\nexport default { ...base, turbopack: { ...base.turbopack, root: ${JSON.stringify(root)} } };\n`,
);
symlinkSync(path.join(root, 'node_modules'), path.join(mirror, 'node_modules'), 'junction');

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextBin, 'dev', '-p', port], { cwd: mirror, stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill());
