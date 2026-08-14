import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatThaiDate } from "@/lib/reorder";
import {
  ORDER_STATUS_META,
  formatBaht,
  formatThaiDateTime,
  shortOrderId,
} from "@/lib/shop";
import { useMutation, useQuery } from "convex/react";
import { CalendarClock, PackageSearch, ShoppingBag, XCircle } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function MyOrders() {
  const orders = useQuery(api.orders.myOrders);
  const subscriptions = useQuery(api.subscriptions.mySubscriptions);
  const cancelSubscription = useMutation(api.subscriptions.cancelSubscription);

  const handleCancel = async (subscriptionId: Id<"subscriptions">) => {
    try {
      await cancelSubscription({ subscriptionId });
      toast.success("ยกเลิกการสั่งรายเดือนแล้ว");
    } catch (error) {
      console.error("Cancel subscription error:", error);
      toast.error("ยกเลิกไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  };

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

          {subscriptions === undefined ? (
            <div className="mt-3 h-20 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ) : subscriptions.length === 0 ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
              <CalendarClock className="size-5 text-slate-300" />
              <p className="text-sm text-slate-500">
                ยังไม่มีการสั่งรายเดือน — กด "สั่งรายเดือน" บนการ์ดสินค้าเพื่อให้ระบบสั่งให้คุณทุกเดือน
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {subscriptions.map(({ subscription, product }) => {
                const daysLeft = Math.max(0, Math.round((subscription.nextOrderAt - Date.now()) / DAY_MS));
                return (
                  <div
                    key={subscription._id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {product?.name ?? "สินค้าถูกลบ"}{" "}
                        <span className="font-normal text-slate-400">× {subscription.quantity}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        ทุก {subscription.intervalDays} วัน · รอบถัดไป{" "}
                        {formatThaiDate(subscription.nextOrderAt)} ({daysLeft} วัน)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`gap-1.5 rounded-full ring-1 ring-inset ${
                          subscription.status === "active"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
                            : "bg-slate-100 text-slate-500 ring-slate-600/10"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            subscription.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {subscription.status === "active" ? "ใช้งานอยู่" : "ยกเลิกแล้ว"}
                      </Badge>
                      {subscription.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-slate-200 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => handleCancel(subscription._id)}
                        >
                          <XCircle className="size-3.5" />
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Order history */}
        <section className="mt-8">
          <h2 className="text-base font-semibold text-slate-900">ประวัติออเดอร์</h2>

        {orders === undefined ? (
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
            {orders.map(({ order, items }) => {
              const meta = ORDER_STATUS_META[order.status];
              return (
                <div
                  key={order._id}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        ออเดอร์ {shortOrderId(order._id)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatThaiDateTime(order.createdAt)} · {order.itemCount} ชิ้น
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
                        key={item._id}
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </section>
      </main>
    </div>
  );
}
