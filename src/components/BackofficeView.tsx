/**
 * @license
 * Backoffice Complet - Pâtisserie Mina's Food (Mbour, Sénégal)
 * 
 * Bonjour ! Cet espace d'administration est conçu sur-mesure pour Mina
 * et son équipe de pâtissiers à Mbour.
 * Il permet de :
 * - Suivre le chiffre d'affaires et les commandes en temps réel
 * - Gérer les étapes de fabrication et de livraison des gâteaux
 * - Ajuster la vitrine, les prix en FCFA et les ruptures de stock
 * - Configurer les tarifs des livreurs moto sur la Petite Côte
 * - Imprimer les bons de préparation pour le laboratoire.
 */

import React, { useState } from 'react';
import { 
  Order, 
  Product, 
  DeliveryZone, 
  BakerySettings, 
  OrderStatus,
  ProductCategory 
} from '../types/bakery.ts';
import { 
  enregistrerProduit, 
  supprimerProduit, 
  mettreAJourStatutCommande, 
  enregistrerZonesLivraison, 
  enregistrerParametres,
  authentifierAdmin,
  verifierSessionAdmin,
  deconnecterAdmin,
  validerPaiementCommande,
  getAdminAuthHeaders
} from '../services/bakeryService.ts';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Cake, 
  Bike, 
  Settings, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit3, 
  Printer, 
  Phone, 
  MessageSquare, 
  Download,
  Sparkles,
  Menu,
  X,
  FileText,
  Radio,
  Send,
  Bell,
  CheckCircle2,
  PackageCheck,
  ChefHat,
  Inbox
} from 'lucide-react';
import { InvoiceModal } from './InvoiceModal.tsx';
import { WaveLogo } from './WaveLogo.tsx';
import { BakeryLogo } from './BakeryLogo.tsx';
import { realtimeService } from '../services/realtimeService.ts';
import { sanitizeInput } from '../utils/securityUtils.ts';

interface Props {
  orders: Order[];
  products: Product[];
  deliveryZones: DeliveryZone[];
  settings: BakerySettings;
  onClose: () => void;
  onRefreshData: () => void;
}

