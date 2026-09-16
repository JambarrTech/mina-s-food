/**
 * @license
 * Backend Express + Vite - Pâtisserie Artisanale Mina's Food (Mbour, Sénégal)
 * 
 * Ce serveur gère :
 * - Les endpoints d'API pour les commandes et le menu
 * - Le système de facturation officiel pour les clients et le backoffice (JSON & HTML)
 * - La validation et vérification des paiements Wave Sénégal
 * - Le conseil personnalisé par IA (Gemini) pour les saveurs et gâteaux d'anniversaire
 * - L'intégration du middleware Vite en développement et le service statique en production
 */

import express, { Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { Pool } from 'pg';
import webPush from 'web-push';

dotenv.config();

// Mode Vercel : chaque invocation est serverless (app exportée, pas de
// http.createServer ni de WebSocket global). En local : serveur Express plein.
const IS_VERCEL = process.env.VERCEL === '1';

const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const VITE_HMR_PORT = Number(process.env.VITE_HMR_PORT || 24678);

let server: http.Server | null = null;
let wss: WebSocketServer | null = null;

// Clients Server-Sent Events : temps réel aussi en mode serverless Vercel
// (le WebSocket global n'existe pas entre plusieurs instances de fonctions).
const sseClients = new Set<Response>();
const recentEvents: Array<{ id: string; event: string; data: unknown; timestamp: string }> = [];
const MAX_RECENT_EVENTS = 100;

function activeWsClients(): number {
  return wss ? wss.clients.size : 0;
}

function enqueueRealtimeEvent(event: string, payload: unknown, timestamp: string): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  recentEvents.push({ id, event, data: payload, timestamp });
  if (recentEvents.length > MAX_RECENT_EVENTS) recentEvents.shift();
  return id;
}

// Diffusion des événements temps réel : WebSocket (dev) + SSE (Vercel)
// + notifications natives (push) même quand l'onglet est fermé.
function broadcastRealtimeEvent(event: string, payload: any, push?: { title: string; message: string; type?: string; orderNumber?: string; url?: string }) {
  const timestamp = new Date().toISOString();
  const message = JSON.stringify({ event, data: payload, timestamp });
  const id = enqueueRealtimeEvent(event, payload, timestamp);
  persistRealtimeEventDb(id, event, payload, timestamp);

  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (err) {
          console.error('[WebSocket] Erreur envoi client :', err);
        }
      }
    });
  }

  if (sseClients.size > 0) {
    const sseFrame = `id: ${id}\nevent: ${event}\ndata: ${message}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(sseFrame);
      } catch {
        sseClients.delete(res);
        res.end();
      }
    }
  }

  // Envoi simultané d'une notification native (arrière-plan / onglet fermé)
  if (push) {
    sendPushToAll(push.title, push.message, push as any).catch(() => {});
  }
}

if (!IS_VERCEL) {
  // Initialisation du serveur WebSocket sur le chemin /api/ws
  server = http.createServer(app);
  wss = new WebSocketServer({ server, path: '/api/ws' });

  // Gestion des connexions WebSocket et heartbeat
  wss.on('connection', (ws: any) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Message de bienvenue avec statistiques
    ws.send(JSON.stringify({
      event: 'connection:established',
      data: {
        message: "Connecté au réseau temps réel Mina's Food Mbour",
        activeClients: wss!.clients.size,
        serverTime: new Date().toISOString()
      }
    }));

    ws.on('message', (messageRaw: any) => {
      try {
        const parsed = JSON.parse(messageRaw.toString());
        if (parsed.event === 'ping') {
          ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
        }
      } catch {}
    });
  });

  // Nettoyage régulier des connexions mortes (toutes les 30s)
  const heartbeatInterval = setInterval(() => {
    wss!.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}

app.use(express.json({
  verify: (req: Request, _res: Response, buf: Buffer) => {
    (req as any).rawBody = buf;
  }
}));

// ============================================================================
// Base de données Neon (PostgreSQL serverless)
// ============================================================================
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon serverless : évite de bloquer si le compute est en pause au
      // premier appel (le serveur répond 503 et le client relance).
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000
    })
  : null;
const adminPin = (process.env.ADMIN_PIN || process.env.VITE_ADMIN_PIN || 'mina2026').trim();

// ============================================================================
// Sessions administrateur.
// En local : persistance sur disque. En serverless (Vercel) : persistance en
// base Neon (les fonctions sont sans état, on vérifie le token en base).
// ============================================================================
const SESSIONS_FILE = path.join(process.cwd(), '.admin-sessions.json');
const adminSessions = new Map<string, number>();
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

async function ensureAdminSessionsTable() {
  if (!pool) return;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS admin_sessions (
      token text PRIMARY KEY,
      expires_at bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  } catch (err: any) {
    console.warn("[Mina's Food] Table admin_sessions indisponible :", err.message);
  }
}

async function loadAdminSessionsDb() {
  if (!pool) return;
  try {
    const { rows } = await pool.query(
      'SELECT token, expires_at FROM admin_sessions WHERE expires_at > $1',
      [Date.now()]
    );
    for (const row of rows) adminSessions.set(row.token, Number(row.expires_at));
  } catch (err: any) {
    console.warn("[Mina's Food] Chargement des sessions en base impossible :", err.message);
  }
}

async function syncAdminSessionsDb() {
  if (!pool) return;
  try {
    const now = Date.now();
    for (const [token, expiresAt] of adminSessions) {
      if (expiresAt > now) {
        await pool.query(
          `INSERT INTO admin_sessions (token, expires_at) VALUES ($1, $2)
           ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
          [token, expiresAt]
        );
      }
    }
    await pool.query('DELETE FROM admin_sessions WHERE expires_at <= $1', [now]);
  } catch (err: any) {
    console.warn("[Mina's Food] Synchronisation des sessions impossible :", err.message);
  }
}

function loadAdminSessions() {
  try {
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const now = Date.now();
    for (const [token, expiresAt] of Object.entries(parsed)) {
      if (Number(expiresAt) > now) adminSessions.set(token, Number(expiresAt));
    }
  } catch {
    // Fichier absent ou illisible : on démarre avec une session vide
  }
}

function persistAdminSessions() {
  try {
    const now = Date.now();
    for (const [token, expiresAt] of adminSessions) {
      if (expiresAt <= now) adminSessions.delete(token);
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(adminSessions)), { mode: 0o600 });
  } catch (err) {
    console.warn('[Mina\'s Food] Persistance des sessions impossible :', err);
  }
  syncAdminSessionsDb();
}

async function requireAdmin(req: Request, res: Response, next: () => void) {
  const authorization = req.header('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentification administrateur requise.' });
  }
  let expiresAt = adminSessions.get(token);
  // Fonction Vercel froide : la mémoire est vide, on vérifie donc en base.
  if (expiresAt === undefined && pool) {
    try {
      const { rows } = await pool.query(
        'SELECT expires_at FROM admin_sessions WHERE token = $1 AND expires_at > $2',
        [token, Date.now()]
      );
      if (rows[0]) {
        expiresAt = Number(rows[0].expires_at);
        adminSessions.set(token, expiresAt);
      }
    } catch {
      // La base peut être temporairement indisponible : on tombe en mémoire.
    }
  }
  if (!expiresAt || expiresAt <= Date.now()) {
    if (token) adminSessions.delete(token);
    return res.status(401).json({ success: false, error: 'Authentification administrateur requise.' });
  }
  next();
}

loadAdminSessions();
loadAdminSessionsDb();
// Nettoie périodiquement les sessions expirées de la mémoire et du disque/base
setInterval(persistAdminSessions, 60 * 60 * 1000).unref?.();

