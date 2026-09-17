/**
 * @license
 * Carte Produit Pâtisserie - Mina's Food (Mbour, Sénégal)
 */

import React from 'react';
import { Product } from '../types/bakery.ts';
import { Plus, Sparkles, Clock } from 'lucide-react';

interface Props {
  product: Product;
  onAddToCart: (product: Product) => void;
  onCustomizeCake: (product: Product) => void;
}

export const ProductCard: React.FC<Props> = React.memo(({
  product,
  onAddToCart,
  onCustomizeCake
}) => {
  return (
    <div 
      id={`product-card-${product.id}`}
      className={`group bg-white rounded-2xl border transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between overflow-hidden ${
        product.isAvailable ? 'border-stone-200/80 hover:border-amber-300' : 'border-stone-200 opacity-60'
      }`}
    >
      <div>
        {/* Conteneur Image */}
        <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-stone-100">
          <img 
            src={product.image} 
            alt={product.name} 
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          
          {/* Badge de disponibilité ou de personnalisation */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
            {product.isCustomizable ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-900/90 text-amber-100 backdrop-blur-xs flex items-center gap-1 shadow-xs">
                <Sparkles className="w-3 h-3 text-amber-400" /> Sur-mesure
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/90 text-stone-700 backdrop-blur-xs shadow-xs">
                {product.preparationTime || 'En boutique'}
              </span>
            )}

            {!product.isAvailable && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-600 text-white shadow-xs">
                Épuisé aujourd'hui
              </span>
            )}
          </div>
        </div>

        {/* Détails du produit */}
        <div className="p-4 sm:p-5 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <Clock className="w-3 h-3 text-amber-700" />
            <span>{product.preparationTime}</span>
          </div>

          <h3 className="font-display font-bold text-base sm:text-lg text-stone-900 leading-snug group-hover:text-amber-900 transition-colors">
            {product.name}
          </h3>

          <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed font-sans">
            {product.description}
          </p>
        </div>
      </div>

      {/* Pied de carte avec tarif en FCFA et boutons d'action */}
      <div className="p-4 sm:p-5 pt-0">
        <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] text-stone-500 block uppercase tracking-wider">Prix</span>
            <span className="font-display font-bold text-base sm:text-lg text-amber-950">
              {product.price.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {product.isAvailable ? (
              product.isCustomizable ? (
                <button
                  id={`customize-btn-${product.id}`}
                  type="button"
                  onClick={() => onCustomizeCake(product)}
                  className="px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Personnaliser</span>
                </button>
              ) : (
                <button
                  id={`add-btn-${product.id}`}
                  type="button"
                  onClick={() => onAddToCart(product)}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-amber-800 active:bg-amber-900 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              )
            ) : (
              <span className="text-xs text-stone-400 italic">
                Victime de son succès
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
