/**
 * Génère la Build Output API Vercel (.vercel/output) pour `framework: null`.
 *
 * - compile api/index.ts (app Express) en une fonction serverless `api`
 * - copie dist/ (build Vite) dans static/
 * - écrit config.json (routage du Build Output API v3)
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.vercel', 'output');
const fnDir = join(outDir, 'functions', 'api.func');
const staticDir = join(outDir, 'static');
const distDir = join(root, 'dist');

console.log('[build-vercel] Génération de la Build Output API (.vercel/output)');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(fnDir, { recursive: true });
mkdirSync(staticDir, { recursive: true });

cpSync(distDir, staticDir, { recursive: true });

await build({
  entryPoints: [join(root, 'api/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  external: ['vite'],
  sourcemap: true,
  outfile: join(fnDir, 'index.cjs'),
});

writeFileSync(
  join(fnDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs20.x',
      handler: 'index.cjs',
      maxDuration: 30,
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
);

writeFileSync(
  join(outDir, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { src: '/api/(.*)', dest: '/api' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log('[build-vercel] OK : fonction `/api` + statique prêts.');