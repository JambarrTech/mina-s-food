/**
 * @license
 * Pâtisserie Artisanale Mina's Food - Mbour, Sénégal
 * 
 * Bonjour ! Ce fichier définit le cœur battant de notre pâtisserie :
 * les types et structures de données pour nos délicieuses créations,
 * nos gâteaux sur-mesure, nos zones de livraison sur la Petite Côte,
 * ainsi que le flux de paiement Wave Sénégal.
 */

export type ProductCategory = 
  | 'gateaux'
  | 'viennoiseries'
  | 'patisseries_individuelles'
  | 'traiteur_sale'
  | 'boissons_locales';

export interface CakeCustomizationOptions {
  servings: number;           // Nombre de parts (ex: 6, 8, 12, 20 parts)
  spongeFlavor: string;       // Parfum de génoise (Vanille Bourbon, Chocolat Intense, Red Velvet, Coco)
  creamFilling: string;       // Fourrage & crème (Chantilly mascarpone, Ganache chocolat, Mangue de Casamance...)
  inscriptionText?: string;   // Texte écrit au cornet sur le gâteau ("Joyeux Anniversaire Aminata")
  candlesCount?: number;      // Nombre de bougies
  giftMessage?: string;       // Petit mot doux sur carte
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  price: number;              // Prix en FCFA (Franc CFA)
  // NOTE : le FCFA est une monnaie à 0 décimales (pas de centimes).
  // Les prix sont donc volontairement stockés en entiers (FCFA), ce qui
  // garantit la précision exacte et évite toute dérive flottante.
  image: string;              // URL de l'image appétissante
  isAvailable: boolean;       // Disponible en vitrine aujourd'hui
  isCustomizable?: boolean;   // Est-ce un gâteau personnalisable ?
  preparationTime?: string;   // ex: "Prêt en 20 min" ou "Sur commande 24h"
  highlightBadge?: string;    // ex: "Coup de cœur", "Bestseller Mbour"
  allergens?: string[];       // Gluten, Produits laitiers, Fruits à coque...
}

export interface CartItem {
  cartItemId: string;         // Identifiant unique dans le panier
  product: Product;
  quantity: number;
  unitPrice: number;          // Prix unitaire calculé (avec options de parts le cas échéant)
  customization?: CakeCustomizationOptions;
  notes?: string;
}

export type OrderStatus = 
  | 'received'      // Commande reçue, enregistrée
  | 'preparing'     // En cours de préparation au laboratoire de pâtisserie
  | 'ready_or_out'  // Prête pour retrait en boutique ou en cours de livraison moto
  | 'delivered'     // Livrée avec succès ou retirée par le client
  | 'cancelled';    // Annulée

export type PaymentMethod = 'wave' | 'cash_delivery';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Order {
  id: string;
  orderNumber: string;        // Code court convivial (ex: MINA-8492)
  customerName: string;
  customerPhone: string;      // Numéro sénégalais (ex: +221 77 000 00 00)
  customerEmail?: string;
  deliveryType: 'livraison_mbour' | 'retrait_boutique';
  deliveryZone: string;       // Quartier (ex: Saly Portudal, Mbour Centre...)
  deliveryAddress?: string;   // Indication précise (ex: À côté de la pharmacie du Grand Marché)
  deliveryFee: number;        // Frais en FCFA
  subtotal: number;           // Sous-total produits en FCFA
  total: number;              // Montant final net à payer en FCFA
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  waveTransactionRef?: string;// Référence de la transaction Wave (ex: WV-MBR-2026-XXXX)
  status: OrderStatus;
  items: CartItem[];
  customerNotes?: string;
  requestedDate: string;      // Date souhaitée pour la dégustation
  requestedTime: string;      // Créneau horaire
  createdAt: string;          // Horodatage ISO
  updatedAt?: string;
}

export interface DeliveryZone {
  id: string;
  name: string;               // ex: "Mbour Centre & Tefess", "Saly Portudal & Tapée", "Somone & Ngaparou"
  fee: number;                // Frais de livraison moto en FCFA
  estimatedMinutes: number;   // Délai moyen estimé
  isActive: boolean;
}

export interface BakerySettings {
  shopName: string;
  tagline: string;
  city: string;
  address: string;
  phoneWave: string;          // Numéro Wave Marchand de Mina
  phoneWhatsApp: string;      // Contact direct WhatsApp pour l'équipe
  openingHours: string;       // ex: "Mardi au Dimanche : 07h30 - 21h30"
  isOpen: boolean;            // Statut de la boutique en temps réel
  announcement?: string;      // Message festif ou promo du moment
}

export interface InvoiceItem {
  name: string;
  category?: string;
  details?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;        // ex: FACT-2026-MINA-8492
  orderId: string;
  orderNumber: string;
  issueDate: string;
  dueDate: string;
  seller: {
    name: string;
    brand: string;
    city: string;
    address: string;
    country: string;
    ninea: string;
    rccm: string;
    phoneWave: string;
    phoneWhatsApp: string;
    email: string;
  };
  client: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    zone: string;
    deliveryType: 'livraison_mbour' | 'retrait_boutique';
  };
  items: InvoiceItem[];
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;            // 0 FCFA (Régime fiscal artisans / exonéré TVA art. 261 CGI Sénégal)
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  waveTransactionRef?: string;
  notes?: string;
  verificationCode: string;
}

// ==========================================
// TYPES AUTHENTIFICATION & SÉCURITÉ SÉPARÉE
// ==========================================

export type UserRole = 'client' | 'admin' | 'staff' | 'delivery';

/**
 * Profil d'un client de Mina's Food (Espace Client)
 */
export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;              // Numéro sénégalais unique (+221 77/78/76/75/70...)
  email?: string;
  favoriteZone?: string;      // Quartier favori à Mbour/Saly
  favoriteAddress?: string;   // Adresse ou repère de livraison habituel
  loyaltyPoints: number;      // Points de fidélité gourmande
  orderNumbers: string[];     // Historique des codes de commandes (MINA-XXXX)
  createdAt: string;
}

/**
 * Session Administrateur / Équipe (Espace Backoffice)
 */
export interface AdminSession {
  token: string;
  userId: string;
  displayName: string;
  role: 'admin' | 'staff' | 'delivery';
  roleLabel: string;
  expiresAt: number;          // Timestamp d'expiration de la session
  loginTime: string;
}

/**
 * Type de message de rétroaction (Feedback & Alertes)
 */
export type FeedbackType = 'success' | 'error' | 'warning' | 'info';

export interface FeedbackNotification {
  id: string;
  type: FeedbackType;
  title: string;
  message: string;
  timestamp: number;
  duration?: number;          // Durée d'affichage en ms (défaut 4000)
  actionLabel?: string;
  onAction?: () => void;
}
