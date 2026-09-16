/**
 * @license
 * Skeleton de charge pour les cartes produit - Mina's Food
 */

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="group rounded-2xl border border-stone-200 bg-white shadow-[0_8px_24px_rgba(28,25,23,0.04)] overflow-hidden animate-[fadeInUp_0.4s_ease-out]">
      <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-stone-100">
        <div className="product-card-skeleton-shimmer absolute inset-0" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="h-6 w-20 rounded-full bg-stone-200/90" />
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-stone-200" />
          <div className="h-3 w-24 rounded-full bg-stone-200" />
        </div>

        <div className="h-5 w-3/4 rounded-full bg-stone-200" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded-full bg-stone-200" />
          <div className="h-3 w-5/6 rounded-full bg-stone-200" />
        </div>
      </div>

      <div className="p-4 sm:p-5 pt-0">
        <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
          <div className="space-y-2">
            <div className="h-2.5 w-10 rounded-full bg-stone-200" />
            <div className="h-5 w-20 rounded-full bg-stone-200" />
          </div>

          <div className="h-9 w-22 rounded-xl bg-stone-200" />
        </div>
      </div>
    </div>
  );
};
