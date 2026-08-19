import { ShopFooter } from "@/components/shop/ShopFooter";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { useLanguage } from "@/lib/i18n";
import { Badge } from "@velnox/shared/components/ui/badge";
import { Button } from "@velnox/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@velnox/shared/components/ui/dialog";
import { Input } from "@velnox/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@velnox/shared/components/ui/select";
import { Skeleton } from "@velnox/shared/components/ui/skeleton";
import { api } from "@convex/_generated/api";
import { formatBaht, formatIsoDate } from "@velnox/shared/lib/commerce";
import { useAction } from "convex/react";
import {
  CalendarClock,
  ImageOff,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

interface Subscription {
  id: string;
  productId: string;
  quantity: number;
  unitPriceSnapshot: number;
  frequency: "daily" | "weekly" | "monthly" | "custom";
  intervalDays: number;
  nextOrderDate: string;
  status: "active" | "paused" | "cancelled";
  createdAt: number;
  productName?: string;
  productImageUrl?: string;
}

const STATUS_META: Record<Subscription["status"], { badge: string; dot: string }> = {
  active: {
    badge: "bg-[#ECFDF5] text-emerald-700 ring-emerald-600/15 hover:bg-[#ECFDF5]",
    dot: "bg-[#10B981]",
  },
  paused: {
    badge: "bg-amber-50 text-amber-700 ring-amber-600/15 hover:bg-amber-50",
    dot: "bg-amber-500",
  },
  cancelled: {
    badge: "bg-slate-100 text-slate-500 ring-slate-600/10 hover:bg-slate-100",
    dot: "bg-slate-400",
  },
};

const STATUS_LABEL_KEY: Record<Subscription["status"], string> = {
  active: "velrepeat.statusActive",
  paused: "velrepeat.statusPaused",
  cancelled: "velrepeat.statusCancelled",
};

const FREQUENCIES: Array<{ id: Subscription["frequency"]; labelKey: string }> = [
  { id: "daily", labelKey: "velrepeat.freqDaily" },
  { id: "weekly", labelKey: "velrepeat.freqWeekly" },
  { id: "monthly", labelKey: "velrepeat.freqMonthly" },
  { id: "custom", labelKey: "velrepeat.custom" },
];

export default function VelRepeatPage() {
  const { t } = useLanguage();
  const mySubscriptions = useAction(api.commerce.mySubscriptions);
  const pauseSubscription = useAction(api.commerce.pauseSubscription);
  const updateSubscription = useAction(api.commerce.updateSubscriptionAction);

  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editFreq, setEditFreq] = useState<Subscription["frequency"]>("monthly");
  const [editInterval, setEditInterval] = useState(30);
  const [saving, setSaving] = useState(false);

  /** Translated frequency label for a subscription (custom includes interval). */
  const frequencyLabel = useCallback(
    (sub: Subscription) => {
      const key = `velrepeat.freq${sub.frequency === "custom" ? "Custom" : sub.frequency === "daily" ? "Daily" : sub.frequency === "weekly" ? "Weekly" : "Monthly"}`;
      return sub.frequency === "custom"
        ? t(key, { days: sub.intervalDays })
        : t(key);
    },
    [t],
  );

  const load = useCallback(async () => {
    try {
      const rows = (await mySubscriptions()) as unknown as Subscription[];
      setSubs(rows ?? []);
    } catch (err) {
      console.error("Subscriptions error:", err);
      setSubs([]);
    }
  }, [mySubscriptions]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (sub: Subscription, status: Subscription["status"]) => {
    setBusyId(sub.id);
    try {
      await pauseSubscription({ subscriptionId: sub.id, status });
      const label =
        status === "active"
          ? t("velrepeat.resumed")
          : status === "paused"
            ? t("velrepeat.pausedMsg")
            : t("velrepeat.cancelledMsg");
      toast.success(label);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("velrepeat.failed"));
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (sub: Subscription) => {
    setEditing(sub);
    setEditQty(sub.quantity);
    setEditFreq(sub.frequency);
    setEditInterval(sub.intervalDays);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateSubscription({
        subscriptionId: editing.id,
        quantity: editQty,
        frequency: editFreq,
        intervalDays: editFreq === "custom" ? editInterval : undefined,
      });
      toast.success(t("velrepeat.updated"));
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("velrepeat.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
            <RefreshCw className="size-4 text-[#10B981]" />
            {t("velrepeat.eyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {t("velrepeat.title")}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{t("velrepeat.desc")}</p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {subs === null ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : subs.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
              <CalendarClock className="size-7 text-[#10B981]" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">{t("velrepeat.emptyTitle")}</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{t("velrepeat.emptyDesc")}</p>
            <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
              <Link to="/">{t("velrepeat.pickProducts")}</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {subs.map((sub) => {
              const meta = STATUS_META[sub.status];
              const label = frequencyLabel(sub);
              const editable = sub.status !== "cancelled";
              return (
                <div
                  key={sub.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
                >
                  <Link to={`/products/${sub.productId}`} className="shrink-0">
                    {sub.productImageUrl ? (
                      <img
                        src={sub.productImageUrl}
                        alt={sub.productName ?? t("velrepeat.product")}
                        className="size-16 rounded-[12px] border border-slate-100 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex size-16 items-center justify-center rounded-[12px] bg-slate-50">
                        <ImageOff className="size-6 text-slate-300" />
                      </span>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/products/${sub.productId}`}
                        className="truncate text-sm font-semibold text-slate-900 hover:text-[#10B981]"
                      >
                        {sub.productName ?? t("velrepeat.product")}
                      </Link>
                      <Badge className={`gap-1 rounded-full ring-1 ring-inset ${meta.badge}`}>
                        <span className={`size-1.5 rounded-full ${meta.dot}`} />
                        {t(STATUS_LABEL_KEY[sub.status])}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>
                        {t("velrepeat.qtyPerCycle", { count: sub.quantity })}
                      </span>
                      <span>
                        {t("velrepeat.price")}{" "}
                        <span className="font-semibold tabular-nums text-slate-900">
                          {formatBaht(sub.unitPriceSnapshot)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <RefreshCw className="size-3 text-[#10B981]" />
                        {label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {sub.status === "active"
                        ? t("velrepeat.nextOrder", { date: formatIsoDate(sub.nextOrderDate) })
                        : t("velrepeat.pausedHint")}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {sub.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-slate-200 text-slate-600"
                        disabled={busyId === sub.id}
                        onClick={() => changeStatus(sub, "paused")}
                      >
                        <Pause className="size-3.5" />
                        {t("velrepeat.pause")}
                      </Button>
                    )}
                    {sub.status === "paused" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-emerald-200 bg-[#ECFDF5] text-emerald-700 hover:bg-[#D1FAE5]"
                        disabled={busyId === sub.id}
                        onClick={() => changeStatus(sub, "active")}
                      >
                        <Play className="size-3.5" />
                        {t("velrepeat.resume")}
                      </Button>
                    )}
                    {editable && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-slate-200 text-slate-600"
                          onClick={() => openEdit(sub)}
                        >
                          <Pencil className="size-3.5" />
                          {t("velrepeat.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-red-600 hover:bg-red-50"
                          disabled={busyId === sub.id}
                          onClick={() => changeStatus(sub, "cancelled")}
                        >
                          <Trash2 className="size-3.5" />
                          {t("velrepeat.cancel")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-900">{t("velrepeat.editTitle")}</DialogTitle>
            <DialogDescription>
              {t("velrepeat.editDesc", { name: editing?.productName ?? t("velrepeat.product") })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500">{t("velrepeat.qtyLabel")}</label>
              <Input
                type="number"
                min={1}
                value={editQty}
                onChange={(e) => setEditQty(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1.5 rounded-[10px] border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">{t("velrepeat.freqLabel")}</label>
              <Select value={editFreq} onValueChange={(val) => setEditFreq(val as Subscription["frequency"])}>
                <SelectTrigger className="mt-1.5 h-9 w-full rounded-[10px] border-slate-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {t(f.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editFreq === "custom" && (
              <div>
                <label className="text-xs font-medium text-slate-500">{t("velrepeat.customDays")}</label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={editInterval}
                  onChange={(e) => setEditInterval(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                  className="mt-1.5 rounded-[10px] border-slate-200"
                />
              </div>
            )}
            {editing && editing.status === "active" && (
              <p className="rounded-[10px] bg-[#ECFDF5] px-3 py-2 text-xs text-emerald-700">
                {t("velrepeat.nextShift")}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-slate-200 text-slate-600" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </Button>
            <Button className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800" onClick={saveEdit} disabled={saving}>
              {saving ? t("velrepeat.saving") : t("velrepeat.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShopFooter />
    </div>
  );
}
