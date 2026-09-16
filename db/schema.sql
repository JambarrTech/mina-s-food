-- ============================================================================
-- Mina's Food - Pâtisserie Artisanale (Mbour, Sénégal)
-- Schéma PostgreSQL pour Neon (serverless Postgres)
-- ============================================================================
-- ============================================================================

-- ============================================================================
-- 1. TYPES ÉNUMÉRÉS
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE product_category AS ENUM (
    'gateaux',
    'viennoiseries',
    'patisseries_individuelles',
    'traiteur_sale',
    'boissons_locales'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'received',
    'preparing',
    'ready_or_out',
    'delivered',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('wave', 'cash_delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_type AS ENUM ('livraison_mbour', 'retrait_boutique');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('client', 'admin', 'staff', 'delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. OUTILS DE MAINTIEN DES horodatages
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Produits du catalogue (vitrine publique)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  category          product_category NOT NULL,
  description       text NOT NULL DEFAULT '',
  price             integer NOT NULL CHECK (price >= 0),
  image             text,
  is_available      boolean NOT NULL DEFAULT true,
  is_customizable   boolean NOT NULL DEFAULT false,
  preparation_time  text,
  highlight_badge   text,
  allergens         jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags              jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category ON products (category);
CREATE INDEX idx_products_available ON products (is_available);

-- ----------------------------------------------------------------------------
-- Zones de livraison Mbour & Petite Côte
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_zones (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  fee               integer NOT NULL CHECK (fee >= 0),
  estimated_minutes integer,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Paramètres généraux de la boutique (une seule ligne 'main')
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bakery_settings (
  id              text PRIMARY KEY,
  shop_name       text NOT NULL,
  tagline         text,
  city            text NOT NULL,
  address         text,
  phone_wave      text,
  phone_whatsapp  text,
  opening_hours   text,
  is_open         boolean NOT NULL DEFAULT true,
  announcement    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Clients (espace client : profil, fidélité, historique)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  phone             text NOT NULL UNIQUE,  -- +221 77 407 81 20
  email             text,
  favorite_zone     text,
  favorite_address  text,
  loyalty_points    integer NOT NULL DEFAULT 0,
  role              user_role NOT NULL DEFAULT 'client',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_phone ON customers (phone);

-- ----------------------------------------------------------------------------
-- Commandes clients
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                  text PRIMARY KEY,
  order_number        text NOT NULL UNIQUE,  -- ex: MINA-4821
  customer_id         text REFERENCES customers (id) ON DELETE SET NULL,
  customer_name       text NOT NULL,
  customer_phone      text NOT NULL,
  customer_email      text,
  delivery_type       delivery_type NOT NULL DEFAULT 'livraison_mbour',
  delivery_zone       text,
  delivery_address    text,
  delivery_fee        integer NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  subtotal            integer NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  total               integer NOT NULL CHECK (total >= 0),
  payment_method      payment_method NOT NULL DEFAULT 'wave',
  payment_status      payment_status NOT NULL DEFAULT 'pending',
  wave_transaction_ref text,                -- ex: WV-MBR-2026-77891
  status              order_status NOT NULL DEFAULT 'received',
  customer_notes      text,
  requested_date      text,
  requested_time      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_wave_ref ON orders (wave_transaction_ref);

-- ----------------------------------------------------------------------------
-- Lignes de commande (articles + options de personnalisation du gâteau)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id          text NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  cart_item_id      text,
  product_id        text REFERENCES products (id) ON DELETE SET NULL,
  product_snapshot  jsonb NOT NULL,  -- copie du produit au moment de la vente
  quantity          integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price        integer NOT NULL CHECK (unit_price >= 0),
  customization     jsonb,           -- CakeCustomizationOptions (serveurs, génoise, fourrage...)
  notes             text
);

CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_items_product ON order_items (product_id);

-- ----------------------------------------------------------------------------
-- Factures / reçus officiels (NINEA, RCCM, code de contrôle)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id                  text PRIMARY KEY,      -- inv-<orderId>
  invoice_number      text NOT NULL UNIQUE,  -- FACT-2026-MINA-4821
  order_id            text REFERENCES orders (id) ON DELETE CASCADE,
  seller_info         jsonb NOT NULL,
  client_info         jsonb NOT NULL,
  subtotal            integer NOT NULL DEFAULT 0,
  delivery_fee        integer NOT NULL DEFAULT 0,
  tax_amount          integer NOT NULL DEFAULT 0,
  total               integer NOT NULL,
  payment_method      payment_method NOT NULL,
  payment_status      payment_status NOT NULL DEFAULT 'pending',
  wave_transaction_ref text,
  verification_code   text,                   -- VERIF-XXXX-XXXX
  notes               text,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_order ON invoices (order_id);
CREATE INDEX idx_invoices_number ON invoices (invoice_number);

-- ----------------------------------------------------------------------------
-- Abonnements Push Web (PWA) pour notifications natives serveur -> navigateur
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint          text NOT NULL UNIQUE,
  keys_p256dh       text NOT NULL,
  keys_auth         text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions (endpoint);

-- ----------------------------------------------------------------------------
-- Sessions administrateur (état serverless : persistées en base, pas sur disque)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_sessions (
  token       text PRIMARY KEY,
  expires_at  bigint NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Événements temps réel récents (fallback polling/SSE pour le serverless :
-- le flux WebSocket n'est pas global entre plusieurs instances Vercel)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS realtime_events (
  id          text PRIMARY KEY,
  event       text NOT NULL,
  payload     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_realtime_events_created ON realtime_events (created_at DESC);

-- ----------------------------------------------------------------------------
-- Références Wave certifiées : idempotence gérée en base (unique index),
-- une même référence ne peut pas payer deux commandes différentes
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_wave_ref_unique
  ON orders (wave_transaction_ref)
  WHERE wave_transaction_ref IS NOT NULL;

-- ============================================================================
-- 4. DÉCLENCHEURS updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_zones_updated_at ON delivery_zones;
CREATE TRIGGER trg_zones_updated_at BEFORE UPDATE ON delivery_zones
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON bakery_settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON bakery_settings
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();