import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@velnox/shared/components/ui/badge";
import { Button } from "@velnox/shared/components/ui/button";
import { api } from "@convex/_generated/api";
import { useAction } from "convex/react";
import {
  ORDER_STATUS_META,
  formatBaht,
  formatIsoDate,
  formatIsoDateTime,
  shortOrderNumber,
  type StoreOrder,
  type StoreSubscription,
} from "@velnox/shared/lib/commerce";
import {
  CalendarClock,
  ImageOff,
  Loader2,
  PackageSearch,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

interface Loaded {
  orders: StoreOrder[];
  subscriptions: StoreSubscription[];
}

export default function MyOrders() {
  const myOrdersAction = useAction(api.commerce.myOrders);
  const mySubscriptionsAction = useAction(api.commerce.mySubscriptions);
  const pauseSubscription = useAction(api.commerce.pauseSubscription);

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [orders, subscriptions] = await Promise.all([
      myOrdersAction({ limit: 50 }),
      mySubscriptionsAction(),
    ]);
    setData({ orders, subscriptions });
  }, [myOrdersAction, mySubscriptionsAction]);

  useEffect(() => {
    let alive = true;
    Promise.all([myOrdersAction({ limit: 50 }), mySubscriptionsAction()])
      .then(([orders, subscriptions]) => alive && setData({ orders, subscriptions }))
      .catch((err) => console.error("Load orders error:", err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [myOrdersAction, mySubscriptionsAction]);

  const orders = data?.orders ?? [];
  const subscriptions = data?.subscriptions ?? [];

  const handleCancel = async (subscriptionId: string) => {
    setCancellingId(subscriptionId);
    try {
      await pauseSubscription({ subscriptionId, status: "cancelled" });
      toast.success("ยกเลิกการสั่งรายเดือนแล้ว");
      await load();
    } catch (error) {
      console.error("Cancel subscription error:", error);
      toast.error("ยกเลิกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setCancellingId(null);
    }
  };

  const daysLeft = useMemo(
    () => (nextOrderDate: string) => {
      const diff = new Date(`${nextOrderDate}T00:00:00`).getTime() - Date.now();
      return Math.max(0, Math.round(diff / (24 * 60 * 60 * 1000)));
    },
    [],
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
            <ShoppingBag className="size-4 text-[#10B981]" />
            velshop · ออเดอร์ของฉัน
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            ออเดอร์ของฉัน
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            ติดตามสถานะออเดอร์และการสั่งรายเดือนของคุณ
          </p>
        </div>

        {/* Monthly subscriptions */}
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
              <CalendarClock className="size-4 text-[#10B981]" />
            </span>
            <h2 className="text-base font-semibold text-slate-900">การสั่งรายเดือนของฉัน</h2>
          </div>

          {loading ? (
            <div className="mt-3 flex h-20 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <Loader2 className="size-5 animate-spin text-slate-300" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
              <CalendarClock className="size-5 text-slate-300" />
              <p className="text-sm text-slate-500">
                ยังไม่มีการสั่งรายเดือน — กด "สั่งรายเดือน" บนการ์ดสินค้าเพื่อให้ระบบสั่งให้คุณทุกเดือน
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    {sub.productImageUrl ? (
                      <img
                        src={sub.productImageUrl}
                        alt=""
                        className="size-12 shrink-0 rounded-[10px] object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-slate-100">
                        <ImageOff className="size-5 text-slate-300" />
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {sub.productName ?? "สินค้าถูกลบ"}{" "}
                        <span className="font-normal text-slate-400">× {sub.quantity}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        ทุก {sub.intervalDays} วัน · รอบถัดไป {formatIsoDate(sub.nextOrderDate)}{" "}
                        ({daysLeft(sub.nextOrderDate)} วัน)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`gap-1.5 rounded-full ring-1 ring-inset ${
                        sub.status === "active"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
                          : "bg-slate-100 text-slate-500 ring-slate-600/10"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          sub.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                      {sub.status === "active" ? "ใช้งานอยู่" : "ยกเลิกแล้ว"}
                    </Badge>
                    {sub.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-slate-200 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => handleCancel(sub.id)}
                        disabled={cancellingId === sub.id}
                      >
                        {cancellingId === sub.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <XCircle className="size-3.5" />
                        )}
                        ยกเลิก
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Order history */}
        <section className="mt-8">
          <h2 className="text-base font-semibold text-slate-900">ประวัติออเดอร์</h2>

          {loading ? (
            <div className="mt-8 space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
                <PackageSearch className="size-7 text-[#10B981]" />
              </span>
              <h2 className="mt-5 text-lg font-semibold text-slate-900">ยังไม่มีออเดอร์</h2>
              <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
                เมื่อคุณสั่งซื้อสินค้า ออเดอร์จะปรากฏที่นี่พร้อมสถานะ
              </p>
              <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
                <Link to="/shop">
                  <ShoppingBag className="size-4" />
                  ไปเลือกสินค้า
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {orders.map((order: StoreOrder) => {
                const meta = ORDER_STATUS_META[order.status];
                const items = order.items ?? [];
                return (
                  <Link
                    key={order.id}
                    to={`/shop/orders/${order.id}`}
                    className="block rounded-xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#10B981]/40 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          ออเดอร์ {shortOrderNumber(order.orderNumber)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatIsoDateTime(order.createdAt)} · {order.itemCount ?? items.reduce((s, i) => s + i.quantity, 0)} ชิ้น
                        </p>
                      </div>
                      <Badge className={`gap-1.5 rounded-full ring-1 ring-inset ${meta.badge}`}>
                        <span className={`size-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="min-w-0 truncate text-slate-600">
                            {item.productName}{" "}
                            <span className="text-slate-400">
                              × {item.quantity} {item.unit}
                            </span>
                          </span>
                          <span className="shrink-0 font-medium tabular-nums text-slate-900">
                            {formatBaht(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-sm text-slate-500">รวมทั้งสิ้น</span>
                      <span className="text-lg font-bold tabular-nums tracking-tight text-slate-900">
                        {formatBaht(order.total)}
                      </span>
                      <span className="text-xs font-medium text-[#10B981]">ดูรายละเอียด →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
