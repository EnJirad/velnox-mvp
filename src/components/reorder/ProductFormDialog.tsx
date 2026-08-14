import { api } from "@/convex/_generated/api";
import {
  PRODUCT_CATEGORY_META,
  type Product,
  type ProductCategory,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this product instead of creating a new one. */
  product?: Product | null;
}

const defaultForm = {
  name: "",
  category: "general" as ProductCategory,
  unit: "ชิ้น",
  currentStock: "",
  reorderLevel: "",
  estimatedCycleDays: "",
  supplier: "",
};

export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  const createProduct = useMutation(api.products.create);
  const updateProduct = useMutation(api.products.update);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(product);

  useEffect(() => {
    if (!open) return;
    setForm(
      product
        ? {
            name: product.name,
            category: product.category,
            unit: product.unit,
            currentStock: String(product.currentStock),
            reorderLevel: String(product.reorderLevel),
            estimatedCycleDays: product.estimatedCycleDays ? String(product.estimatedCycleDays) : "",
            supplier: product.supplier ?? "",
          }
        : defaultForm,
    );
  }, [open, product]);

  const set = <K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("กรุณากรอกชื่อสินค้า");
      return;
    }
    const currentStock = Number(form.currentStock);
    const reorderLevel = Number(form.reorderLevel);
    if (!Number.isFinite(currentStock) || currentStock < 0) {
      toast.error("กรุณากรอกจำนวนสต็อกให้ถูกต้อง");
      return;
    }
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
      toast.error("กรุณากรอกจุดสั่งซื้อซ้ำให้ถูกต้อง");
      return;
    }
    const estimatedCycleDays = Number(form.estimatedCycleDays);

    setSaving(true);
    try {
      if (product) {
        await updateProduct({
          productId: product._id,
          name: form.name,
          category: form.category,
          unit: form.unit.trim() || "ชิ้น",
          currentStock,
          reorderLevel,
          estimatedCycleDays: Number.isFinite(estimatedCycleDays) && estimatedCycleDays > 0 ? estimatedCycleDays : undefined,
          supplier: form.supplier || undefined,
        });
        toast.success("อัปเดตสินค้าแล้ว");
      } else {
        await createProduct({
          name: form.name,
          category: form.category,
          unit: form.unit.trim() || "ชิ้น",
          currentStock,
          reorderLevel,
          estimatedCycleDays: Number.isFinite(estimatedCycleDays) && estimatedCycleDays > 0 ? estimatedCycleDays : undefined,
          supplier: form.supplier || undefined,
        });
        toast.success("เพิ่มสินค้าแล้ว");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Product save error:", error);
      toast.error("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</DialogTitle>
          <DialogDescription>
            ใส่ข้อมูลสินค้าและจุดสั่งซื้อซ้ำ แล้วให้ Velnox เรียนรู้รอบการสั่งของคุณ
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="product-name">ชื่อสินค้า</Label>
            <Input
              id="product-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="เช่น ยาสีฟัน, กาแฟ, กล่องบรรจุภัณฑ์"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>หมวดหมู่</Label>
              <Select
                value={form.category}
                onValueChange={(v) => set("category", v as ProductCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCT_CATEGORY_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-unit">หน่วย</Label>
              <Input
                id="product-unit"
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="ชิ้น, กล่อง, ถุง"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="product-stock">สต็อกปัจจุบัน</Label>
              <Input
                id="product-stock"
                type="number"
                min="0"
                step="any"
                value={form.currentStock}
                onChange={(e) => set("currentStock", e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-reorder">จุดสั่งซื้อซ้ำ</Label>
              <Input
                id="product-reorder"
                type="number"
                min="0"
                step="any"
                value={form.reorderLevel}
                onChange={(e) => set("reorderLevel", e.target.value)}
                placeholder="เช่น 10"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="product-cycle">รอบการซื้อโดยประมาณ (วัน, ไม่บังคับ)</Label>
              <Input
                id="product-cycle"
                type="number"
                min="0"
                step="1"
                value={form.estimatedCycleDays}
                onChange={(e) => set("estimatedCycleDays", e.target.value)}
                placeholder="เช่น 30"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-supplier">ซัพพลายเออร์ (ไม่บังคับ)</Label>
              <Input
                id="product-supplier"
                value={form.supplier}
                onChange={(e) => set("supplier", e.target.value)}
                placeholder="ชื่อร้านค้าส่ง"
              />
            </div>
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
              {isEdit ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
