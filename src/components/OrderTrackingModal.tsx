/**
 * @license
 * Modal de Suivi de Commande en Temps Réel - Mina's Food (Mbour, Sénégal)
 * 
 * Permet au client de saisir son code MINA-XXXX pour suivre l'avancement
 * de son gâteau ou de sa commande entre le laboratoire de pâtisserie et la livraison moto.
 */

import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types/bakery.ts';
import { trouverCommandeParNumero } from '../services/bakeryService.ts';
import { realtimeService } from '../services/realtimeService.ts';
import { WaveLogo } from './WaveLogo.tsx';
import { 
  X, 
  Search, 
  CheckCircle2, 
  Clock, 
  ChefHat, 
  Bike, 
  HeartHandshake, 
  Phone, 
  MapPin,
  Sparkles,
  FileText
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialOrderNumber?: string;
  phoneWhatsAppMina: string;
  onOpenInvoice?: (order: Order) => void;
}

const ETAPES_SUIVI: { status: OrderStatus; label: string; desc: string; icon: any }[] = [
  {
    status: 'received',
    label: 'Commande reçue',
    desc: 'Commande enregistrée et transmise à la cuisine',
    icon: Clock
  },
  {
    status: 'preparing',
    label: 'En préparation au laboratoire',
    desc: 'Le chef pâtissier façonne vos créations et décore vos gâteaux',
    icon: ChefHat
  },
  {
    status: 'ready_or_out',
    label: 'Prête / En livraison moto',
    desc: 'Emballée avec soin et en route vers votre quartier à Mbour',
    icon: Bike
  },
  {
    status: 'delivered',
    label: 'Livrée & Dégustée',
    desc: 'Bonne dégustation ! Que vos moments de fête soient doux',
    icon: HeartHandshake
  }
];

