import { api } from "@convex/_generated/api";
import {
  PRODUCT_CATEGORY_META,
  type StoreProduct,
  type StoreProductCategory,
  type StoreShop,
} from "@velnox/shared/lib/commerce";
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
import { ImageUploader } from "@velnox/shared/components/seller/ImageUploader";
import { useAction } from "convex/react";
import { Loader2, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shop: StoreShop;
  /** when provided, edits this product instead of creating a new one */
  product?: StoreProduct | null;
  onSaved?: (product: StoreProduct) => void;
}

interface InnerProps {
  shop: StoreShop;
  product: StoreProduct | null;
  onClose: () => void;
  onSaved?: (product: StoreProduct) => void;
}

const defaultForm = {
  name: "",
  category: "general" as StoreProductCategory,
  unit: "ชิ้น",
  price: "",
  description: "",
  supplier: "",
  stock: "",
  reorderLevel: "",
  published: false,
};

function ProductFormInner({ shop, product, onClose, onSaved }: InnerProps) {
  const createProduct = useAction(api.commerce.createProductAction);
  const updateProduct = useAction(api.commerce.updateProductAction);
  const setStock = useAction(api.commerce.setStockAction);
  const setReorderLevel = useAction(api.commerce.setReorderLevelAction);

  const [form, setForm] = useState<typeof defaultForm>(() =>
    product
      ? {
          name: product.name,
          category: product.category,
          unit: product.unit,
          price: product.price > 0 ? String(product.price) : "",
          description: product.description ?? "",
          supplier: product.supplier ?? "",
          stock: String(product.inventory?.quantity ?? 0),
          reorderLevel: String(product.inventory?.reorderLevel ?? 0),
          published: product.status === "published",
        }
      : defaultForm,
  );
  const [current, setCurrent] = useState<StoreProduct | null>(product ?? null);
  const [saving, setSaving] = useState(false);
  const isEdit = product !== null;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("กรุณากรอกชื่อสินค้า");
      return;
    }
    const price = Number(form.price);
    if (!form.price || !Number.isFinite(price) || price <= 0) {
      toast.error("กรุณากรอกราคาให้ถูกต้อง (มากกว่า 0)");
      return;
    }
    if (form.published) {
      const stock = Number(form.stock);
      if (!Number.isFinite(stock) || stock < 0) {
        toast.error("กรุณากรอกจำนวนสต็อกให้ถูกต้อง");
        return;
      }
    }

    setSaving(true);
    try {
      if (current) {
        const updated = await updateProduct({
          productId: current.id,
          name: form.name,
          category: form.category,
          unit: form.unit.trim() || "ชิ้น",
          price,
          description: form.description || undefined,
          supplier: form.supplier || undefined,
          status: form.published ? "published" : "draft",
        });
        if (updated) {
          if (form.stock !== "") await setStock({ productId: current.id, quantity: Math.max(0, Number(form.stock)) });
          if (form.reorderLevel !== "") await setReorderLevel({ productId: current.id, reorderLevel: Math.max(0, Number(form.reorderLevel)) });
          toast.success("บันทึกสินค้าแล้ว");
          setCurrent(updated);
          onSaved?.(updated);
        }
      } else {
        const created = await createProduct({
          shopId: shop.id,
          name: form.name,
          category: form.category,
          unit: form.unit.trim() || "ชิ้น",
          price,
          description: form.description || undefined,
          supplier: form.supplier || undefined,
          status: form.published ? "published" : "draft",
          initialStock: form.stock ? Math.max(0, Number(form.stock)) : 0,
          reorderLevel: form.reorderLevel ? Math.max(0, Number(form.reorderLevel)) : undefined,
        });
        toast.success("เพิ่มสินค้าแล้ว — อัปโหลดรูปได้เลย 🖼️");
        if (created) {
          setCurrent(created);
          onSaved?.(created);
        }
      }
    } catch (error) {
      console.error("Product save error:", error);
      toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{current ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</DialogTitle>
        <DialogDescription>
          จัดการสินค้าของร้าน {shop.name} — ราคา สต็อก และรูปภาพ (อัปโหลดผ่าน Cloudinary CDN)
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="p-name">ชื่อสินค้า *</Label>
          <Input
            id="p-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="เช่น แชมพูสมุนไพร ขนาด 300 มล."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>หมวดหมู่</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v as StoreProductCategory)}>
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
            <Label htmlFor="p-unit">หน่วย</Label>
            <Input
              id="p-unit"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              placeholder="ชิ้น, กล่อง, ถุง"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="p-price">ราคาขาย (บาท) *</Label>
            <Input
              id="p-price"
              type="number"
              min="0"
              step="0.5"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="เช่น 45"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-supplier">ซัพพลายเออร์ (ไม่บังคับ)</Label>
            <Input
              id="p-supplier"
              value={form.supplier}
              onChange={(e) => set("supplier", e.target.value)}
              placeholder="ชื่อร้านค้าส่ง"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="p-stock">สต็อก (จำนวน)</Label>
            <Input
              id="p-stock"
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(e) => set("stock", e.target.value)}
              placeholder="เช่น 100"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-reorder">จุดสั่งซื้อซ้ำ</Label>
            <Input
              id="p-reorder"
              type="number"
              min="0"
              step="1"
              value={form.reorderLevel}
              onChange={(e) => set("reorderLevel", e.target.value)}
              placeholder="เช่น 20"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="p-desc">คำอธิบายสินค้า (แสดงที่หน้าร้าน)</Label>
          <Textarea
            id="p-desc"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="เช่น สูตรคลาสสิก ปราศจากสารกันเสีย"
            rows={2}
          />
        </div>

        <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 px-3 py-2.5">
          <Store className="size-4 shrink-0 text-[#10B981]" />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">ประกาศขายที่หน้าร้าน velshop</p>
            <p className="text-xs text-slate-400">ต้องตั้งราคาและสต็อกก่อนจึงจะประกาศขายได้</p>
          </div>
          <Switch checked={form.published} onCheckedChange={(v) => set("published", v)} aria-label="ประกาศขาย" />
        </div>

        {current && (
          <div className="rounded-[10px] border border-slate-200 p-4">
            <ImageUploader
              product={current}
              onChange={(updated) => {
                setCurrent(updated);
                onSaved?.(updated);
              }}
            />
          </div>
        )}

        <DialogFooter className="mt-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-slate-200 text-slate-700"
            onClick={onClose}
            disabled={saving}
          >
            {current && !isEdit ? "ปิด" : "ยกเลิก"}
          </Button>
          {(isEdit || !current) && (
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
            </Button>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function ProductFormDialog({ open, onOpenChange, shop, product, onSaved }: ProductFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <ProductFormInner
          key={product?.id ?? "new"}
          shop={shop}
          product={product ?? null}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}
