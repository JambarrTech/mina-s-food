/**
 * @license
 * Service de Gestion Métier - Mina's Food (Mbour, Sénégal)
 * 
 * Source de vérité : base PostgreSQL hébergée sur Neon, servie par l'API
 * Express. Toutes les opérations passent par les endpoints REST /api/* :
 * - Catalogue des produits
 * - Commandes (création, suivi, statuts)
 * - Zones de livraison Mbour & Petite Côte
 * - Paramètres de la pâtisserie
 */

import { Product, Order, OrderStatus, DeliveryZone, BakerySettings } from '../types/bakery.ts';

const ADMIN_TOKEN_KEY = 'minas_food_admin_token';

export function getAdminAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function authentifierAdmin(pin: string): Promise<void> {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success || !data.token) {
    throw new Error(data?.error || 'Connexion administrateur impossible.');
  }
  sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
}

export function deconnecterAdmin(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

/**
 * Vérifie qu'un jeton de session existant est toujours valide (restauration
 * de session au rechargement de la page, sans redemander le PIN).
 */
export async function verifierSessionAdmin(): Promise<boolean> {
  if (!sessionStorage.getItem(ADMIN_TOKEN_KEY)) return false;
  try {
    const response = await fetch('/api/admin/session', { headers: getAdminAuthHeaders() });
    if (!response.ok) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function requeteApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders(), ...options?.headers },
    ...options
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    const message = data?.error || `Erreur serveur (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

// ==========================================
// 1. GESTION DES PRODUITS DU CATALOGUE
// ==========================================

export async function chargerProduits(): Promise<Product[]> {
  const data = await requeteApi<{ products: Product[] }>('/api/products');
  return data.products || [];
}

export async function enregistrerProduit(produit: Product): Promise<void> {
  await requeteApi('/api/products', {
    method: 'POST',
    body: JSON.stringify(produit)
  });
}

export async function supprimerProduit(produitId: string): Promise<void> {
  await requeteApi(`/api/products/${encodeURIComponent(produitId)}`, {
    method: 'DELETE'
  });
}

// ==========================================
// 2. GESTION DES COMMANDES CLIENTS
// ==========================================

export async function chargerCommandes(): Promise<Order[]> {
  const data = await requeteApi<{ orders: Order[] }>('/api/orders');
  return data.orders || [];
}

export async function creerCommande(nouvelleCommande: Order): Promise<Order> {
  const data = await requeteApi<{ order: Order }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(nouvelleCommande)
  });
  return data.order;
}

export async function verifierPaiementWave(params: {
  transactionRef: string;
  orderId: string;
  amount: number;
}): Promise<void> {
  await requeteApi('/api/wave/verify', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

export async function mettreAJourStatutCommande(
  commandeId: string,
  nouveauStatut: OrderStatus
): Promise<void> {
  await requeteApi(`/api/orders/${encodeURIComponent(commandeId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: nouveauStatut })
  });
}

/**
 * Validation manuelle du paiement d'une commande par le backoffice, après
 * vérification dans l'application Wave (modèle du lien commercial).
 */
export async function validerPaiementCommande(
  commandeId: string,
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded',
  waveTransactionRef?: string
): Promise<void> {
  await requeteApi(`/api/orders/${encodeURIComponent(commandeId)}/payment`, {
    method: 'PATCH',
    body: JSON.stringify({ paymentStatus, waveTransactionRef })
  });
}

export async function trouverCommandeParNumero(code: string, telephone: string): Promise<Order | null> {
  try {
    const query = `?phone=${encodeURIComponent(telephone.trim())}`;
    const data = await requeteApi<{ order: Order }>(`/api/orders/${encodeURIComponent(code.trim())}${query}`);
    return data.order || null;
  } catch (erreur: any) {
    if (erreur?.message?.includes('introuvable') || erreur?.message?.includes('404')) {
      return null;
    }
    throw erreur;
  }
}

export async function chargerFacture(commandeId: string, telephone: string): Promise<any> {
  const query = `?phone=${encodeURIComponent(telephone.trim())}`;
  const data = await requeteApi<{ invoice: any }>(`/api/invoices/${encodeURIComponent(commandeId)}${query}`);
  return data.invoice;
}

// ==========================================
// 3. ZONES DE LIVRAISON MBOUR
// ==========================================

export async function chargerZonesLivraison(): Promise<DeliveryZone[]> {
  const data = await requeteApi<{ zones: DeliveryZone[] }>('/api/delivery-zones');
  return data.zones || [];
}

export async function enregistrerZonesLivraison(zones: DeliveryZone[]): Promise<void> {
  await requeteApi('/api/delivery-zones', {
    method: 'PUT',
    body: JSON.stringify({ zones })
  });
}

// ==========================================
// 4. PARAMÈTRES DE LA PÂTISSERIE
// ==========================================

export async function chargerParametres(): Promise<BakerySettings> {
  const data = await requeteApi<{ settings: BakerySettings }>('/api/settings');
  return data.settings;
}

export async function enregistrerParametres(settings: BakerySettings): Promise<void> {
  await requeteApi('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
}