import { Button } from "@/components/ui/button";
import { ShopNav } from "@/components/ShopNav";
import { CartDrawer } from "@/components/CartDrawer";
import { useCart } from "@/components/CartProvider";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { formatMoney } from "@/lib/format";
import {
  ArrowLeft,
  Loader2,
  Minus,
  Plus,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { add, setOpen } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<"cart" | "buy" | null>(null);

  const data = useQuery(api.products.getProduct, {
    productId: id as Id<"products">,
  });

  if (data === undefined) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <ShopNav />
        <div className="flex items-center justify-center gap-2 py-32 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Loading product…
        </div>
      </div>
    );
  }

  if (data === null || data.product.status !== "ACTIVE") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <ShopNav />
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-32 text-center">
          <p className="text-lg font-semibold">Product not available</p>
          <p className="text-sm text-muted-foreground">
            It may have been removed or is no longer on sale.
          </p>
          <Button asChild variant="outline" className="cursor-pointer">
            <Link to="/shop">Back to marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { product, variants, seller } = data;
  const selectedVariant = variants.find((variant) => variant._id === variantId);
  const unitPrice = selectedVariant?.price ?? product.price;
  const available =
    (selectedVariant?.stock ?? product.stock) -
    (selectedVariant?.reserved ?? product.reserved);
  const out = available <= 0;

  const handleAdd = async (mode: "cart" | "buy") => {
    setBusy(mode);
    try {
      await add(product._id, selectedVariant?._id, quantity);
      if (mode === "cart") {
        toast.success("Added to cart", { description: product.name });
        setOpen(true);
      } else {
        navigate("/shop/checkout");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ShopNav />
      <CartDrawer />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <Link
          to="/shop"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to marketplace
        </Link>

        <div className="grid gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
            {product.images[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center text-muted-foreground">
                No image
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-5">
            <div>
              {data.categoryName && (
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">
                  {data.categoryName}
                </p>
              )}
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {product.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {product.totalSold > 0
                  ? `${product.totalSold}+ sold on Velnox`
                  : "New on Velnox"}
              </p>
            </div>

            <p className="text-3xl font-bold tracking-tight text-lime-300">
              {formatMoney(unitPrice)}
            </p>

            <p className="leading-relaxed text-muted-foreground">
              {product.description}
            </p>

            {variants.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {variants.map((variant) => (
                  <button
                    key={variant._id}
                    type="button"
                    onClick={() => setVariantId(variant._id)}
                    className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                      variantId === variant._id
                        ? "border-lime-500/60 bg-lime-500/10 text-lime-300"
                        : "border-border/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {variant.name}
                    {variant.price ? ` · ${formatMoney(variant.price)}` : ""}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 rounded-full border border-border/70">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex size-10 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center font-semibold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  disabled={quantity >= available}
                  onClick={() => setQuantity((q) => Math.min(available, q + 1))}
                  className="flex size-10 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                {out ? "Sold out" : `${available} in stock`}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                size="lg"
                className="flex-1 cursor-pointer"
                disabled={out || busy !== null}
                onClick={() => void handleAdd("cart")}
              >
                {busy === "cart" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShoppingBag className="size-4" />
                )}
                Add to cart
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="flex-1 cursor-pointer"
                disabled={out || busy !== null}
                onClick={() => void handleAdd("buy")}
              >
                <Zap className="size-4" /> Buy now
              </Button>
            </div>

            <div className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-border/60 bg-card p-4 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Truck className="size-4 text-lime-300" />
                Ships nationwide · free shipping over ฿1,000
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Repeat className="size-4 text-lime-300" />
                VelRepeat eligible — schedule this as a recurring order
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="size-4 text-lime-300" />
                Buyer protection on every order
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-lime-400/10 text-lime-300">
                <Store className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{seller.storeName}</p>
                <p className="text-xs text-muted-foreground">
                  {seller.description || "A verified Velnox seller."}
                </p>
              </div>
              <Link
                to="/shop"
                className="text-sm font-semibold text-lime-300 hover:underline"
              >
                Visit store
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
