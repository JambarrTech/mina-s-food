import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import vercel, {type VercelOutputConfig} from 'vite-plugin-vercel';

type VercelRoute = NonNullable<VercelOutputConfig['routes']>[number];

// Routage du Build Output API aligné sur l'ancienne config manuelle qui
// fonctionnait : /api/* -> fonction servie sous /api, tout le reste ->
// index.html (SPA). Le routage par défaut du plugin (dest '/api/$1' avec
// check:true) ne joignait pas la fonction sur Vercel.
const vercelRoutes: VercelRoute[] = [
  {handle: 'filesystem'},
  {src: '/api/(.*)', dest: '/api'},
  {src: '/(.*)', dest: '/index.html'},
];

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), vercel()],
    vercel: {
      // SSE : la connexion se referme volontairement à ~50 s côté serveur puis
      // EventSource se reconnecte, ce qui reste sous cette durée max.
      defaultMaxDuration: 60,
      defaultSupportsResponseStreaming: true,
      config: {
        routes: vercelRoutes,
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