// ============================================================================
// Notifications Push Web (Service Worker + VAPID) - PWA Mina's Food
//
// Envoie des notifications natives du système via le Push API, même lorsque
// l'onglet est fermé. Repose sur :
//   - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY : clés dédiées (serveur)
//   - VITE_VAPID_PUBLIC_KEY : clé publique exposée au navigateur
//   - VAPID_SUBJECT (mailto:) : contact requis par le standard w3c
// ============================================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:commandes@minasfood-mbour.sn';

let pushEnabled = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  pushEnabled = true;
}

const PUSH_SUBSCRIPTIONS_FILE = path.join(process.cwd(), '.push-subscriptions.json');
const pushSubscriptions: any[] = [];

function loadPushSubscriptions() {
  try {
    const raw = fs.readFileSync(PUSH_SUBSCRIPTIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) pushSubscriptions.push(...parsed);
  } catch {
    // Absent ou illisible : on repart de zéro
  }
}

function persistPushSubscriptions() {
  try {
    fs.writeFileSync(PUSH_SUBSCRIPTIONS_FILE, JSON.stringify(pushSubscriptions), { mode: 0o600 });
  } catch (err) {
    console.warn('[Push] Persistance des abonnements impossible :', err);
  }
}

async function loadDbPushSubscriptions() {
  if (!pool) return;
  try {
    const { rows } = await pool.query('SELECT endpoint, keys_p256dh, keys_auth FROM push_subscriptions');
    pushSubscriptions.splice(0, pushSubscriptions.length, ...rows.map(row => ({
      endpoint: row.endpoint,
      expirationTime: null,
      keys: { p256dh: row.keys_p256dh, auth: row.keys_auth }
    })));
  } catch {
    // Table absente : mode démo / base non migrée, on ignore.
  }
}

function isValidPushSubscription(sub: any): boolean {
  return Boolean(
    sub &&
    typeof sub === 'object' &&
    typeof sub.endpoint === 'string' &&
    sub.endpoint.startsWith('https://') &&
    sub.keys &&
    typeof sub.keys.p256dh === 'string' &&
    typeof sub.keys.auth === 'string'
  );
}

async function addPushSubscription(subscription: any) {
  if (!isValidPushSubscription(subscription)) {
    return { error: 'Abonnement push invalide.', status: 400 };
  }
  // Déduplication par endpoint (un navigateur = un abonnement)
  const existing = pushSubscriptions.find(s => s.endpoint === subscription.endpoint);
  if (!existing) {
    pushSubscriptions.push(subscription);
    persistPushSubscriptions();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth)
           VALUES ($1,$2,$3)
           ON CONFLICT (endpoint) DO NOTHING`,
          [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
        );
      } catch (err: any) {
        console.warn('[Push] Enregistrement SQL impossible :', err.message);
      }
    }
    console.log(`[Push] Abonnement enregistré (${pushSubscriptions.length} au total).`);
  }
  return { success: true };
}

async function removePushSubscription(endpoint: string) {
  const index = pushSubscriptions.findIndex(s => s.endpoint === endpoint);
  if (index >= 0) {
    pushSubscriptions.splice(index, 1);
    persistPushSubscriptions();
    if (pool) {
      try {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
      } catch (err: any) {
        console.warn('[Push] Suppression SQL impossible :', err.message);
      }
    }
    console.log(`[Push] Abonnement retiré (${pushSubscriptions.length} restants).`);
  }
  return { success: true };
}

/**
 * Envoie une notification push native à tous les abonnés.
 * Les abonnements devenus invalides (410/404) sont automatiquement retirés.
 */
async function sendPushToAll(title: string, message: string, extras: { type?: string; orderNumber?: string; url?: string } = {}) {
  if (!pushEnabled || pushSubscriptions.length === 0) return 0;

  const payload = JSON.stringify({
    title,
    message,
    type: extras.type || 'info',
    orderNumber: extras.orderNumber || null,
    url: extras.url || '/'
  });

  let sent = 0;
  const invalid: string[] = [];

  await Promise.all(pushSubscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification(subscription, payload);
      sent += 1;
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        invalid.push(subscription.endpoint);
      } else {
        console.warn('[Push] Échec envoi :', err?.statusCode || err?.message || err);
      }
    }
  }));

  if (invalid.length === 0) return sent;
  for (const endpoint of invalid) await removePushSubscription(endpoint);
  return sent;
}

loadPushSubscriptions();
loadDbPushSubscriptions();

// ============================================================================
// Limiteur de débit (rate limiter) basique en mémoire, par adresse IP
// Protège les endpoints publics contre les abus et le spam de commandes.
// ============================================================================
interface RateWindow { count: number; resetAt: number }
const rateBuckets = new Map<string, RateWindow>();

async function rateLimit(
  req: Request,
  res: Response,
  next: (err?: any) => void,
  { windowMs = 60_000, max = 60 }: { windowMs?: number; max?: number } = {}
) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > max) {
    return res.status(429).json({
      success: false,
      error: 'Trop de requêtes. Veuillez patienter quelques instants avant de réessayer.'
    });
  }

  return next();
}

function rateLimitedHandler(
  handler: (req: Request, res: Response) => any,
  opts?: { windowMs?: number; max?: number }
) {
  return (req: Request, res: Response, next: (err?: any) => void) => {
    rateLimit(req, res, () => {
      Promise.resolve(handler(req, res))
        .then(() => {
          // Ne pas poursuivre vers le middleware suivant (Vite/CORS) si la
          // réponse a déjà été envoyée : évite les erreurs de headers.
          if (!res.headersSent) next();
        })
        .catch(err => next(err));
    }, opts);
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}, 60_000).unref?.();

function pinsMatch(candidate: string) {
  const expected = Buffer.from(adminPin);
  const received = Buffer.from(candidate || '');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

const demoProducts = [
  {
    id: 'prod-gateau-royal-chocolat',
    name: 'Gâteau Royal Chocolat & Praliné Croustillant',
    category: 'gateaux',
    description: 'Biscuit noisette, croustillant praliné et mousse au chocolat noir.',
    price: 12000,
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80',
    isAvailable: true,
    isCustomizable: true,
    preparationTime: 'Sur commande (24h)',
    highlightBadge: 'Bestseller Mbour',
    allergens: ['Gluten', 'Lait', 'Fruits à coque', 'Œufs'],
    tags: []
  },
  {
    id: 'prod-red-velvet-mina',
    name: 'Layer Cake Red Velvet Suprême',
    category: 'gateaux',
    description: 'Génoise cacao et cream cheese vanillé onctueux.',
    price: 14000,
    image: 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=900&q=80',
    isAvailable: true,
    isCustomizable: true,
    preparationTime: 'Sur commande (24h)',
    highlightBadge: 'Coup de cœur',
    allergens: ['Gluten', 'Lait', 'Œufs'],
    tags: []
  },
  {
    id: 'prod-croissant-pur-beurre',
    name: 'Croissant Feuilleté Pur Beurre',
    category: 'viennoiseries',
    description: 'Feuilletage pur beurre façonné chaque matin à Mbour.',
    price: 600,
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=80',
    isAvailable: true,
    isCustomizable: false,
    preparationTime: 'Disponible dès 07h30',
    highlightBadge: 'Du jour',
    allergens: ['Gluten', 'Lait'],
    tags: []
  },
  {
    id: 'prod-jus-bissap-frais',
    name: 'Jus de Bissap Rouge Bio & Menthe Fraîche',
    category: 'boissons_locales',
    description: 'Infusion fraîche de bissap, menthe et vanille.',
    price: 1000,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80',
    isAvailable: true,
    isCustomizable: false,
    preparationTime: 'Frais & glacé',
    highlightBadge: '100% naturel',
    allergens: [],
    tags: []
  }
];

const demoZones = [
  { id: 'zone-mbour-centre', name: 'Mbour Centre, Escale, Tefess & Marché', fee: 1000, estimatedMinutes: 25, isActive: true },
  { id: 'zone-mbour-quartiers', name: 'Mbour 1, 2, 3, 4 & Oncad', fee: 1200, estimatedMinutes: 30, isActive: true },
  { id: 'zone-saly', name: 'Saly Portudal, Saly Tapée, Golf & Niakh Niakhal', fee: 1500, estimatedMinutes: 35, isActive: true },
  { id: 'zone-somone-ngaparou', name: 'Ngaparou & Somone Plage', fee: 2000, estimatedMinutes: 45, isActive: true }
];

const demoOrders: any[] = [];

// ============================================================================
// Auto-init de la base (base Neon neuve : tables serverless + seed catalogue)
// ============================================================================
let dbStateInitialized = false;

async function ensureDatabaseState() {
  if (!pool || dbStateInitialized) return;
  try {
    dbStateInitialized = true;
    await ensureAdminSessionsTable();
    await pool.query(`CREATE TABLE IF NOT EXISTS realtime_events (
      id text PRIMARY KEY,
      event text NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_realtime_events_created ON realtime_events (created_at DESC)');
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_wave_ref_unique
       ON orders (wave_transaction_ref) WHERE wave_transaction_ref IS NOT NULL`
    );
    await seedDemoDataIfEmpty();
  } catch (err: any) {
    dbStateInitialized = false; // nouvelle tentative au prochain appel
    console.warn("[Mina's Food] Initialisation de la base impossible :", err.message);
  }
}

async function seedDemoDataIfEmpty() {
  if (!pool) return;
  const products = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if (products.rows[0].count === 0) {
    for (const product of demoProducts) await upsertProduct(product);
  }
  const zones = await pool.query('SELECT COUNT(*)::int AS count FROM delivery_zones');
  if (zones.rows[0].count === 0) {
    await replaceZones(demoZones);
  }
  await pool.query(
    `INSERT INTO bakery_settings (id, shop_name, tagline, city, address, phone_wave, phone_whatsapp, opening_hours, is_open, announcement)
     VALUES ('main', $1, $2, $3, $4, $5, $6, $7, true, NULL)
     ON CONFLICT (id) DO NOTHING`,
    [SELLER_INFO.brand, 'Pâtisserie artisanale à Mbour, Sénégal', SELLER_INFO.city,
     SELLER_INFO.address, SELLER_INFO.phoneWave, SELLER_INFO.phoneWhatsApp,
     'Tous les jours 8h - 20h']
  );
}

function persistRealtimeEventDb(id: string, event: string, payload: unknown, timestamp: string) {
  if (!pool) return;
  pool.query(
    `INSERT INTO realtime_events (id, event, payload, created_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [id, event, JSON.stringify(payload), timestamp]
  ).catch(() => {});
}

async function listRecentEventsDb(): Promise<Array<{ id: string; event: string; data: unknown; timestamp: string }>> {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      'SELECT id, event, payload, created_at FROM realtime_events ORDER BY created_at DESC LIMIT 50'
    );
    return rows.map((row: any) => ({
      id: row.id,
      event: row.event,
      data: row.payload,
      timestamp: row.created_at
    }));
  } catch {
    return [];
  }
}

