import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatBaht, formatIsoDate } from "@/lib/commerce";
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
  createdAt: string;
  productName?: string;
  productImageUrl?: string;
}

const FREQUENCY_LABEL: Record<Subscription["frequency"], (sub: Subscription) => string> = {
  daily: () => "ทุกวัน",
  weekly: () => "ทุกสัปดาห์ (7 วัน)",
  monthly: () => "ทุกเดือน (30 วัน)",
  custom: (sub) => `ทุก ${sub.intervalDays} วัน`,
};

const STATUS_META: Record<Subscription["status"], { label: string; badge: string; dot: string }> = {
  active: {
    label: "กำลังสั่งอัตโนมัติ",
    badge: "bg-[#ECFDF5] text-emerald-700 ring-emerald-600/15 hover:bg-[#ECFDF5]",
    dot: "bg-[#10B981]",
  },
  paused: {
    label: "หยุดชั่วคราว",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/15 hover:bg-amber-50",
    dot: "bg-amber-500",
  },
  cancelled: {
    label: "ยกเลิกแล้ว",
    badge: "bg-slate-100 text-slate-500 ring-slate-600/10 hover:bg-slate-100",
    dot: "bg-slate-400",
  },
};

export default function VelRepeatPage() {
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
      const label = status === "active" ? "กลับมาใช้งานต่อแล้ว" : status === "paused" ? "หยุดชั่วคราวแล้ว" : "ยกเลิกการสั่งแล้ว";
      toast.success(label);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ไม่สำเร็จ กรุณาลองอีกครั้ง");
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
      toast.success("อัปเดตการสั่งรายเดือนแล้ว");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปเดตไม่สำเร็จ");
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
            VelRepeat · สั่งรายเดือนอัตโนมัติ
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            การสั่งซื้ออัตโนมัติของฉัน
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
            สินค้าประจำวันจะถูกสั่งให้คุณอัตโนมัติตามรอบที่ตั้งไว้ — เปลี่ยนรอบ หยุด หรือยกเลิกได้ทุกเมื่อ
          </p>
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
            <h2 className="mt-5 text-lg font-semibold text-slate-900">ยังไม่มีการสั่งรายเดือน</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              เลือกสินค้าประจำวัน แล้วกด “สั่งรายเดือน” เพื่อให้ Velnox สั่งให้คุณอัตโนมัติทุกช่วงเวลา
            </p>
            <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
              <Link to="/shop">เลือกสินค้าเลย</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {subs.map((sub) => {
              const meta = STATUS_META[sub.status];
              const frequencyLabel = FREQUENCY_LABEL[sub.frequency](sub);
              const editable = sub.status !== "cancelled";
              return (
                <div
                  key={sub.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
                >
                  <Link to={`/shop/products/${sub.productId}`} className="shrink-0">
                    {sub.productImageUrl ? (
                      <img
                        src={sub.productImageUrl}
                        alt={sub.productName ?? "สินค้า"}
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
                        to={`/shop/products/${sub.productId}`}
                        className="truncate text-sm font-semibold text-slate-900 hover:text-[#10B981]"
                      >
                        {sub.productName ?? "สินค้า"}
                      </Link>
                      <Badge className={`gap-1 rounded-full ring-1 ring-inset ${meta.badge}`}>
                        <span className={`size-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>
                        จำนวน <span className="font-semibold text-slate-900">{sub.quantity}</span> ต่อครั้ง
                      </span>
                      <span>
                        ราคา{" "}
                        <span className="font-semibold tabular-nums text-slate-900">
                          {formatBaht(sub.unitPriceSnapshot)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <RefreshCw className="size-3 text-[#10B981]" />
                        {frequencyLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {sub.status === "active"
                        ? `สั่งครั้งถัดไป: ${formatIsoDate(sub.nextOrderDate)}`
                        : `เริ่มสั่งอีกครั้งได้เมื่อคุณกลับมาใช้งาน`}
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
                        หยุดชั่วคราว
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
                        กลับมาใช้ต่อ
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
                          แก้ไข
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-red-600 hover:bg-red-50"
                          disabled={busyId === sub.id}
                          onClick={() => changeStatus(sub, "cancelled")}
                        >
                          <Trash2 className="size-3.5" />
                          ยกเลิก
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
            <DialogTitle className="text-slate-900">แก้ไขการสั่งรายเดือน</DialogTitle>
            <DialogDescription>
              {editing?.productName ?? "สินค้า"} — ปรับจำนวนหรือรอบการสั่งได้ตามต้องการ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500">จำนวนต่อครั้ง</label>
              <Input
                type="number"
                min={1}
                value={editQty}
                onChange={(e) => setEditQty(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1.5 rounded-[10px] border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">รอบการสั่ง</label>
              <Select value={editFreq} onValueChange={(val) => setEditFreq(val as Subscription["frequency"])}>
                <SelectTrigger className="mt-1.5 h-9 w-full rounded-[10px] border-slate-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">ทุกวัน</SelectItem>
                  <SelectItem value="weekly">ทุกสัปดาห์ (7 วัน)</SelectItem>
                  <SelectItem value="monthly">ทุกเดือน (30 วัน)</SelectItem>
                  <SelectItem value="custom">กำหนดเอง</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editFreq === "custom" && (
              <div>
                <label className="text-xs font-medium text-slate-500">ทุกกี่วัน</label>
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
                สั่งครั้งถัดไปจะเลื่อนเป็นวันที่ใหม่ตามรอบที่ตั้ง
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-slate-200 text-slate-600" onClick={() => setEditing(null)}>
              ยกเลิก
            </Button>
            <Button className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800" onClick={saveEdit} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
