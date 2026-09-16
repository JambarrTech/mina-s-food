/**
 * @license
 * Pied de Page - Pâtisserie Mina's Food (Mbour, Sénégal)
 */

import React from 'react';
import { BakerySettings } from '../types/bakery.ts';
import { MapPin, Phone, Clock, Heart, Bike } from 'lucide-react';
import { WaveLogo } from './WaveLogo.tsx';

interface Props {
  settings: BakerySettings;
  onOpenTracking: () => void;
}

export const Footer: React.FC<Props> = ({ settings, onOpenTracking }) => {
  return (
    <footer className="bg-stone-900 text-stone-300 pt-12 pb-8 px-4 sm:px-6 border-t border-stone-800 mt-16 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-stone-800">
        
        {/* Identité */}
        <div className="space-y-3 md:col-span-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-700 text-white flex items-center justify-center font-serif font-bold text-lg">
              M
            </div>
            <span className="font-display font-bold text-xl text-white">
              Mina's Food
            </span>
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            Votre pâtisserie artisanale de référence à Mbour. Créations faites avec passion pour sublimer vos anniversaires, mariages et moments de gourmandise.
          </p>
          <div className="flex items-center gap-2 pt-1 text-xs text-amber-400">
            <WaveLogo size="xs" />
            <span>Partenaire Wave Sénégal</span>
          </div>
        </div>

        {/* Coordonnées */}
        <div className="space-y-2.5 text-xs">
          <h4 className="font-semibold text-white uppercase tracking-wider text-[11px]">
            La Pâtisserie à Mbour
          </h4>
          <div className="flex items-start gap-2 text-stone-400">
            <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>{settings.address}</span>
          </div>
          <div className="flex items-center gap-2 text-stone-400">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{settings.openingHours}</span>
          </div>
          <div className="flex items-center gap-2 text-stone-400">
            <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>WhatsApp : {settings.phoneWhatsApp}</span>
          </div>
        </div>

        {/* Secteurs desservis */}
        <div className="space-y-2.5 text-xs">
          <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5 text-amber-500" />
            Livraison Express Petite Côte
          </h4>
          <p className="text-stone-400 leading-relaxed">
            Nos livreurs à moto acheminent vos délices fraîchement préparés dans tout Mbour et ses environs :
          </p>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-300">Mbour Centre</span>
            <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-300">Saly Portudal</span>
            <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-300">Somone</span>
            <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-300">Ngaparou</span>
            <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-300">Warang</span>
            <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-300">Tefess</span>
          </div>
        </div>

        {/* Liens utiles */}
        <div className="space-y-2.5 text-xs">
          <h4 className="font-semibold text-white uppercase tracking-wider text-[11px]">
            Services & Équipe
          </h4>
          <ul className="space-y-1.5">
            <li>
              <button 
                onClick={onOpenTracking}
                className="text-stone-400 hover:text-amber-400 transition-colors text-left cursor-pointer"
              >
                Suivre l'avancement de ma commande
              </button>
            </li>
            <li>
              <a 
                href={`https://wa.me/${settings.phoneWhatsApp.replace(/[\s\+\-]/g, '')}?text=${encodeURIComponent("Bonjour Mina, je souhaite des renseignements sur un gâteau événementiel.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-stone-400 hover:text-amber-400 transition-colors block"
              >
                Commander un gâteau géant de mariage
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
        <p>© {new Date().getFullYear()} Mina's Food Pâtisserie • Mbour, Sénégal. Tous droits réservés.</p>
        <p className="flex items-center gap-1">
          Fait avec passion <Heart className="w-3 h-3 text-rose-500 fill-current" /> pour la Petite Côte
        </p>
      </div>
    </footer>
  );
};
