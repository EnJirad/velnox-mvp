import { api } from "@/convex/_generated/api";
import { formatNumber, goalPercent, type Goal } from "@/lib/goals";
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
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ProgressDialogProps {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProgressDialog({ goal, open, onOpenChange }: ProgressDialogProps) {
  const addProgress = useMutation(api.goals.addProgress);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setAmount("");
  }, [open, goal]);

  if (!goal) return null;

  const delta = Number(amount);
  const valid = Number.isFinite(delta) && delta > 0;
  const nextValue = valid ? goal.currentValue + delta : goal.currentValue;
  const percent = goalPercent(goal);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await addProgress({ goalId: goal._id, amount: delta });
      toast.success("บันทึกความคืบหน้าแล้ว");
      onOpenChange(false);
    } catch (error) {
      console.error("Progress save error:", error);
      toast.error("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>บันทึกความคืบหน้า</DialogTitle>
          <DialogDescription>
            {goal.title} · {formatNumber(goal.currentValue)} / {formatNumber(goal.targetValue)}{" "}
            {goal.unit} ({percent}%)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="progress-amount">
              เพิ่มตัวเลขล่าสุด ({goal.unit})
            </Label>
            <Input
              id="progress-amount"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="เช่น 50000"
              autoFocus
              required
            />
          </div>

          {valid && (
            <p className="rounded-[10px] bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              ความคืบหน้าจะกลายเป็น{" "}
              <span className="font-semibold text-slate-900">
                {formatNumber(nextValue)} {goal.unit}
              </span>
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={saving || !valid}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