ensureDatabaseState();

function getDemoProduct(productId: string) {
  return demoProducts.find(product => product.id === productId);
}

async function validateOrderPayload(orderData: any) {
  const allowedDeliveryTypes = ['livraison_mbour', 'retrait_boutique'];
  const allowedPaymentMethods = ['wave', 'cash_delivery'];
  if (!orderData || typeof orderData !== 'object') throw new Error('Données de commande invalides.');
  if (!String(orderData.customerName || '').trim() || !String(orderData.customerPhone || '').trim()) {
    throw new Error('Nom du client et téléphone requis.');
  }
  if (!allowedDeliveryTypes.includes(orderData.deliveryType)) throw new Error('Mode de livraison invalide.');
  if (!allowedPaymentMethods.includes(orderData.paymentMethod)) throw new Error('Mode de paiement invalide.');
  if (!Array.isArray(orderData.items) || orderData.items.length === 0) throw new Error('La commande doit contenir au moins un article.');

  const items = await Promise.all(orderData.items.map(async (item: any) => {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('Quantité d’article invalide.');
    let product = getDemoProduct(item.product?.id);
    if (pool && item.product?.id) {
      const { rows } = await pool.query('SELECT * FROM products WHERE id = $1 LIMIT 1', [item.product.id]);
      product = rows[0] ? mapProduct(rows[0]) : undefined;
    }
    if (!product?.id || !String(product.name || '').trim()) throw new Error('Produit de commande invalide.');
    const basePrice = Number(product.price);
    const unitPrice = Number(item.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice < basePrice) throw new Error(`Prix invalide pour ${product.name}.`);
    if (!product.isCustomizable && unitPrice !== basePrice) throw new Error(`Prix non autorisé pour ${product.name}.`);
    if (item.customization && !product.isCustomizable) throw new Error(`Personnalisation non autorisée pour ${product.name}.`);
    return { ...item, quantity, unitPrice, product: { ...product, price: basePrice } };
  }));

  const subtotal = items.reduce((total: number, item: any) => total + item.unitPrice * item.quantity, 0);
  const deliveryFee = Number(orderData.deliveryFee) || 0;
  if (!Number.isInteger(deliveryFee) || deliveryFee < 0) throw new Error('Frais de livraison invalides.');
  const total = subtotal + deliveryFee;
  return { ...orderData, items, subtotal, deliveryFee, total };
}

async function ensureDb(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// --- Mappeurs lignes PostgreSQL (snake_case) -> objets métier (camelCase) ---
function mapProduct(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: Number(row.price),
    image: row.image,
    isAvailable: row.is_available,
    isCustomizable: row.is_customizable,
    preparationTime: row.preparation_time,
    highlightBadge: row.highlight_badge,
    allergens: row.allergens || [],
    tags: row.tags || []
  };
}

function mapZone(row: any) {
  return {
    id: row.id,
    name: row.name,
    fee: Number(row.fee),
    estimatedMinutes: Number(row.estimated_minutes),
    isActive: row.is_active
  };
}

function mapSettings(row: any) {
  return {
    shopName: row.shop_name,
    tagline: row.tagline,
    city: row.city,
    address: row.address,
    phoneWave: row.phone_wave,
    phoneWhatsApp: row.phone_whatsapp,
    openingHours: row.opening_hours,
    isOpen: row.is_open,
    announcement: row.announcement
  };
}

function mapOrder(row: any) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    deliveryType: row.delivery_type,
    deliveryZone: row.delivery_zone,
    deliveryAddress: row.delivery_address,
    deliveryFee: Number(row.delivery_fee),
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    waveTransactionRef: row.wave_transaction_ref,
    status: row.status,
    customerNotes: row.customer_notes,
    requestedDate: row.requested_date,
    requestedTime: row.requested_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: [] as any[]
  };
}

function mapOrderItem(row: any) {
  return {
    cartItemId: row.cart_item_id,
    product: row.product_snapshot || null,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    customization: row.customization || undefined,
    notes: row.notes || undefined
  };
}

// --- Produits (catalogue) ---
async function listProducts() {
  if (!pool) {
    return demoProducts;
  }
  const { rows } = await pool.query('SELECT * FROM products ORDER BY name');
  return rows.map(mapProduct);
}

async function upsertProduct(p: any) {
  if (!pool) {
    const index = demoProducts.findIndex(product => product.id === p.id);
    const product = {
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description || '',
      price: Number(p.price) || 0,
      image: p.image || '',
      isAvailable: p.isAvailable !== false,
      isCustomizable: Boolean(p.isCustomizable),
      preparationTime: p.preparationTime || '',
      highlightBadge: p.highlightBadge || '',
      allergens: p.allergens || [],
      tags: p.tags || []
    };
    if (index >= 0) demoProducts[index] = product;
    else demoProducts.push(product);
    return;
  }
  await pool.query(
    `INSERT INTO products (id, name, category, description, price, image, is_available, is_customizable, preparation_time, highlight_badge, allergens, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description,
       price = EXCLUDED.price, image = EXCLUDED.image, is_available = EXCLUDED.is_available,
       is_customizable = EXCLUDED.is_customizable, preparation_time = EXCLUDED.preparation_time,
       highlight_badge = EXCLUDED.highlight_badge, allergens = EXCLUDED.allergens, tags = EXCLUDED.tags`,
    [p.id, p.name, p.category, p.description || '', Number(p.price) || 0, p.image || null,
     p.isAvailable !== false, Boolean(p.isCustomizable), p.preparationTime || null,
     p.highlightBadge || null, JSON.stringify(p.allergens || []), JSON.stringify(p.tags || [])]
  );
}

