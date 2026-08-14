import { api } from "@/convex/_generated/api";
import {
  effectiveCycleDays,
  formatDays,
  formatNumber,
  suggestedQty,
  type Product,
} from "@/lib/reorder";
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
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "convex/react";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ReorderDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReorderDialog({ product, open, onOpenChange }: ReorderDialogProps) {
  const recordPurchase = useMutation(api.products.recordPurchase);
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && product) {
      setQuantity(String(suggestedQty(product)));
      setCost("");
      setNote("");
    }
  }, [open, product]);

  if (!product) return null;

  const qty = Number(quantity);
  const valid = Number.isFinite(qty) && qty > 0;
  const costNum = Number(cost);
  const cycle = effectiveCycleDays(product);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await recordPurchase({
        productId: product._id,
        quantity: qty,
        cost: Number.isFinite(costNum) && costNum > 0 ? costNum : undefined,
        note: note || undefined,
      });
      toast.success(`สั่งซื้อซ้ำ "${product.name}" แล้ว`);
      onOpenChange(false);
    } catch (error) {
      console.error("Reorder error:", error);
      toast.error("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-4 text-[#10B981]" />
            สั่งซื้อซ้ำ
          </DialogTitle>
          <DialogDescription>
            {product.name}
            {cycle !== undefined && ` · รอบการซื้อเฉลี่ย ${formatDays(cycle)}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="reorder-qty">จำนวนที่สั่ง ({product.unit})</Label>
            <Input
              id="reorder-qty"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus
              required
            />
            {product.lastPurchaseQty !== undefined && (
              <p className="text-xs text-slate-400">
                ครั้งที่แล้วสั่ง {formatNumber(product.lastPurchaseQty)} {product.unit}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reorder-cost">ต้นทุนรวม (บาท, ไม่บังคับ)</Label>
            <Input
              id="reorder-cost"
              type="number"
              min="0"
              step="any"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="เช่น 1500"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reorder-note">หมายเหตุ (ไม่บังคับ)</Label>
            <Textarea
              id="reorder-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น สั่งจากร้านส่งประจำ"
              rows={2}
            />
          </div>

          {valid && (
            <p className="rounded-[10px] bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              สต็อกจะกลายเป็น{" "}
              <span className="font-semibold text-slate-900">
                {formatNumber(product.currentStock + qty)} {product.unit}
              </span>
              {" "}· ระบบจะจำรอบการสั่งนี้เพื่อเตือนครั้งถัดไป
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
              ยืนยันการสั่งซื้อ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
