/**
 * @license
 * Logo Officiel Wave Sénégal - Pâtisserie Mina's Food (Mbour)
 *
 * Affiche le logo officiel Wave Mobile Money à partir de l'asset
 * /wave-logo.png (manchot + typographie "wave").
 */

import React from 'react';

interface Props {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const WaveLogo: React.FC<Props> = ({ className = '', size = 'md' }) => {
  const sizeMap = {
    xs: 'h-4',
    sm: 'h-5',
    md: 'h-6',
    lg: 'h-8',
    xl: 'h-10'
  };

  return (
    <img
      src="/wave-logo.png"
      alt="Wave Sénégal"
      className={`${sizeMap[size] || sizeMap.md} w-auto max-w-full object-contain shrink-0 ${className}`}
    />
  );
};
