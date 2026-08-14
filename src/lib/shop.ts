import type { Doc } from "@/convex/_generated/dataModel";
import {
  CheckCircle2,
  Clock3,
  PackageCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type Order = Doc<"orders">;
export type OrderItem = Doc<"orderItems">;
export type OrderStatus = Order["status"];

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; badge: string; dot: string }
> = {
  pending: {
    label: "รอตรวจสอบ",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/15 hover:bg-amber-50",
    dot: "bg-amber-500",
  },
  confirmed: {
    label: "ยืนยันแล้ว",
    badge: "bg-sky-50 text-sky-700 ring-sky-600/15 hover:bg-sky-50",
    dot: "bg-sky-500",
  },
  completed: {
    label: "เสร็จสิ้น",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 hover:bg-emerald-50",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "ยกเลิก",
    badge: "bg-slate-100 text-slate-500 ring-slate-600/10 hover:bg-slate-100",
    dot: "bg-slate-400",
  },
};

export const ORDER_STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  pending: Clock3,
  confirmed: PackageCheck,
  completed: CheckCircle2,
  cancelled: XCircle,
};

export const ROLE_META: Record<
  "customer" | "seller" | "admin" | "owner" | "staff",
  { label: string; badge: string }
> = {
  customer: {
    label: "ลูกค้า",
    badge: "bg-slate-100 text-slate-600 ring-slate-600/10",
  },
  seller: {
    label: "พ่อค้า / ร้านค้า",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  },
  staff: {
    label: "พนักงาน (ดูข้อมูล)",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/10",
  },
  admin: {
    label: "ผู้ดูแลฝ่าย",
    badge: "bg-sky-50 text-sky-700 ring-sky-600/10",
  },
  owner: {
    label: "เจ้าของบริษัท",
    badge: "bg-violet-50 text-violet-700 ring-violet-600/10",
  },
};

export function formatBaht(value: number): string {
  return `฿${value.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatThaiDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatThaiDate(timestamp: number): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

/** Short, human-friendly order number (last 6 chars of the Convex id). */
export function shortOrderId(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}
