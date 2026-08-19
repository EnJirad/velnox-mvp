import type { Doc } from "@convex/_generated/dataModel";
import {
  Boxes,
  Coffee,
  Package,
  ShoppingBag,
  Sparkles,
  Tag,
  type LucideIcon,
} from "lucide-react";

export type Product = Doc<"products">;
export type ProductCategory = Product["category"];
export type Purchase = Doc<"purchases">;

export const PRODUCT_CATEGORY_META: Record<
  ProductCategory,
  { label: string; icon: LucideIcon; chip: string; iconClass: string }
> = {
  general: {
    label: "สินค้าทั่วไป",
    icon: Package,
    chip: "bg-slate-100 text-slate-700 ring-slate-600/10",
    iconClass: "text-slate-600",
  },
  food: {
    label: "อาหารและเครื่องดื่ม",
    icon: Coffee,
    chip: "bg-amber-50 text-amber-700 ring-amber-600/10",
    iconClass: "text-amber-600",
  },
  daily: {
    label: "ของใช้ประจำวัน",
    icon: ShoppingBag,
    chip: "bg-sky-50 text-sky-700 ring-sky-600/10",
    iconClass: "text-sky-600",
  },
  beauty: {
    label: "ความงามและของใช้ส่วนตัว",
    icon: Sparkles,
    chip: "bg-rose-50 text-rose-700 ring-rose-600/10",
    iconClass: "text-rose-600",
  },
  packaging: {
    label: "วัสดุและบรรจุภัณฑ์",
    icon: Boxes,
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    iconClass: "text-emerald-600",
  },
  other: {
    label: "อื่น ๆ",
    icon: Tag,
    chip: "bg-slate-100 text-slate-700 ring-slate-600/10",
    iconClass: "text-slate-600",
  },
};

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The cycle Velnox currently believes in: learned data wins over the owner's estimate. */
export function effectiveCycleDays(product: Product): number | undefined {
  return product.avgCycleDays ?? product.estimatedCycleDays;
}

/** Days since the last reorder (undefined when the product was never reordered). */
export function daysSinceOrder(product: Product): number | undefined {
  if (product.lastOrderedAt === undefined) return undefined;
  return Math.max(0, (Date.now() - product.lastOrderedAt) / DAY_MS);
}

export type ReorderStatus = "due" | "upcoming" | "ok" | "unlearned";

export interface ReorderInfo {
  status: ReorderStatus;
  /** Positive = days left until the next expected reorder. Negative = overdue. */
  daysUntilDue?: number;
  /** Whether current stock is at/below the reorder level. */
  lowStock: boolean;
}

/**
 * Smart Reorder status: how urgent it is to reorder this product, based on the
 * learned purchase cycle and the current stock level.
 */
export function reorderInfo(product: Product): ReorderInfo {
  const lowStock = product.reorderLevel > 0 && product.currentStock <= product.reorderLevel;
  const cycle = effectiveCycleDays(product);
  const since = daysSinceOrder(product);

  if (cycle !== undefined && since !== undefined) {
    const remaining = cycle - since;
    if (remaining <= 0) return { status: "due", daysUntilDue: remaining, lowStock };
    if (remaining <= cycle * 0.3) return { status: "upcoming", daysUntilDue: remaining, lowStock };
    return { status: "ok", daysUntilDue: remaining, lowStock };
  }
  return { status: "unlearned", lowStock };
}

export const STATUS_META: Record<
  ReorderStatus,
  { label: string; badge: string; dot: string }
> = {
  due: {
    label: "ถึงเวลาสั่งแล้ว",
    badge: "bg-rose-50 text-rose-700 ring-rose-600/15 hover:bg-rose-50",
    dot: "bg-rose-500",
  },
  upcoming: {
    label: "ใกล้ถึงรอบสั่ง",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/15 hover:bg-amber-50",
    dot: "bg-amber-500",
  },
  ok: {
    label: "ตามรอบ",
    badge: "bg-slate-100 text-slate-600 ring-slate-600/10 hover:bg-slate-100",
    dot: "bg-slate-400",
  },
  unlearned: {
    label: "ยังไม่มีรอบ",
    badge: "bg-slate-100 text-slate-600 ring-slate-600/10 hover:bg-slate-100",
    dot: "bg-slate-400",
  },
};

/** Suggested order quantity: reuse the last order size when known. */
export function suggestedQty(product: Product): number {
  if (product.lastPurchaseQty && product.lastPurchaseQty > 0) return product.lastPurchaseQty;
  return Math.max(1, Math.ceil(product.reorderLevel * 2));
}

export function formatDays(days: number): string {
  const rounded = Math.max(0, Math.round(days));
  return `${rounded.toLocaleString("th-TH")} วัน`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export function formatThaiDate(timestamp: number): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}
