import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/components/CartProvider";
import { formatMoney } from "@/lib/format";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Link } from "react-router";

export function CartDrawer() {
  const { items, totalMinor, count, open, setOpen, updateQty, remove, loading } =
    useCart();
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/70 px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="size-4" />
            Your cart {count > 0 && `(${count})`}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Items in your cart
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading cart…</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <ShoppingBag className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Your cart is empty.{" "}
                <Link
                  to="/shop"
                  onClick={() => setOpen(false)}
                  className="text-lime-300 underline underline-offset-4"
                >
                  Browse the shop
                </Link>
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-border/60 bg-card p-3"
                >
                  <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="size-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        {item.variantName && (
                          <p className="text-xs text-muted-foreground">
                            {item.variantName}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void remove(item.id)}
                        className="cursor-pointer text-muted-foreground transition-colors hover:text-red-400"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center gap-1 rounded-full border border-border/70">
                        <button
                          type="button"
                          onClick={() => void updateQty(item.id, item.quantity - 1)}
                          className="flex size-7 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= item.available}
                          onClick={() => void updateQty(item.id, item.quantity + 1)}
                          className="flex size-7 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoney(item.subtotal)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border/70 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-lg font-bold tabular-nums">
              {formatMoney(totalMinor)}
            </span>
          </div>
          <Button
            type="button"
            className="w-full cursor-pointer"
            size="lg"
            disabled={items.length === 0}
            onClick={() => {
              setOpen(false);
              navigate("/shop/checkout");
            }}
          >
            Checkout
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Shipping calculated at checkout · Free over ฿1,000
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
