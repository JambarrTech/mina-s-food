/**
 * @license
 * Modal de Paiement Wave Sénégal & Validation de Commande
 * Pâtisserie Mina's Food - Mbour, Sénégal
 * 
 * Bonjour ! Ce composant recrée avec fidélité et bienveillance
 * l'expérience de paiement Wave plébiscitée au Sénégal :
 * - Reconnaissance automatique des numéros locaux (+221)
 * - QR Code Wave officiel scannable
 * - Simulation instantanée du push de confirmation Wave
 * - Reçu de commande imprimable et partage WhatsApp direct avec Mina
 */

import React, { useState } from 'react';
import { Order } from '../types/bakery.ts';
import { 
  genererLienWhatsAppMina 
} from '../services/wavePaymentService.ts';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  Share2, 
  Printer, 
  X, 
  ArrowRight, 
  ShieldCheck, 
  FileText,
  ExternalLink,
  Banknote
} from 'lucide-react';
import { WaveLogo } from './WaveLogo.tsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderData: {
    customerName: string;
    customerPhone: string;
    customerAddress?: string;
    deliveryZone: string;
    deliveryType: 'livraison_mbour' | 'retrait_boutique';
    deliveryFee: number;
    subtotal: number;
    total: number;
    items: any[];
    customerNotes?: string;
    requestedDate: string;
    requestedTime: string;
  };
  onOrderConfirmed: (confirmedOrder: Order) => Promise<void> | void;
  onOpenInvoice?: (order: Order) => void;
  phoneWhatsAppMina: string;
}

