import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { ORDER_STATUS_META, formatBaht, formatIsoDateTime } from "@/lib/commerce";
import { useAction } from "convex/react";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  ImageOff,
  MapPin,
  Package,
  Store,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";

interface OrderItemRow {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

interface TrackingEventRow {
  id: string;
  status: string;
  description: string | null;
  location: string | null;
  occurredAt: string;
}

interface ShipmentRow {
  id: string;
  carrier: string;
  trackingNumber: string | null;
  status: string;
  estimatedDeliveryDate: string | null;
  events?: TrackingEventRow[];
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  note: string | null;
  createdAt: string;
  addressSnapshot: {
    recipientName?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    subdistrict?: string;
    district?: string;
    province?: string;
    postalCode?: string;
  };
  items?: OrderItemRow[];
  shipments?: ShipmentRow[];
}

const ORDER_STEPS: Array<{ key: string; label: string; icon: typeof Clock3 }> = [
  { key: "pending", label: "รอตรวจสอบ", icon: Clock3 },
  { key: "confirmed", label: "ร้านกำลังเตรียมสินค้า", icon: Package },
  { key: "shipped", label: "กำลังจัดส่ง", icon: Truck },
  { key: "delivered", label: "จัดส่งแล้ว", icon: CheckCircle2 },
  { key: "completed", label: "เสร็จสิ้น", icon: CheckCircle2 },
];

const TRACKING_LABELS: Record<string, string> = {
  created: "สร้างพัสดุแล้ว",
  picked_up: "รับพัสดุแล้ว",
  in_transit: "อยู่ระหว่างขนส่ง",
  arrived_at_hub: "ถึงศูนย์คัดแยก",
  out_for_delivery: "กำลังนำส่ง",
  delivered: "ส่งถึงแล้ว",
  failed: "จัดส่งไม่สำเร็จ",
  returned: "ส่งคืนผู้ขาย",
  cancelled: "ยกเลิกการจัดส่ง",
};

export default function ShopOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const orderDetail = useAction(api.customer.orderDetail);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const data = (await orderDetail({ orderId })) as unknown as OrderDetail;
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถโหลดออเดอร์ได้");
    } finally {
      setLoading(false);
    }
  }, [orderId, orderDetail]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <ShopHeader />
        <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-40 rounded-2xl" />
          <Skeleton className="mt-4 h-40 rounded-2xl" />
        </main>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <ShopHeader />
        <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
            <Package className="size-7 text-slate-400" />
          </span>
          <h1 className="mt-5 text-xl font-bold text-slate-900">ไม่พบออเดอร์</h1>
          <p className="mt-2 text-sm text-slate-500">{error ?? "ออเดอร์นี้อาจไม่ใช่ของคุณ"}</p>
          <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
            <Link to="/shop/orders">
              <ArrowLeft className="size-4" />
              กลับไปออเดอร์ของฉัน
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  const meta = ORDER_STATUS_META[order.status as keyof typeof ORDER_STATUS_META] ?? ORDER_STATUS_META.pending;
  const items = order.items ?? [];
  const shipments = order.shipments ?? [];
  const stepIndex =
    order.status === "cancelled"
      ? -1
      : ORDER_STEPS.findIndex((s) => s.key === order.status);

  const addressText = [
    order.addressSnapshot.line1,
    order.addressSnapshot.line2,
    order.addressSnapshot.subdistrict,
    order.addressSnapshot.district,
    order.addressSnapshot.province,
    order.addressSnapshot.postalCode,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
              <Package className="size-4 text-[#10B981]" />
              ออเดอร์ {order.orderNumber}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">รายละเอียดออเดอร์</h1>
            <p className="mt-1 text-sm text-slate-500">สั่งเมื่อ {formatIsoDateTime(order.createdAt)}</p>
          </div>
          <Badge className={`gap-1.5 rounded-full ring-1 ring-inset ${meta.badge}`}>
            <span className={`size-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </Badge>
        </div>

        {/* Timeline */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold tracking-tight text-slate-900">ความคืบหน้าออเดอร์</h2>
          {order.status === "cancelled" ? (
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <Circle className="size-4 text-slate-400" />
              ออเดอร์นี้ถูกยกเลิก
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-1">
              {ORDER_STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = stepIndex >= i;
                return (
                  <div key={s.key} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span
                        className={`flex size-8 items-center justify-center rounded-full ${
                          done ? "bg-[#10B981] text-white" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className={`text-[11px] ${done ? "font-medium text-slate-900" : "text-slate-400"}`}>
                        {s.label}
                      </span>
                    </div>
                    {i < ORDER_STEPS.length - 1 && (
                      <span
                        className={`mx-2 mb-5 h-0.5 w-8 sm:w-12 ${stepIndex > i ? "bg-[#10B981]" : "bg-slate-200"}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Shipment tracking */}
        {shipments.length > 0 && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
              <Truck className="size-4 text-[#10B981]" />
              การติดตามพัสดุ
            </h2>
            {shipments.map((s) => (
              <div key={s.id} className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="font-semibold text-slate-900">{s.carrier}</p>
                  <p className="font-mono text-xs text-slate-500">{s.trackingNumber ?? "ยังไม่มีเลขพัสดุ"}</p>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  สถานะ: {TRACKING_LABELS[s.status] ?? s.status}
                  {s.estimatedDeliveryDate ? ` · คาดว่าถึง ${s.estimatedDeliveryDate}` : ""}
                </p>
                {s.events && s.events.length > 0 && (
                  <div className="mt-4 space-y-0">
                    {[...s.events].reverse().map((e, i) => (
                      <div key={e.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`mt-1 size-2.5 rounded-full ${i === 0 ? "bg-[#10B981]" : "bg-slate-300"}`} />
                          {i < s.events!.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm font-medium text-slate-900">
                            {TRACKING_LABELS[e.status.toLowerCase()] ?? e.status}
                          </p>
                          {e.description && <p className="mt-0.5 text-xs text-slate-500">{e.description}</p>}
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {e.location ? `${e.location} · ` : ""}
                            {formatIsoDateTime(e.occurredAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Items */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold tracking-tight text-slate-900">สินค้าในออเดอร์</h2>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-slate-50">
                    <ImageOff className="size-4 text-slate-300" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.productName}</p>
                    <p className="text-xs text-slate-400">
                      {formatBaht(item.unitPrice)} / {item.unit} × {item.quantity}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{formatBaht(item.subtotal)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">สินค้า</span>
              <span className="tabular-nums text-slate-900">{formatBaht(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">ค่าจัดส่ง</span>
              <span className="tabular-nums text-slate-900">{formatBaht(order.shippingFee)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="font-medium text-slate-500">รวมทั้งสิ้น</span>
              <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{formatBaht(order.total)}</span>
            </div>
          </div>
          {order.note && (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              หมายเหตุ: {order.note}
            </p>
          )}
        </section>

        {/* Address */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
            <MapPin className="size-4 text-[#10B981]" />
            ที่อยู่จัดส่ง
          </h2>
          <p className="mt-3 text-sm font-medium text-slate-900">
            {order.addressSnapshot.recipientName ?? ""}
            {order.addressSnapshot.phone ? ` · ${order.addressSnapshot.phone}` : ""}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{addressText || "—"}</p>
        </section>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="border-slate-200 text-slate-700" asChild>
            <Link to="/shop/orders">
              <ArrowLeft className="size-4" />
              กลับไปออเดอร์ของฉัน
            </Link>
          </Button>
          <Button className="bg-slate-900 text-white hover:bg-slate-800" asChild>
            <Link to="/shop">
              <Store className="size-4" />
              ซื้อสินค้าต่อ
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
