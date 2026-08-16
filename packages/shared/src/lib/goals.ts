import type { Doc } from "@convex/_generated/dataModel";
import { ShoppingBag, Target, TrendingUp, Users, type LucideIcon } from "lucide-react";

export type Goal = Doc<"goals">;
export type GoalCategory = Goal["category"];
export type GoalPeriod = Goal["period"];

export const CATEGORY_META: Record<
  GoalCategory,
  { label: string; icon: LucideIcon; chip: string; iconClass: string }
> = {
  revenue: {
    label: "ยอดขาย",
    icon: TrendingUp,
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    iconClass: "text-emerald-600",
  },
  orders: {
    label: "ออเดอร์",
    icon: ShoppingBag,
    chip: "bg-sky-50 text-sky-700 ring-sky-600/10",
    iconClass: "text-sky-600",
  },
  customers: {
    label: "ลูกค้าใหม่",
    icon: Users,
    chip: "bg-amber-50 text-amber-700 ring-amber-600/10",
    iconClass: "text-amber-600",
  },
  other: {
    label: "อื่น ๆ",
    icon: Target,
    chip: "bg-slate-100 text-slate-700 ring-slate-600/10",
    iconClass: "text-slate-600",
  },
};

export const PERIOD_META: Record<GoalPeriod, string> = {
  monthly: "รายเดือน",
  quarterly: "รายไตรมาส",
  yearly: "รายปี",
};

export function formatNumber(value: number): string {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export function goalPercent(goal: Goal): number {
  if (goal.targetValue <= 0) return 0;
  return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
}

export function isAchieved(goal: Goal): boolean {
  return goal.targetValue > 0 && goal.currentValue >= goal.targetValue;
}

export function isAtRisk(goal: Goal): boolean {
  if (isAchieved(goal) || goal.dueDate === undefined) return false;
  return goal.dueDate < Date.now();
}

export function formatThaiDate(timestamp: number): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function formatShortThaiDate(timestamp: number): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}
