import { AppHeader } from "@velnox/shared/components/AppHeader";
import { Badge } from "@velnox/shared/components/ui/badge";
import { Button } from "@velnox/shared/components/ui/button";
import { api } from "@convex/_generated/api";
import { PRODUCT_CATEGORY_META, formatBaht } from "@velnox/shared/lib/commerce";
import { useAction } from "convex/react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Package,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ReorderSuggestion {
  product: {
    id: string;
    name: string;
    category: string;
    price: number;
    unit: string;
    status: string;
    primaryImage?: { thumbUrl?: string; url: string } | null;
    inventory?: { available: number; quantity: number; reorderLevel: number };
  };
  available: number;
  reorderLevel: number;
  lowStock: boolean;
  outOfStock: boolean;
  purchaseCount: number;
  unitsSold: number;
  lastPurchaseAt: string | null;
  avgCycleDays: number | null;
  estimatedNextPurchase: string | null;
  confidence: "high" | "medium" | "low" | "not_enough_data";
  due: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function shortDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

const CONFIDENCE_META: Record<
  ReorderSuggestion["confidence"],
  { label: string; className: string }
> = {
  high: { label: "มั่นใจสูง", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  medium: { label: "มั่นใจปานกลาง", className: "bg-sky-50 text-sky-700 ring-sky-600/15" },
  low: { label: "ข้อมูลน้อย", className: "bg-amber-50 text-amber-700 ring-amber-600/15" },
  not_enough_data: { label: "ข้อมูลไม่พอ", className: "bg-slate-100 text-slate-500 ring-slate-600/10" },
};

export default function Reorder() {
  const sellerReorder = useAction(api.commerce.sellerReorderSuggestionsAction);
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[] | null>(null);

  useEffect(() => {
    let alive = true;
    sellerReorder()
      .then((rows) => alive && setSuggestions(rows as unknown as ReorderSuggestion[]))
      .catch((error) => {
        console.error("Reorder load error:", error);
        alive && setSuggestions([]);
      });
    return () => {
      alive = false;
    };
  }, [sellerReorder]);

  const { due, upcoming, noData } = useMemo(() => {
    const list = suggestions ?? [];
    const dueList: ReorderSuggestion[] = [];
    const upcomingList: ReorderSuggestion[] = [];
    const noDataList: ReorderSuggestion[] = [];
    for (const s of list) {
      if (s.due) {
        dueList.push(s);
      } else if (
        s.estimatedNextPurchase !== null &&
        new Date(s.estimatedNextPurchase).getTime() - Date.now() <= 14 * DAY_MS
      ) {
        upcomingList.push(s);
      } else if (s.purchaseCount === 0) {
        noDataList.push(s);
      }
    }
    return { due: dueList, upcoming: upcomingList, noData: noDataList };
  }, [suggestions]);

  if (suggestions === null) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <AppHeader />
        <main className="flex min-h-[60vh] items-center justify-center px-4">
          <Loader2 className="size-6 animate-spin text-slate-300" />
        </main>
      </div>
    );
  }

  const stats = [
    { icon: AlertTriangle, label: "ต้องสั่งซื้อซ้ำ", value: due.length, accent: "text-rose-600", chip: "bg-rose-50" },
    { icon: CalendarClock, label: "กำลังจะถึงกำหนด", value: upcoming.length, accent: "text-amber-600", chip: "bg-amber-50" },
    { icon: Package, label: "สินค้าทั้งหมด", value: suggestions.length, accent: "text-slate-700", chip: "bg-slate-100" },
    { icon: ShoppingBag, label: "สินค้าที่มีประวัติขาย", value: suggestions.filter((s) => s.purchaseCount > 0).length, accent: "text-emerald-600", chip: "bg-emerald-50" },
  ];

  const Card = ({ s }: { s: ReorderSuggestion }) => {
    const meta = PRODUCT_CATEGORY_META[s.product.category as keyof typeof PRODUCT_CATEGORY_META] ?? PRODUCT_CATEGORY_META.general;
    const conf = CONFIDENCE_META[s.confidence];
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200">
        <div className="flex items-start gap-3">
          {s.product.primaryImage ? (
            <img
              src={s.product.primaryImage.thumbUrl || s.product.primaryImage.url}
              alt={s.product.name}
              className="size-12 shrink-0 rounded-[10px] object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-slate-100">
              <Package className="size-5 text-slate-300" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">{s.product.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {meta.label} · {formatBaht(s.product.price)}/{s.product.unit}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge className={`gap-1 rounded-full ring-1 ring-inset ${conf.className}`}>{conf.label}</Badge>
              {s.outOfStock ? (
                <Badge className="gap-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15">
                  <AlertTriangle className="size-3" /> สินค้าหมด
                </Badge>
              ) : s.lowStock ? (
                <Badge className="gap-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15">
                  <AlertTriangle className="size-3" /> ต่ำกว่าจุดสั่งซื้อ
                </Badge>
              ) : (
                <Badge className="gap-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                  <CheckCircle2 className="size-3" /> สต็อกปกติ
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-[10px] bg-slate-50 p-3 text-xs sm:grid-cols-4">
          <div>
            <p className="text-slate-400">สต็อกคงเหลือ</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {s.available} <span className="font-normal text-slate-400">/ จุดสั่ง {s.reorderLevel}</span>
            </p>
          </div>
          <div>
            <p className="text-slate-400">ขายแล้ว</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {s.unitsSold} {s.product.unit}
            </p>
          </div>
          <div>
            <p className="text-slate-400">รอบการซื้อเฉลี่ย</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {s.avgCycleDays !== null ? `${s.avgCycleDays} วัน` : "—"}
            </p>
          </div>
          <div>
            <p className="text-slate-400">คาดว่าต้องสั่ง</p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {s.estimatedNextPurchase ? shortDate(s.estimatedNextPurchase) : "ยังไม่พอประมาณ"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            {s.purchaseCount > 0
              ? `สั่งซื้อ ${s.purchaseCount} ครั้ง · ล่าสุด ${shortDate(s.lastPurchaseAt)}`
              : "ยังไม่มีประวัติการขาย — เริ่มขายเพื่อให้ระบบคาดการณ์ได้"}
          </p>
          <Button size="sm" variant="outline" className="shrink-0 gap-1.5 border-slate-200 text-slate-600" asChild>
            <a href="/seller/shop">
              <Store className="size-3.5" />
              จัดการสต็อก
            </a>
          </Button>
        </div>
      </div>
    );
  };

  const Section = ({ title, items, empty }: { title: string; items: ReorderSuggestion[]; empty: string }) => (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {items.length} รายการ
        </span>
      </div>
      {items.length === 0 ? (
        <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <CheckCircle2 className="size-7 text-emerald-500" />
          <p className="mt-3 text-sm text-slate-500">{empty}</p>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {items.map((s) => (
            <Card key={s.product.id} s={s} />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
            <RefreshCw className="size-4 text-[#10B981]" />
            velseller · Smart Reorder
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            สั่งซื้อซ้ำอย่างชาญฉลาด
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            คำนวณจากประวัติออเดอร์จริงในระบบ — รอบการซื้อของลูกค้า สต็อกคงเหลือ และจุดสั่งซื้อซ้ำของสินค้า
            (ข้อมูลไม่พอจะไม่คาดการณ์ล่วงหน้า)
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <span className={`flex size-9 items-center justify-center rounded-[10px] ${s.chip}`}>
                <s.icon className={`size-4.5 ${s.accent}`} />
              </span>
              <p className="mt-3 text-xl font-bold tabular-nums text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        <Section title="ถึงเวลาสั่งซื้อซ้ำ" items={due} empty="ไม่มีสินค้าที่ต้องสั่งซื้อตอนนี้ 🎉" />

        <Section
          title="คาดว่าจะถึงกำหนดใน 14 วัน"
          items={upcoming}
          empty="ไม่มีสินค้าใกล้ถึงกำหนดสั่งซื้อ"
        />

        <Section
          title="สินค้าที่ข้อมูลยังไม่พอ"
          items={noData}
          empty="สินค้าทุกตัวมีประวัติการขายแล้ว"
        />

        {suggestions.length === 0 && (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
              <TrendingUp className="size-7 text-[#10B981]" />
            </span>
            <h3 className="mt-5 text-lg font-semibold text-slate-900">ยังไม่มีสินค้าในร้าน</h3>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              เพิ่มสินค้าและตั้งจุดสั่งซื้อซ้ำที่หน้า "ร้านของฉัน" — เมื่อมีออเดอร์จริง ระบบจะเริ่มคาดการณ์รอบถัดไปให้
            </p>
            <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
              <a href="/seller/shop">
                <Store className="size-4" />
                ไปที่ร้านของฉัน
              </a>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
