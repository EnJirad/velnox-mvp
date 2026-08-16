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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@velnox/shared/components/ui/select";
import { api } from "@convex/_generated/api";
import { useAuth } from "@velnox/shared/hooks/use-auth";
import { formatBaht, type StoreProduct } from "@velnox/shared/lib/commerce";
import { useAction } from "convex/react";
import { CalendarClock, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface SubscriptionDialogProps {
  product: StoreProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriptionDialog({ product, open, onOpenChange }: SubscriptionDialogProps) {
  const { isAuthenticated } = useAuth();
  const createVelRepeat = useAction(api.commerce.createVelRepeat);
  const navigate = useNavigate();
  const [intervalDays, setIntervalDays] = useState("30");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const stock = (product?.inventory?.available ?? product?.inventory?.quantity) ?? 0;

  const handleSubscribe = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      onOpenChange(false);
      navigate("/auth?returnTo=/shop");
      return;
    }
    setSubmitting(true);
    try {
      await createVelRepeat({
        productId: product.id,
        quantity,
        intervalDays: Number(intervalDays),
        frequency: "monthly",
      });
      toast.success(`สมัครรับ "${product.name}" ทุก ${intervalDays} วันแล้ว 🗓️`);
      onOpenChange(false);
    } catch (error) {
      console.error("Create subscription error:", error);
      toast.error(error instanceof Error ? error.message : "สมัครไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-[#10B981]" />
            สั่งรายเดือน · {product?.name}
          </DialogTitle>
          <DialogDescription>
            ระบบจะสร้างออเดอร์ให้อัตโนมัติทุกช่วงเวลา — ไม่ต้องสั่งเองทุกครั้ง
            {product && product.price > 0 && (
              <span className="mt-1 block font-medium text-slate-700">
                {formatBaht(product.price)} / {product.unit} ต่อรอบ
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sub-interval">รอบการสั่ง</Label>
            <Select value={intervalDays} onValueChange={setIntervalDays}>
              <SelectTrigger id="sub-interval" className="rounded-[10px] border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">ทุก 30 วัน (รายเดือน)</SelectItem>
                <SelectItem value="60">ทุก 60 วัน</SelectItem>
                <SelectItem value="90">ทุก 90 วัน</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sub-qty">จำนวนต่อรอบ</Label>
            <Input
              id="sub-qty"
              type="number"
              min={1}
              max={Math.max(1, stock)}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="rounded-[10px] border-slate-200"
            />
            {product && stock > 0 && (
              <p className="text-xs text-slate-400">
                สต็อกปัจจุบัน {stock} {product.unit} — ถ้าสต็อกไม่พอรอบนั้นจะถูกข้าม
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-200 text-slate-700"
          >
            ยกเลิก
          </Button>
          <Button
            className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
            onClick={handleSubscribe}
            disabled={submitting}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            ยืนยันสั่งรายเดือน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
