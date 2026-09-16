/**
 * @license
 * En-tête Principal - Mina's Food (Mbour, Sénégal)
 * 
 * Bonjour ! Ce composant offre une navigation accueillante et chaleureuse,
 * reflétant l'excellence et la proximité de la pâtisserie de Mina sur la Petite Côte.
 */

import React from 'react';
import { 
  ShoppingBag, 
  Bike, 
  Phone, 
  Search 
} from 'lucide-react';
import { BakerySettings } from '../types/bakery.ts';
import { BakeryLogo } from './BakeryLogo.tsx';
import { WaveLogo } from './WaveLogo.tsx';
import { NotificationCenter } from './NotificationCenter.tsx';

interface Props {
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  onOpenTracking: () => void;
  settings: BakerySettings;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const Header: React.FC<Props> = ({
  cartCount,
  cartTotal,
  onOpenCart,
  onOpenTracking,
  settings,
  searchQuery,
  onSearchChange
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-100 shadow-2xs">
      {/* Barre supérieure d'annonce et contact */}
      <div className="bg-amber-900 text-amber-100 text-[11px] sm:text-xs py-1.5 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium truncate">
            {settings.isOpen ? `Pâtisserie Ouverte à Mbour • ${settings.openingHours}` : 'Boutique actuellement fermée'}
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <a
            href={`https://wa.me/${settings.phoneWhatsApp.replace(/[\s\+\-]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1 font-medium"
          >
            <Phone className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">WhatsApp :</span> {settings.phoneWhatsApp}
          </a>
          <span className="hidden md:inline text-amber-400/60">•</span>
          <span className="hidden md:inline-flex items-center gap-1.5 text-amber-200">
            <span>Paiement instantané</span>
            <WaveLogo size="xs" />
            <span className="font-semibold">Wave</span>
          </span>
        </div>
      </div>

      {/* Barre de navigation principale */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Logo & Identité Officielle */}
        <BakeryLogo size="md" showSubtitle={true} />

        {/* Champ de recherche pour délices */}
        <div className="hidden md:flex items-center flex-1 max-w-xs relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un gâteau, croissant..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 bg-stone-50/70 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-stone-800 transition-all"
          />
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3" />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 text-xs text-stone-400 hover:text-stone-600"
            >
              ×
            </button>
          )}
        </div>

        {/* Actions : Suivi, notifications et panier */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Suivi de commande */}
          <button
            id="nav-track-order-btn"
            type="button"
            onClick={onOpenTracking}
            className="px-3 py-2 rounded-xl text-stone-700 hover:text-amber-900 hover:bg-amber-50/80 border border-stone-200 sm:border-transparent text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Suivre votre commande"
          >
            <Bike className="w-4 h-4 text-amber-700" />
            <span className="hidden sm:inline">Suivi</span>
          </button>

          {/* Centre de notifications directes WebSocket */}
          <NotificationCenter onOpenTracking={() => onOpenTracking()} />

          {/* Bouton Panier */}
          <button
            id="nav-cart-btn"
            type="button"
            onClick={onOpenCart}
            className="px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <div className="relative">
              <ShoppingBag className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="font-bold">
              {cartTotal > 0 ? `${cartTotal.toLocaleString('fr-FR')} F` : 'Panier'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
