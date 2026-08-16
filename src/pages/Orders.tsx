import { Button } from "@/components/ui/button";
import { ShopNav } from "@/components/ShopNav";
import { CartDrawer } from "@/components/CartDrawer";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Loader2, Package, XCircle } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function Orders() {
  const orders = useQuery(api.orders.myOrders);
  const cancelOrder = useMutation(api.orders.cancelOrder);

  const handleCancel = async (orderId: string) => {
    try {
      await cancelOrder({ orderId: orderId as never });
      toast.success("Order cancelled", {
        description: "Stock has been released back to the sellers.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ShopNav />
      <CartDrawer />

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">
          Velshop
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">My orders</h1>

        {orders === undefined ? (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 py-24 text-center">
            <Package className="size-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">No orders yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your orders will appear here after checkout.
              </p>
            </div>
            <Button asChild variant="outline" className="cursor-pointer">
              <Link to="/shop">Start shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-5">
            {orders.map(({ order, items }) => (
              <div
                key={order._id}
                className="rounded-2xl border border-border/70 bg-card p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold tracking-tight">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(order._creationTime)} ·{" "}
                      {order.paymentMethod === "cod" ? "Cash on delivery" : "Card on delivery"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={order.status} />
                    {order.status === "PENDING" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer text-red-400 hover:text-red-300"
                        onClick={() => void handleCancel(order._id)}
                      >
                        <XCircle className="mr-1.5 size-4" /> Cancel
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4">
                  {items.map((item) => (
                    <div key={item._id} className="flex items-center gap-3">
                      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.productName}
                            className="size-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.productName}
                          {item.variantName ? ` — ${item.variantName}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × {formatMoney(item.unitPrice)}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                      <p className="w-24 text-right text-sm font-semibold tabular-nums">
                        {formatMoney(item.subtotal)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4 text-sm">
                  <span className="text-muted-foreground">
                    {order.shippingAddress
                      ? `${order.shippingAddress.name} · ${order.shippingAddress.province} ${order.shippingAddress.postalCode}`
                      : "Address on file"}
                  </span>
                  <span className="font-bold">
                    Total {formatMoney(order.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