export const WaveCheckoutModal: React.FC<Props> = ({
  isOpen,
  onClose,
  orderData,
  onOrderConfirmed,
  onOpenInvoice,
  phoneWhatsAppMina
}) => {
  // Mode de paiement sélectionné : Wave (recommandé) ou Espèces à la livraison
  const [paymentMode, setPaymentMode] = useState<'wave' | 'cash_delivery'>('wave');
  
  const [wavePaymentStarted, setWavePaymentStarted] = useState<boolean>(false);
  // Lien commercial Wave officiel de la boutique (fallback intégré au code,
  // surchargeable via VITE_WAVE_PAYMENT_LINK dans .env)
  const wavePaymentLink = String(
    import.meta.env.VITE_WAVE_PAYMENT_LINK ||
    'https://pay.wave.com/m/M_sn_adltbIFU3xPE/c/sn/'
  ).trim();
  
  // État du processus de paiement
  const [step, setStep] = useState<'input' | 'confirmed'>('input');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string>('');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  // Numéro de commande stable pour toute la session de checkout
  const [sessionRef] = useState(() => {
    const numero = `MINA-${Math.floor(1000 + Math.random() * 9000)}`;
    return { numero };
  });
  const orderNumber = sessionRef.numero;

  if (!isOpen) return null;

  const handleConfirmWavePayment = () => finaliserCommande('wave');

  const handlePayCash = () => {
    finaliserCommande('cash_delivery');
  };

  const finaliserCommande = async (methode: 'wave' | 'cash_delivery', referenceWave?: string) => {
    setIsProcessing(true);
    setCheckoutError('');
    
    const nouvelleCommande: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      deliveryType: orderData.deliveryType,
      deliveryZone: orderData.deliveryZone,
      deliveryAddress: orderData.customerAddress,
      deliveryFee: orderData.deliveryFee,
      subtotal: orderData.subtotal,
      total: orderData.total,
      paymentMethod: methode,
      paymentStatus: 'pending',
      waveTransactionRef: referenceWave,
      status: 'received',
      items: orderData.items,
      customerNotes: orderData.customerNotes,
      requestedDate: orderData.requestedDate,
      requestedTime: orderData.requestedTime,
      createdAt: new Date().toISOString()
    };

    try {
      await onOrderConfirmed(nouvelleCommande);
      setConfirmedOrder(nouvelleCommande);
      setStep('confirmed');

      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}
    } catch (error: any) {
      setCheckoutError(error?.message || 'Impossible d’enregistrer la commande. Veuillez réessayer.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Résumé textuel pour WhatsApp
  const itemsSummary = orderData.items.map(item => {
    let ligne = `• ${item.quantity}x ${item.product.name} (${(item.unitPrice * item.quantity).toLocaleString('fr-FR')} FCFA)`;
    if (item.customization?.inscriptionText) {
      ligne += ` [Plaque: "${item.customization.inscriptionText}"]`;
    }
    return ligne;
  }).join('\n');

  const lienWhatsApp = genererLienWhatsAppMina({
    phoneWhatsAppMina,
    orderNumber: confirmedOrder?.orderNumber || orderNumber,
    customerName: orderData.customerName,
    customerPhone: orderData.customerPhone,
    deliveryType: orderData.deliveryType,
    deliveryZone: orderData.deliveryZone,
    total: orderData.total,
    paymentMethod: paymentMode,
    waveRef: confirmedOrder?.waveTransactionRef,
    itemsSummary,
    requestedDate: orderData.requestedDate,
    requestedTime: orderData.requestedTime
  });

  return (
    <div 
      id="wave-checkout-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="wave-checkout-card"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-4"
      >
        {/* En-tête Wave avec branding authentique */}
        <div className="bg-gradient-to-r from-[#00b2fe] to-[#0090d8] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Wave officiel */}
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md p-1 shrink-0">
              <WaveLogo size="sm" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-lg tracking-tight">Paiement Wave Sénégal</h3>
                <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                  0% de frais
                </span>
              </div>
              <p className="text-xs text-blue-50">Sécurisé & instantané pour Mina's Food Mbour</p>
            </div>
          </div>

          <button
              onClick={onClose}
              className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENU VARIABLE SELON L'ÉTAPE */}
        {step === 'input' && (
          <div className="p-6 space-y-5">
            {checkoutError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {checkoutError}
              </div>
            )}
            {/* Récapitulatif montant net à payer */}
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
              <div>
                <div className="text-xs text-stone-500">Montant total de la commande :</div>
                <div className="text-2xl font-bold font-display text-[#006ea8]">
                  {orderData.total.toLocaleString('fr-FR')} FCFA
                </div>
              </div>
              <div className="text-right text-xs text-stone-600">
                <span className="font-semibold block text-stone-800">
                  {orderData.deliveryType === 'retrait_boutique' ? 'Retrait boutique' : 'Livraison Mbour'}
                </span>
                <span>{orderData.deliveryZone}</span>
              </div>
            </div>

            {/* Choix de la méthode : Wave ou Espèces */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Choisissez votre moyen de règlement
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMode('wave')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    paymentMode === 'wave'
                      ? 'border-[#00b2fe] bg-sky-50/80 text-[#006ea8] ring-2 ring-[#00b2fe]/30 font-semibold'
                      : 'border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <WaveLogo size="sm" />
                  <div>
                    <div className="text-sm font-bold">Wave Mobile</div>
                    <div className="text-[11px] text-stone-500">Validation instantanée</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('cash_delivery')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    paymentMode === 'cash_delivery'
                      ? 'border-amber-600 bg-amber-50/80 text-amber-900 ring-2 ring-amber-600/30 font-semibold'
                      : 'border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <span className="text-xl">💵</span>
                  <div>
                    <div className="text-sm font-bold">À la livraison</div>
                    <div className="text-[11px] text-stone-500">Espèces au livreur</div>
                  </div>
                </button>
              </div>
            </div>

            {/* SI WAVE EST SÉLECTIONNÉ */}
            {paymentMode === 'wave' ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-stone-700 text-xs space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-sky-900">
                    <ShieldCheck className="w-4 h-4 text-[#00b2fe]" />
                    Paiement sécurisé par lien commercial Wave
                  </div>
                  <p>
                    Ouvre le lien commercial Wave, règle exactement <strong>{orderData.total.toLocaleString('fr-FR')} FCFA</strong>, puis reviens ici pour confirmer l’envoi de ta commande.
                  </p>
                  {wavePaymentLink ? (
                    <>
                      <a
                        id="launch-wave-payment-link"
                        href={wavePaymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setWavePaymentStarted(true)}
                        className="w-full py-3 px-4 rounded-xl bg-[#00b2fe] hover:bg-[#009ee0] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <span>Ouvrir le paiement Wave</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        disabled={!wavePaymentStarted || isProcessing}
                        onClick={handleConfirmWavePayment}
                        className="w-full py-2.5 px-4 rounded-xl border border-[#00b2fe] text-[#006ea8] hover:bg-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        J’ai effectué le paiement
                      </button>
                    </>
                  ) : (
                    <p className="font-semibold text-red-700">
                      Le lien commercial Wave n’est pas configuré. Ajoute VITE_WAVE_PAYMENT_LINK dans .env.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* SI PAIEMENT EN ESPÈCES À LA LIVRAISON */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-stone-700 text-xs space-y-2">
                  <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-amber-700" /> Règlement à la livraison ou au comptoir
                  </div>
                  <p>
                    Vous remettrez la somme exacte de <strong>{orderData.total.toLocaleString('fr-FR')} FCFA</strong> à notre livreur à moto dès son arrivée à votre adresse à Mbour, ou à la caisse lors de votre passage à la boutique.
                  </p>
                  <p className="text-stone-500 italic">
                    Astuce : Prévoyez l’appoint si possible pour faciliter le travail du livreur !
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handlePayCash}
                  className="w-full py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Confirmer la commande avec paiement à la livraison</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE COMMANDE CONFIRMÉE & REÇU OFFICIEL */}
        {step === 'confirmed' && confirmedOrder && (
          <div className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold font-display text-stone-900">
                Commande Validée avec Succès !
              </h3>
              <p className="text-xs text-stone-600 max-w-xs mx-auto">
                Merci {confirmedOrder.customerName} ! Mina et son équipe en laboratoire s'activent pour préparer vos douceurs.
              </p>
            </div>

            {/* Reçu officiel de la commande */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <div>
                  <span className="text-stone-500 block">Numéro de commande :</span>
                  <span className="font-mono font-bold text-sm text-stone-900">
                    {confirmedOrder.orderNumber}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-stone-500 block">Mode de règlement :</span>
                  <span className="font-semibold text-stone-800 inline-flex items-center gap-1">
                    {confirmedOrder.paymentMethod === 'wave' ? (
                      <>
                        <WaveLogo size="xs" />
                        <span>Wave (en vérification)</span>
                      </>
                    ) : '💵 À la livraison'}
                  </span>
                </div>
              </div>

              {confirmedOrder.waveTransactionRef && (
                <div className="flex items-center justify-between text-stone-600">
                  <span>Référence Wave :</span>
                  <span className="font-mono font-semibold text-[#006ea8]">
                    {confirmedOrder.waveTransactionRef}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-stone-600">
                <span>Livraison / Retrait :</span>
                <span className="font-semibold text-stone-800">
                  {confirmedOrder.deliveryType === 'retrait_boutique' ? 'Boutique Mbour' : confirmedOrder.deliveryZone}
                </span>
              </div>

              <div className="flex items-center justify-between text-stone-600">
                <span>Créneau souhaité :</span>
                <span className="font-semibold text-stone-800">
                  {confirmedOrder.requestedDate} - {confirmedOrder.requestedTime}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-stone-200 pt-2 text-sm font-bold text-stone-900">
                <span>Total commande :</span>
                <span className="text-amber-900 font-display text-base">
                  {confirmedOrder.total.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            {/* Boutons d'actions client : Facture, WhatsApp, Impression, Fermer */}
            <div className="space-y-2">
              {onOpenInvoice && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenInvoice(confirmedOrder);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2 text-center cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Consulter & Imprimer ma Facture Officielle</span>
                </button>
              )}

              <a
                href={lienWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 text-center"
              >
                <Share2 className="w-4 h-4" />
                <span>Envoyer le récapitulatif sur WhatsApp à Mina</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer le reçu</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Retour à la boutique
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
