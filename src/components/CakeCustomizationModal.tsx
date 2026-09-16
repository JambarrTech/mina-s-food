/**
 * @license
 * Modale de Personnalisation de Gâteau - Mina's Food (Mbour, Sénégal)
 * 
 * Permet aux clients de composer leur gâteau de fête sur-mesure :
 * - Choix du format (nombre de parts)
 * - Saveur de génoise artisanale
 * - Fourrage & crème gourmande
 * - Inscription personnalisée au chocolat offerte avec prévisualisation en direct
 * - Bougies festives
 */

import React, { useState } from 'react';
import { Product, CakeCustomizationOptions } from '../types/bakery.ts';
import { X, Sparkles, Cake, Check, Heart } from 'lucide-react';

interface Props {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (customization: CakeCustomizationOptions, calculatedPrice: number) => void;
}

// Formats disponibles et coefficients de prix
const SERVING_OPTIONS = [
  { count: 6, label: '6 parts (Petit comité)', priceMultiplier: 1.0, popular: false },
  { count: 8, label: '8 parts (Familial)', priceMultiplier: 1.25, popular: true },
  { count: 12, label: '12 parts (Grande fête)', priceMultiplier: 1.75, popular: false },
  { count: 20, label: '20 parts (Événement / Baptême)', priceMultiplier: 2.7, popular: false },
];

const SPONGE_OPTIONS = [
  'Vanille Bourbon de Madagascar',
  'Chocolat Noir Intense 70%',
  'Red Velvet Douceur',
  'Noix de Coco des Îles'
];

const CREAM_OPTIONS = [
  'Ganache Chocolat Fondante',
  'Chantilly Mascarpone Vanille',
  'Mangue de Casamance & Passion',
  'Caramel au Beurre Salé Maison',
  'Praliné Feuillantine Croustillant'
];

