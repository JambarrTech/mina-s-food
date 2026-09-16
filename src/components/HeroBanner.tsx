/**
 * @license
 * Bannière d'Accueil & Identité de la Pâtisserie - Mina's Food (Mbour, Sénégal)
 */

import React from 'react';
import { Sparkles, Bike, ShieldCheck, Heart, MapPin, Award } from 'lucide-react';
import { BakerySettings } from '../types/bakery.ts';
import { BakeryLogo } from './BakeryLogo.tsx';
import { WaveLogo } from './WaveLogo.tsx';

interface Props {
  settings: BakerySettings;
  onExploreCakes: () => void;
}

export const HeroBanner: React.FC<Props> = ({ settings, onExploreCakes }) => {
  return (
    <div className="relative overflow-hidden bg-stone-950 text-stone-100 rounded-3xl mx-4 sm:mx-6 my-4 shadow-2xl border border-amber-900/40">
      {/* Image de fond avec superposition chaleureuse */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1600&q=80" 
          alt="Atelier pâtisserie Mina's Food Mbour" 
          className="w-full h-full object-cover opacity-20 scale-105 transition-transform duration-1000 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-900/95 to-amber-950/70" />
      </div>

      <div className="relative z-10 p-6 sm:p-10 lg:p-12 max-w-5xl space-y-6">
        {/* En-tête de la bannière avec logo emblème & localisation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold backdrop-blur-xs">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Mbour & Saly • Petite Côte, Sénégal</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-200/90">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">Maison de Confiance ★★★</span>
          </div>
        </div>

        {/* Titre et Logo officiel côte à côte */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-7">
          {/* Emblème Officiel Mina's Food */}
          <div className="shrink-0">
            <BakeryLogo size="2xl" variant="circle" />
          </div>

          <div className="space-y-2">
            <div className="inline-block text-amber-400 text-xs sm:text-sm font-serif italic tracking-wide">
              Saveurs faites avec amour
            </div>
            <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
              L'excellence gourmande signée <span className="text-amber-400 font-serif">Mina's Food</span>
            </h1>
            <p className="text-xs sm:text-sm text-amber-200/90 font-medium">
              Qualité • Fraîcheur • Passion • Commandes directes au <strong>{settings.phoneWhatsApp}</strong>
            </p>
            <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed font-sans pt-1">
              Gâteaux d’anniversaire et de mariage sur-mesure, viennoiseries dorées pur beurre, fatayas croustillants et jus locaux pressés du jour.
            </p>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={onExploreCakes}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:from-amber-700 active:to-amber-600 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-amber-900/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Composer un Gâteau Personnalisé</span>
          </button>

          <a
            href={`https://wa.me/${settings.phoneWhatsApp.replace(/[\s\+\-]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/20 backdrop-blur-xs transition-all flex items-center gap-2"
          >
            <Heart className="w-4 h-4 text-rose-400 fill-current" />
            <span>WhatsApp : {settings.phoneWhatsApp}</span>
          </a>
        </div>

        {/* Garanties & Services locaux avec Logos officiels */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-stone-800/80 text-xs text-stone-300">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center p-0.5 shadow-xs shrink-0">
              <WaveLogo size="xs" />
            </div>
            <span><strong>Paiement Wave Sénégal</strong> sans frais au {settings.phoneWhatsApp}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Bike className="w-4 h-4" />
            </div>
            <span><strong>Livraison Express Moto</strong> Mbour, Saly, Ngaparou</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span><strong>Fait Maison au Quotidien</strong> Ingrédients nobles</span>
          </div>
        </div>
      </div>
    </div>
  );
};
