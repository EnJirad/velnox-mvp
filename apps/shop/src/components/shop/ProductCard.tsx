import { useLanguage } from "@/lib/i18n";
import { Button } from "@velnox/shared/components/ui/button";
import { formatBaht, type StoreProduct } from "@velnox/shared/lib/commerce";
import { ImageOff, Plus, Star } from "lucide-react";

interface ProductCardProps {
  product: StoreProduct;
  /** Open the product (detail page or quick-view modal). */
  onOpen: (product: StoreProduct) => void;
  onAdd: (product: StoreProduct) => void;
  /** Optional small overlay label (e.g. “แนะนำ”). */
  badgeLabel?: string;
}

/**
 * VelShop product card — the single card used on Home and the catalog.
 * Deliberately minimal: image, name, price, one stock/sold line and an
 * add-to-cart button. No heart, no motion, no extra badges.
 */
export function ProductCard({ product, onOpen, onAdd, badgeLabel }: ProductCardProps) {
  const { t } = useLanguage();
  const available = product.inventory?.available ?? product.inventory?.quantity ?? 0;
  const outOfStock = available <= 0;
  const lowStock = !outOfStock && available <= 5;
  const hasReviews = (product.reviewCount ?? 0) > 0 && product.rating != null;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-slate-300">
      <button
        type="button"
        onClick={() => onOpen(product)}
        className="relative block aspect-square w-full cursor-pointer overflow-hidden bg-slate-50"
        aria-label={t("product.ariaViewDetail", { name: product.name })}
      >
        {product.primaryImage ? (
          <img
            src={product.primaryImage.displayUrl}
            alt={product.primaryImage.alt || product.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <ImageOff className="size-8 text-slate-300" />
          </span>
        )}
        {outOfStock && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            {t("product.outOfStock")}
          </span>
        )}
        {badgeLabel && !outOfStock && (
          <span className="absolute left-2 top-2 rounded-full bg-[#10B981] px-2 py-0.5 text-[10px] font-semibold text-white">
            {badgeLabel}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{product.name}</h3>

        {hasReviews && (
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            <span className="font-semibold tabular-nums text-slate-700">
              {Number(product.rating).toFixed(1)}
            </span>
            <span>({product.reviewCount})</span>
          </p>
        )}

        <p className="mt-2 text-base font-bold tabular-nums tracking-tight text-slate-900">
          {formatBaht(product.price)}
          <span className="ml-1 text-[11px] font-normal text-slate-400">
            {t("cart.perUnit", { unit: product.unit })}
          </span>
        </p>

        <p
          className={`mt-0.5 text-[11px] ${
            outOfStock
              ? "font-medium text-red-500"
              : lowStock
                ? "font-medium text-amber-600"
                : "text-slate-400"
          }`}
        >
          {outOfStock
            ? t("product.outOfStock")
            : lowStock
              ? t("product.lowStock", { count: available, unit: product.unit })
              : product.soldCount != null && product.soldCount > 0
                ? t("product.soldShort", { count: product.soldCount })
                : t("product.inStockShort")}
        </p>

        <div className="flex-1" />
        <Button
          className="mt-3 h-9 w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
          disabled={outOfStock || product.price <= 0}
          onClick={() => onAdd(product)}
        >
          <Plus className="size-4" />
          <span className="sm:hidden">{t("product.addToCartSm")}</span>
          <span className="hidden sm:inline">{t("product.addToCart")}</span>
        </Button>
      </div>
    </div>
  );
}
