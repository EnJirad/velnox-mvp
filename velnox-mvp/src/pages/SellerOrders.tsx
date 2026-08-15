import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  NEXT_ORDER_STATUSES,
  ORDER_STATUS_META,
  formatBaht,
  formatIsoDate,
  formatIsoDateTime,
  shortOrderNumber,
  type StoreOrder,
  type StoreOrderStatus,
  type StoreSubscription,
} from "@/lib/commerce";
import { useAction } from "convex/react";
import {
  CalendarClock,
  Inbox,
  Loader2,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function SellerOrders() {
  const sellerOrdersAction = useAction(api.commerce.sellerOrders);
  const sellerSubscriptionsAction = useAction(api.commerce.sellerSubscriptions);
  const setOrderStatus = useAction(api.commerce.setOrderStatus);
  const processDue = useAction(api.commerce.processDueSubscriptions);

  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [subscriptions, setSubscriptions] = useState<StoreSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  // "now" captured outside render so subscription due-dates are pure
  const [now, setNow] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  const load = useCallback(async () => {
    const [o, s] = await Promise.all([
      sellerOrdersAction({ limit: 50 }),
      sellerSubscriptionsAction(),
    ]);
    setOrders(o);
    setSubscriptions(s);
  }, [sellerOrdersAction, sellerSubscriptionsAction]);

  useEffect(() => {
    let alive = true;
    Promise.all([sellerOrdersAction({ limit: 50 }), sellerSubscriptionsAction()])
      .then(([o, s]) => {
        if (!alive) return;
        setOrders(o);
        setSubscriptions(s);
      })
      .catch((err) => console.error("Load seller orders error:", err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sellerOrdersAction, sellerSubscriptionsAction]);

  const handleStatusChange = async (orderId: string, status: StoreOrderStatus) => {
    setChangingId(orderId);
    try {
      await setOrderStatus({ orderId, status });
      toast.success("อัปเดตสถานะออเดอร์แล้ว");
      await load();
    } catch (error) {
      console.error("Update order status error:", error);
      toast.error(error instanceof Error ? error.message : "อัปเดตไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setChangingId(null);
    }
  };

  const handleProcessDue = async () => {
    setProcessing(true);
    try {
      const result = await processDue();
      toast.success(
        result.created > 0
          ? `สร้างออเดอร์รายเดือนแล้ว ${result.created} ออเดอร์${result.skipped > 0 ? ` (ข้าม ${result.skipped} — สต็อกไม่พอ)` : ""}`
          : result.skipped > 0
            ? `ข้าม ${result.skipped} ออเดอร์ (สต็อกไม่พอ)`
            : "ยังไม่มีรอบครบกำหนด",
      );
      await load();
    } catch (error) {
      console.error("Process due subscriptions error:", error);
      toast.error(error instanceof Error ? error.message : "ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setProcessing(false);
    }
  };

  const nextStatuses = (status: StoreOrderStatus) => NEXT_ORDER_STATUSES[status] ?? [];

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
            ออเดอร์จาก velshop จะมาโผล่ที่นี่ — ยืนยัน จัดส่ง และติดตามจนเสร็จสิ้น
          </p>
        </div>

        {/* Monthly subscriptions (velshop สั่งรายเดือน) */}
        <section className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                <CalendarClock className="size-4 text-[#10B981]" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">การสั่งรายเดือนของลูกค้า</h2>
                <p className="text-xs text-slate-400">
                  ลูกค้าสมัครรับสินค้าเป็นรอบ — กดสร้างออเดอร์เมื่อถึงรอบครบกำหนด
                </p>
              </div>
            </div>
            <Button
              className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              onClick={handleProcessDue}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              สร้างออเดอร์รอบครบกำหนด
            </Button>
          </div>

          {loading ? (
            <div className="mt-3 flex h-20 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <Loader2 className="size-5 animate-spin text-slate-300" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
              <CalendarClock className="size-5 text-slate-300" />
              <p className="text-sm text-slate-500">ยังไม่มีลูกค้าสมัครสั่งรายเดือน</p>
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-slate-400">ลูกค้า</TableHead>
                    <TableHead className="text-slate-400">สินค้า</TableHead>
                    <TableHead className="text-slate-400">รอบ</TableHead>
                    <TableHead className="pr-5 text-right text-slate-400">รอบถัดไป</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => {
                    const due = new Date(`${sub.nextOrderDate}T00:00:00`).getTime() - now;
                    return (
                      <TableRow key={sub.id} className="hover:bg-slate-50/60">
                        <TableCell className="pl-5">
                          <p className="font-medium text-slate-900">{sub.customerName || "สมาชิก"}</p>
                          <p className="text-xs text-slate-400">{sub.customerEmail ?? "—"}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-slate-600">
                            {sub.productName ?? "สินค้าถูกลบ"}{" "}
                            <span className="text-slate-400">× {sub.quantity}</span>
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-slate-600">ทุก {sub.intervalDays} วัน</p>
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <p className="text-sm text-slate-600">{formatIsoDate(sub.nextOrderDate)}</p>
                          <p className={`text-xs ${due <= 0 ? "font-medium text-rose-600" : "text-slate-400"}`}>
                            {due <= 0 ? "ถึงรอบแล้ว" : `อีก ${Math.max(0, Math.round(due / DAY_MS))} วัน`}
                          </p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Customer orders */}
        <section className="mt-8">
          <h2 className="text-base font-semibold text-slate-900">ออเดอร์ของลูกค้า</h2>

          {loading ? (
            <div className="mt-3 space-y-4">
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
              {orders.map((order) => {
                const meta = ORDER_STATUS_META[order.status];
                const items = order.items ?? [];
                const next = nextStatuses(order.status);
                const done = next.length === 0;
                return (
                  <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            ออเดอร์ {shortOrderNumber(order.orderNumber)}
                          </p>
                          <Badge className={`gap-1.5 rounded-full ring-1 ring-inset ${meta.badge}`}>
                            <span className={`size-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatIsoDateTime(order.createdAt)} · {order.itemCount ?? items.reduce((s, i) => s + i.quantity, 0)} ชิ้น
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">สถานะ:</span>
                        {done ? (
                          <span className="text-sm font-medium text-slate-400">สิ้นสุด</span>
                        ) : (
                          <Select
                            value={order.status}
                            onValueChange={(v) => handleStatusChange(order.id, v as StoreOrderStatus)}
                            disabled={changingId === order.id}
                          >
                            <SelectTrigger className="h-9 w-40 rounded-[10px] border-slate-200 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {next.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {ORDER_STATUS_META[s].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Customer + items */}
                    <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ลูกค้า</p>
                        <p className="mt-1.5 text-sm font-medium text-slate-900">
                          {order.customerName || "ลูกค้า"}
                        </p>
                        <p className="text-sm text-slate-500">{order.customerPhone}</p>
                        {order.addressSnapshot?.line1 && (
                          <p className="mt-1 text-xs leading-5 text-slate-400">{order.addressSnapshot.line1}</p>
                        )}
                        {order.note && (
                          <p className="mt-2 rounded-[10px] bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            📝 {order.note}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">รายการสินค้า</p>
                        <div className="mt-1.5 space-y-1">
                          {items.map((item) => (
                            <p key={item.id} className="text-sm text-slate-600">
                              {item.productName}{" "}
                              <span className="text-slate-400">
                                × {item.quantity} {item.unit}
                              </span>
                              <span className="ml-2 tabular-nums text-slate-900">{formatBaht(item.subtotal)}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-sm text-slate-500">รวมทั้งสิ้น (สินค้าของคุณ)</span>
                      <p className="text-lg font-bold tabular-nums tracking-tight text-slate-900">
                        {formatBaht(items.reduce((s, i) => s + i.subtotal, 0))}
                      </p>
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
