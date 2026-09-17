/**
 * @license
 * Tiroir Panier & Formulaire de Livraison - Mina's Food (Mbour, Sénégal)
 * 
 * Permet au client de vérifier ses douceurs, d'ajuster les quantités,
 * de choisir son mode de réception (Retrait en boutique ou Livraison moto à Mbour / Saly)
 * et de renseigner ses coordonnées avant le paiement Wave.
 */

import React, { useState } from 'react';
import { CartItem, DeliveryZone } from '../types/bakery.ts';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Bike, 
  Store, 
  Calendar, 
  Clock, 
  Sparkles, 
  ArrowRight
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (cartItemId: string, newQty: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  deliveryZones: DeliveryZone[];
  onProceedToWaveCheckout: (checkoutData: {
    customerName: string;
    customerPhone: string;
    customerAddress?: string;
    deliveryZone: string;
    deliveryType: 'livraison_mbour' | 'retrait_boutique';
    deliveryFee: number;
    subtotal: number;
    total: number;
    items: CartItem[];
    customerNotes?: string;
    requestedDate: string;
    requestedTime: string;
  }) => void;
}

export const CartDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  deliveryZones,
  onProceedToWaveCheckout
}) => {
  // Mode de remise : Retrait à la boutique ou Livraison à domicile
  const [deliveryType, setDeliveryType] = useState<'livraison_mbour' | 'retrait_boutique'>('livraison_mbour');
  
  // Zone sélectionnée à Mbour
  const [selectedZoneId, setSelectedZoneId] = useState<string>(deliveryZones[0]?.id || 'zone-mbour-centre');
  
  // Coordonnées client
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  
  // Date et créneau souhaités avec calcul dynamique
  const getDynamicDates = () => {
    const today = new Date();
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dates = [
      { value: 'Aujourd\'hui', label: 'Aujourd\'hui' },
      { value: 'Demain', label: 'Demain' },
    ];
    // Ajouter les 5 prochains jours
    for (let i = 2; i <= 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push({ value: days[d.getDay()], label: `Ce ${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}` });
    }
    return dates;
  };
  const dynamicDates = getDynamicDates();

  const [requestedDate, setRequestedDate] = useState<string>('Aujourd\'hui');
  const [requestedTime, setRequestedTime] = useState<string>('Dès que possible (30-45 min)');
  
  // Erreurs de validation
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string; address?: string }>({});
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  if (!isOpen) return null;

  // Calcul des montants
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  
  const currentZone = deliveryZones.find(z => z.id === selectedZoneId) || deliveryZones[0];
  const deliveryFee = deliveryType === 'retrait_boutique' ? 0 : (currentZone?.fee || 1000);
  const total = subtotal + deliveryFee;

  const handleCheckoutClick = () => {
    const errors: { name?: string; phone?: string; address?: string } = {};
    if (!customerName.trim()) {
      errors.name = 'Veuillez indiquer votre prénom ou nom';
    }
    if (!customerPhone.trim()) {
      errors.phone = 'Veuillez renseigner votre numéro de téléphone';
    }
    if (deliveryType === 'livraison_mbour' && !customerAddress.trim()) {
      errors.address = 'Veuillez préciser votre adresse ou un repère à Mbour / Saly';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsCheckingOut(true);
    onProceedToWaveCheckout({
      customerName,
      customerPhone,
      customerAddress: deliveryType === 'livraison_mbour' ? customerAddress : 'Retrait en boutique Mina’s Food (Mbour Centre)',
      deliveryZone: deliveryType === 'retrait_boutique' ? 'Retrait en boutique' : currentZone.name,
      deliveryType,
      deliveryFee,
      subtotal,
      total,
      items,
      customerNotes: customerNotes.trim() || undefined,
      requestedDate,
      requestedTime
    });
  };

  return (
    <div 
      id="cart-drawer-backdrop" 
      className="fixed inset-0 z-50 flex justify-end bg-stone-900/60 backdrop-blur-xs transition-opacity animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Panier"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="cart-drawer-panel"
        className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden text-stone-800 animate-slideLeft"
      >
        {/* En-tête du panier */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-700 text-white shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-stone-900 leading-tight">
                Votre Panier Gourmand
              </h2>
              <p className="text-xs text-stone-500">
                {items.length} {items.length > 1 ? 'articles sélectionnés' : 'article sélectionné'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Fermer le panier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps du panier */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {items.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="text-base font-semibold text-stone-800">
                Votre panier est encore vide
              </p>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Laissez-vous tenter par nos gâteaux personnalisés, croissants dorés ou jus locaux frais de Mbour !
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-5 py-2.5 rounded-xl bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 transition-colors cursor-pointer"
              >
                Découvrir la vitrine
              </button>
            </div>
          ) : (
            <>
              {/* Liste des articles */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Articles commandés
                </div>
                {items.map((item) => (
                  <div 
                    key={item.cartItemId}
                    className="p-3 rounded-xl border border-stone-200 bg-white hover:border-amber-200 transition-colors shadow-2xs space-y-2"
                  >
                    <div className="flex gap-3">
                      <img 
                        src={item.product.image} 
                        alt={item.product.name} 
                        className="w-16 h-16 rounded-lg object-cover bg-stone-100 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-sm font-semibold text-stone-900 truncate">
                            {item.product.name}
                          </h4>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.cartItemId)}
                            className="text-stone-400 hover:text-red-600 transition-colors p-1"
                            title="Supprimer cet article"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-xs font-bold text-amber-900 mt-0.5">
                          {item.unitPrice.toLocaleString('fr-FR')} FCFA
                        </div>

                        {/* Détails de personnalisation si gâteau */}
                        {item.customization && (
                          <div className="mt-1.5 p-2 rounded-md bg-amber-50/80 border border-amber-100 text-[11px] text-stone-700 space-y-0.5">
                            <div className="font-semibold text-amber-950 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              {item.customization.servings} parts • {item.customization.spongeFlavor}
                            </div>
                            <div className="text-stone-600">
                              Crème : {item.customization.creamFilling}
                            </div>
                            {item.customization.inscriptionText && (
                              <div className="text-amber-900 font-serif italic">
                                « {item.customization.inscriptionText} »
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contrôles de quantité */}
                    <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                      <span className="text-xs text-stone-500">Quantité :</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)}
                          className="w-6 h-6 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                          aria-label={`Diminuer la quantité de ${item.product.name}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold w-4 text-center" aria-label={`Quantité: ${item.quantity}`}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
                          className="w-6 h-6 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                          aria-label={`Augmenter la quantité de ${item.product.name}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mode de réception : Retrait ou Livraison moto */}
              <div className="space-y-3 pt-2 border-t border-stone-200">
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Mode de réception à Mbour
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('livraison_mbour')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      deliveryType === 'livraison_mbour'
                        ? 'border-amber-600 bg-amber-50/70 text-amber-950 ring-1 ring-amber-600 font-semibold'
                        : 'border-stone-200 text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <Bike className="w-5 h-5 text-amber-700 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Livraison Moto</div>
                      <div className="text-[11px] text-stone-500">Mbour & Petite Côte</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType('retrait_boutique')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      deliveryType === 'retrait_boutique'
                        ? 'border-amber-600 bg-amber-50/70 text-amber-950 ring-1 ring-amber-600 font-semibold'
                        : 'border-stone-200 text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <Store className="w-5 h-5 text-amber-700 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Retrait Boutique</div>
                      <div className="text-[11px] text-emerald-600 font-semibold">Gratuit</div>
                    </div>
                  </button>
                </div>

                {/* Si livraison : sélection de la zone */}
                {deliveryType === 'livraison_mbour' && (
                  <div className="space-y-2 p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <label htmlFor="cart-delivery-zone" className="block text-xs font-semibold text-stone-700">
                      Secteur / Quartier de livraison
                    </label>
                    <select
                      id="cart-delivery-zone"
                      value={selectedZoneId}
                      onChange={(e) => setSelectedZoneId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {deliveryZones.map(zone => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name} (+{zone.fee.toLocaleString('fr-FR')} FCFA • ~{zone.estimatedMinutes} min)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Formulaire des coordonnées client */}
              <div className="space-y-3 pt-2 border-t border-stone-200">
                <div className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Vos coordonnées pour la livraison
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Prénom & Nom *
                  </label>
                  <input
                    type="text"
                    id="cart-customer-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: Fatou Sow ou Jean Diouf"
                    className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      formErrors.name ? 'border-red-400 bg-red-50/40' : 'border-stone-300 bg-white'
                    }`}
                  />
                  {formErrors.name && (
                    <span className="text-[11px] text-red-600 mt-0.5 block">{formErrors.name}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Numéro de téléphone (Wave / WhatsApp) *
                  </label>
                  <input
                    type="tel"
                    id="cart-customer-phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ex: 77 123 45 67"
                    className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      formErrors.phone ? 'border-red-400 bg-red-50/40' : 'border-stone-300 bg-white'
                    }`}
                  />
                  {formErrors.phone && (
                    <span className="text-[11px] text-red-600 mt-0.5 block">{formErrors.phone}</span>
                  )}
                </div>

                {deliveryType === 'livraison_mbour' && (
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Adresse ou repère précis à Mbour / Saly *
                    </label>
                    <input
                      type="text"
                      id="cart-customer-address"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="Ex: Saly Tapée, en face de l'hôtel Palm Beach, portail marron"
                      className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        formErrors.address ? 'border-red-400 bg-red-50/40' : 'border-stone-300 bg-white'
                      }`}
                    />
                    {formErrors.address && (
                      <span className="text-[11px] text-red-600 mt-0.5 block">{formErrors.address}</span>
                    )}
                  </div>
                )}

                {/* Date & Heure souhaitées */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="cart-requested-date" className="block text-xs font-medium text-stone-700 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-stone-500" /> Date
                    </label>
                    <select
                      id="cart-requested-date"
                      value={requestedDate}
                      onChange={(e) => setRequestedDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {dynamicDates.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="cart-requested-time" className="block text-xs font-medium text-stone-700 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-500" /> Heure
                    </label>
                    <select
                      id="cart-requested-time"
                      value={requestedTime}
                      onChange={(e) => setRequestedTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Dès que possible (30-45 min)">Dès que possible</option>
                      <option value="Midi (12h - 13h)">Midi (12h - 13h)</option>
                      <option value="Goûter (16h - 17h)">Goûter (16h - 17h)</option>
                      <option value="Soirée (18h - 19h30)">Soirée (18h - 19h30)</option>
                      <option value="Créneau précis (contactez-moi)">Autre horaire</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Instructions spéciales (optionnel)
                  </label>
                  <input
                    type="text"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Ex: Klaxonner deux fois à la porte, gâteau bien frais"
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pied de page du panier avec total et bouton Wave */}
        {items.length > 0 && (
          <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 space-y-3">
            <div className="space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Sous-total produits :</span>
                <span className="font-semibold text-stone-800">
                  {subtotal.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div className="flex justify-between">
                <span>Frais de livraison :</span>
                <span className="font-semibold text-stone-800">
                  {deliveryFee === 0 ? 'Gratuit (Retrait)' : `+${deliveryFee.toLocaleString('fr-FR')} FCFA`}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-stone-950 pt-2 border-t border-stone-200">
                <span>Total net à régler :</span>
                <span className="text-amber-900 font-display text-xl">
                  {total.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            <button
              id="proceed-to-wave-btn"
              type="button"
              onClick={handleCheckoutClick}
              disabled={isCheckingOut}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#00b2fe] to-[#0090d8] hover:from-[#00a1e6] hover:to-[#007cb8] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isCheckingOut ? 'Préparation...' : `Payer avec Wave (${total.toLocaleString('fr-FR')} FCFA)`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
