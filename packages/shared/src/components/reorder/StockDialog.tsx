import { api } from "@convex/_generated/api";
import { formatNumber, type Product } from "@velnox/shared/lib/reorder";
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
import { Label } from "@velnox/shared/components/ui/label";
import { useMutation } from "convex/react";
import { Loader2, MinusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface StockDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockDialog({ product, open, onOpenChange }: StockDialogProps) {
  const recordSale = useMutation(api.products.recordSale);
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setQuantity("");
  }, [open, product]);

  if (!product) return null;

  const qty = Number(quantity);
  const valid = Number.isFinite(qty) && qty > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await recordSale({ productId: product._id, quantity: qty });
      toast.success(`บันทึกการขาย "${product.name}" แล้ว`);
      onOpenChange(false);
    } catch (error) {
      console.error("Sale record error:", error);
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
            <MinusCircle className="size-4 text-slate-500" />
            บันทึกการขาย / ใช้ไป
          </DialogTitle>
          <DialogDescription>
            {product.name} · สต็อกปัจจุบัน {formatNumber(product.currentStock)} {product.unit}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sale-qty">จำนวนที่ขาย / ใช้ไป ({product.unit})</Label>
            <Input
              id="sale-qty"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus
              required
            />
          </div>

          {valid && (
            <p className="rounded-[10px] bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              สต็อกจะเหลือ{" "}
              <span className="font-semibold text-slate-900">
                {formatNumber(Math.max(0, product.currentStock - qty))} {product.unit}
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
