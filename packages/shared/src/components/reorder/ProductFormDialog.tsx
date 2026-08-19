import { api } from "@convex/_generated/api";
import {
  PRODUCT_CATEGORY_META,
  type Product,
  type ProductCategory,
} from "@velnox/shared/lib/reorder";
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
import { Switch } from "@velnox/shared/components/ui/switch";
import { Textarea } from "@velnox/shared/components/ui/textarea";
import { useMutation } from "convex/react";
import { Loader2, Store } from "lucide-react";
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
  price: "",
  description: "",
  published: false,
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
            price: product.price ? String(product.price) : "",
            description: product.description ?? "",
            published: product.published ?? false,
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
    const price = Number(form.price);
    if (form.price && (!Number.isFinite(price) || price <= 0)) {
      toast.error("กรุณากรอกราคาให้ถูกต้อง");
      return;
    }
    if (form.published && price <= 0) {
      toast.error("ต้องตั้งราคาก่อนจึงจะประกาศขายได้");
      return;
    }
    const estimatedCycleDays = Number(form.estimatedCycleDays);

    const baseArgs = {
      name: form.name,
      category: form.category,
      unit: form.unit.trim() || "ชิ้น",
      currentStock,
      reorderLevel,
      price: price > 0 ? price : undefined,
      description: form.description || undefined,
      published: form.published,
      estimatedCycleDays: Number.isFinite(estimatedCycleDays) && estimatedCycleDays > 0 ? estimatedCycleDays : undefined,
      supplier: form.supplier || undefined,
    };

    setSaving(true);
    try {
      if (product) {
        await updateProduct({ productId: product._id, ...baseArgs });
        toast.success("อัปเดตสินค้าแล้ว");
      } else {
        await createProduct(baseArgs);
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
              <Label htmlFor="product-price">ราคาขาย (บาท)</Label>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.5"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="เช่น 45"
              />
            </div>
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="product-description">คำอธิบายสินค้า (แสดงที่หน้าร้าน)</Label>
            <Textarea
              id="product-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="เช่น สูตรคลาสสิก ขนาด 150 กรัม"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="product-supplier">ซัพพลายเออร์ (ไม่บังคับ)</Label>
              <Input
                id="product-supplier"
                value={form.supplier}
                onChange={(e) => set("supplier", e.target.value)}
                placeholder="ชื่อร้านค้าส่ง"
              />
            </div>
            <div className="flex items-end gap-2 rounded-[10px] border border-slate-200 px-3 py-2.5">
              <Store className="size-4 shrink-0 text-[#10B981]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">ประกาศขายที่หน้าร้าน</p>
                <p className="text-xs text-slate-400">แสดงใน velshop ให้ลูกค้าสั่งซื้อได้</p>
              </div>
              <Switch
                checked={form.published}
                onCheckedChange={(v) => set("published", v)}
                aria-label="ประกาศขายที่หน้าร้าน"
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
