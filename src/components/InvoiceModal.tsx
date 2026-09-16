/**
 * @license
 * Modal de Facture & Reçu Client - Mina's Food (Mbour, Sénégal)
 * 
 * Affiche la facture officielle générée par le serveur (endpoint
 * /api/invoices/:orderId) à partir des données de la base Neon :
 * mentions légales (NINEA, RCCM), détail des personnalisations,
 * reçu de paiement Wave Sénégal, impression et partage WhatsApp.
 */

import { useEffect, useState } from 'react';
import { Order } from '../types/bakery.ts';
import { chargerFacture } from '../services/bakeryService.ts';
import { 
  Printer, 
  Download, 
  Share2, 
  X, 
  CheckCircle2, 
  Cake, 
  Bike, 
  Phone, 
  ShieldCheck,
  FileText
} from 'lucide-react';

interface Props {
  order: Order;
  onClose: () => void;
}

// Forme de facture renvoyée par l'API serveur (voir buildInvoiceObject dans server.ts)
interface FactureItem {
  name: string;
  details?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Facture {
  invoiceNumber: string;
  orderNumber: string;
  issueDate: string;
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
    deliveryType: string;
  };
  items: FactureItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentStatus: string;
  waveTransactionRef?: string;
  notes?: string;
  verificationCode: string;
}

