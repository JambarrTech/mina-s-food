/**
 * @license
 * Entrée Vercel (serverless) : monte l'app Express définie dans server.ts.
 *
 * Sur Vercel (VERCEL=1), server.ts :
 * - n'ouvre ni port ni http.createServer
 * - utilise Neon comme source de vérité (sessions admin, refs Wave, push,
 *   événements temps réel)
 * - exporte l'app Express ci-dessous.
 *
 * En local, `npm run dev` / `node dist/server.cjs` rend le serveur complet.
 */
import app from '../server';

export default app;