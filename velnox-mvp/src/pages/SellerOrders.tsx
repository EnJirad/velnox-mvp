import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ORDER_STATUS_META,
  formatBaht,
  formatThaiDate,
  shortOrderId,
  type OrderStatus,
} from "@/lib/shop";
import { useMutation, useQuery } from "convex/react";
import { Inbox, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS: OrderStatus[] = ["pending", "confirmed", "completed", "cancelled"];

export default function SellerOrders() {
  const orders = useQuery(api.orders.allOrders);
  const updateStatus = useMutation(api.orders.updateStatus);

  const handleStatusChange = async (orderId: Id<"orders">, status: OrderStatus) => {
    try {
      await updateStatus({ orderId, status });
      toast.success("อัปเดตสถานะออเดอร์แล้ว");
    } catch (error) {
      console.error("Update order status error:", error);
      toast.error("อัปเดตไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
            <ShoppingBag className="size-4 text-[#10B981]" />
            velseller · ออเดอร์จากหน้าร้าน
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            ออเดอร์ของลูกค้า
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            ออเดอร์จาก velshop จะมาโผล่ที่นี่ — ยืนยันและติดตามจนเสร็จสิ้น
          </p>
        </div>

        {orders === undefined ? (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
              <Inbox className="size-7 text-[#10B981]" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">ยังไม่มีออเดอร์</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              เมื่อลูกค้าสั่งซื้อจากหน้าร้าน velshop ออเดอร์จะปรากฏที่นี่
            </p>
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
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          ออเดอร์ {shortOrderId(order._id)}
                        </p>
                        <Badge className={`gap-1.5 rounded-full ring-1 ring-inset ${meta.badge}`}>
                          <span className={`size-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatThaiDate(order.createdAt)} · {order.itemCount} ชิ้น
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">สถานะ:</span>
                      <Select
                        value={order.status}
                        onValueChange={(v) => handleStatusChange(order._id, v as OrderStatus)}
                      >
                        <SelectTrigger className="h-9 w-36 rounded-[10px] border-slate-200 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {ORDER_STATUS_META[s].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Customer + items */}
                  <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        ลูกค้า
                      </p>
                      <p className="mt-1.5 text-sm font-medium text-slate-900">
                        {order.customerName}
                      </p>
                      <p className="text-sm text-slate-500">{order.customerPhone}</p>
                      {order.customerAddress && (
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          {order.customerAddress}
                        </p>
                      )}
                      {order.note && (
                        <p className="mt-2 rounded-[10px] bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          📝 {order.note}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        รายการสินค้า
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {items.map((item) => (
                          <p key={item._id} className="text-sm text-slate-600">
                            {item.productName}{" "}
                            <span className="text-slate-400">
                              × {item.quantity} {item.unit}
                            </span>
                            <span className="ml-2 tabular-nums text-slate-900">
                              {formatBaht(item.subtotal)}
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm text-slate-500">รวมทั้งสิ้น</span>
                    <p className="text-lg font-bold tabular-nums tracking-tight text-slate-900">
                      {formatBaht(order.total)}
                    </p>
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