export const BackofficeView: React.FC<Props> = ({
  orders,
  products,
  deliveryZones,
  settings,
  onClose,
  onRefreshData
}) => {
  // Sécurisation d'accès par code PIN : l'authentification, le verrouillage
  // anti-bruteforce et la session sont entièrement gérés par l'API serveur.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinCode, setPinCode] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Navigation dans les onglets du Backoffice
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'catalog' | 'zones' | 'settings'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Filtre d'état des commandes
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);

  // État d'édition d'un produit
  const [isEditingProduct, setIsEditingProduct] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product>>({
    name: '',
    category: 'gateaux',
    description: '',
    price: 10000,
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80',
    isAvailable: true,
    isCustomizable: true,
    preparationTime: 'Sur commande (24h)'
  });

  // Paramètres modifiés
  const [settingsForm, setSettingsForm] = useState<BakerySettings>({ ...settings });
  const [zonesForm, setZonesForm] = useState<DeliveryZone[]>([...deliveryZones]);
  const [notificationMessage, setNotificationMessage] = useState<string>('');

  // Centre de diffusion Push en temps réel
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState<boolean>(false);
  const [broadcastTitle, setBroadcastTitle] = useState<string>('Nouveauté Mina\'s Food !');
  const [broadcastBody, setBroadcastBody] = useState<string>('Nos pâtisseries fraîches viennent d\'être enfournées à Mbour. Venez vous régaler !');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState<boolean>(false);

  // Notification flash amicale
  const showToast = (message: string) => {
    setNotificationMessage(message);
    setTimeout(() => setNotificationMessage(''), 4000);
  };

  // Écoute en direct des événements WebSocket pour le Backoffice
  React.useEffect(() => {
    if (!isAuthenticated) return;
    const unsubOrder = realtimeService.on('order:created', (data: any) => {
      showToast(`Nouvelle commande #${data.orderNumber || ''} de ${data.customerName || 'Client'} reçue en direct !`);
      onRefreshData();
    });

    const unsubPayment = realtimeService.on('payment:verified', (data: any) => {
      showToast(`Paiement Wave validé pour #${data.orderNumber || ''} (${data.amount ? data.amount.toLocaleString('fr-FR') + ' FCFA' : ''}) !`);
      onRefreshData();
    });

    const unsubDeclared = realtimeService.on('payment:declared', (data: any) => {
      showToast(`Paiement Wave déclaré par le client pour #${data.orderNumber || ''} : à vérifier dans l'app Wave.`);
      onRefreshData();
    });

    return () => {
      unsubOrder();
      unsubPayment();
      unsubDeclared();
    };
  }, [isAuthenticated, onRefreshData]);

  // Envoi d'une notification push broadcast à tous les clients
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;

    setIsSendingBroadcast(true);
    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        body: JSON.stringify({
          title: broadcastTitle.trim(),
          message: broadcastBody.trim(),
          type: 'announcement'
        })
      });

      if (res.ok) {
        showToast('Notification Push diffusée instantanément à tous les clients connectés !');
        setIsBroadcastModalOpen(false);
      } else {
        showToast('Erreur lors de la diffusion de la notification');
      }
    } catch (err) {
      console.error('Erreur diffusion push :', err);
      showToast('Erreur de connexion lors de la diffusion');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  // Restauration de session : un jeton valide évite de redemander le PIN.
  React.useEffect(() => {
    let active = true;
    verifierSessionAdmin().then(valid => {
      if (active && valid) {
        setIsAuthenticated(true);
        onRefreshData();
      }
    });
    return () => { active = false; };
  }, [onRefreshData]);

  // Authentification par PIN (validée exclusivement par le serveur)
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedPin = sanitizeInput(pinCode, 32);
    if (!sanitizedPin) {
      setPinError('Veuillez saisir votre code d’accès.');
      return;
    }

    try {
      await authentifierAdmin(sanitizedPin);
      setIsAuthenticated(true);
      setPinError('');
      setPinCode('');
      onRefreshData();
    } catch (error: any) {
      setPinError(error?.message || 'Connexion administrateur impossible.');
    }
  };

  const handleLogout = () => {
    deconnecterAdmin();
    setIsAuthenticated(false);
    setPinCode('');
    setPinError('');
  };

  // Calculs pour le tableau de bord
  const totalRevenue = orders.reduce((sum, o) => sum + (o.paymentStatus === 'paid' ? o.total : 0), 0);
  const ordersReceived = orders.filter(o => o.status === 'received').length;
  const ordersPreparing = orders.filter(o => o.status === 'preparing').length;
  const ordersReady = orders.filter(o => o.status === 'ready_or_out').length;
  const ordersDelivered = orders.filter(o => o.status === 'delivered').length;
  const wavePaymentsCount = orders.filter(o => o.paymentMethod === 'wave').length;

  // Filtrage des commandes
  const filteredOrders = orderFilter === 'all' 
    ? orders 
    : orders.filter(o => o.status === orderFilter);

  // Changement rapide d'état d'une commande
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    await mettreAJourStatutCommande(orderId, newStatus);
    onRefreshData();
    showToast(`Statut de la commande mis à jour vers "${newStatus}" !`);
  };

  // Validation manuelle du paiement (après vérification dans l'app Wave)
  const handleValidatePayment = async (
    order: Order,
    paymentStatus: 'paid' | 'failed' | 'refunded'
  ) => {
    try {
      await validerPaiementCommande(order.id, paymentStatus, order.waveTransactionRef);
      onRefreshData();
      showToast(
        paymentStatus === 'paid'
          ? `Paiement de ${order.orderNumber} confirmé !`
          : `Paiement de ${order.orderNumber} marqué « ${paymentStatus} ».`
      );
    } catch (error: any) {
      showToast(error?.message || 'Impossible de mettre à jour le paiement.');
    }
  };

  // Bascule rapide de disponibilité d'un produit (En stock / Rupture)
  const handleToggleProductAvailability = async (product: Product) => {
    const updated = { ...product, isAvailable: !product.isAvailable };
    await enregistrerProduit(updated);
    onRefreshData();
    showToast(`"${product.name}" est maintenant ${updated.isAvailable ? 'Disponible' : 'en Rupture de stock'}.`);
  };

  // Sauvegarde d'un produit nouveau ou modifié
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct.name || !editingProduct.price) {
      alert("Veuillez renseigner le nom et le prix.");
      return;
    }

    const produitFinal: Product = {
      id: editingProduct.id || `prod-${Date.now()}`,
      name: editingProduct.name,
      category: editingProduct.category || 'gateaux',
      description: editingProduct.description || '',
      price: Number(editingProduct.price),
      image: editingProduct.image || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80',
      isAvailable: editingProduct.isAvailable ?? true,
      isCustomizable: editingProduct.isCustomizable ?? false,
      preparationTime: editingProduct.preparationTime || 'En boutique'
    };

    await enregistrerProduit(produitFinal);
    setIsEditingProduct(false);
    onRefreshData();
    showToast(`La création "${produitFinal.name}" a été enregistrée avec succès !`);
  };

  // Suppression de produit
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (confirm(`Confirmez-vous le retrait de "${productName}" de la vitrine ?`)) {
      await supprimerProduit(productId);
      onRefreshData();
      showToast(`Produit retiré.`);
    }
  };

  // Sauvegarde des zones de livraison
  const handleSaveZones = async () => {
    await enregistrerZonesLivraison(zonesForm);
    onRefreshData();
    showToast("Les tarifs de livraison pour Mbour et la Petite Côte ont été enregistrés !");
  };

  // Sauvegarde des paramètres de la boutique
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await enregistrerParametres(settingsForm);
    onRefreshData();
    showToast("Paramètres de la pâtisserie mis à jour avec succès !");
  };

  // Écran de verrouillage si non authentifié
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-stone-800 rounded-2xl border border-stone-700 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-900/60 text-white flex items-center justify-center mx-auto shadow-lg p-2 border border-amber-500/30">
            <BakeryLogo size="md" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-amber-200">
              Espace Administration Mina's Food
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              Réservé à Mina et à l'équipe de la pâtisserie à Mbour
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="Entrez le code d'accès"
                className="w-full px-4 py-3 rounded-xl bg-stone-900 border border-stone-600 text-center font-mono text-sm tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
              {pinError && <p className="text-xs text-red-400 mt-1">{pinError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Déverrouiller le Backoffice
            </button>
          </form>

          <div className="pt-4 border-t border-stone-700 flex justify-between items-center text-xs text-stone-400">
            <span>Accès protégé côté serveur</span>
            <button
              onClick={onClose}
              className="text-amber-400 hover:underline cursor-pointer"
            >
              Retour à la boutique
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 flex flex-col lg:flex-row font-sans">
      {/* Toast de notification amicale */}
      {notificationMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl bg-stone-900 text-amber-200 text-xs font-semibold shadow-xl border border-amber-500/30 animate-slideDown flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{notificationMessage}</span>
        </div>
      )}

      {/* NAVBAR VERTICALE (SIDEBAR) DU BACKOFFICE */}
      <aside 
        id="backoffice-vertical-navbar"
        className="w-full lg:w-72 bg-stone-900 text-stone-200 flex flex-col justify-between shrink-0 border-r border-stone-800 lg:min-h-screen lg:sticky lg:top-0 z-40"
        aria-label="Navigation verticale du Backoffice"
      >
        {/* En-tête de la sidebar avec Logo et Bouton Mobile */}
        <div className="p-4 sm:p-5 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-900/60 p-1 flex items-center justify-center shadow-md shrink-0 border border-amber-500/30">
              <BakeryLogo size="sm" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-base text-amber-100 leading-none">
                  Mina's Food
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Mbour
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Laboratoire & Commandes</span>
              </div>
            </div>
          </div>

          {/* Bouton pour plier/déplier le menu vertical sur mobile */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 cursor-pointer"
            aria-label="Basculer le menu vertical"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Liens de la Navbar Verticale */}
        <div className={`lg:flex flex-col flex-1 justify-between p-3 sm:p-4 space-y-6 ${isMobileMenuOpen ? 'flex' : 'hidden'}`}>
          <div className="space-y-4">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Menu Administration
            </div>

            <nav className="space-y-1.5" aria-label="Menu vertical">
              {/* Onglet 1 : Tableau de bord */}
              <button
                id="backoffice-nav-vertical-dashboard"
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-700 text-white font-bold shadow-xs'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-white' : 'text-amber-400'}`} />
                  <span>Tableau de bord</span>
                </div>
              </button>

              {/* Onglet 2 : Commandes */}
              <button
                id="backoffice-nav-vertical-orders"
                type="button"
                onClick={() => {
                  setActiveTab('orders');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-amber-700 text-white font-bold shadow-xs'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className={`w-4 h-4 ${activeTab === 'orders' ? 'text-white' : 'text-amber-400'}`} />
                  <span>Commandes</span>
                </div>
                {(ordersReceived + ordersPreparing) > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-stone-900 animate-pulse">
                    {ordersReceived + ordersPreparing} à faire
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-800 text-stone-400">
                    {orders.length}
                  </span>
                )}
              </button>

              {/* Onglet 3 : Menu & Vitrine */}
              <button
                id="backoffice-nav-vertical-catalog"
                type="button"
                onClick={() => {
                  setActiveTab('catalog');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                  activeTab === 'catalog'
                    ? 'bg-amber-700 text-white font-bold shadow-xs'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Cake className={`w-4 h-4 ${activeTab === 'catalog' ? 'text-white' : 'text-amber-400'}`} />
                  <span>Menu & Vitrine</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-800 text-stone-400">
                  {products.length}
                </span>
              </button>

              {/* Onglet 4 : Zones Mbour */}
              <button
                id="backoffice-nav-vertical-zones"
                type="button"
                onClick={() => {
                  setActiveTab('zones');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                  activeTab === 'zones'
                    ? 'bg-amber-700 text-white font-bold shadow-xs'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bike className={`w-4 h-4 ${activeTab === 'zones' ? 'text-white' : 'text-amber-400'}`} />
                  <span>Zones & Livreurs</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-800 text-stone-400">
                  {deliveryZones.length}
                </span>
              </button>

              {/* Onglet 5 : Paramètres */}
              <button
                id="backoffice-nav-vertical-settings"
                type="button"
                onClick={() => {
                  setActiveTab('settings');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-amber-700 text-white font-bold shadow-xs'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-white' : 'text-amber-400'}`} />
                  <span>Paramètres</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Section basse de la navbar verticale */}
          <div className="space-y-3 pt-4 border-t border-stone-800">
            {/* Widget Wave Officiel */}
            <div className="p-3 rounded-xl bg-stone-800/80 border border-stone-700/60 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sky-400 font-semibold flex items-center gap-1.5">
                  <WaveLogo size="xs" />
                  <span>Wave Sénégal</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                  En direct
                </span>
              </div>
              <div className="text-stone-400 text-[11px] truncate">
                Marchand : {settings.phoneWave}
              </div>
              <div className="font-display font-bold text-amber-200 text-sm pt-0.5">
                {totalRevenue.toLocaleString('fr-FR')} FCFA
              </div>
            </div>

            {/* Bouton pour diffuser une notification Push */}
            <button
              id="backoffice-sidebar-broadcast-btn"
              type="button"
              onClick={() => setIsBroadcastModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 animate-bounce" />
              <span>Diffuser Alerte Push</span>
            </button>

            {/* Bouton retour vers la vitrine */}
            <button
              onClick={onClose}
              className="w-full py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 border border-stone-700 transition-colors cursor-pointer"
              title="Revenir sur la vitrine client"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voir la boutique client</span>
            </button>

            {/* Verrouillage de la session admin */}
            <button
              onClick={handleLogout}
              className="w-full py-2.5 px-3 rounded-xl bg-red-900/40 hover:bg-red-800/60 text-red-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 border border-red-800/50 transition-colors cursor-pointer"
              title="Verrouiller la session"
            >
              <X className="w-4 h-4" />
              <span>Verrouiller la session</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ZONE DE CONTENU PRINCIPALE */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-stone-100">
        {/* Barre d'état supérieure du contenu */}
        <header className="bg-white border-b border-stone-200 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div>
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              {activeTab === 'dashboard' && 'Tableau de bord'}
              {activeTab === 'orders' && 'Gestion des commandes'}
              {activeTab === 'catalog' && 'Gestion du menu & des stocks'}
              {activeTab === 'zones' && 'Zones de livraison & tarifs'}
              {activeTab === 'settings' && 'Configuration générale'}
            </span>
            <div className="text-sm font-bold text-stone-800">
              Pâtisserie Mina's Food • Mbour
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Radio className="w-3 h-3" />
              <span className="hidden sm:inline">WebSocket Direct</span>
            </span>

            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 hidden sm:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Boutique Ouverte
            </span>

            <button
              onClick={() => setIsBroadcastModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              title="Envoyer un push instantané à tous les visiteurs"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Alerte Push</span>
            </button>
          </div>
        </header>

        {/* CONTENU SELON L'ONGLET SÉLECTIONNÉ */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">

        {/* 1. TABLEAU DE BORD & KPIS */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold font-display text-stone-900">
                  Vue d'ensemble de la Pâtisserie
                </h1>
                <p className="text-xs text-stone-500">
                  Activités en temps réel à Mbour Centre, Saly et environs
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(orders, null, 2));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `commandes-minas-food-${new Date().toISOString().slice(0,10)}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    showToast("Export comptable téléchargé avec succès !");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter les ventes
                </button>
              </div>
            </div>

            {/* Cartes de statistiques clés */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>Chiffre d'affaires encaissé</span>
                  <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 font-bold">
                    XOF
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display text-emerald-700">
                  {totalRevenue.toLocaleString('fr-FR')} F
                </div>
                <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                  <WaveLogo size="xs" />
                  <span>{wavePaymentsCount} paiements par Wave</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>À préparer au labo</span>
                  <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 font-bold">
                    {ordersPreparing}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display text-amber-900">
                  {ordersPreparing} gâteaux
                </div>
                <div className="text-[11px] text-amber-700 font-medium">
                  {ordersReceived} nouvelle(s) commande(s) reçue(s)
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>En livraison moto / Prêt</span>
                  <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 font-bold">
                    {ordersReady}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display text-blue-800">
                  {ordersReady} colis
                </div>
                <div className="text-[11px] text-stone-500">
                  Livreurs en cours sur Mbour / Saly
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>Livrées & Dégustées</span>
                  <span className="p-1.5 rounded-lg bg-stone-100 text-stone-600 font-bold">
                    {ordersDelivered}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-display text-stone-800">
                  {ordersDelivered} clients
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold">
                  100% de satisfaction locale
                </div>
              </div>
            </div>

            {/* Alertes sur les commandes urgentes à préparer */}
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-amber-950 text-base flex items-center gap-2">
                  <Cake className="w-5 h-5 text-amber-700" />
                  Gâteaux du jour & Inscriptions spéciales à réaliser
                </h3>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs text-amber-800 font-bold hover:underline"
                >
                  Voir toutes les commandes →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {orders.filter(o => o.status === 'received' || o.status === 'preparing').slice(0, 4).map(o => (
                  <div key={o.id} className="p-3.5 rounded-xl bg-white border border-amber-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-stone-800">{o.orderNumber}</span>
                      <span className="text-amber-800 font-semibold">{o.requestedDate} • {o.requestedTime}</span>
                    </div>

                    <div className="text-xs text-stone-700 font-medium">
                      Client : <strong>{o.customerName}</strong> ({o.customerPhone})
                    </div>

                    {/* Inscriptions au cornet */}
                    {o.items.map((it, idx) => (
                      <div key={idx} className="text-xs text-stone-600 bg-amber-50/60 p-2 rounded-lg">
                        <div>• {it.quantity}x {it.product.name}</div>
                        {it.customization?.inscriptionText && (
                          <div className="text-amber-900 font-serif font-bold italic mt-1">
                            Inscription cornet : « {it.customization.inscriptionText} »
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                      <span className="text-[11px] text-stone-500">{o.deliveryZone}</span>
                      <button
                        onClick={() => handleUpdateOrderStatus(o.id, o.status === 'received' ? 'preparing' : 'ready_or_out')}
                        className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        {o.status === 'received' ? 'Passer en préparation' : 'Prêt pour départ'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. GESTION DÉTAILLÉE DES COMMANDES */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold font-display text-stone-900">
                  Gestion des Commandes Clients
                </h1>
                <p className="text-xs text-stone-500">
                  Suivez la préparation au laboratoire et l'expédition par moto
                </p>
              </div>

              {/* Filtres par statut */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-white rounded-xl border border-stone-200 shadow-2xs">
                {(['all', 'received', 'preparing', 'ready_or_out', 'delivered'] as const).map(stat => (
                  <button
                    key={stat}
                    onClick={() => setOrderFilter(stat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      orderFilter === stat
                        ? 'bg-amber-700 text-white shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                    }`}
                  >
                    {stat === 'all' && 'Toutes'}
                    {stat === 'received' && 'Reçues'}
                    {stat === 'preparing' && 'En préparation'}
                    {stat === 'ready_or_out' && 'Prêtes / Départ'}
                    {stat === 'delivered' && 'Livrées'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tableau / Liste des commandes */}
            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
                  Aucune commande dans cette catégorie pour le moment.
                </div>
              ) : (
                filteredOrders.map(order => (
                  <div 
                    key={order.id}
                    className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-4 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm bg-stone-100 px-2.5 py-1 rounded-lg text-stone-800">
                          {order.orderNumber}
                        </span>
                        <div>
                          <span className="font-bold text-sm text-stone-900 block">
                            {order.customerName}
                          </span>
                          <span className="text-xs text-stone-500">
                            {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • {order.requestedDate} à {order.requestedTime}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                          order.status === 'ready_or_out' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'preparing' ? 'bg-amber-100 text-amber-800' :
                          'bg-stone-200 text-stone-700'
                        }`}>
                          {order.status === 'delivered' && <><CheckCircle2 className="inline-block w-3.5 h-3.5 mr-1" />Livrée</>}
                          {order.status === 'ready_or_out' && <><PackageCheck className="inline-block w-3.5 h-3.5 mr-1" />Prête / En livraison</>}
                          {order.status === 'preparing' && <><ChefHat className="inline-block w-3.5 h-3.5 mr-1" />En préparation</>}
                          {order.status === 'received' && <><Inbox className="inline-block w-3.5 h-3.5 mr-1" />Reçue</>}
                        </span>

                        <span className="font-display font-bold text-base text-amber-900">
                          {order.total.toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                    </div>

                    {/* Articles et personnalisations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2">
                        <span className="font-semibold text-stone-700 block">
                          Articles de la commande :
                        </span>
                        {order.items.map((it, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 space-y-1">
                            <div className="flex justify-between font-medium text-stone-800">
                              <span>{it.quantity}x {it.product.name}</span>
                              <span>{(it.unitPrice * it.quantity).toLocaleString('fr-FR')} F</span>
                            </div>
                            {it.customization && (
                              <div className="text-stone-600 text-[11px] space-y-0.5 pt-1 border-t border-stone-200">
                                <div>Format : {it.customization.servings} parts | Génoise : {it.customization.spongeFlavor}</div>
                                <div>Crème : {it.customization.creamFilling}</div>
                                {it.customization.inscriptionText && (
                                  <div className="text-amber-900 font-serif font-bold italic">
                                    Plaque : « {it.customization.inscriptionText} »
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Livraison & Coordonnées */}
                      <div className="space-y-2 bg-amber-50/40 p-3 rounded-xl border border-amber-100">
                        <div className="font-semibold text-stone-800 flex items-center justify-between">
                          <span>Détails livraison / contact :</span>
                          <span className={`text-[11px] font-bold inline-flex items-center gap-1 ${
                            order.paymentStatus === 'paid' ? 'text-emerald-700'
                              : order.paymentStatus === 'failed' ? 'text-red-700'
                              : 'text-amber-800'
                          }`}>
                            {order.paymentMethod === 'wave' ? (
                              <>
                                <WaveLogo size="xs" />
                                <span>
                                  {order.paymentStatus === 'paid' ? 'Wave Payé'
                                    : order.paymentStatus === 'failed' ? 'Wave échoué'
                                    : order.paymentStatus === 'refunded' ? 'Wave remboursé'
                                    : 'Wave en attente'}
                                </span>
                              </>
                            ) : (order.paymentStatus === 'paid' ? '💵 Espèces payées' : '💵 Espèces livreur')}
                          </span>
                        </div>
                        <div className="text-stone-700 space-y-1">
                          <p><strong>Téléphone :</strong> {order.customerPhone}</p>
                          <p><strong>Zone :</strong> {order.deliveryZone}</p>
                          <p><strong>Adresse :</strong> {order.deliveryAddress || 'Retrait boutique'}</p>
                          {order.customerNotes && (
                            <p className="text-amber-900 italic"><strong>Notes :</strong> {order.customerNotes}</p>
                          )}
                          {order.waveTransactionRef && (
                            <p className="font-mono text-[11px] text-sky-800">Réf Wave : {order.waveTransactionRef}</p>
                          )}
                        </div>

                        <div className="pt-2 flex gap-2">
                          <a
                            href={`https://wa.me/${order.customerPhone.replace(/[\s\+\-]/g, '')}?text=${encodeURIComponent(`Bonjour ${order.customerName} ! Mina's Food à l'appareil concernant votre commande ${order.orderNumber}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Écrire WhatsApp
                          </a>
                          <a
                            href={`tel:${order.customerPhone.replace(/[\s\+\-]/g, '')}`}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-900 text-white font-semibold text-[11px] flex items-center gap-1"
                          >
                            <Phone className="w-3.5 h-3.5" /> Appeler
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Boutons d'actions rapides sur le statut */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedOrderForPrint(order)}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          title="Imprimer le bon de préparation pour le pâtissier"
                        >
                          <Printer className="w-3.5 h-3.5" /> Bon Cuisine
                        </button>

                        <button
                          onClick={() => setSelectedInvoiceOrder(order)}
                          className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Consulter et imprimer la facture officielle client"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-700" /> Facture Client
                        </button>

                        {order.paymentMethod === 'wave' && order.paymentStatus !== 'paid' && (
                          <>
                            <button
                              onClick={() => handleValidatePayment(order, 'paid')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Confirmer la réception du paiement Wave (vérifié dans l'app Wave)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Valider le paiement
                            </button>
                            <button
                              onClick={() => handleValidatePayment(order, 'failed')}
                              className="px-2.5 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                              title="Marquer le paiement comme échoué"
                            >
                              Échec
                            </button>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {order.status !== 'received' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'received')}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100"
                          >
                            Reçue
                          </button>
                        )}
                        {order.status !== 'preparing' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-900 hover:bg-amber-200"
                          >
                            En préparation
                          </button>
                        )}
                        {order.status !== 'ready_or_out' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'ready_or_out')}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-900 hover:bg-blue-200"
                          >
                            Prête / En livraison
                          </button>
                        )}
                        {order.status !== 'delivered' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                          >
                            Marquer comme Livrée
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. MENU & CATALOGUE DE PÂTISSERIE */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold font-display text-stone-900">
                  Catalogue & Gestion du Stock
                </h1>
                <p className="text-xs text-stone-500">
                  Modifiez vos créations, prix en FCFA et activez/désactivez la vitrine en temps réel
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingProduct({
                    name: '',
                    category: 'gateaux',
                    description: '',
                    price: 8000,
                    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80',
                    isAvailable: true,
                    isCustomizable: false,
                    preparationTime: 'Disponible en boutique'
                  });
                  setIsEditingProduct(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Ajouter une nouvelle pâtisserie
              </button>
            </div>

            {/* Grille des produits du catalogue */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(prod => (
                <div 
                  key={prod.id}
                  className={`p-4 rounded-2xl bg-white border transition-all shadow-2xs flex flex-col justify-between ${
                    prod.isAvailable ? 'border-stone-200 hover:border-amber-300' : 'border-red-200 bg-red-50/20 opacity-75'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="relative h-36 rounded-xl overflow-hidden bg-stone-100">
                      <img 
                        src={prod.image} 
                        alt={prod.name} 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <button
                          onClick={() => handleToggleProductAvailability(prod)}
                          className={`px-2 py-1 rounded-full text-[10px] font-bold shadow-sm transition-colors cursor-pointer ${
                            prod.isAvailable 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {prod.isAvailable ? 'En vitrine' : 'Rupture stock'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                        <span className="capitalize">{prod.category.replace('_', ' ')}</span>
                        {prod.isCustomizable && (
                          <span className="text-amber-700 font-semibold flex items-center gap-0.5">
                            <Sparkles className="w-3 h-3" /> Sur-mesure
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-stone-900 text-sm leading-tight">
                        {prod.name}
                      </h4>
                      <p className="text-xs text-stone-500 line-clamp-2 mt-1">
                        {prod.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between mt-3">
                    <span className="font-display font-bold text-base text-amber-900">
                      {prod.price.toLocaleString('fr-FR')} FCFA
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingProduct(prod);
                          setIsEditingProduct(true);
                        }}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-amber-800 hover:bg-amber-50 cursor-pointer"
                        title="Modifier"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod.id, prod.name)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. ZONES DE LIVRAISON MBOUR & TARIFS */}
        {activeTab === 'zones' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold font-display text-stone-900">
                  Tarifs des Livreurs & Secteurs de Mbour
                </h1>
                <p className="text-xs text-stone-500">
                  Ajustez les frais de livraison moto pour chaque quartier de la Petite Côte
                </p>
              </div>

              <button
                onClick={handleSaveZones}
                className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Enregistrer les tarifs
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs divide-y divide-stone-100">
              {zonesForm.map((zone, index) => (
                <div key={zone.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={zone.name}
                      onChange={(e) => {
                        const updated = [...zonesForm];
                        updated[index].name = e.target.value;
                        setZonesForm(updated);
                      }}
                      className="text-sm font-semibold text-stone-900 w-full bg-transparent border-b border-transparent focus:border-amber-500 focus:outline-none"
                    />
                    <div className="text-xs text-stone-400 mt-0.5">
                      Délai estimé : {zone.estimatedMinutes} minutes
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-stone-500">Tarif moto :</label>
                      <input
                        type="number"
                        value={zone.fee}
                        onChange={(e) => {
                          const updated = [...zonesForm];
                          updated[index].fee = Number(e.target.value);
                          setZonesForm(updated);
                        }}
                        step={100}
                        className="w-24 px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-bold text-amber-900 text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-xs font-semibold text-stone-700">FCFA</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...zonesForm];
                        updated[index].isActive = !updated[index].isActive;
                        setZonesForm(updated);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        zone.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {zone.isActive ? 'Zone Active' : 'Désactivée'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. PARAMÈTRES GÉNÉRAUX DE LA PÂTISSERIE */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold font-display text-stone-900">
                Paramètres de Mina's Food
              </h1>
              <p className="text-xs text-stone-500">
                Coordonnées de paiement Wave, horaires et annonce en boutique
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="p-6 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nom officiel de la boutique
                </label>
                <input
                  type="text"
                  value={settingsForm.shopName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, shopName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Adresse de la boutique à Mbour
                </label>
                <input
                  type="text"
                  value={settingsForm.address}
                  onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Numéro Wave Marchand de Mina
                  </label>
                  <input
                    type="text"
                    value={settingsForm.phoneWave}
                    onChange={(e) => setSettingsForm({ ...settingsForm, phoneWave: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Contact WhatsApp Client
                  </label>
                  <input
                    type="text"
                    value={settingsForm.phoneWhatsApp}
                    onChange={(e) => setSettingsForm({ ...settingsForm, phoneWhatsApp: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Horaires d'ouverture
                </label>
                <input
                  type="text"
                  value={settingsForm.openingHours}
                  onChange={(e) => setSettingsForm({ ...settingsForm, openingHours: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Bannière d'annonce sur le site
                </label>
                <textarea
                  rows={2}
                  value={settingsForm.announcement}
                  onChange={(e) => setSettingsForm({ ...settingsForm, announcement: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div>
                  <div className="text-xs font-bold text-stone-800">Statut de la pâtisserie</div>
                  <div className="text-[11px] text-stone-500">Accepter les commandes en ligne dès maintenant</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsForm({ ...settingsForm, isOpen: !settingsForm.isOpen })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    settingsForm.isOpen ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                  }`}
                >
                  {settingsForm.isOpen ? 'Ouverte' : 'Fermée'}
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                Mettre à jour les paramètres
              </button>
            </form>
          </div>
        )}
      </main>

      {/* MODALE D'ÉDITION DE PRODUIT */}
      {isEditingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-6">
            <h3 className="font-bold font-display text-lg text-stone-900">
              {editingProduct.id ? 'Modifier la création' : 'Nouvelle pâtisserie'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Nom du délice *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Catégorie</label>
                  <select
                    value={editingProduct.category || 'gateaux'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value as ProductCategory })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="gateaux">Gâteaux & Événements</option>
                    <option value="viennoiseries">Viennoiseries</option>
                    <option value="patisseries_individuelles">Pâtisseries individuelles</option>
                    <option value="traiteur_sale">Traiteur salé & Fatayas</option>
                    <option value="boissons_locales">Boissons locales (Bissap, Bouye)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Prix en FCFA *</label>
                  <input
                    type="number"
                    required
                    step={100}
                    value={editingProduct.price || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Description gourmande</label>
                <textarea
                  rows={2}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">URL de l'image</label>
                <input
                  type="url"
                  value={editingProduct.image || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.isCustomizable ?? false}
                    onChange={(e) => setEditingProduct({ ...editingProduct, isCustomizable: e.target.checked })}
                    className="rounded text-amber-700"
                  />
                  <span>Personnalisable (choix génoise, parts, cornet)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.isAvailable ?? true}
                    onChange={(e) => setEditingProduct({ ...editingProduct, isAvailable: e.target.checked })}
                    className="rounded text-amber-700"
                  />
                  <span>En stock vitrine</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsEditingProduct(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE D'IMPRESSION DU BON DE PRÉPARATION LABORATOIRE */}
      {selectedOrderForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-6 print:p-0 print:shadow-none">
            <div className="text-center border-b border-dashed border-stone-300 pb-4">
              <h2 className="font-display text-xl font-bold text-stone-900">Mina's Food Pâtisserie</h2>
              <p className="text-xs text-stone-500">Laboratoire de fabrication • Mbour, Sénégal</p>
              <div className="mt-2 font-mono font-bold text-base bg-stone-100 py-1 rounded-lg inline-block px-3">
                BON CUISINE : {selectedOrderForPrint.orderNumber}
              </div>
            </div>

            <div className="text-xs space-y-1.5 text-stone-700">
              <div className="flex justify-between">
                <span>Client :</span>
                <strong>{selectedOrderForPrint.customerName} ({selectedOrderForPrint.customerPhone})</strong>
              </div>
              <div className="flex justify-between">
                <span>Horaire dégustation :</span>
                <strong>{selectedOrderForPrint.requestedDate} à {selectedOrderForPrint.requestedTime}</strong>
              </div>
              <div className="flex justify-between">
                <span>Mode :</span>
                <strong>{selectedOrderForPrint.deliveryType === 'retrait_boutique' ? 'Retrait boutique' : `Livraison moto (${selectedOrderForPrint.deliveryZone})`}</strong>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-stone-300 py-3 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-600">
                Articles à confectionner :
              </div>
              {selectedOrderForPrint.items.map((it, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-stone-50 text-xs space-y-1">
                  <div className="font-bold text-stone-900">
                    {it.quantity}x {it.product.name}
                  </div>
                  {it.customization && (
                    <div className="text-stone-700 text-[11px] space-y-0.5">
                      <div>Parts : {it.customization.servings} | Génoise : {it.customization.spongeFlavor}</div>
                      <div>Crème : {it.customization.creamFilling}</div>
                      {it.customization.inscriptionText && (
                        <div className="p-1.5 rounded bg-amber-100 text-amber-950 font-serif font-bold text-xs mt-1">
                          🖋️ ÉCRITURE AU CHOCOLAT : « {it.customization.inscriptionText} »
                        </div>
                      )}
                      {it.customization.candlesCount && (
                        <div>Bougies : {it.customization.candlesCount} fournies</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-xs font-bold text-stone-900">
              <span>Total commande :</span>
              <span>{selectedOrderForPrint.total.toLocaleString('fr-FR')} FCFA ({selectedOrderForPrint.paymentMethod === 'wave' ? 'RÉGLÉ WAVE' : 'À ENCAISSER'})</span>
            </div>

            <div className="flex gap-2 pt-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimer le bon
              </button>
              <button
                onClick={() => setSelectedOrderForPrint(null)}
                className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FACTURE OFFICIELLE CLIENT */}
      {selectedInvoiceOrder && (
        <InvoiceModal
          order={selectedInvoiceOrder}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}

      {/* MODAL DE DIFFUSION DE NOTIFICATION PUSH WEBSOCKET */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-stone-200 animate-slideDown">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-900">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-base">Diffuser une Notification Push</h3>
                  <p className="text-[11px] text-stone-500">Envoyée instantanément en direct à tous les clients connectés</p>
                </div>
              </div>
              <button
                onClick={() => setIsBroadcastModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Titre de la notification
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="Ex : 🎂 Fournée fraîche du matin prête !"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Message pour les clients
                </label>
                <textarea
                  rows={3}
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Ex : Nos délicieux gâteaux et viennoiseries sont prêts pour livraison sur Mbour & Saly..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/60 text-xs text-amber-900 flex items-start gap-2">
                <Radio className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>Tous les clients ayant l'application ouverte recevront le carillon sonore, le toast en direct et la notification système du navigateur.</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSendingBroadcast}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSendingBroadcast ? 'Envoi en direct...' : 'Diffuser à tous maintenant'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 font-semibold text-xs cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
