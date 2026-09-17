<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Mina's Food

Application de boutique pâtisserie artisanale pour Mbour, Sénégal, avec catalogue, panier, paiement via lien commercial Wave, suivi de commandes et backoffice sécurisé.

## Prérequis

- Node.js 20+
- PostgreSQL si tu veux utiliser la base de données réelle

## Installation

1. Installe les dépendances :
   `npm install`
2. Copie le fichier d'environnement :
   `cp .env.example .env`
3. Configure les variables d’environnement dans `.env`
4. Démarre le projet :
   `npm run dev`

## Variables d’environnement

La configuration minimale est :

- `DATABASE_URL` : URL PostgreSQL de ton instance Neon ou locale
- `ADMIN_PIN` : code PIN d’accès au backoffice, **strictement côté serveur** (par défaut : `mina2026`). Ne jamais utiliser `VITE_ADMIN_PIN` en production : toute variable préfixée `VITE_` est embarquée dans le bundle navigateur.
- `ALLOWED_ORIGINS` (optionnel) : origines autorisées en CORS, séparées par des virgules
- `VITE_WAVE_PAYMENT_LINK` : lien commercial Wave qui sera ouvert au client
- `WAVE_WEBHOOK_SECRET` (optionnel) : secret HMAC-SHA256 qui authentifie les appels du webhook Wave vers `/api/wave/webhook`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VITE_VAPID_PUBLIC_KEY` (optionnel) : clés Web Push pour les notifications natives de navigateur
- `VAPID_SUBJECT` (optionnel) : adresse `mailto:` de contact exigée par le standard Push (défaut : `mailto:commandes@minasfood-mbour.sn`)

Exemple :

```env
DATABASE_URL=postgresql://user:password@host:5432/minasfood
ADMIN_PIN=mina2026
VITE_WAVE_PAYMENT_LINK=https://pay.wave.com/m/REMPLACE_PAR_TON_LIEN
WAVE_WEBHOOK_SECRET=REMPLACE_PAR_UN_SECRET_LONG
VAPID_PUBLIC_KEY=REMPLACE_PAR_TA_CLE_PUBLIQUE
VAPID_PRIVATE_KEY=REMPLACE_PAR_TA_CLE_PRIVEE
VITE_VAPID_PUBLIC_KEY=REMPLACE_PAR_TA_CLE_PUBLIQUE
VAPID_SUBJECT=mailto:commandes@minasfood-mbour.sn
```

Si `DATABASE_URL` est absente ou vide, le projet passe automatiquement en mode démo sans base de données.

## Commandes utiles

- `npm run dev` : démarrage du serveur de développement
- `npm run build` : build de production
- `npm run lint` : vérification TypeScript
- `npm test` : exécution des tests de sécurité

## Sécurité

Le backoffice est protégé par un PIN **jamais exposé au navigateur** : l’authentification et le verrouillage anti-bruteforce (5 tentatives, blocage 60 s) sont gérés côté serveur. Les opérations d’administration exigent un token de session serveur (persisté sur disque en local et en base Neon en serverless).

Les endpoints publics sont protégés par un limiteur de débit par adresse IP, **persisté en base Neon** (table `rate_limits`) pour rester efficace entre les instances serverless, avec repli mémoire si la base est indisponible.

Les frais de livraison sont **recalculés côté serveur** à partir de la zone active : le client ne peut pas les modifier. Le retrait en boutique est toujours gratuit.

### Paiement Wave

Avec le **lien commercial Wave**, aucune vérification automatique serveur-à-serveur n’est possible. Le modèle retenu est donc :

1. Le client ouvre le lien commercial Wave, paie, puis déclare sa référence (`POST /api/wave/verify`). La commande reste **en attente**.
2. Mina vérifie le paiement dans son application Wave puis le confirme dans le backoffice (`PATCH /api/orders/:id/payment`), qui passe la commande en `paid` et synchronise la facture.

Une référence Wave ne peut jamais être réutilisée sur deux commandes (index unique). Si tu disposes d’un compte **Wave Business**, configure `WAVE_WEBHOOK_SECRET` pour que Wave certifie automatiquement les paiements via un webhook signé HMAC-SHA256 (`/api/wave/webhook`), sans intervention manuelle.

Les prix sont exprimés en entiers FCFA : le Franc CFA est une monnaie sans centimes, ce choix garantit donc une précision exacte, conforme au système monétaire sénégalais.

## Notifications temps réel & Push

La plateforme combine trois canaux de notification :

- **Temps réel WebSocket** (`/api/ws`) : diffusion instantanée vers tous les onglets ouverts (nouvelles commandes, changement de statut, paiement Wave, annonces du backoffice) avec toasts, carillons sonores et historique in-app accessible depuis la cloche. Le WebSocket est utilisé en mode local / VPS.
- **Temps réel SSE** (`/api/events/stream`) : endpoint Server-Sent Events, utilisé automatiquement par le client sur Vercel (serverless, pas de WebSocket global entre instances Vercel) et disponible en fallback dès que le WebSocket n'est pas joignable. Le client reçoit les mêmes événements en temps réel et récupère un replay des derniers événements à la connexion.
- **Push natif** (Service Worker + Push API) : les notifications sont également reçues lorsque l'onglet est fermé ou le navigateur en arrière-plan. Le client s'abonne avec les clés VAPID (`/sw.js`) et le serveur envoie les notifications via `web-push`, en retirant automatiquement les abonnements expirés (HTTP 404/410). Les abonnements sont persistés en base (table `push_subscriptions`) ou à défaut dans un fichier local `.push-subscriptions.json`.

Pour activer le push, génère les clés VAPID et renseigne-les dans `.env` :

```bash
npx web-push generate-vapid-keys --json
```

Le push natif ne fonctionne que sur une origine **HTTPS** (ou `localhost` en développement).

## Déploiement Vercel (serverless)

L'application est prête pour Vercel + Neon (PostgreSQL serverless). Le mode est automatiquement détecté : lorsque Vercel définit la variable `VERCEL=1`, le serveur n'ouvre ni port ni WebSocket global ; l'export est l'application Express.

### Prérequis

1. **Base Neon** : crée un projet sur [neon.tech](https://neon.tech), copie l'URL de connexion (`DATABASE_URL`) avec le paramètre `sslmode=require`.
2. **Clés VAPID** : génère-les une seule fois et stocke-les dans Vercel (Environment Variables) comme dans `.env`.

### Variables à configurer dans le dashboard Vercel

| Variable | Exemple / Valeur |
|---|---|
| `DATABASE_URL` | `postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require` |
| `ADMIN_PIN` | `mina2026` (ou un secret fort, côté serveur uniquement) |
| `VAPID_PUBLIC_KEY` | `BD8yCmu__eyk...` |
| `VAPID_PRIVATE_KEY` | `0chfB96RE...` |
| `VITE_VAPID_PUBLIC_KEY` | (identique à `VAPID_PUBLIC_KEY`, exposée au client) |
| `VAPID_SUBJECT` | `mailto:commandes@minasfood-mbour.sn` |
| `VITE_WAVE_PAYMENT_LINK` | Lien Wave commercial (optionnel, fallback dans le code) |
| `WAVE_WEBHOOK_SECRET` | Secret HMAC Wave (optionnel mais recommandé) |

### Structure du build

- `npm run build` (exécuté par Vercel) produit `dist/` (frontend) + `dist-server/server.cjs` (bundle backend, non exposé).
- `api/index.ts` importe et exporte l'application Express ; Vercel le monte via `@vercel/node`.
- `vercel.json` route `/api/*` vers la fonction Node et sert les fichiers statiques depuis `dist/`.

### Auto-initialisation de la base

Au premier démarrage avec `DATABASE_URL`, le serveur crée automatiquement les tables manquantes (`admin_sessions`, `realtime_events`, index unique sur `wave_transaction_ref`) et peuple le catalogue avec les produits et zones de démo si la table `products` est vide.

### Commande locale avec l'override Vercel

```bash
VERCEL=1 PORT=3999 node dist-server/server.cjs
```

## Fonctionnalités

- catalogue des produits
- panier et gestion de livraison
- paiement via lien commercial Wave
- suivi de commande en temps réel avec numéro de commande et téléphone client
- notifications temps réel (WebSocket & SSE) et push natif (Service Worker / VAPID)
- génération de facture
- backoffice de gestion
