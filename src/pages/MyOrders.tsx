import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import {
  ORDER_STATUS_META,
  formatBaht,
  formatThaiDateTime,
  shortOrderId,
} from "@/lib/shop";
import { useQuery } from "convex/react";
import { PackageSearch, ShoppingBag } from "lucide-react";
import { Link } from "react-router";

export default function MyOrders() {
  const orders = useQuery(api.orders.myOrders);

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
            ติดตามสถานะออเดอร์ของคุณ — ร้านค้าจะยืนยันและติดต่อกลับ
          </p>
        </div>

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
          <div className="mt-8 space-y-4">
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
      </main>
    </div>
  );
}
