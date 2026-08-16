import { Button } from "@/components/ui/button";
import { useCart } from "@/components/CartProvider";
import { formatMoney } from "@/lib/format";
import { ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Link } from "react-router";

type ProductCardProps = {
  id: string;
  name: string;
  price: number;
  image?: string;
  sellerName: string;
  stock: number;
  reserved: number;
  totalSold?: number;
};

export function ProductCard({
  id,
  name,
  price,
  image,
  sellerName,
  stock,
  reserved,
  totalSold,
}: ProductCardProps) {
  const { add, setOpen } = useCart();
  const available = Math.max(0, stock - reserved);
  const out = available <= 0;

  const quickAdd = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await add(id);
      toast.success("Added to cart", { description: name });
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add to cart");
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <Link
        to={`/shop/product/${id}`}
        className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:border-lime-500/40"
      >
        <div className="relative aspect-square overflow-hidden bg-muted">
          {image ? (
            <img
              src={image}
              alt={name}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
          {out && (
            <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white">
              Sold out
            </span>
          )}
          {!out && (totalSold ?? 0) > 0 && (
            <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur">
              {totalSold}+ sold
            </span>
          )}
          <Button
            type="button"
            size="icon"
            variant="secondary"
            disabled={out}
            onClick={quickAdd}
            className="absolute bottom-3 right-3 size-10 cursor-pointer rounded-full opacity-0 shadow-none transition-all group-hover:opacity-100 disabled:opacity-0"
            aria-label={`Add ${name} to cart`}
          >
            <ShoppingBag className="size-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-1 p-4">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{sellerName}</p>
          <p className="mt-1 text-base font-bold tracking-tight text-lime-300">
            {formatMoney(price)}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
