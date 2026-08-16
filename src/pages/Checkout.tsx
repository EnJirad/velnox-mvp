import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShopNav } from "@/components/ShopNav";
import { CartDrawer } from "@/components/CartDrawer";
import { useCart } from "@/components/CartProvider";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { FLAT_SHIPPING_MINOR, FREE_SHIPPING_THRESHOLD_MINOR, formatMoney } from "@/lib/format";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function Checkout() {
  const { items, totalMinor, loading } = useCart();
  const createOrder = useMutation(api.orders.createOrder);
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `chk-${Date.now()}`,
  );
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "card">("cod");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<{ orderNumber: string } | null>(null);

  const shippingFee =
    totalMinor === 0 || totalMinor >= FREE_SHIPPING_THRESHOLD_MINOR
      ? 0
      : FLAT_SHIPPING_MINOR;
  const total = totalMinor + shippingFee;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0) return;
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    try {
      const result = await createOrder({
        idempotencyKey,
        sessionId: undefined,
        shippingAddress: {
          name: String(formData.get("name") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          line1: String(formData.get("line1") ?? ""),
          province: String(formData.get("province") ?? ""),
          postalCode: String(formData.get("postalCode") ?? ""),
        },
        notes: String(formData.get("notes") ?? "") || undefined,
        paymentMethod,
      });
      setPlaced({ orderNumber: result.orderNumber });
      toast.success("Order placed", { description: result.orderNumber });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not place order.");
    } finally {
      setBusy(false);
    }
  };

  if (placed) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <ShopNav />
        <main className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-24 text-center">
          <CheckCircle2 className="size-14 text-lime-300" />
          <h1 className="mt-6 text-3xl font-bold tracking-tight">
            Order confirmed
          </h1>
          <p className="mt-2 text-muted-foreground">
            Order <span className="font-semibold text-foreground">{placed.orderNumber}</span>{" "}
            is being prepared. The sellers have been notified.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="cursor-pointer">
              <Link to="/shop/orders">Track my orders</Link>
            </Button>
            <Button asChild variant="outline" className="cursor-pointer">
              <Link to="/shop">Keep shopping</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ShopNav />
      <CartDrawer />

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <Link
          to="/shop"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to shop
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Preparing checkout…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 py-24 text-center">
            <p className="font-semibold">Your cart is empty</p>
            <Button asChild variant="outline" className="cursor-pointer">
              <Link to="/shop">Browse the marketplace</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
            <div className="flex flex-col gap-8">
              {/* Shipping */}
              <section>
                <h2 className="mb-4 text-lg font-bold tracking-tight">
                  Shipping address
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" name="name" required placeholder="Somchai Jaidee" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      required
                      placeholder="08x-xxx-xxxx"
                      type="tel"
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="line1">Address line</Label>
                    <Input
                      id="line1"
                      name="line1"
                      required
                      placeholder="123 Sukhumvit Rd, Khlong Toei"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="province">Province</Label>
                    <Input id="province" name="province" required placeholder="Bangkok" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="postalCode">Postal code</Label>
                    <Input
                      id="postalCode"
                      name="postalCode"
                      required
                      placeholder="10110"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="notes">Order notes (optional)</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder="Delivery instructions, gift message…"
                      rows={3}
                    />
                  </div>
                </div>
              </section>

              {/* Payment */}
              <section>
                <h2 className="mb-4 text-lg font-bold tracking-tight">Payment</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cod")}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                      paymentMethod === "cod"
                        ? "border-lime-500/60 bg-lime-500/10"
                        : "border-border/70 hover:border-border"
                    }`}
                  >
                    <Banknote className="size-5 text-lime-300" />
                    <div>
                      <p className="text-sm font-semibold">Cash on delivery</p>
                      <p className="text-xs text-muted-foreground">
                        Pay when your parcel arrives
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                      paymentMethod === "card"
                        ? "border-lime-500/60 bg-lime-500/10"
                        : "border-border/70 hover:border-border"
                    }`}
                  >
                    <CreditCard className="size-5 text-lime-300" />
                    <div>
                      <p className="text-sm font-semibold">Card on delivery</p>
                      <p className="text-xs text-muted-foreground">
                        Pay at your door with any card
                      </p>
                    </div>
                  </button>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3.5" /> Totals are calculated securely
                  on the server at the moment you place the order.
                </p>
              </section>
            </div>

            {/* Summary */}
            <aside className="h-fit rounded-2xl border border-border/70 bg-card p-5 lg:sticky lg:top-24">
              <h2 className="mb-4 text-lg font-bold tracking-tight">Summary</h2>
              <ul className="flex flex-col gap-3">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="size-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {formatMoney(item.unitPrice)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatMoney(item.subtotal)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-2 border-t border-border/60 pt-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatMoney(totalMinor)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className="tabular-nums">
                    {shippingFee === 0 ? "Free" : formatMoney(shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-3 text-base font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatMoney(total)}</span>
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                className="mt-5 w-full cursor-pointer"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Placing order…
                  </>
                ) : (
                  `Place order · ${formatMoney(total)}`
                )}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                10% platform commission included · sellers receive the rest
              </p>
            </aside>
          </form>
        )}
      </main>
    </div>
  );
}
