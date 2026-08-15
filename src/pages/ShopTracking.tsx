import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatIsoDateTime } from "@/lib/commerce";
import { useAction } from "convex/react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";

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

interface OrderForTracking {
  id: string;
  orderNumber: string;
  status: string;
  shippingStatus: string;
  shipments?: ShipmentRow[];
}

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

export default function ShopTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const orderDetail = useAction(api.customer.orderDetail);
  const [order, setOrder] = useState<OrderForTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const data = (await orderDetail({ orderId })) as unknown as OrderForTracking;
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลการติดตามได้");
    } finally {
      setLoading(false);
    }
  }, [orderId, orderDetail]);

  useEffect(() => {
    void load();
  }, [load]);

  const shipments = order?.shipments ?? [];
  const anyEvents = shipments.some((s) => (s.events?.length ?? 0) > 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : error || !order ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <Truck className="size-8 text-slate-300" />
            <h1 className="mt-4 text-lg font-semibold text-slate-900">ไม่พบข้อมูลการติดตาม</h1>
            <p className="mt-1.5 text-sm text-slate-500">{error ?? "ออเดอร์นี้อาจไม่ใช่ของคุณ"}</p>
            <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
              <Link to="/shop/orders">
                <ArrowLeft className="size-4" />
                กลับไปออเดอร์ของฉัน
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
                  <Truck className="size-4 text-[#10B981]" />
                  การติดตามพัสดุ · ออเดอร์ {order.orderNumber}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">ติดตามสถานะการจัดส่ง</h1>
              </div>
              <Button variant="outline" className="border-slate-200 text-slate-600" asChild>
                <Link to={`/shop/orders/${order.id}`}>
                  <Package className="size-4" />
                  รายละเอียดออเดอร์
                </Link>
              </Button>
            </div>

            {shipments.length === 0 || !anyEvents ? (
              <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-50">
                  <Package className="size-7 text-slate-400" />
                </span>
                <h2 className="mt-5 text-lg font-semibold text-slate-900">ร้านค้ายังไม่ได้จัดส่ง</h2>
                <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
                  เมื่อร้านค้าส่งพัสดุและอัปเดตเลขพัสดุ ระบบจะแสดงไทม์ไลน์การติดตามที่นี่
                </p>
              </div>
            ) : (
              <div className="mt-8 space-y-6">
                {shipments.map((s) => {
                  const events = [...(s.events ?? [])].reverse();
                  return (
                    <section key={s.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                            <Truck className="size-4 text-[#10B981]" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{s.carrier}</p>
                            <p className="font-mono text-xs text-slate-500">{s.trackingNumber ?? "ยังไม่มีเลขพัสดุ"}</p>
                          </div>
                        </div>
                        <Badge className="gap-1.5 rounded-full bg-[#ECFDF5] text-emerald-700 ring-1 ring-inset ring-emerald-600/15 hover:bg-[#ECFDF5]">
                          <span className="size-1.5 rounded-full bg-[#10B981]" />
                          {TRACKING_LABELS[s.status] ?? s.status}
                        </Badge>
                      </div>

                      {s.estimatedDeliveryDate && (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock3 className="size-3.5" />
                          คาดว่าจะถึง: {formatIsoDateTime(s.estimatedDeliveryDate)}
                        </p>
                      )}

                      <div className="mt-6">
                        {events.map((e, i) => {
                          const isLatest = i === 0;
                          const done = isLatest;
                          return (
                            <div key={e.id} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <span
                                  className={`mt-1 flex size-6 items-center justify-center rounded-full ${
                                    done ? "bg-[#10B981] text-white" : "bg-slate-100 text-slate-400"
                                  }`}
                                >
                                  {done ? <CheckCircle2 className="size-3.5" /> : <span className="size-2 rounded-full bg-slate-300" />}
                                </span>
                                {i < events.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                              </div>
                              <div className={`pb-6 ${i === events.length - 1 ? "pb-0" : ""}`}>
                                <p className={`text-sm font-medium ${done ? "text-slate-900" : "text-slate-600"}`}>
                                  {TRACKING_LABELS[e.status.toLowerCase()] ?? e.status}
                                </p>
                                {e.description && <p className="mt-0.5 text-xs text-slate-500">{e.description}</p>}
                                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                                  {e.location && (
                                    <>
                                      <MapPin className="size-3" />
                                      {e.location} ·
                                    </>
                                  )}
                                  {formatIsoDateTime(e.occurredAt)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
