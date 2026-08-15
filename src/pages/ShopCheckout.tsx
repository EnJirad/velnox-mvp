import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/lib/cart";
import { useTracking } from "@/lib/track";
import { formatBaht } from "@/lib/commerce";
import { useAction } from "convex/react";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

interface AddressRow {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: string;
}

interface CheckoutResult {
  parentOrderId: string;
  parentOrderNumber: string;
  orders: Array<{ orderId: string; orderNumber: string; shopId: string; shopName: string; subtotal: number; shippingFee: number; total: number }>;
  total: number;
  itemCount: number;
}

const PAYMENT_METHODS: Array<{ id: string; label: string; desc: string; icon: typeof Banknote }> = [
  { id: "cod", label: "เก็บเงินปลายทาง (COD)", desc: "จ่ายเงินเมื่อได้รับสินค้า", icon: Banknote },
  { id: "promptpay", label: "พร้อมเพย์ (PromptPay)", desc: "สแกน QR / โอนผ่านเบอร์โทร", icon: QrCode },
  { id: "transfer", label: "โอนเงินผ่านธนาคาร", desc: "โอนแล้วแจ้งหลักฐานให้ร้านค้า", icon: CreditCard },
  { id: "card", label: "บัตรเครดิต / เดบิต", desc: "ชำระด้วยบัตร", icon: CreditCard },
];

function formatAddress(a: AddressRow): string {
  const parts = [a.line1, a.line2, a.subdistrict, a.district, a.province, a.postalCode].filter(Boolean);
  return parts.join(" · ");
}