export const CakeCustomizationModal: React.FC<Props> = ({
  product,
  isOpen,
  onClose,
  onAddToCart
}) => {
  const [servings, setServings] = useState<number>(8);
  const [spongeFlavor, setSpongeFlavor] = useState<string>(SPONGE_OPTIONS[0]);
  const [creamFilling, setCreamFilling] = useState<string>(CREAM_OPTIONS[1]);
  const [inscriptionText, setInscriptionText] = useState<string>('Joyeux Anniversaire !');
  const [candlesCount, setCandlesCount] = useState<number>(0);
  const [giftMessage, setGiftMessage] = useState<string>('');

  if (!isOpen) return null;

  // Calcul du prix ajusté selon le nombre de parts
  const selectedOption = SERVING_OPTIONS.find(o => o.count === servings) || SERVING_OPTIONS[1];
  const calculatedPrice = Math.round(product.price * selectedOption.priceMultiplier / 500) * 500;

  const handleConfirm = () => {
    onAddToCart({
      servings,
      spongeFlavor,
      creamFilling,
      inscriptionText: inscriptionText.trim() || undefined,
      candlesCount: candlesCount > 0 ? candlesCount : undefined,
      giftMessage: giftMessage.trim() || undefined
    }, calculatedPrice);
    onClose();
  };

  return (
    <div 
      id="cake-customization-modal-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="cake-customization-modal-card"
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-amber-100 overflow-hidden my-6"
      >
        {/* En-tête avec visuel gourmand */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-amber-950">
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-900/40 to-transparent" />
          
          <button
            id="close-cake-modal-btn"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-6 right-6 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-stone-950 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Personnalisation sur-mesure
              </span>
              <span className="text-xs text-amber-200">Laboratoire Mina's Food Mbour</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-amber-50 leading-tight">
              {product.name}
            </h2>
          </div>
        </div>

        {/* Corps du formulaire de personnalisation */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          
          {/* Étape 1 : Nombre de parts */}
          <div id="step-servings-container">
            <label className="block text-sm font-semibold text-stone-800 mb-2.5 flex items-center gap-2">
              <Cake className="w-4 h-4 text-amber-700" />
              1. Choisissez le format (Nombre de parts)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SERVING_OPTIONS.map((option) => {
                const isSelected = servings === option.count;
                const priceForOption = Math.round(product.price * option.priceMultiplier / 500) * 500;
                return (
                  <button
                    key={option.count}
                    type="button"
                    onClick={() => setServings(option.count)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected 
                        ? 'border-amber-600 bg-amber-50/70 text-amber-950 shadow-xs ring-1 ring-amber-600' 
                        : 'border-stone-200 hover:border-amber-300 text-stone-700 bg-white'
                    }`}
                  >
                    {option.popular && (
                      <span className="absolute -top-2 right-2 px-1.5 py-0.5 text-[10px] font-bold bg-amber-600 text-white rounded-full">
                        Idéal
                      </span>
                    )}
                    <div className="text-sm font-bold">{option.count} parts</div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {priceForOption.toLocaleString('fr-FR')} FCFA
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Étape 2 : Parfum de la génoise */}
          <div id="step-sponge-container">
            <label className="block text-sm font-semibold text-stone-800 mb-2">
              2. Saveur de la génoise moelleuse
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SPONGE_OPTIONS.map((flavor) => (
                <button
                  key={flavor}
                  type="button"
                  onClick={() => setSpongeFlavor(flavor)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-sm transition-all cursor-pointer ${
                    spongeFlavor === flavor 
                      ? 'border-amber-600 bg-amber-50/60 font-medium text-amber-900 ring-1 ring-amber-600' 
                      : 'border-stone-200 hover:border-amber-200 text-stone-700'
                  }`}
                >
                  <span>{flavor}</span>
                  {spongeFlavor === flavor && <Check className="w-4 h-4 text-amber-700" />}
                </button>
              ))}
            </div>
          </div>

          {/* Étape 3 : Fourrage & Crème */}
          <div id="step-cream-container">
            <label className="block text-sm font-semibold text-stone-800 mb-2">
              3. Crème & Fourrage intérieur
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CREAM_OPTIONS.map((cream) => (
                <button
                  key={cream}
                  type="button"
                  onClick={() => setCreamFilling(cream)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-sm transition-all cursor-pointer ${
                    creamFilling === cream 
                      ? 'border-amber-600 bg-amber-50/60 font-medium text-amber-900 ring-1 ring-amber-600' 
                      : 'border-stone-200 hover:border-amber-200 text-stone-700'
                  }`}
                >
                  <span>{cream}</span>
                  {creamFilling === cream && <Check className="w-4 h-4 text-amber-700" />}
                </button>
              ))}
            </div>
          </div>

          {/* Étape 4 : Inscription personnalisée au chocolat offerte */}
          <div id="step-inscription-container" className="bg-amber-50/50 rounded-xl p-4 border border-amber-200/80">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                4. Inscription sur plaque au chocolat (Offert)
              </label>
              <span className="text-xs text-amber-700 font-medium">Gratuit</span>
            </div>
            <p className="text-xs text-stone-600 mb-2.5">
              Notre chef pâtissier écrira délicatement ce message au cornet sur le gâteau.
            </p>
            <input
              type="text"
              id="cake-inscription-input"
              value={inscriptionText}
              onChange={(e) => setInscriptionText(e.target.value)}
              placeholder="Ex: Joyeux Anniversaire Aminata (25 ans) !"
              maxLength={60}
              className="w-full px-3.5 py-2.5 rounded-lg border border-amber-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-stone-800"
            />
            
            {/* Prévisualisation de la plaque au chocolat */}
            {inscriptionText && (
              <div className="mt-3 p-3 rounded-lg bg-stone-900 text-amber-200 text-center border border-amber-600/40 shadow-inner">
                <span className="text-[11px] uppercase tracking-wider text-stone-400 block mb-1">
                  Aperçu de la plaque
                </span>
                <p className="font-display italic text-base sm:text-lg text-amber-300">
                  « {inscriptionText} »
                </p>
              </div>
            )}
          </div>

          {/* Étape 5 : Bougies festives & message carte */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Nombre de bougies incluses
              </label>
              <select
                id="cake-candles-select"
                value={candlesCount}
                onChange={(e) => setCandlesCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value={0}>Aucune bougie</option>
                <option value={1}>1 bougie d'anniversaire</option>
                <option value={5}>Lot de 5 bougies dorées</option>
                <option value={10}>Lot de 10 bougies multicolores</option>
                <option value={18}>18 bougies</option>
                <option value={25}>25 bougies</option>
                <option value={30}>30 bougies</option>
                <option value={50}>50 bougies</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Petit mot doux sur carte cadeau (optionnel)
              </label>
              <input
                type="text"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder="Ex: De la part de Moussa & famille"
                maxLength={80}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Pied de page de la modale avec prix total et bouton d'ajout */}
        <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-stone-500">Prix pour {servings} parts :</div>
            <div className="text-xl sm:text-2xl font-bold font-display text-amber-900">
              {calculatedPrice.toLocaleString('fr-FR')} FCFA
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-sm font-medium transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              id="confirm-cake-customization-btn"
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white text-sm font-semibold shadow-md transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Heart className="w-4 h-4 fill-current" />
              Ajouter au panier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
