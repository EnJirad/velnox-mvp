import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@velnox/shared/components/ui/badge";
import { Button } from "@velnox/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@velnox/shared/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@velnox/shared/components/ui/dialog";
import { Skeleton } from "@velnox/shared/components/ui/skeleton";
import { Textarea } from "@velnox/shared/components/ui/textarea";
import { api } from "@convex/_generated/api";
import { ORDER_STATUS_META, formatBaht, formatIsoDateTime } from "@velnox/shared/lib/commerce";
import { useAction } from "convex/react";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  ImageOff,
  MapPin,
  Package,
  RefreshCw,
  RotateCcw,
  Star,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

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

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "ยังไม่ชำระ",
  pending: "รอชำระเงิน",
  paid: "ชำระแล้ว",
  partially_refunded: "คืนเงินบางส่วน",
  refunded: "คืนเงินแล้ว",
  failed: "ชำระไม่สำเร็จ",
};

const CANCELABLE = new Set(["pending", "confirmed"]);
const REVIEWABLE = new Set(["delivered", "completed"]);

export default function ShopOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const orderDetail = useAction(api.customer.orderDetail);
  const reorder = useAction(api.customer.reorderAction);
  const cancelOrder = useAction(api.commerce.cancelOrderAction);
  const requestReturn = useAction(api.customer.requestReturnAction);
  const reviewProduct = useAction(api.customer.reviewProduct);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // cancel dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  // return dialog
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnDesc, setReturnDesc] = useState("");
  // review dialog
  const [reviewTarget, setReviewTarget] = useState<OrderItemRow | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

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

  const handleCancel = async () => {
    if (!order) return;
    setBusy(true);
    try {
      await cancelOrder({ orderId: order.id });
      toast.success("ยกเลิกออเดอร์แล้ว");
      setCancelOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleBuyAgain = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const res = (await reorder({ orderId: order.id })) as unknown as {
        added: unknown[];
        skipped: { productName: string; reason: string }[];
      };
      if (res.added.length > 0) {
        toast.success(`เพิ่ม ${res.added.length} รายการลงตะกร้าแล้ว 🛒`);
      }
      if (res.skipped.length > 0) {
        toast.warning(`ข้าม ${res.skipped.length} รายการ (${res.skipped[0].reason})`, {
          description: res.skipped.map((s) => s.productName).join(", "),
        });
      }
      if (res.added.length === 0) {
        toast.error("ไม่สามารถสั่งซื้อซ้ำได้ — สินค้าหมดหรือถูกนำออก");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สั่งซื้อซ้ำไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitReturn = async () => {
    if (!order || !returnReason.trim()) return;
    setBusy(true);
    try {
      await requestReturn({
        orderId: order.id,
        items: (order.items ?? []).map((i) => ({ orderItemId: i.id, quantity: i.quantity })),
        reason: returnReason.trim(),
        description: returnDesc.trim() || undefined,
      });
      toast.success("ส่งคำขอคืนสินค้าแล้ว — ร้านค้าจะตรวจสอบภายใน 1–2 วัน");
      setReturnOpen(false);
      setReturnReason("");
      setReturnDesc("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ส่งคำขอคืนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!order || !reviewTarget) return;
    setBusy(true);
    try {
      await reviewProduct({
        productId: reviewTarget.productId,
        orderId: order.id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      toast.success("ส่งรีวิวแล้ว ขอบคุณสำหรับคำติชม 💚");
      setReviewTarget(null);
      setReviewComment("");
      setReviewRating(5);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ส่งรีวิวไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

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
  const stepIndex = order.status === "cancelled" ? -1 : ORDER_STEPS.findIndex((s) => s.key === order.status);

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
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`gap-1.5 rounded-full ring-1 ring-inset ${meta.badge}`}>
              <span className={`size-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </Badge>
            <Badge className="gap-1.5 rounded-full bg-white ring-1 ring-inset ring-slate-200">
              <span className="size-1.5 rounded-full bg-slate-400" />
              {PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}
            </Badge>
          </div>
        </div>

        {/* Timeline */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold tracking-tight text-slate-900">ความคืบหน้าออเดอร์</h2>
          {order.status === "cancelled" ? (
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <XCircle className="size-4 text-slate-400" />
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
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
                <Truck className="size-4 text-[#10B981]" />
                การติดตามพัสดุ
              </h2>
              <Button variant="outline" size="sm" className="gap-1.5 border-slate-200 text-slate-600" asChild>
                <Link to={`/shop/orders/${order.id}/tracking`}>
                  <Truck className="size-3.5" />
                  ดูไทม์ไลน์เต็ม
                </Link>
              </Button>
            </div>
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
                    {[...s.events].reverse().slice(0, 3).map((e, i) => (
                      <div key={e.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`mt-1 size-2.5 rounded-full ${i === 0 ? "bg-[#10B981]" : "bg-slate-300"}`} />
                          {i < 2 && <span className="w-px flex-1 bg-slate-200" />}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm font-medium text-slate-900">
                            {TRACKING_LABELS[e.status.toLowerCase()] ?? e.status}
                          </p>
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
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-sm font-bold tabular-nums text-slate-900">{formatBaht(item.subtotal)}</p>
                  {REVIEWABLE.has(order.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 border-slate-200 text-slate-600"
                      onClick={() => {
                        setReviewTarget(item);
                        setReviewRating(5);
                        setReviewComment("");
                      }}
                    >
                      <Star className="size-3.5" />
                      รีวิว
                    </Button>
                  )}
                </div>
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

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" className="border-slate-200 text-slate-700" asChild>
            <Link to="/shop/orders">
              <ArrowLeft className="size-4" />
              ออเดอร์ทั้งหมด
            </Link>
          </Button>
          {order.status !== "cancelled" && (
            <Button
              variant="outline"
              className="gap-1.5 border-slate-200 text-slate-700"
              onClick={handleBuyAgain}
              disabled={busy}
            >
              <RefreshCw className="size-4" />
              ซื้ออีกครั้ง
            </Button>
          )}
          {REVIEWABLE.has(order.status) && (
            <Button
              variant="outline"
              className="gap-1.5 border-slate-200 text-slate-700"
              onClick={() => setReturnOpen(true)}
              disabled={busy}
            >
              <RotateCcw className="size-4" />
              ขอคืนสินค้า
            </Button>
          )}
          {CANCELABLE.has(order.status) && (
            <Button
              variant="outline"
              className="ml-auto gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => setCancelOpen(true)}
              disabled={busy}
            >
              <XCircle className="size-4" />
              ยกเลิกออเดอร์
            </Button>
          )}
        </div>
      </main>

      {/* Cancel confirm */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>ยกเลิกออเดอร์นี้?</AlertDialogTitle>
            <AlertDialogDescription>
              ยกเลิกได้เฉพาะออเดอร์ที่ร้านค้ายังไม่ได้จัดส่ง — ระบบจะคืนสต็อกสินค้าทั้งหมดให้อัตโนมัติ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>ปิด</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={handleCancel} disabled={busy}>
              {busy ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return request */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">ขอคืนสินค้า / คืนเงิน</DialogTitle>
            <DialogDescription>
              กรอกเหตุผล — ร้านค้าจะตรวจสอบตามนโยบาย (Velnox คุ้มครองคืนสินค้าตามเงื่อนไขที่กำหนด)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-[10px] border border-slate-100 bg-slate-50 p-3 text-sm">
              {items.map((i) => (
                <div key={i.id} className="flex items-center justify-between py-1">
                  <span className="truncate pr-3 text-slate-700">{i.productName}</span>
                  <span className="shrink-0 text-xs text-slate-400">×{i.quantity}</span>
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">เหตุผล *</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#10B981]"
              >
                <option value="">เลือกเหตุผล...</option>
                <option value="สินค้าผิดหรือไม่ตรงตามที่สั่ง">สินค้าผิดหรือไม่ตรงตามที่สั่ง</option>
                <option value="สินค้าชำรุด/เสียหาย">สินค้าชำรุด / เสียหาย</option>
                <option value="ได้สินค้าไม่ครบ">ได้สินค้าไม่ครบ</option>
                <option value="เปลี่ยนใจไม่ต้องการแล้ว">เปลี่ยนใจไม่ต้องการแล้ว</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">รายละเอียดเพิ่มเติม</label>
              <Textarea
                value={returnDesc}
                onChange={(e) => setReturnDesc(e.target.value)}
                placeholder="อธิบายปัญหาเพิ่มเติม (ถ้ามี)"
                className="mt-1.5 rounded-[10px] border-slate-200 text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-200 text-slate-600" onClick={() => setReturnOpen(false)}>
              ปิด
            </Button>
            <Button
              className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              onClick={handleSubmitReturn}
              disabled={busy || !returnReason.trim()}
            >
              {busy ? "กำลังส่ง..." : "ส่งคำขอคืนสินค้า"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review */}
      <Dialog open={reviewTarget !== null} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent className="bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900">รีวิวสินค้า</DialogTitle>
            <DialogDescription>{reviewTarget?.productName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500">คะแนน</label>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReviewRating(i + 1)}
                    className="transition-transform hover:scale-110"
                    aria-label={`${i + 1} ดาว`}
                  >
                    <Star
                      className={`size-6 ${i < reviewRating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">ความคิดเห็น</label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="บอกประสบการณ์การใช้สินค้า..."
                className="mt-1.5 rounded-[10px] border-slate-200 text-sm"
                rows={3}
              />
            </div>
            <p className="rounded-[10px] bg-[#ECFDF5] px-3 py-2 text-xs text-emerald-700">
              รีวิวนี้จะแสดงว่า “ซื้อจริงแล้ว” ให้ลูกค้าคนอื่นมั่นใจ
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-200 text-slate-600" onClick={() => setReviewTarget(null)}>
              ปิด
            </Button>
            <Button
              className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              onClick={handleSubmitReview}
              disabled={busy}
            >
              {busy ? "กำลังส่ง..." : "ส่งรีวิว"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
