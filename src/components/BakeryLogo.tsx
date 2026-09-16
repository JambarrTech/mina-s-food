/**
 * @license
 * Logo Officiel Mina's Food - Pâtisserie & Traiteur d'Excellence Mbour
 * 
 * Emblème officiel de la maison Mina's Food (asset /logo.jpeg).
 */

import React from 'react';
import { Award } from 'lucide-react';

interface Props {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showSubtitle?: boolean;
  variant?: 'circle' | 'square';
}

export const BakeryLogo: React.FC<Props> = ({
  className = '',
  size = 'md',
  showSubtitle = false,
  variant = 'circle'
}) => {
  const sizeMap = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
    '2xl': 'w-28 h-28'
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const radiusClass = variant === 'circle' ? 'rounded-full' : 'rounded-2xl';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Conteneur d'emblème avec contour doré brillant */}
      <div 
        className={`${currentSize} shrink-0 ${radiusClass} overflow-hidden shadow-md shadow-amber-950/20 ring-2 ring-amber-400/60 bg-black hover:scale-105 transition-all duration-300 relative group`}
        title="Mina's Food - Saveurs faites avec amour (Mbour, Sénégal)"
      >
        <img 
          src="/logo.jpeg" 
          alt="Logo Officiel Mina's Food Mbour" 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:brightness-110 transition-all"
        />
        {/* Lueur subtile au survol */}
        <div className={`absolute inset-0 ${radiusClass} pointer-events-none ring-1 ring-inset ring-amber-300/30`} />
      </div>

      {showSubtitle && (
        <div className="leading-tight">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-stone-900">
              Mina's Food
            </span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300/60 shadow-2xs">
              Mbour
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              <Award className="w-3 h-3 text-amber-600" />
              Maison de Confiance
            </span>
          </div>

          <p className="text-[11px] font-medium text-amber-800/80 italic mt-0.5">
            Saveurs faites avec amour
          </p>
        </div>
      )}
    </div>
  );
};