export const InvoiceModal: React.FC<Props> = ({ order, onClose }) => {
  const [invoice, setInvoice] = useState<Facture | null>(null);
  const [erreur, setErreur] = useState<string>('');
  const [tentative, setTentative] = useState<number>(0);

  useEffect(() => {
    let actif = true;
    setErreur('');
    setInvoice(null);

    (async () => {
      try {
        const facture = await chargerFacture(order.orderNumber || order.id, order.customerPhone);
        if (actif) setInvoice(facture);
      } catch (e: any) {
        if (actif) setErreur(e?.message || 'Impossible de charger la facture.');
      }
    })();

    return () => { actif = false; };
  }, [order.orderNumber, order.id, tentative]);

  const handleDownload = () => {
    if (!invoice) return;
    const contenu = document.getElementById('facture-printable')?.outerHTML || '';
    if (!contenu) return;
    const blob = new Blob([contenu], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Facture-${invoice.invoiceNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWhatsAppShare = () => {
    if (!invoice) return;
    const url = `https://wa.me/?text=${encodeURIComponent(
      `Bonjour Mina's Food, voici ma facture ${invoice.invoiceNumber} (commande ${invoice.orderNumber}) d'un montant de ${invoice.total.toLocaleString('fr-FR')} FCFA.`
    )}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formattedDate = invoice ? new Date(invoice.issueDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : '';

  return (
    <div 
      id="invoice-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static"
      role="dialog"
      aria-modal="true"
    >
      <div 
        id="invoice-modal-card"
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto print:shadow-none print:border-none print:max-w-none print:rounded-none"
      >
        {/* Barre d'action supérieure (masquée lors de l'impression) */}
        <div className="bg-stone-900 text-white px-5 py-3.5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <span className="font-bold text-sm text-stone-100 block leading-none">
                Facture Client Officielle
              </span>
              <span className="text-[10px] text-amber-300">
                {invoice ? invoice.invoiceNumber : 'Chargement…'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Imprimer ou enregistrer en PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimer / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!invoice}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer border border-stone-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Télécharger le reçu (.html)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reçu</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              disabled={!invoice}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="Partager le récapitulatif sur WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer ml-1"
              title="Fermer la facture"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!invoice && !erreur && (
          <div className="p-10 text-center text-stone-500 text-sm space-y-3">
            <div className="w-10 h-10 rounded-full border-4 border-amber-200 border-t-amber-700 animate-spin mx-auto" />
            <p>Génération de la facture depuis le laboratoire de Mina…</p>
          </div>
        )}

        {erreur && (
          <div className="p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center font-serif text-2xl font-bold mx-auto">
              !
            </div>
            <p className="text-sm text-stone-600 font-medium">{erreur}</p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setTentative(t => t + 1)}
                className="px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 cursor-pointer"
              >
                Réessayer
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* CORPS DE LA FACTURE (Stylé pour écran & impression standard) */}
        {invoice && (
          <div id="facture-printable" className="p-6 sm:p-8 space-y-6 text-stone-800 text-xs sm:text-sm print:p-0">
            {/* En-tête de la facture */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b-2 border-amber-700">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-700 text-white flex items-center justify-center font-serif font-bold text-lg shadow-sm">
                    M
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-xl text-amber-950 leading-none">
                      Mina's Food
                    </h2>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Pâtisserie Fine & Cake Design • {invoice.seller.city}, {invoice.seller.country}
                    </p>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-stone-500 space-y-0.5">
                  <p>{invoice.seller.address}</p>
                  <p>NINEA : <strong className="text-stone-700">{invoice.seller.ninea}</strong> • RCCM : <strong className="text-stone-700">{invoice.seller.rccm}</strong></p>
                  <p>Tél / Wave : <strong className="text-stone-700">{invoice.seller.phoneWave}</strong></p>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-900 border border-amber-200 inline-block mb-1">
                  Facture & Reçu de Caisse
                </span>
                <div className="font-mono font-bold text-base text-amber-900">
                  {invoice.invoiceNumber}
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Commande N° <strong>{invoice.orderNumber}</strong>
                </p>
                <p className="text-[11px] text-stone-500 capitalize">
                  {formattedDate}
                </p>
              </div>
            </div>

            {/* Sceau de statut Wave / Paiement */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-xs">
                    {invoice.paymentStatus === 'paid' ? 'Paiement Wave Sénégal Confirmé' : 'Commande Enregistrée'}
                  </span>
                  {invoice.waveTransactionRef && (
                    <span className="text-[11px] text-emerald-700 block sm:inline sm:ml-2">
                      (Réf Wave : <code className="font-mono font-bold">{invoice.waveTransactionRef}</code>)
                    </span>
                  )}
                </div>
              </div>

              <div className="text-[11px] font-medium text-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Paiement Garanti & Sécurisé</span>
              </div>
            </div>

            {/* Coordonnées Client & Livraison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Client Facturé
                </h3>
                <p className="font-bold text-stone-900 text-sm">{invoice.client.name}</p>
                <p className="text-stone-600 mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-amber-700" />
                  <span>{invoice.client.phone}</span>
                </p>
                {invoice.client.email && (
                  <p className="text-stone-500 text-xs mt-0.5">{invoice.client.email}</p>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Destination & Retrait
                </h3>
                <div className="flex items-center gap-1.5 font-semibold text-stone-900">
                  {invoice.client.deliveryType === 'livraison_mbour' ? (
                    <>
                      <Bike className="w-3.5 h-3.5 text-amber-700" />
                      <span>Livraison Moto à Mbour</span>
                    </>
                  ) : (
                    <>
                      <Cake className="w-3.5 h-3.5 text-amber-700" />
                      <span>Retrait direct à la boutique</span>
                    </>
                  )}
                </div>
                <p className="text-stone-700 mt-1">
                  Quartier : <strong>{invoice.client.zone}</strong>
                </p>
                {invoice.client.address && (
                  <p className="text-stone-500 text-xs mt-0.5">
                    Repère : {invoice.client.address}
                  </p>
                )}
              </div>
            </div>

            {/* Tableau des douceurs commandées */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-500 font-bold bg-stone-50">
                    <th className="py-2.5 px-3">Désignation</th>
                    <th className="py-2.5 px-3 text-center">Qté</th>
                    <th className="py-2.5 px-3 text-right">Prix Unitaire</th>
                    <th className="py-2.5 px-3 text-right">Total Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/20">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-stone-900">{item.name}</div>
                        {item.details && (
                          <div className="text-[11px] text-amber-800 bg-amber-50/60 p-1.5 rounded-lg mt-1 border border-amber-100/60">
                            {item.details}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-stone-700">{item.quantity}</td>
                      <td className="py-3 px-3 text-right font-medium text-stone-700">
                        {item.unitPrice.toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-stone-900">
                        {item.totalPrice.toLocaleString('fr-FR')} FCFA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Récapitulatif et totaux */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-stone-200">
              <div className="text-[11px] text-stone-500 max-w-xs space-y-1">
                <p>• Produits artisanaux frais, préparés le jour même au laboratoire.</p>
                <p>• Exonération de TVA conformément à l'article 261 du Code Général des Impôts du Sénégal.</p>
                {invoice.notes && (
                  <p className="italic text-stone-600 bg-stone-100 p-2 rounded-lg mt-1">
                    Note client : « {invoice.notes} »
                  </p>
                )}
              </div>

              <div className="w-full sm:w-64 space-y-2 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <div className="flex justify-between text-stone-600 text-xs">
                  <span>Sous-total douceurs :</span>
                  <span className="font-semibold">{invoice.subtotal.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-stone-600 text-xs">
                  <span>Frais de livraison ({invoice.client.zone}) :</span>
                  <span className="font-semibold">
                    {invoice.deliveryFee > 0 ? `${invoice.deliveryFee.toLocaleString('fr-FR')} FCFA` : '0 FCFA (Gratuit)'}
                  </span>
                </div>
                <div className="flex justify-between text-stone-500 text-[11px]">
                  <span>TVA (0%) :</span>
                  <span>Exonéré</span>
                </div>
                <div className="pt-2 border-t border-stone-300 flex justify-between items-baseline font-bold text-amber-950">
                  <span className="text-sm">Total Net :</span>
                  <span className="text-lg font-display text-amber-800">
                    {invoice.total.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            </div>

            {/* Pied de facture */}
            <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-stone-400 text-center sm:text-left">
              <div>
                <p className="font-semibold text-stone-600">{invoice.seller.brand} • Mbour, Sénégal</p>
                <p>Service client & Réclamations : {invoice.seller.phoneWave} • NINEA {invoice.seller.ninea.split(' ')[0]}</p>
              </div>
              <div className="font-mono text-stone-400">
                Contrôle : {invoice.verificationCode}
              </div>
            </div>
          </div>
        )}

        {/* Bouton de fermeture en bas sur mobile */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 sm:hidden print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-stone-800 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Fermer la facture
          </button>
        </div>
      </div>
    </div>
  );
};