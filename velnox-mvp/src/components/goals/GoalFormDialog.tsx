import { api } from "@/convex/_generated/api";
import type { Goal, GoalCategory, GoalPeriod } from "@/lib/goals";
import { CATEGORY_META, PERIOD_META } from "@/lib/goals";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this goal instead of creating a new one. */
  goal?: Goal | null;
}

function toDateInputValue(timestamp?: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const defaultForm = {
  title: "",
  description: "",
  category: "revenue" as GoalCategory,
  unit: "บาท",
  targetValue: "",
  currentValue: "",
  period: "monthly" as GoalPeriod,
  dueDate: "",
};

export function GoalFormDialog({ open, onOpenChange, goal }: GoalFormDialogProps) {
  const createGoal = useMutation(api.goals.create);
  const updateGoal = useMutation(api.goals.update);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(goal);

  useEffect(() => {
    if (!open) return;
    setForm(
      goal
        ? {
            title: goal.title,
            description: goal.description ?? "",
            category: goal.category,
            unit: goal.unit,
            targetValue: String(goal.targetValue),
            currentValue: String(goal.currentValue),
            period: goal.period,
            dueDate: toDateInputValue(goal.dueDate),
          }
        : defaultForm,
    );
  }, [open, goal]);

  const set = <K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetValue = Number(form.targetValue);
    const currentValue = Number(form.currentValue) || 0;
    if (!form.title.trim()) {
      toast.error("กรุณากรอกชื่อเป้าหมาย");
      return;
    }
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      toast.error("กรุณากรอกค่าเป้าหมายให้มากกว่า 0");
      return;
    }
    const dueDate = form.dueDate ? new Date(`${form.dueDate}T00:00:00`).getTime() : undefined;

    setSaving(true);
    try {
      if (goal) {
        await updateGoal({
          goalId: goal._id,
          title: form.title,
          description: form.description || undefined,
          category: form.category,
          unit: form.unit.trim() || "ครั้ง",
          targetValue,
          currentValue,
          period: form.period,
          dueDate,
        });
        toast.success("อัปเดตเป้าหมายแล้ว");
      } else {
        await createGoal({
          title: form.title,
          description: form.description || undefined,
          category: form.category,
          unit: form.unit.trim() || "ครั้ง",
          targetValue,
          currentValue,
          period: form.period,
          dueDate,
        });
        toast.success("สร้างเป้าหมายแล้ว");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Goal save error:", error);
      toast.error("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขเป้าหมาย" : "สร้างเป้าหมายใหม่"}</DialogTitle>
          <DialogDescription>
            กำหนดเป้าหมายธุรกิจของคุณ แล้วให้ Velnox จำและช่วยคุณติดตาม
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="goal-title">ชื่อเป้าหมาย</Label>
            <Input
              id="goal-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="เช่น ยอดขายเดือนนี้, เป้าลูกค้าใหม่"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="goal-description">รายละเอียด (ไม่บังคับ)</Label>
            <Textarea
              id="goal-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="เพิ่มบริบทหรือรายละเอียดของเป้าหมายนี้"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>หมวดหมู่</Label>
              <Select
                value={form.category}
                onValueChange={(v) => set("category", v as GoalCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>ช่วงเวลา</Label>
              <Select
                value={form.period}
                onValueChange={(v) => set("period", v as GoalPeriod)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="เลือกช่วงเวลา" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_META).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="goal-target">ค่าเป้าหมาย</Label>
              <Input
                id="goal-target"
                type="number"
                min="0"
                step="any"
                value={form.targetValue}
                onChange={(e) => set("targetValue", e.target.value)}
                placeholder="600000"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-current">ความคืบหน้าปัจจุบัน</Label>
              <Input
                id="goal-current"
                type="number"
                min="0"
                step="any"
                value={form.currentValue}
                onChange={(e) => set("currentValue", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-unit">หน่วย</Label>
              <Input
                id="goal-unit"
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="บาท, ออเดอร์, คน"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="goal-due">กำหนดเสร็จ (ไม่บังคับ)</Label>
            <Input
              id="goal-due"
              type="date"
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
            />
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "บันทึกการแก้ไข" : "สร้างเป้าหมาย"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