export default function ShopCheckout() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { lines, total, count, clear, reload, syncing } = useCart();
  const myAddresses = useAction(api.customer.myAddresses);
  const checkoutAction = useAction(api.customer.checkoutAction);
  const navigate = useNavigate();
  const { track } = useTracking();

  const [addresses, setAddresses] = useState<AddressRow[] | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const loadAddresses = useCallback(async () => {
    try {
      const rows = (await myAddresses()) as unknown as AddressRow[];
      setAddresses(rows);
      const def = rows.find((a) => a.isDefault) ?? rows[0];
      setSelectedAddressId((prev) => prev ?? def?.id ?? null);
    } catch (err) {
      console.error("Load addresses error:", err);
      setAddresses([]);
    }
  }, [myAddresses]);

  useEffect(() => {
    if (isAuthenticated && addresses === null) void loadAddresses();
  }, [isAuthenticated, addresses, loadAddresses]);

  // CPNS: starting checkout is a strong intent signal.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || count === 0) return;
    checkoutTracked.current = true;
    track("CHECKOUT_START", {
      value: `สินค้า ${count} ชิ้น`,
      context: { itemCount: count, total },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const selectedAddress = useMemo(
    () => addresses?.find((a) => a.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );
  const hasGps = selectedAddress?.latitude != null && selectedAddress.longitude != null;

  const grouped = useMemo(() => {
    const map = new Map<string, typeof lines>();
    for (const line of lines) {
      const key = line.shopName ?? "ร้านค้า Velnox";
      const list = map.get(key) ?? [];
      list.push(line);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [lines]);

  const handleSubmit = async () => {
    if (!selectedAddressId) {
      toast.error("กรุณาเลือกที่อยู่จัดส่งก่อน");
      return;
    }
    if (!hasGps) {
      toast.error("ที่อยู่นี้ยังไม่มีพิกัด GPS — กรุณาไปเพิ่มที่อยู่และเลือกตำแหน่งบนแผนที่");
      return;
    }
    setSubmitting(true);
    try {
      const res = (await checkoutAction({
        addressId: selectedAddressId,
        paymentMethod,
        shippingFee: 0,
      })) as unknown as CheckoutResult;
      setResult(res);
      clear();
      toast.success("สั่งซื้อสำเร็จ! 🎉");
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error(
        err instanceof Error ? err.message : "สั่งซื้อไม่สำเร็จ — ราคาหรือสต็อกอาจมีการเปลี่ยนแปลง กรุณาตรวจสอบอีกครั้ง",
      );
      reload();
    } finally {
      setSubmitting(false);
    }
  };

  // ---- success screen -----------------------------------------------------
  if (result) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <ShopHeader />
        <main className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-[#ECFDF5]">
              <CheckCircle2 className="size-8 text-[#10B981]" />
            </span>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">สั่งซื้อสำเร็จ!</h1>
            <p className="mt-2 text-sm text-slate-500">
              ขอบคุณสำหรับคำสั่งซื้อ — ร้านค้าจะยืนยันและเตรียมสินค้าให้เร็วที่สุด
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">เลขที่ออเดอร์</p>
              <p className="font-mono text-sm font-semibold text-slate-900">{result.parentOrderNumber}</p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-slate-500">รวมทั้งสิ้น ({result.itemCount} ชิ้น)</p>
              <p className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{formatBaht(result.total)}</p>
            </div>

            <div className="mt-5 space-y-2 border-t border-slate-100 pt-5">
              {result.orders.map((o) => (
                <div key={o.orderId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                    <Store className="size-3.5 shrink-0 text-[#10B981]" />
                    <span className="truncate">{o.shopName}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-slate-900">{formatBaht(o.total)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
              <Link to="/shop/orders">ติดตามออเดอร์</Link>
            </Button>
            <Button variant="outline" className="flex-1 border-slate-200 text-slate-700" asChild>
              <Link to="/shop">ซื้อสินค้าต่อ</Link>
            </Button>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            ชำระเงิน {PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label} · ร้านค้าจะยืนยันการชำระเงินเมื่อได้รับ
          </p>
        </main>
      </div>
    );
  }

  // ---- empty cart ---------------------------------------------------------
  if (!syncing && !authLoading && isAuthenticated && count === 0) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <ShopHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
            <ShoppingBag className="size-7 text-slate-400" />
          </span>
          <h1 className="mt-5 text-xl font-bold text-slate-900">ตะกร้าของคุณว่างเปล่า</h1>
          <p className="mt-2 text-sm text-slate-500">เพิ่มสินค้าก่อน แล้วกลับมาที่หน้านี้เพื่อสั่งซื้อ</p>
          <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
            <Link to="/shop">
              <ArrowLeft className="size-4" />
              กลับไปเลือกสินค้า
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-9 text-slate-500" asChild>
            <Link to="/shop/cart" aria-label="กลับไปตะกร้า">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ชำระเงิน</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              เลือกที่อยู่จัดส่ง + วิธีชำระเงิน แล้วยืนยันคำสั่งซื้อ
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            {/* Address */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
                  <MapPin className="size-4 text-[#10B981]" />
                  ที่อยู่จัดส่ง
                </h2>
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-[#10B981] hover:bg-[#ECFDF5]" asChild>
                  <Link to="/shop/addresses">จัดการที่อยู่</Link>
                </Button>
              </div>

              {addresses === null ? (
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                </div>
              ) : addresses.length === 0 ? (
                <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
                  <MapPin className="size-6 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-600">ยังไม่มีที่อยู่</p>
                  <p className="mt-1 text-xs text-slate-400">
                    เพิ่มที่อยู่พร้อมเลือกตำแหน่งบนแผนที่ (ต้องมีพิกัด GPS)
                  </p>
                  <Button variant="outline" size="sm" className="mt-4 border-slate-200 text-slate-700" asChild>
                    <Link to="/shop/addresses">เพิ่มที่อยู่</Link>
                  </Button>
                </div>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {addresses.map((a) => {
                    const gps = a.latitude != null && a.longitude != null;
                    const active = a.id === selectedAddressId;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAddressId(a.id)}
                        className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
                          active
                            ? "border-[#10B981] bg-[#F0FDF9]"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                        aria-pressed={active}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            {a.label}
                            {a.isDefault && (
                              <Badge className="rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-600/10 hover:bg-slate-100">
                                หลัก
                              </Badge>
                            )}
                            {!gps && (
                              <Badge className="rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15 hover:bg-amber-50">
                                ยังไม่มี GPS
                              </Badge>
                            )}
                          </p>
                          <span
                            className={`size-4 shrink-0 rounded-full border-2 ${
                              active ? "border-[#10B981] bg-[#10B981]" : "border-slate-300 bg-white"
                            }`}
                          />
                        </div>
                        <p className="mt-1 text-sm leading-5 text-slate-600">{formatAddress(a)}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {a.recipientName} · {a.phone}
                        </p>
                      </button>
                    );
                  })}
                  {!hasGps && selectedAddress && (
                    <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <MapPin className="size-3.5" />
                      ที่อยู่นี้ต้องมีพิกัด GPS ถึงจะสั่งซื้อได้ — ไปหน้า "จัดการที่อยู่" แล้วเลือกตำแหน่งบนแผนที่
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Payment */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
                <CreditCard className="size-4 text-[#10B981]" />
                วิธีชำระเงิน
              </h2>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                        active
                          ? "border-[#10B981] bg-[#F0FDF9]"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                      aria-pressed={active}
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${
                          active ? "bg-[#10B981] text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{m.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">{m.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {user?.email ? `ยืนยันออเดอร์ด้วยบัญชี ${user.email}` : ""} — สถานะการชำระเงินจะแสดงในหน้าติดตามออเดอร์
              </p>
            </section>
          </div>

          {/* Review */}
          <div className="lg:col-span-2">
            <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-bold tracking-tight text-slate-900">สรุปคำสั่งซื้อ</h2>

              <div className="mt-4 space-y-4">
                {grouped.map(([shopName, shopLines]) => (
                  <div key={shopName}>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Store className="size-3.5 text-[#10B981]" />
                      {shopName}
                    </p>
                    <div className="mt-2 space-y-2">
                      {shopLines.map((line) => (
                        <div key={line.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-slate-600">
                            {line.name}{" "}
                            <span className="text-slate-400">
                              × {line.qty} {line.unit}
                            </span>
                          </span>
                          <span className="shrink-0 font-medium tabular-nums text-slate-900">
                            {formatBaht(line.qty * line.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">สินค้า ({count} ชิ้น)</span>
                  <span className="font-medium tabular-nums text-slate-900">{formatBaht(total)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ค่าจัดส่ง</span>
                  <span className="text-slate-400">0 ฿ (ร้านค้าจะแจ้งเพิ่มถ้ามี)</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm font-medium text-slate-500">รวมทั้งสิ้น</span>
                  <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                    {formatBaht(total)}
                  </span>
                </div>
              </div>

              <Button
                className="mt-5 w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                onClick={handleSubmit}
                disabled={submitting || count === 0 || addresses === null}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    กำลังสร้างออเดอร์...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
                    ยืนยันสั่งซื้อ · {formatBaht(total)}
                  </>
                )}
              </Button>
              <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">
                ราคาและสต็อกจะถูกตรวจสอบใหม่จากระบบก่อนยืนยัน — ถ้ามีการเปลี่ยนแปลง ระบบจะแจ้งให้คุณทราบ
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
