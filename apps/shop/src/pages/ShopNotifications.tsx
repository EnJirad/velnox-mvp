import { ShopFooter } from "@/components/shop/ShopFooter";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { useLanguage } from "@/lib/i18n";
import { Badge } from "@velnox/shared/components/ui/badge";
import { Button } from "@velnox/shared/components/ui/button";
import { Skeleton } from "@velnox/shared/components/ui/skeleton";
import { api } from "@convex/_generated/api";
import { formatIsoDateTime } from "@velnox/shared/lib/commerce";
import { useAction } from "convex/react";
import {
  Bell,
  BellRing,
  CheckCheck,
  CreditCard,
  Package,
  RotateCcw,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  order: Package,
  payment: CreditCard,
  shipping: Truck,
  return: RotateCcw,
  refund: RotateCcw,
  promotion: Sparkles,
  system: BellRing,
  seller: Package,
};

export default function ShopNotifications() {
  const { t } = useLanguage();
  const myNotifications = useAction(api.customer.myNotifications);
  const markRead = useAction(api.customer.markNotificationReadAction);
  const markAll = useAction(api.customer.markAllNotificationsRead);

  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await myNotifications();
      setItems((res.items ?? []) as NotificationRow[]);
    } catch (err) {
      console.error("Load notifications error:", err);
      setItems([]);
    }
  }, [myNotifications]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = items?.filter((n) => !n.isRead).length ?? 0;

  const handleRead = async (n: NotificationRow) => {
    if (n.isRead) return;
    setBusyId(n.id);
    try {
      await markRead({ notificationId: n.id });
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) ?? null);
    } catch (err) {
      console.error("Mark read error:", err);
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAll();
      setItems((prev) => prev?.map((x) => ({ ...x, isRead: true })) ?? null);
      toast.success(t("notifications.markAllSuccess"));
    } catch (err) {
      console.error("Mark all error:", err);
      toast.error(t("notifications.markAllFailed"));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
              <Bell className="size-4 text-[#10B981]" />
              {t("notifications.eyebrow")}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t("notifications.title")}</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              {unread > 0 ? t("notifications.unread", { count: unread }) : t("notifications.allRead")}
            </p>
          </div>
          {unread > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 border-slate-200 text-slate-600" onClick={() => void handleMarkAll()}>
              <CheckCheck className="size-3.5" />
              {t("notifications.markAll")}
            </Button>
          )}
        </div>

        {items === null ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
              <Bell className="size-7 text-slate-400" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">{t("notifications.emptyTitle")}</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{t("notifications.emptyDesc")}</p>
          </div>
        ) : (
          <div className="mt-8 space-y-2.5">
            {items.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? BellRing;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void handleRead(n)}
                  disabled={busyId === n.id}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                    n.isRead ? "border-slate-200 bg-white" : "border-[#10B981]/30 bg-[#F0FDF9]"
                  } ${!n.isRead ? "hover:border-[#10B981]/50" : ""}`}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${
                      n.isRead ? "bg-slate-100 text-slate-400" : "bg-[#10B981] text-white"
                    }`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{n.title}</span>
                      {!n.isRead && <Badge className="shrink-0 rounded-full bg-[#10B981] text-white hover:bg-[#10B981]">{t("notifications.new")}</Badge>}
                    </span>
                    {n.message && <span className="mt-0.5 block text-sm leading-5 text-slate-600">{n.message}</span>}
                    <span className="mt-1 block text-[11px] text-slate-400">{formatIsoDateTime(n.createdAt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <ShopFooter />
    </div>
  );
}