export const OrderTrackingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialOrderNumber = '',
  phoneWhatsAppMina,
  onOpenInvoice
}) => {
  const [searchCode, setSearchCode] = useState<string>(initialOrderNumber);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);

  useEffect(() => {
    if (initialOrderNumber && isOpen) {
      setSearchCode(initialOrderNumber);
      handleSearch(initialOrderNumber);
    }
  }, [initialOrderNumber, isOpen]);

  // Écoute en direct des changements de statut via WebSocket
  useEffect(() => {
    const unsubscribe = realtimeService.on('order:status_updated', (data: any) => {
      if (order && (order.id === data.orderId || order.orderNumber === data.orderNumber)) {
        setOrder(prev => prev ? { ...prev, status: data.status, updatedAt: data.updatedAt || new Date().toISOString() } : null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [order]);

  if (!isOpen) return null;

  const handleSearch = async (codeToSearch?: string) => {
    const code = codeToSearch || searchCode;
    if (!code.trim() || !customerPhone.trim()) return;

    setIsLoading(true);
    setSearched(true);

    const found = await trouverCommandeParNumero(code, customerPhone);
    setOrder(found);
    setIsLoading(false);
  };

  const getEtapeIndex = (status: OrderStatus) => {
    switch (status) {
      case 'received': return 0;
      case 'preparing': return 1;
      case 'ready_or_out': return 2;
      case 'delivered': return 3;
      default: return 0;
    }
  };

  const currentStepIdx = order ? getEtapeIndex(order.status) : 0;

  return (
    <div 
      id="order-tracking-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="order-tracking-card"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4"
      >
        {/* En-tête */}
        <div className="p-5 border-b border-stone-200 bg-amber-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-700 text-white shadow-xs">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold font-display text-base sm:text-lg text-stone-900 leading-tight">
                Suivi de Commande en Direct
              </h3>
              <p className="text-xs text-stone-500">
                Pâtisserie Mina's Food • Mbour & Petite Côte
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barre de recherche */}
        <div className="p-5 border-b border-stone-100">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  placeholder="Numéro (ex: MINA-4821)"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono uppercase"
                />
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              </div>
              <button
                type="submit"
                disabled={isLoading || !customerPhone.trim()}
                className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Recherche...' : 'Suivre'}
              </button>
            </div>
            <div className="relative">
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Téléphone utilisé lors de la commande"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            </div>
          </form>
        </div>

        {/* Contenu du suivi */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-stone-500 text-xs animate-pulse">
              Recherche des informations de votre commande à Mbour...
            </div>
          ) : order ? (
            <div className="space-y-6">
              {/* Carte résumé de commande */}
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-stone-500 block">Commande :</span>
                  <span className="font-mono font-bold text-base text-stone-900">
                    {order.orderNumber}
                  </span>
                  <span className="text-xs text-stone-600 block mt-0.5">
                    {order.customerName} ({order.customerPhone})
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-stone-500 block">Montant :</span>
                  <span className="font-display font-bold text-base text-amber-900">
                    {order.total.toLocaleString('fr-FR')} FCFA
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1 mt-0.5 justify-end">
                    {order.paymentMethod === 'wave' ? (
                      <>
                        <WaveLogo size="xs" />
                        <span>Payé par Wave</span>
                      </>
                    ) : '💵 À régler au livreur'}
                  </span>
                </div>
              </div>

              {/* TIMELINE VISUELLE DES ÉTAPES */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                    Progression de la préparation
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>En direct WebSocket</span>
                  </span>
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                  {ETAPES_SUIVI.map((etape, idx) => {
                    const isCompleted = idx < currentStepIdx;
                    const isCurrent = idx === currentStepIdx;
                    const Icon = etape.icon;

                    return (
                      <div key={etape.status} className="relative flex items-start gap-3.5">
                        {/* Puce d'étape */}
                        <div 
                          className={`absolute -left-6 top-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            isCompleted 
                              ? 'bg-emerald-600 text-white' 
                              : isCurrent 
                              ? 'bg-amber-600 text-white ring-4 ring-amber-100 animate-pulse' 
                              : 'bg-stone-200 text-stone-400'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Icon className="w-3 h-3" />
                          )}
                        </div>

                        <div>
                          <h4 className={`text-sm font-semibold ${
                            isCurrent ? 'text-amber-900 font-bold' : isCompleted ? 'text-stone-800' : 'text-stone-400'
                          }`}>
                            {etape.label}
                            {isCurrent && (
                              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold uppercase">
                                En cours
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-stone-500 mt-0.5">
                            {etape.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Détails des délices commandés */}
              <div className="space-y-2 pt-2 border-t border-stone-200">
                <span className="text-xs font-semibold text-stone-700 block">
                  Contenu du paquet gourmand :
                </span>
                <div className="space-y-1.5 text-xs text-stone-600">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start">
                      <span>• {item.quantity}x {item.product.name}</span>
                      <span className="font-semibold text-stone-800">
                        {(item.unitPrice * item.quantity).toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bouton Consulter la Facture Officielle */}
              {onOpenInvoice && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onOpenInvoice(order)}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <FileText className="w-4 h-4" />
                    <span>📄 Voir & Télécharger la Facture Officielle</span>
                  </button>
                </div>
              )}

              {/* Destination & Contact Mina */}
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-2">
                <div className="flex items-start gap-2 text-stone-700">
                  <MapPin className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-stone-900">
                      {order.deliveryType === 'retrait_boutique' ? 'Retrait à la Pâtisserie :' : 'Adresse de livraison :'}
                    </span>
                    <p className="text-stone-600 mt-0.5">
                      {order.deliveryAddress || order.deliveryZone}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-[11px]">
                  <span className="text-stone-500">Une question sur la livraison ?</span>
                  <a
                    href={`tel:${phoneWhatsAppMina.replace(/[\s\+\-]/g, '')}`}
                    className="text-amber-800 font-bold hover:underline flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" /> Appeler Mina ({phoneWhatsAppMina})
                  </a>
                </div>
              </div>
            </div>
          ) : searched ? (
            <div className="py-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-stone-800">
                Aucune commande trouvée pour le code « {searchCode} »
              </p>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Vérifiez le numéro figurant sur votre reçu Wave ou sur le message WhatsApp envoyé par Mina's Food.
              </p>
            </div>
          ) : (
            <div className="py-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-stone-800">
                Suivez votre commande pas à pas
              </p>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Entrez votre code de commande (ex: <strong>MINA-4821</strong> ou <strong>MINA-3904</strong>) pour visualiser en direct l'avancement en cuisine et la livraison à Mbour.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
