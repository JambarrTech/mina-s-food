/**
 * @license
 * Application Principale - Pâtisserie Mina's Food (Mbour, Sénégal)
 * 
 * Bonjour ! Ce composant coordonne l'ensemble de l'expérience client et artisan :
 * - Vitrine gourmande des créations de Mina
 * - Atelier de personnalisation des gâteaux pour fêtes & mariages à Mbour
 * - Panier interactif avec calcul des zones de livraison sur la Petite Côte
 * - Flux complet de paiement Wave Sénégal & simulation en direct
 * - Suivi de commande en temps réel
 * - Espace Backoffice d'administration pour Mina et son équipe en laboratoire.
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Product, 
  Order, 
  DeliveryZone, 
  BakerySettings, 
  CartItem, 
  CakeCustomizationOptions,
  ProductCategory 
} from './types/bakery.ts';
import { 
  chargerProduits, 
  chargerZonesLivraison, 
  chargerParametres, 
  creerCommande,
  verifierPaiementWave
} from './services/bakeryService.ts';
import { Header } from './components/Header.tsx';
import { HeroBanner } from './components/HeroBanner.tsx';
import { ProductCard } from './components/ProductCard.tsx';
import { ProductCardSkeleton } from './components/ProductCardSkeleton.tsx';
import { CakeCustomizationModal } from './components/CakeCustomizationModal.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { WaveCheckoutModal } from './components/WaveCheckoutModal.tsx';
import { OrderTrackingModal } from './components/OrderTrackingModal.tsx';
import { InvoiceModal } from './components/InvoiceModal.tsx';
import { BackofficeView } from './components/BackofficeView.tsx';
import { Footer } from './components/Footer.tsx';
import { WaveLogo } from './components/WaveLogo.tsx';
import { 
  Sparkles, 
  Cake, 
  Croissant, 
  UtensilsCrossed, 
  CupSoda, 
  Check, 
  ArrowRight,
  Heart
} from 'lucide-react';

const CATEGORIES: { id: 'all' | ProductCategory; label: string; icon: any; count?: number }[] = [
  { id: 'all', label: 'Toutes les créations', icon: Sparkles },
  { id: 'gateaux', label: 'Gâteaux d’Événements', icon: Cake },
  { id: 'viennoiseries', label: 'Viennoiseries Pur Beurre', icon: Croissant },
  { id: 'patisseries_individuelles', label: 'Pâtisseries Individuelles', icon: Heart },
  { id: 'traiteur_sale', label: 'Fatayas & Traiteur Salé', icon: UtensilsCrossed },
  { id: 'boissons_locales', label: 'Jus Locaux Frais (Bissap, Bouye)', icon: CupSoda },
];

export default function App() {
  // Données principales synchronisées
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [settings, setSettings] = useState<BakerySettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');

  // Le backoffice est accessible uniquement par l'URL dédiée /admin.
  const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');

  // Filtres catalogue
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Gestion du panier
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('minas_food_cart_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modales interactives
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [selectedCakeForCustomization, setSelectedCakeForCustomization] = useState<Product | null>(null);
  const [isWaveCheckoutOpen, setIsWaveCheckoutOpen] = useState<boolean>(false);
  const [pendingCheckoutData, setPendingCheckoutData] = useState<any>(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState<boolean>(false);
  const [trackingOrderCode, setTrackingOrderCode] = useState<string>('');
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Synchronisation du panier vers le stockage local
  useEffect(() => {
    localStorage.setItem('minas_food_cart_v1', JSON.stringify(cart));
  }, [cart]);

  // Chargement initial des données de la pâtisserie
  const rafraichirDonnees = async () => {
    try {
      const [prods, ords, zones, params] = await Promise.all([
        chargerProduits(),
        Promise.resolve([]),
        chargerZonesLivraison(),
        chargerParametres()
      ]);
      setProducts(prods);
      setOrders(ords);
      setDeliveryZones(zones);
      setSettings(params);
      setLoadError('');
    } catch (err: any) {
      console.error("Erreur de synchronisation :", err);
      setLoadError(err?.message || 'Impossible de charger les données de la boutique.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    rafraichirDonnees();
  }, []);

  const afficherToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Calculs du panier
  const cartCount = useMemo(() => cart.reduce((total, item) => total + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((total, item) => total + (item.unitPrice * item.quantity), 0), [cart]);

  // Ajout direct d'un produit standard au panier
  const handleAddToCart = (product: Product) => {
    const existingIndex = cart.findIndex(item => item.product.id === product.id && !item.customization);
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      const newItem: CartItem = {
        cartItemId: `cart-${Date.now()}-${Math.random()}`,
        product,
        quantity: 1,
        unitPrice: product.price
      };
      setCart([...cart, newItem]);
    }
    afficherToast(`"${product.name}" ajouté au panier !`);
  };

  // Ajout d'un gâteau personnalisé
  const handleAddCustomizedCake = (customization: CakeCustomizationOptions, calculatedPrice: number) => {
    if (!selectedCakeForCustomization) return;
    const newItem: CartItem = {
      cartItemId: `cart-cake-${Date.now()}`,
      product: selectedCakeForCustomization,
      quantity: 1,
      unitPrice: calculatedPrice,
      customization
    };
    setCart([...cart, newItem]);
    afficherToast(`Gâteau sur-mesure ajouté avec succès !`);
    setIsCartOpen(true);
  };

  // Modification quantité dans le panier
  const handleUpdateCartQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(cartItemId);
    } else {
      setCart(cart.map(item => item.cartItemId === cartItemId ? { ...item, quantity: newQty } : item));
    }
  };

  // Suppression d'un article du panier
  const handleRemoveCartItem = (cartItemId: string) => {
    setCart(cart.filter(item => item.cartItemId !== cartItemId));
  };

  // Passage vers le checkout Wave
  const handleProceedToWave = (checkoutData: any) => {
    setPendingCheckoutData(checkoutData);
    setIsCartOpen(false);
    setIsWaveCheckoutOpen(true);
  };

  // Enregistrement effectif de la commande après validation Wave
  const handleOrderConfirmed = async (confirmedOrder: Order) => {
    const savedOrder = await creerCommande(confirmedOrder);
    if (confirmedOrder.paymentMethod === 'wave' && confirmedOrder.waveTransactionRef) {
      await verifierPaiementWave({
        orderId: savedOrder.id,
        transactionRef: confirmedOrder.waveTransactionRef,
        amount: savedOrder.total
      });
    }
    setCart([]); // Vider le panier
    await rafraichirDonnees();
    setTrackingOrderCode(confirmedOrder.orderNumber);
  };

  // Filtrage des produits selon la catégorie et la recherche
  const produitsFiltres = useMemo(() => {
    return products.filter(product => {
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSearch = searchQuery.trim() === '' || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  if (loadError) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center font-serif text-2xl font-bold mx-auto">
            !
          </div>
          <h2 className="font-display font-bold text-lg text-stone-900">
            Connexion à la base de données impossible
          </h2>
          <p className="text-xs text-stone-500 leading-relaxed">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => { setIsLoading(true); setLoadError(''); rafraichirDonnees(); }}
            className="px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !settings) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-700 text-white flex items-center justify-center font-serif text-2xl font-bold mx-auto animate-bounce shadow-md">
            M
          </div>
          <h2 className="font-display font-bold text-lg text-stone-900">
            Pâtisserie Mina's Food
          </h2>
          <p className="text-xs text-stone-500">
            Préparation de la vitrine de Mbour...
          </p>
        </div>
      </div>
    );
  }

  if (isAdminRoute) {
    return (
      <BackofficeView
        orders={orders}
        products={products}
        deliveryZones={deliveryZones}
        settings={settings}
        onClose={() => { window.location.href = '/'; }}
        onRefreshData={rafraichirDonnees}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f5] text-stone-800 font-sans selection:bg-amber-200 selection:text-amber-950">
      
      {/* Toast d'alerte amicale */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-stone-900 text-amber-200 text-xs font-semibold shadow-2xl border border-amber-500/40 animate-slideDown flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* En-tête principal de la boutique */}
      <Header
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenTracking={() => setIsTrackingOpen(true)}
        settings={settings}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Corps de la vitrine */}
      <main className="flex-1 max-w-7xl w-full mx-auto pb-16">
        
        {/* Bannière Hero chaleureuse */}
        <HeroBanner
          settings={settings}
          onExploreCakes={() => {
            setSelectedCategory('gateaux');
            const el = document.getElementById('vitrine-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Section Vitrine & Catalogue */}
        <section id="vitrine-section" className="px-4 sm:px-6 pt-6 space-y-6">
          
          {/* Titre et Sélecteur de Catégories */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-stone-900">
                  La Carte des Délices
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                  {produitsFiltres.length} créations
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Confectionnées chaque matin au laboratoire de Mbour avec des ingrédients nobles.
              </p>
            </div>

            {/* Sélecteur de catégorie à défilement horizontal */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {CATEGORIES.map(cat => {
                const isSelected = selectedCategory === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    id={`cat-btn-${cat.id}`}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-amber-800 text-white shadow-xs'
                        : 'bg-white text-stone-700 hover:bg-amber-50/70 border border-stone-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grille des Délices de Mina's Food */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, index) => (
                <ProductCardSkeleton key={`product-skeleton-${index}`} />
              ))}
            </div>
          ) : produitsFiltres.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-stone-200 space-y-3 animate-[fadeInUp_0.3s_ease-out]">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
                <Cake className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-base text-stone-900">
                Aucune gourmandise trouvée
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Essayez d'ajuster votre recherche ou sélectionnez une autre catégorie pour explorer nos spécialités.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 cursor-pointer"
              >
                Afficher tout le menu
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-[fadeInUp_0.35s_ease-out]">
              {produitsFiltres.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  onCustomizeCake={(cake) => setSelectedCakeForCustomization(cake)}
                />
              ))}
            </div>
          )}

          {/* Bannière de réassurance Wave & Commande Événement */}
          <div className="mt-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#00b2fe]/10 via-amber-500/10 to-transparent border border-[#00b2fe]/30 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white text-[#00b2fe] flex items-center justify-center shadow-md text-2xl shrink-0">
                <WaveLogo size="sm" />
              </div>
              <div>
                <h4 className="font-display font-bold text-base sm:text-lg text-stone-900">
                  Commandez en toute tranquillité avec Wave Sénégal
                </h4>
                <p className="text-xs text-stone-600 max-w-xl mt-0.5">
                  Validation instantanée sur votre smartphone, aucun frais supplémentaire, et expédition directe à moto à votre porte à Mbour ou Saly.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
              <button
                onClick={() => setIsTrackingOpen(true)}
                className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Suivre une commande
              </button>
              <button
                onClick={() => setIsCartOpen(true)}
                className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-[#00b2fe] hover:bg-[#009ee0] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Voir mon panier ({cartTotal.toLocaleString('fr-FR')} F)
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Barre flottante Panier sur mobile */}
      {cartCount > 0 && (
        <div className="sm:hidden fixed bottom-4 left-4 right-4 z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 rounded-2xl bg-amber-900 text-white font-bold text-sm shadow-2xl flex items-center justify-between animate-slideUp cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-700 flex items-center justify-center text-xs">
                {cartCount}
              </span>
              <span>Voir le panier</span>
            </div>
            <div className="flex items-center gap-1 font-display">
              <span>{cartTotal.toLocaleString('fr-FR')} FCFA</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Pied de page */}
      <Footer
        settings={settings}
        onOpenTracking={() => setIsTrackingOpen(true)}
      />

      {/* Modale de personnalisation de gâteau */}
      {selectedCakeForCustomization && (
        <CakeCustomizationModal
          product={selectedCakeForCustomization}
          isOpen={Boolean(selectedCakeForCustomization)}
          onClose={() => setSelectedCakeForCustomization(null)}
          onAddToCart={handleAddCustomizedCake}
        />
      )}

      {/* Tiroir Panier & Sélection livraison */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => setCart([])}
        deliveryZones={deliveryZones}
        onProceedToWaveCheckout={handleProceedToWave}
      />

      {/* Modale Paiement Wave Sénégal */}
      {isWaveCheckoutOpen && pendingCheckoutData && settings && (
        <WaveCheckoutModal
          isOpen={isWaveCheckoutOpen}
          onClose={() => setIsWaveCheckoutOpen(false)}
          orderData={pendingCheckoutData}
          onOrderConfirmed={handleOrderConfirmed}
          onOpenInvoice={(order) => setSelectedInvoiceOrder(order)}
          phoneWhatsAppMina={settings.phoneWhatsApp}
        />
      )}

      {/* Modale Suivi de Commande en Direct */}
      {settings && (
        <OrderTrackingModal
          isOpen={isTrackingOpen}
          onClose={() => setIsTrackingOpen(false)}
          initialOrderNumber={trackingOrderCode}
          phoneWhatsAppMina={settings.phoneWhatsApp}
          onOpenInvoice={(order) => setSelectedInvoiceOrder(order)}
        />
      )}

      {/* Modale de Facture Officielle Client */}
      {selectedInvoiceOrder && (
        <InvoiceModal
          order={selectedInvoiceOrder}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}
    </div>
  );
}
