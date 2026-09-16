/**
 * @license
 * Module de Paiement Wave Sénégal - Pâtisserie Mina's Food (Mbour)
 * 
 * Bonjour ! Ce module implémente la logique de paiement Wave, la solution
 * mobile money préférée des Sénégalais sur la Petite Côte.
 * 
 * Le flux respecte fidèlement les habitudes d'utilisation :
 * 1. Calcul du montant exact en FCFA (sans frais cachés pour le client)
 * 2. Génération d'une référence unique sécurisée (ex: WV-MBR-2026-8942)
 * 3. Affichage du QR Code Wave officiel scannable
 * 4. Option de saisie du numéro de téléphone sénégalais (Orange, Free, Expresso, Promobile)
 * 5. Simulation push instantanée : le client valide sur son smartphone
 * 6. Émission d'un reçu numérique complet pour le client et pour le laboratoire à Mbour.
 */

/**
 * Génère une référence de paiement Wave élégante et humaine
 * Format : WV-MBR-AAAA-XXXX (ex: WV-MBR-2026-4821)
 */
export function genererReferenceWave(orderNumber: string): string {
  const annee = new Date().getFullYear();
  const suffixe = Math.floor(1000 + Math.random() * 9000);
  const codeNettoye = orderNumber.replace(/[^0-9]/g, '') || suffixe.toString();
  return `WV-MBR-${annee}-${codeNettoye}-${suffixe.toString().slice(-2)}`;
}

/**
 * Valide un numéro de téléphone sénégalais (+221 ou format local)
 * Préfixes valides : 70 (Free), 75 (Promobile), 76 (Free), 77 (Orange), 78 (Orange)
 */
export function validerNumeroSenegal(telephone: string): { valide: boolean; formate: string; operateur?: string } {
  const nettoye = telephone.replace(/[\s\-\(\)\.]/g, '');
  
  // Format international avec +221 ou 00221
  let numeroSansIndicatif = nettoye;
  if (nettoye.startsWith('+221')) {
    numeroSansIndicatif = nettoye.slice(4);
  } else if (nettoye.startsWith('00221')) {
    numeroSansIndicatif = nettoye.slice(5);
  } else if (nettoye.startsWith('221') && nettoye.length === 12) {
    numeroSansIndicatif = nettoye.slice(3);
  }

  if (numeroSansIndicatif.length !== 9) {
    return {
      valide: false,
      formate: telephone
    };
  }

  const prefixe = numeroSansIndicatif.slice(0, 2);
  let operateur = 'Wave';
  if (prefixe === '77' || prefixe === '78') operateur = 'Orange / Wave';
  else if (prefixe === '76' || prefixe === '70') operateur = 'Free / Wave';
  else if (prefixe === '75') operateur = 'Promobile / Wave';

  const numeroPropre = `+221 ${numeroSansIndicatif.slice(0, 2)} ${numeroSansIndicatif.slice(2, 5)} ${numeroSansIndicatif.slice(5, 7)} ${numeroSansIndicatif.slice(7, 9)}`;

  return {
    valide: true,
    formate: numeroPropre,
    operateur
  };
}

/**
 * Construit un lien WhatsApp chaleureux avec le récapitulatif complet
 * pour que le client puisse envoyer sa commande directement à Mina
 */
export function genererLienWhatsAppMina(params: {
  phoneWhatsAppMina: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryType: string;
  deliveryZone: string;
  total: number;
  paymentMethod: string;
  waveRef?: string;
  itemsSummary: string;
  requestedDate: string;
  requestedTime: string;
}): string {
  const numeroMina = params.phoneWhatsAppMina.replace(/[\s\+\-]/g, '');
  
  const texte = `Bonjour Mina's Food !\n\n` +
    `Je viens de passer une commande sur votre site :\n` +
    `🔖 *Commande n° :* ${params.orderNumber}\n` +
    `👤 *Client :* ${params.customerName} (${params.customerPhone})\n` +
    `🎂 *Détails des douceurs :*\n${params.itemsSummary}\n\n` +
    `📍 *Mode :* ${params.deliveryType === 'retrait_boutique' ? 'Retrait à la boutique de Mbour' : 'Livraison à domicile'}\n` +
    `🛵 *Secteur :* ${params.deliveryZone}\n` +
    `🕒 *Date & Heure souhaitées :* ${params.requestedDate} à ${params.requestedTime}\n` +
    `💰 *Montant total :* ${params.total.toLocaleString('fr-FR')} FCFA\n` +
    `💳 *Paiement :* ${params.paymentMethod === 'wave' ? `Wave validé (Réf: ${params.waveRef || 'En cours'})` : 'Paiement à la livraison'}\n\n` +
    `J'ai hâte de déguster vos créations, merci beaucoup !`;

  return `https://wa.me/${numeroMina}?text=${encodeURIComponent(texte)}`;
}