async function deleteProduct(id: string) {
  if (!pool) {
    const index = demoProducts.findIndex(product => product.id === id);
    if (index >= 0) demoProducts.splice(index, 1);
    return;
  }
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
}

// --- Zones de livraison ---
async function listZones() {
  if (!pool) {
    return demoZones;
  }
  const { rows } = await pool.query('SELECT * FROM delivery_zones ORDER BY fee');
  return rows.map(mapZone);
}

async function replaceZones(zones: any[]) {
  if (!pool) {
    demoZones.splice(0, demoZones.length, ...zones.map((zone: any, index: number) => ({
      id: zone.id || `zone-demo-${index + 1}`,
      name: String(zone.name || '').trim(),
      fee: Number(zone.fee) || 0,
      estimatedMinutes: Number(zone.estimatedMinutes) || 0,
      isActive: zone.isActive !== false
    })));
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM delivery_zones');
    for (const z of zones) {
      await client.query(
        `INSERT INTO delivery_zones (id, name, fee, estimated_minutes, is_active) VALUES ($1,$2,$3,$4,$5)`,
        [z.id || `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, z.name,
         Number(z.fee) || 0, z.estimatedMinutes != null ? Number(z.estimatedMinutes) : null,
         z.isActive !== false]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// --- Paramètres de la boutique ---
async function getSettings() {
  if (!pool) {
    return {
      shopName: 'Mina\'s Food',
      tagline: 'Saveurs faites avec amour • Qualité, Fraîcheur & Passion',
      city: 'Mbour, Sénégal',
      address: 'Quartier Grand Mbour, Route de Saly, Mbour',
      phoneWave: '+221 77 407 81 20',
      phoneWhatsApp: '+221 77 407 81 20',
      openingHours: 'Du Mardi au Dimanche : 07h30 - 21h30',
      isOpen: true,
      announcement: 'Mode démo activé : la base de données n\'est pas configurée.'
    };
  }
  const { rows } = await pool.query(`SELECT * FROM bakery_settings WHERE id = 'main' LIMIT 1`);
  return rows[0] ? mapSettings(rows[0]) : null;
}

async function upsertSettings(s: any) {
  if (!pool) {
    throw new Error('Base de données indisponible : mode démo activé.');
  }
  await pool.query(
    `INSERT INTO bakery_settings (id, shop_name, tagline, city, address, phone_wave, phone_whatsapp, opening_hours, is_open, announcement)
     VALUES ('main',$1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET
       shop_name = EXCLUDED.shop_name, tagline = EXCLUDED.tagline, city = EXCLUDED.city,
       address = EXCLUDED.address, phone_wave = EXCLUDED.phone_wave,
       phone_whatsapp = EXCLUDED.phone_whatsapp, opening_hours = EXCLUDED.opening_hours,
       is_open = EXCLUDED.is_open, announcement = EXCLUDED.announcement`,
    [s.shopName, s.tagline || null, s.city, s.address || null, s.phoneWave || null,
     s.phoneWhatsApp || null, s.openingHours || null, s.isOpen !== false, s.announcement || null]
  );
}

// --- Commandes ---
async function listOrders() {
  if (!pool) {
    return demoOrders;
  }
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  const orders = rows.map(mapOrder);
  if (orders.length === 0) return orders;

  const ids = orders.map(o => o.id);
  const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id = ANY($1::text[])', [ids]);
  const index = new Map(orders.map(o => [o.id, o]));
  for (const it of items) {
    const order = index.get(it.order_id);
    if (order) order.items.push(mapOrderItem(it));
  }
  return orders;
}

async function getOrderByIdentifier(identifier: string) {
  if (!pool) {
    return demoOrders.find(order => order.id === identifier || order.orderNumber.toUpperCase() === identifier.toUpperCase()) || null;
  }
  const { rows } = await pool.query(
    'SELECT * FROM orders WHERE id = $1 OR UPPER(order_number) = UPPER($1) LIMIT 1',
    [identifier]
  );
  if (rows.length === 0) return null;
  const order = mapOrder(rows[0]);
  const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
  order.items = items.map(mapOrderItem);
  return order;
}

async function createOrder(orderData: any) {
  const validated = await validateOrderPayload(orderData);
  if (!pool) {
    const now = new Date().toISOString();
    const order = {
      ...validated,
      id: validated.id || `ord-${Date.now()}`,
      orderNumber: validated.orderNumber || `MINA-${Math.floor(1000 + Math.random() * 9000)}`,
      paymentStatus: validated.paymentStatus || (validated.paymentMethod === 'wave' ? 'pending' : 'pending'),
      status: validated.status || 'received',
      createdAt: now,
      updatedAt: now
    };
    demoOrders.unshift(order);
    return { order, orderNumber: order.orderNumber, orderId: order.id };
  }
  const orderId = validated.id || `ord-${Date.now()}`;
  const orderNumber = validated.orderNumber || `MINA-${Math.floor(1000 + Math.random() * 9000)}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO orders (id, order_number, customer_name, customer_phone, customer_email, delivery_type,
        delivery_zone, delivery_address, delivery_fee, subtotal, total, payment_method, payment_status,
        wave_transaction_ref, status, customer_notes, requested_date, requested_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [orderId, orderNumber, validated.customerName, validated.customerPhone, validated.customerEmail || null,
       validated.deliveryType, validated.deliveryZone || null,
       validated.deliveryAddress || null, validated.deliveryFee, validated.subtotal,
       validated.total, validated.paymentMethod,
       validated.paymentStatus || 'pending', validated.waveTransactionRef || null, validated.status || 'received',
       validated.customerNotes || null, validated.requestedDate || null, validated.requestedTime || null]
    );

    for (const item of validated.items) {
      await client.query(
        `INSERT INTO order_items (order_id, cart_item_id, product_id, product_snapshot, quantity, unit_price, customization, notes)
         VALUES ($1,$2,(SELECT id FROM products WHERE id = $3),$4,$5,$6,$7,$8)`,
        [orderId, item.cartItemId || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
         item.product?.id || null, JSON.stringify(item.product || {}), Number(item.quantity) || 1,
         Number(item.unitPrice) || Number(item.product?.price) || 0,
         item.customization ? JSON.stringify(item.customization) : null, item.notes || null]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const saved = await getOrderByIdentifier(orderId);
  return { order: saved, orderNumber, orderId: saved?.id };
}

async function updateOrderStatus(identifier: string, status: string) {
  if (!pool) {
    const order = await getOrderByIdentifier(identifier);
    if (!order) return null;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    return order;
  }
  await pool.query(
    `UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 OR UPPER(order_number) = UPPER($1)`,
    [identifier, status]
  );
  return getOrderByIdentifier(identifier);
}

async function markOrderPaid(identifier: string, transactionRef: string) {
  if (!pool) {
    const order = await getOrderByIdentifier(identifier);
    if (order) {
      order.paymentStatus = 'paid';
      order.waveTransactionRef = transactionRef;
      order.updatedAt = new Date().toISOString();
    }
    return;
  }
  await pool.query(
    `UPDATE orders SET payment_status = 'paid', wave_transaction_ref = $2, updated_at = now()
     WHERE id = $1 OR UPPER(order_number) = UPPER($1)`,
    [identifier, transactionRef]
  );
}
  const SELLER_INFO = {
  name: "Mme Aminata 'Mina' Faye",
  brand: "Mina's Food - Saveurs faites avec amour",
  city: "Mbour",
  address: "Quartier Grand Mbour, Face Stade Caroline Faye, Route de Saly",
  country: "Sénégal",
  ninea: "009842145 2V3",
  rccm: "SN.MBR.2023.A.1420",
  phoneWave: "+221 77 407 81 20",
  phoneWhatsApp: "+221 77 407 81 20",
  email: "commandes@minasfood-mbour.sn"
};

// Helper pour générer les données de facture
function buildInvoiceObject(order: any) {
  const cleanOrderCode = (order.orderNumber || order.id).replace(/[^A-Z0-9]/gi, '');
  const invoiceNumber = `FACT-2026-${cleanOrderCode}`;

  const items = (order.items || []).map((item: any) => {
    let details = '';
    if (item.customization) {
      const c = item.customization;
      const parts = [
        c.servings ? `${c.servings} parts` : '',
        c.spongeFlavor ? `Génoise : ${c.spongeFlavor}` : '',
        c.creamFilling ? `Fourrage : ${c.creamFilling}` : '',
        c.inscriptionText ? `Inscription : "${c.inscriptionText}"` : '',
        c.candlesCount ? `${c.candlesCount} bougies` : ''
      ].filter(Boolean);
      details = parts.join(' • ');
    } else if (item.notes) {
      details = item.notes;
    }

    return {
      name: item.product?.name || item.name || 'Douceur artisanale',
      category: item.product?.category,
      details: details || undefined,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || item.price || 0,
      totalPrice: (item.unitPrice || item.price || 0) * (item.quantity || 1)
    };
  });

  const verificationCode = `VERIF-${order.id.slice(0, 6).toUpperCase()}-${((order.total || 0) % 9999).toString().padStart(4, '0')}`;

  return {
    id: `inv-${order.id}`,
    invoiceNumber,
    orderId: order.id,
    orderNumber: order.orderNumber,
    issueDate: order.createdAt || new Date().toISOString(),
    dueDate: order.requestedDate || order.createdAt || new Date().toISOString(),
    seller: SELLER_INFO,
    client: {
      name: order.customerName || 'Client Mina\'s Food',
      phone: order.customerPhone || '',
      email: order.customerEmail,
      address: order.deliveryAddress,
      zone: order.deliveryZone || 'Mbour',
      deliveryType: order.deliveryType || 'livraison_mbour'
    },
    items,
    subtotal: order.subtotal || (order.total - (order.deliveryFee || 0)),
    deliveryFee: order.deliveryFee || 0,
    taxAmount: 0,
    total: order.total || 0,
    paymentMethod: order.paymentMethod || 'wave',
    paymentStatus: order.paymentStatus || 'paid',
    waveTransactionRef: order.waveTransactionRef,
    notes: order.customerNotes,
    verificationCode
  };
}

// Helper pour générer du HTML de facture imprimable
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildInvoiceHTML(invoice: any): string {
  const dateFormatted = new Date(invoice.issueDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const rows = invoice.items.map((item: any) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e7e5e4;">
        <div style="font-weight: 600; color: #1c1917;">${escapeHtml(item.name)}</div>
        ${item.details ? `<div style="font-size: 12px; color: #78716c; margin-top: 3px;">${escapeHtml(item.details)}</div>` : ''}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e7e5e4; text-align: center; color: #44403c;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e7e5e4; text-align: right; color: #44403c;">${item.unitPrice.toLocaleString('fr-FR')} FCFA</td>
      <td style="padding: 12px; border-bottom: 1px solid #e7e5e4; text-align: right; font-weight: 600; color: #78350f;">${item.totalPrice.toLocaleString('fr-FR')} FCFA</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${escapeHtml(invoice.invoiceNumber)} - Mina's Food Mbour</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafaf9; margin: 0; padding: 24px; color: #292524; }
    .invoice-card { max-width: 800px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e7e5e4; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #b45309; padding-bottom: 24px; }
    .brand { font-size: 24px; font-weight: bold; color: #78350f; }
    .brand-sub { font-size: 12px; color: #78716c; margin-top: 4px; }
    .meta-box { text-align: right; }
    .inv-title { font-size: 20px; font-weight: bold; color: #1c1917; }
    .inv-num { font-size: 14px; font-family: monospace; color: #b45309; font-weight: bold; }
    .parties { display: flex; justify-content: space-between; margin-top: 24px; gap: 24px; }
    .party-col { flex: 1; background: #f5f5f4; padding: 16px; border-radius: 10px; font-size: 13px; line-height: 1.5; }
    .party-title { font-size: 11px; text-transform: uppercase; font-weight: bold; color: #78716c; margin-bottom: 8px; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; font-size: 14px; }
    th { background: #f5f5f4; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #78716c; }
    .totals-area { margin-top: 24px; display: flex; justify-content: flex-end; }
    .totals-table { width: 320px; font-size: 14px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; color: #44403c; }
    .totals-final { display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #78350f; font-size: 18px; font-weight: bold; color: #78350f; margin-top: 6px; }
    .badge-paid { display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e7e5e4; text-align: center; font-size: 11px; color: #a8a29e; }
    @media print {
      body { background: white; padding: 0; }
      .invoice-card { border: none; box-shadow: none; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 800px; margin: 0 auto 16px; text-align: right;">
    <button onclick="window.print()" style="background: #b45309; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer;">🖨️ Imprimer la facture</button>
  </div>

  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand">🍰 Mina's Food</div>
        <div class="brand-sub">Pâtisserie Fine & Traiteur Sucré • Mbour, Sénégal</div>
        <div class="brand-sub">NINEA : ${escapeHtml(invoice.seller.ninea)} • RCCM : ${escapeHtml(invoice.seller.rccm)}</div>
        <div class="brand-sub">Tél / Wave : ${escapeHtml(invoice.seller.phoneWave)}</div>
      </div>
      <div class="meta-box">
        <div class="inv-title">FACTURE OFFICIELLE</div>
        <div class="inv-num">${escapeHtml(invoice.invoiceNumber)}</div>
        <div style="font-size: 12px; color: #78716c; margin-top: 4px;">Réf Commande : <strong>${escapeHtml(invoice.orderNumber)}</strong></div>
        <div style="font-size: 12px; color: #78716c; margin-top: 2px;">${escapeHtml(dateFormatted)}</div>
        <div style="margin-top: 8px;">
          <span class="badge-paid">✓ ${invoice.paymentStatus === 'paid' ? 'PAYÉ PAR WAVE SÉNÉGAL' : 'COMMANDE CONFIRMÉE'}</span>
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="party-col">
        <div class="party-title">Émetteur</div>
        <strong>${escapeHtml(invoice.seller.brand)}</strong><br>
        ${escapeHtml(invoice.seller.address)}<br>
        ${escapeHtml(invoice.seller.city)}, Sénégal<br>
        WhatsApp : ${escapeHtml(invoice.seller.phoneWhatsApp)}
      </div>

      <div class="party-col">
        <div class="party-title">Client Facturé</div>
        <strong>${escapeHtml(invoice.client.name)}</strong><br>
        Tél : ${escapeHtml(invoice.client.phone)}<br>
        Zone : ${escapeHtml(invoice.client.zone)}<br>
        ${invoice.client.address ? `Adresse : ${escapeHtml(invoice.client.address)}<br>` : ''}
        Mode : ${invoice.client.deliveryType === 'livraison_mbour' ? 'Livraison Moto à domicile' : 'Retrait en Boutique'}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Désignation</th>
          <th style="text-align: center;">Qté</th>
          <th style="text-align: right;">Prix Unitaire</th>
          <th style="text-align: right;">Total Net</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="totals-area">
      <div class="totals-table">
        <div class="totals-row">
          <span>Sous-total douceurs :</span>
          <span>${invoice.subtotal.toLocaleString('fr-FR')} FCFA</span>
        </div>
        <div class="totals-row">
          <span>Frais de livraison (${escapeHtml(invoice.client.zone)}) :</span>
          <span>${invoice.deliveryFee > 0 ? `${invoice.deliveryFee.toLocaleString('fr-FR')} FCFA` : '0 FCFA (Gratuit)'}</span>
        </div>
        <div class="totals-row" style="font-size: 11px; color: #78716c;">
          <span>TVA (Exonération art. 261 CGI) :</span>
          <span>0 FCFA</span>
        </div>
        <div class="totals-final">
          <span>Total Net à Payer :</span>
          <span>${invoice.total.toLocaleString('fr-FR')} FCFA</span>
        </div>
      </div>
    </div>

    ${invoice.waveTransactionRef ? `
      <div style="margin-top: 20px; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; font-size: 12px; color: #0369a1;">
        <strong>Preuve de transaction Wave Sénégal :</strong> Réf <code>${escapeHtml(invoice.waveTransactionRef)}</code> • Statut : Encaissé avec succès sur le compte marchand Mina's Food.
      </div>
    ` : ''}

    <div class="footer">
      <div>Gâteaux et pâtisseries confectionnés artisanalement avec amour à Mbour le jour de la dégustation.</div>
      <div style="margin-top: 4px;">Code de contrôle : ${escapeHtml(invoice.verificationCode)} • Merci de votre confiance et bonne dégustation !</div>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// 1. ENDPOINTS D'API REST
// ============================================================================

// 1.1 Santé du serveur
app.get('/api/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: "Mina's Food - API Pâtisserie Mbour",
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    waveStatus: 'active',
    database: await ensureDb() ? 'ok' : 'unavailable'
  });
});

app.post('/api/admin/login', rateLimitedHandler((req: Request, res: Response) => {
  const pin = String(req.body?.pin || '').trim();
  if (!pinsMatch(pin)) {
    return res.status(401).json({ success: false, error: 'Code administrateur incorrect.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  adminSessions.set(token, expiresAt);
  persistAdminSessions();
  res.json({ success: true, token, expiresAt });
}, { max: 10 }));

// 1.2 Liste des commandes
app.get('/api/orders', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const orders = await listOrders();
    res.json({ success: true, count: orders.length, orders });
  } catch (err: any) {
    res.status(503).json({ success: false, error: `Base de données indisponible : ${err.message}` });
  }
});

// 1.3 Enregistrement d'une nouvelle commande
app.post('/api/orders', rateLimitedHandler(async (req: Request, res: Response) => {
  try {
    const orderData = req.body;
    if (!orderData.customerName || !orderData.customerPhone || !orderData.total) {
      return res.status(400).json({
        success: false,
        error: 'Nom du client, téléphone et total sont requis.'
      });
    }

    const { order: savedOrder } = await createOrder(orderData);

    // Diffusion temps réel immédiate via WebSocket
    broadcastRealtimeEvent('order:created', {
      orderNumber: savedOrder.orderNumber,
      total: savedOrder.total,
      deliveryZone: savedOrder.deliveryZone,
      message: `Nouvelle commande ${savedOrder.orderNumber} reçue (${savedOrder.total.toLocaleString('fr-FR')} FCFA)`
    }, {
      title: "Nouvelle Commande - Mina's Food",
      message: `Commande ${savedOrder.orderNumber} reçue (${savedOrder.total.toLocaleString('fr-FR')} FCFA)`,
      type: 'order',
      orderNumber: savedOrder.orderNumber,
      url: '/'
    });

    // Génération automatique de la facture correspondante
    const invoice = buildInvoiceObject(savedOrder);

    res.status(201).json({
      success: true,
      message: 'Commande enregistrée avec succès dans le laboratoire de Mina.',
      order: savedOrder,
      invoiceSummary: {
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        downloadUrl: `/api/invoices/${savedOrder.orderNumber}/html?phone=${encodeURIComponent(savedOrder.customerPhone)}`
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}, { max: 20 }));

// 1.4 Récupération d'une commande par ID ou numéro court
app.get('/api/orders/:orderId', rateLimitedHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const requestedPhone = String(req.query.phone || '').replace(/\D/g, '');
  if (!requestedPhone) {
    return res.status(400).json({ success: false, error: 'Le téléphone utilisé lors de la commande est requis.' });
  }
  try {
    const order = await getOrderByIdentifier(orderId);
    const orderPhone = String(order?.customerPhone || '').replace(/\D/g, '');
    if (!order || orderPhone !== requestedPhone) {
      return res.status(404).json({
        success: false,
        error: 'Commande introuvable ou informations de suivi incorrectes.'
      });
    }
    res.json({ success: true, order });
  } catch (err: any) {
    res.status(503).json({ success: false, error: `Base de données indisponible : ${err.message}` });
  }
}, { max: 100 }));

// 1.5 Mise à jour du statut d'une commande
app.patch('/api/orders/:orderId/status', requireAdmin, async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const allowedStatuses = ['received', 'preparing', 'ready_or_out', 'delivered', 'cancelled'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Le statut est requis.' });
  }

  try {
    const order = await updateOrderStatus(orderId, status);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Commande introuvable' });
    }

    // Diffusion temps réel immédiate de la progression (vers le client et le laboratoire)
    broadcastRealtimeEvent('order:status_updated', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      updatedAt: order.updatedAt,
      message: `Le gâteau de la commande ${order.orderNumber} est maintenant : "${
        status === 'preparing' ? 'En préparation au labo' :
        status === 'ready_or_out' ? 'Prêt / En cours de livraison' :
        status === 'delivered' ? 'Livré au client' : 'Reçue'
      }"`
    }, {
      title: `Suivi Commande ${order.orderNumber}`,
      message: `Le gâteau de la commande ${order.orderNumber} est maintenant : "${
        status === 'preparing' ? 'En préparation au labo' :
        status === 'ready_or_out' ? 'Prêt / En cours de livraison' :
        status === 'delivered' ? 'Livré au client' : 'Reçue'
      }"`,
      type: 'status',
      orderNumber: order.orderNumber,
      url: '/'
    });

    res.json({ success: true, order });
  } catch (err: any) {
    res.status(503).json({ success: false, error: `Base de données indisponible : ${err.message}` });
  }
});

// ============================================================================
// 1bis. ENDPOINTS DU CATALOGUE, ZONES & PARAMÈTRES (Neon)
// ============================================================================

// Liste des produits de la vitrine
app.get('/api/products', rateLimitedHandler(async (_req: Request, res: Response) => {
  try {
    const products = await listProducts();
    res.json({ success: true, count: products.length, products });
  } catch (err: any) {
    res.status(503).json({ success: false, error: `Base de données indisponible : ${err.message}` });
  }
}, { max: 200 }));

// Création ou mise à jour d'un produit
app.post('/api/products', requireAdmin, async (req: Request, res: Response) => {
  try {
    const product = req.body;
    const allowedCategories = ['gateaux', 'viennoiseries', 'patisseries_individuelles', 'traiteur_sale', 'boissons_locales'];
    if (!product.id || !product.name || !allowedCategories.includes(product.category)) {
      return res.status(400).json({ success: false, error: 'id, name et category sont requis.' });
    }
    if (!Number.isFinite(Number(product.price)) || Number(product.price) < 0) {
      return res.status(400).json({ success: false, error: 'Le prix doit être un nombre positif.' });
    }
    await upsertProduct(product);
    res.json({ success: true, product });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Suppression d'un produit
app.delete('/api/products/:productId', requireAdmin, async (req: Request, res: Response) => {
  try {
    await deleteProduct(req.params.productId);
    res.json({ success: true, id: req.params.productId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Zones de livraison
app.get('/api/delivery-zones', rateLimitedHandler(async (_req: Request, res: Response) => {
  try {
    const zones = await listZones();
    res.json({ success: true, count: zones.length, zones });
  } catch (err: any) {
    res.status(503).json({ success: false, error: `Base de données indisponible : ${err.message}` });
  }
}, { max: 200 }));

// Remplacement complet des zones (depuis le backoffice)
app.put('/api/delivery-zones', requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!Array.isArray(req.body?.zones)) {
      return res.status(400).json({ success: false, error: 'Un tableau `zones` est requis.' });
    }
    if (req.body.zones.some((zone: any) => !String(zone.name || '').trim() || Number(zone.fee) < 0)) {
      return res.status(400).json({ success: false, error: 'Chaque zone doit avoir un nom et des frais valides.' });
    }
    await replaceZones(req.body.zones);
    const zones = await listZones();
    res.json({ success: true, zones });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paramètres de la boutique
app.get('/api/settings', rateLimitedHandler(async (_req: Request, res: Response) => {
  try {
    const settings = await getSettings();
    if (!settings) {
      return res.status(404).json({ success: false, error: 'Paramètres de boutique introuvables.' });
    }
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(503).json({ success: false, error: `Base de données indisponible : ${err.message}` });
  }
}, { max: 200 }));

// Mise à jour des paramètres
app.put('/api/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    if (!settings || !settings.shopName) {
      return res.status(400).json({ success: false, error: 'shopName est requis.' });
    }
    await upsertSettings(settings);
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 2. ENDPOINTS DU SYSTÈME DE FACTURE (CLIENT & BACKOFFICE)
// ============================================================================

// 2.1 Récupérer la facture en JSON
app.get('/api/invoices/:orderId', rateLimitedHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const requestedPhone = String(req.query.phone || '').replace(/\D/g, '');
  if (!requestedPhone) {
    return res.status(400).json({ success: false, error: 'Le téléphone client est requis pour accéder à la facture.' });
  }
  try {
    const order = await getOrderByIdentifier(orderId);
    const orderPhone = String(order?.customerPhone || '').replace(/\D/g, '');
    if (!order || orderPhone !== requestedPhone) {
      return res.status(404).json({
        success: false,
        error: `Aucune facture trouvée pour la référence ${orderId}.`
      });
    }

    const invoice = buildInvoiceObject(order);
    res.json({ success: true, invoice });
  } catch (err: any) {
    res.status(503).json({ success: false, error: `Base de données indisponible : ${err.message}` });
  }
}, { max: 100 }));

// 2.2 Téléchargement ou affichage HTML imprimable de la facture
app.get('/api/invoices/:orderId/html', rateLimitedHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const requestedPhone = String(req.query.phone || '').replace(/\D/g, '');
  if (!requestedPhone) {
    return res.status(400).send('Le téléphone client est requis pour accéder à la facture.');
  }
  try {
    const order = await getOrderByIdentifier(orderId);
    const orderPhone = String(order?.customerPhone || '').replace(/\D/g, '');
    if (!order || orderPhone !== requestedPhone) {
      return res.status(404).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>Facture introuvable</h2>
            <p>La référence ${orderId} n'existe pas ou a expiré.</p>
            <a href="/">Retour à la boutique Mina's Food</a>
          </body>
        </html>
      `);
    }

    const invoice = buildInvoiceObject(order);
    const html = buildInvoiceHTML(invoice);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(503).send('Base de données indisponible');
  }
}, { max: 100 }));

// ============================================================================
// 3. VÉRIFICATION & WEBHOOK DES PAIEMENTS WAVE SÉNÉGAL
// ============================================================================

// Références déjà traitées : rend la certification idempotente et empêche
// la réutilisation d'une même référence sur plusieurs commandes.
// En serverless la mémoire est vide à froid : la source de vérité est la base
// (colonne orders.wave_transaction_ref + index unique), la Map sert de cache.
const processedWaveRefs = new Map<string, string>(); // ref -> orderId déjà certifié

async function getWaveRefOwner(normalizedRef: string): Promise<string | undefined> {
  const cached = processedWaveRefs.get(normalizedRef);
  if (cached !== undefined) return cached;
  if (pool) {
    try {
      const { rows } = await pool.query(
        'SELECT id FROM orders WHERE wave_transaction_ref = $1 LIMIT 1',
        [normalizedRef]
      );
      if (rows[0]) {
        processedWaveRefs.set(normalizedRef, String(rows[0].id));
        return String(rows[0].id);
      }
    } catch {
      // Base indisponible : on retombe sur le cache mémoire.
    }
  }
  return undefined;
}

function recordWaveRef(normalizedRef: string, orderId: string) {
  processedWaveRefs.set(normalizedRef, orderId);
}

function respondWaveVerified(res: Response, normalizedRef: string, amount: number | null, alreadyVerified: boolean) {
  res.json({
    success: true,
    verified: true,
    alreadyVerified,
    waveTransactionRef: normalizedRef,
    merchantName: "Mina's Food Mbour",
    merchantPhone: SELLER_INFO.phoneWave,
    amount,
    verifiedAt: new Date().toISOString(),
    message: alreadyVerified
      ? 'Ce paiement Wave a déjà été certifié pour cette commande.'
      : 'Paiement Wave certifié avec succès sur le compte marchand.'
  });
}

async function certifyWavePayment(orderId: string, normalizedRef: string, amount: number | null) {
  const order = orderId ? await getOrderByIdentifier(orderId) : null;
  if (orderId && !order) {
    return { error: 'Commande introuvable pour ce paiement.', status: 404 };
  }
  if (order && amount != null && Number(amount) !== Number(order.total)) {
    return { error: 'Le montant du paiement ne correspond pas à la commande.', status: 422 };
  }

  // Idempotence : si la référence a déjà certifié cette commande, on renvoie le cache.
  const existingOwner = await getWaveRefOwner(normalizedRef);
  const alreadyVerified = existingOwner === orderId || order?.paymentStatus === 'paid';

  if (!alreadyVerified) {
    // Interdire de réutiliser une référence sur une autre commande.
    if (existingOwner && existingOwner !== orderId) {
      return { error: 'Cette référence Wave a déjà été utilisée pour une autre commande.', status: 422 };
    }

    if (orderId) {
      try {
        await markOrderPaid(orderId, normalizedRef);
      } catch (err: any) {
        console.warn('[Wave] Impossible de marquer la commande payée en base :', err.message);
      }
    }

    recordWaveRef(normalizedRef, orderId || '');

    // Diffusion temps réel du paiement Wave certifié
    broadcastRealtimeEvent('payment:verified', {
      waveTransactionRef: normalizedRef,
      orderId: orderId || null,
      amount: amount || null,
      orderNumber: order?.orderNumber || null,
      verifiedAt: new Date().toISOString(),
      message: `Paiement Wave Sénégal certifié (${normalizedRef})`
    }, {
      title: 'Paiement Wave Confirmé',
      message: `Paiement Wave certifié (${normalizedRef})${order?.orderNumber ? ` pour la commande ${order.orderNumber}` : ''}`,
      type: 'wave',
      orderNumber: order?.orderNumber || null,
      url: '/'
    });
  }

  return { order, alreadyVerified };
}

// 3.1 Vérification manuelle depuis l'interface client (idempotente)
app.post('/api/wave/verify', rateLimitedHandler(async (req: Request, res: Response) => {
  const { transactionRef, orderId, amount } = req.body;

  if (!transactionRef) {
    return res.status(400).json({
      success: false,
      error: 'La référence de transaction Wave est requise.'
    });
  }

  const normalizedRef = String(transactionRef).trim().toUpperCase();
  const isValidFormat = /^WV-[A-Z0-9-]{6,32}$/.test(normalizedRef);

  if (!isValidFormat) {
    return res.status(422).json({
      success: false,
      error: 'Format de référence Wave invalide.'
    });
  }

  const result = await certifyWavePayment(orderId, normalizedRef, amount != null ? Number(amount) : null);
  if (result.error) {
    return res.status(result.status!).json({ success: false, error: result.error });
  }
  respondWaveVerified(res, normalizedRef, amount != null ? Number(amount) : null, Boolean(result.alreadyVerified));
}, { max: 30 }));

// 3.2 Webhook Wave Business Server-to-Server (optionnel mais conseillé)
//     En production, active WAVE_WEBHOOK_SECRET et configure l'URL
//     https://TON_DOMAINE/api/wave/webhook dans le back-office Wave Business.
app.post('/api/wave/webhook', rateLimitedHandler(async (req: Request, res: Response) => {
  const secret = process.env.WAVE_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, error: 'Webhook Wave non configuré (WAVE_WEBHOOK_SECRET absent).' });
  }

  // Signature HMAC-SHA256 du corps brut pour authentifier l'appelant Wave.
  const signature = String(req.header('x-wave-signature') || '');
  const rawBody = Buffer.isBuffer((req as any).rawBody) ? (req as any).rawBody : Buffer.from(JSON.stringify(req.body || {}));
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  if (!signature || provided.length !== expectedBuf.length || !crypto.timingSafeEqual(provided, expectedBuf)) {
    return res.status(401).json({ success: false, error: 'Signature Wave invalide.' });
  }

  const { orderId, orderNumber, transactionRef, amount, status } = req.body || {};
  const identifier = orderId || orderNumber;
  if (!identifier || !transactionRef) {
    return res.status(400).json({ success: false, error: 'orderId/orderNumber et transactionRef sont requis.' });
  }
  if (status === 'failed' || status === 'cancelled') {
    return res.json({ success: true, received: true, action: 'ignored' });
  }

  const normalizedRef = String(transactionRef).trim().toUpperCase();
  const result = await certifyWavePayment(identifier, normalizedRef, amount != null ? Number(amount) : null);
  if (result.error) {
    return res.status(result.status!).json({ success: false, error: result.error });
  }
  res.json({ success: true, verified: true, received: true, alreadyVerified: Boolean(result.alreadyVerified) });
}, { max: 60 }));

// ============================================================================
// 4. ENDPOINTS TEMPS RÉEL & NOTIFICATIONS PUSH
// ============================================================================

// 4.1 Statistiques des connexions WebSockets actives
app.get('/api/realtime/stats', requireAdmin, (_req: Request, res: Response) => {
  res.json({
    success: true,
    mode: IS_VERCEL ? 'vercel-serverless' : 'local',
    activeWebSocketClients: activeWsClients(),
    activeSseClients: sseClients.size,
    pushSubscribers: pushSubscriptions.length,
    pushEnabled,
    timestamp: new Date().toISOString()
  });
});

// 4.1b Enregistrement d'un abonnement push navigateur (clients & backoffice)
app.post('/api/push/register', rateLimitedHandler(async (req: Request, res: Response) => {
  const subscription = req.body?.subscription;
  const result = await addPushSubscription(subscription);
  if (result.error) {
    return res.status(result.status!).json({ success: false, error: result.error });
  }
  res.json({ success: true, subscribers: pushSubscriptions.length });
}, { max: 60 }));

// 4.1c Désabonnement push (lorsque l'utilisateur désactive les notifications)
app.post('/api/push/unregister', rateLimitedHandler(async (req: Request, res: Response) => {
  const endpoint = String(req.body?.endpoint || req.body?.subscription?.endpoint || '').trim();
  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'Le endpoint de l\'abonnement push est requis.' });
  }
  const result = await removePushSubscription(endpoint);
  res.json({ success: result.success, subscribers: pushSubscriptions.length });
}, { max: 60 }));

// 4.1d Statut public de la configuration push (sans détail sensible)
app.get('/api/push/status', rateLimitedHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    pushEnabled,
    subscribers: pushSubscriptions.length,
    publicKey: pushEnabled ? VAPID_PUBLIC_KEY : null
  });
}, { max: 120 }));

// 4.2 Diffusion d'une notification push / annonce boutique depuis le backoffice
app.post('/api/notifications/broadcast', requireAdmin, (req: Request, res: Response) => {
  const { title, message, type } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: 'Le message est requis.' });
  }

  broadcastRealtimeEvent('notification:broadcast', {
    title: title || "Annonce Mina's Food Mbour",
    message,
    type: type || 'info',
    createdAt: new Date().toISOString()
  }, {
    title: title || "Annonce Mina's Food Mbour",
    message,
    type: type || 'info',
    url: '/'
  });

  res.json({
    success: true,
    message: 'Notification push diffusée en temps réel avec succès.',
    recipientsCount: activeWsClients() + sseClients.size
  });
});

// 4.3 Flux Server-Sent Events : temps réel fiable entre instances serverless.
// Le client écoute ce flux avec EventSource et reçoit les mêmes événements que
// les clients WebSocket (rejet du buffer récent à la connexion).
app.get('/api/events/stream', rateLimitedHandler(async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write('retry: 3000\n\n');

  // Rejoue les derniers événements pour que le nouveau client soit à jour :
  // mémoire d'abord (même instance), puis base Neon (instance froide).
  const dbEvents = recentEvents.length === 0 ? await listRecentEventsDb() : [];
  for (const ev of [...dbEvents, ...recentEvents]) {
    res.write(`id: ${ev.id}\nevent: ${ev.event}\ndata: ${JSON.stringify({ event: ev.event, data: ev.data, timestamp: ev.timestamp })}\n\n`);
  }

  res.write(`id: connect-${Date.now()}\nevent: connection:established\ndata: ${JSON.stringify({
    event: 'connection:established',
    data: {
      message: "Connecté au réseau temps réel Mina's Food Mbour",
      activeWsClients: activeWsClients(),
      activeSseClients: sseClients.size,
      serverTime: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  })}\n\n`);

  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
    res.end();
  });
}, { max: 300 }));

// 4.4 Derniers événements temps réel (fallback polling simple du client)
app.get('/api/events/recent', rateLimitedHandler(async (_req: Request, res: Response) => {
  const dbEvents = await listRecentEventsDb();
  const merged = new Map<string, any>();
  for (const ev of [...dbEvents, ...recentEvents]) merged.set(ev.id, ev);
  const events = Array.from(merged.values()).slice(-50).reverse();
  res.json({ success: true, events });
}, { max: 120 }));

// ============================================================================
// 5. INTÉGRATION VITE & DÉMARRAGE DU SERVEUR
// ============================================================================

function listenOnAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      const listener = server!.listen(port, '0.0.0.0');

      listener.once('error', (error: any) => {
        if (error && error.code === 'EADDRINUSE') {
          const nextPort = port + 1;
          if (nextPort - startPort > 20) {
            reject(new Error(`Aucun port disponible à partir de ${startPort}.`));
            return;
          }
          tryPort(nextPort);
          return;
        }
        reject(error);
      });

      listener.once('listening', () => {
        resolve(port);
      });
    };

    tryPort(startPort);
  });
}

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          port: VITE_HMR_PORT,
          host: '0.0.0.0'
        },
        watch: {
          ignored: ['**/node_modules/**', '**/.git/**']
        }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const actualPort = await listenOnAvailablePort(DEFAULT_PORT);
  console.log(`[Mina's Food Server] Démarré sur http://localhost:${actualPort} avec WebSockets sur /api/ws`);
}

// --- Export pour Vercel (serverless) ----------------------------------------
// Sur Vercel, la fonction API monte l'app Express directement : pas de port,
// pas de http.createServer, pas de WebSocket global.
export default app;

// En local (développement et node dist/server.cjs), démarre le vrai serveur.
if (!IS_VERCEL) {
  startServer().catch((err) => {
    console.error('[Mina\'s Food Server] Échec du démarrage :', err);
    process.exit(1);
  });
}
