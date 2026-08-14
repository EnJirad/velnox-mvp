import { AppHeader } from "@/components/AppHeader";
import { ProductFormDialog } from "@/components/seller/ProductFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import {
  PRODUCT_CATEGORY_META,
  formatBaht,
  type SellerProfile,
  type StoreProduct,
  type StoreShop,
} from "@/lib/commerce";
import { useAction } from "convex/react";
import {
  BadgePercent,
  Eye,
  EyeOff,
  ImageOff,
  Loader2,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  Store,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const EMPTY_ONBOARD = { shopName: "", slug: "", description: "", taxId: "" };

export default function MyShop() {
  const mySellerProfile = useAction(api.commerce.mySellerProfile);
  const openShop = useAction(api.commerce.openShop);
  const listProducts = useAction(api.commerce.listProducts);
  const setStatus = useAction(api.commerce.setProductStatusAction);
  const deleteProduct = useAction(api.commerce.deleteProductAction);

  const [profile, setProfile] = useState<SellerProfile | null | undefined>(undefined);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [onboard, setOnboard] = useState(EMPTY_ONBOARD);
  const [opening, setOpening] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [deleting, setDeleting] = useState<StoreProduct | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const shop: StoreShop | null = profile?.shops[0] ?? null;

  const reloadProducts = useCallback(async () => {
    try {
      const list = await listProducts({ mine: true, limit: 200 });
      setProducts(list);
    } catch (error) {
      console.error("Load products error:", error);
    }
  }, [listProducts]);

  useEffect(() => {
    let alive = true;
    mySellerProfile()
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        if (p) reloadProducts();
      })
      .catch(() => alive && setProfile(null));
    return () => {
      alive = false;
    };
  }, [mySellerProfile, reloadProducts]);

  const handleOpenShop = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onboard.shopName.trim()) {
      toast.error("กรุณากรอกชื่อร้านค้า");
      return;
    }
    setOpening(true);
    try {
      await openShop({
        shopName: onboard.shopName.trim(),
        slug: onboard.slug.trim() || undefined,
        description: onboard.description.trim() || undefined,
        taxId: onboard.taxId.trim() || undefined,
      });
      toast.success("เปิดร้านค้าแล้ว 🎉 — จัดการสินค้าได้เลย");
      setProfile(await mySellerProfile());
    } catch (error) {
      console.error("Open shop error:", error);
      toast.error(error instanceof Error ? error.message : "เปิดร้านไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setOpening(false);
    }
  };

  const handleTogglePublish = async (product: StoreProduct) => {
    setTogglingId(product.id);
    try {
      const next = product.status === "published" ? "draft" : "published";
      const updated = await setStatus({ productId: product.id, status: next });
      toast.success(next === "published" ? "ประกาศขายหน้าร้านแล้ว 🛍️" : "ปิดการขายแล้ว");
      if (updated) {
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    } catch (error) {
      console.error("Toggle publish error:", error);
      toast.error(error instanceof Error ? error.message : "ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteProduct({ productId: deleting.id });
      toast.success("ลบสินค้าแล้ว");
      setProducts((prev) => prev.filter((p) => p.id !== deleting.id));
      setDeleting(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error instanceof Error ? error.message : "ลบไม่สำเร็จ");
    } finally {
      setDeletingBusy(false);
    }
  };

  // ---------------------------------------------------------------- onboarding
  if (profile === undefined) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <AppHeader />
        <main className="flex min-h-[60vh] items-center justify-center px-4">
          <Loader2 className="size-6 animate-spin text-slate-300" />
        </main>
      </div>
    );
  }

  if (profile === null || !shop) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <AppHeader />
        <main className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
              <Store className="size-7 text-[#10B981]" />
            </span>
            <h1 className="mt-5 text-center text-xl font-bold tracking-tight text-slate-900">
              เปิดร้านค้าของคุณกับ Velnox
            </h1>
            <p className="mt-2 text-center text-sm leading-6 text-slate-500">
              เริ่มขายสินค้าที่หน้าร้าน velshop — ค่าธรรมเนียมเพียง 3% ต่อชิ้น
              พร้อมนโยบายตีกลับครอบคลุมไม่เกิน 10% ของยอดขาย
            </p>

            <form onSubmit={handleOpenShop} className="mt-6 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="shop-name">ชื่อร้านค้า *</Label>
                <Input
                  id="shop-name"
                  value={onboard.shopName}
                  onChange={(e) => setOnboard((p) => ({ ...p, shopName: e.target.value }))}
                  placeholder="เช่น ร้านสมุนไพรบ้านนา"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shop-slug">ที่อยู่หน้าร้าน (ไม่บังคับ)</Label>
                <Input
                  id="shop-slug"
                  value={onboard.slug}
                  onChange={(e) => setOnboard((p) => ({ ...p, slug: e.target.value }))}
                  placeholder="herb-home"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shop-desc">คำโปรยร้าน (ไม่บังคับ)</Label>
                <Textarea
                  id="shop-desc"
                  value={onboard.description}
                  onChange={(e) => setOnboard((p) => ({ ...p, description: e.target.value }))}
                  placeholder="สินค้าสมุนไพรคัดสรรจากสวนของเรา"
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shop-tax">เลขทะเบียนภาษี / เลขผู้เสียภาษี (ไม่บังคับ)</Label>
                <Input
                  id="shop-tax"
                  value={onboard.taxId}
                  onChange={(e) => setOnboard((p) => ({ ...p, taxId: e.target.value }))}
                  placeholder="เลข 13 หลัก"
                />
              </div>
              <Button
                type="submit"
                className="mt-2 gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                disabled={opening}
              >
                {opening && <Loader2 className="size-4 animate-spin" />}
                เปิดร้านค้า
              </Button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // ------------------------------------------------------------------ dashboard
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
              <Store className="size-4 text-[#10B981]" />
              velseller · ร้านของฉัน
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {shop.name}
            </h1>
            <p className="mt-1.5 max-w-lg text-sm leading-6 text-slate-500">
              {shop.description || "จัดการสินค้า รูปภาพ และสต็อกของคุณ — ขายที่หน้าร้าน velshop"}
            </p>
          </div>
          <Button
            className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            เพิ่มสินค้า
          </Button>
        </div>

        {/* shop summary */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
              <Store className="size-5 text-[#10B981]" />
            </span>
            <div>
              <p className="text-xs text-slate-400">ร้านค้า</p>
              <p className="text-sm font-semibold text-slate-900">{shop.name}</p>
              {shop.slug && <p className="text-xs text-slate-400">velshop/{shop.slug}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-slate-100">
              <BadgePercent className="size-5 text-slate-600" />
            </span>
            <div>
              <p className="text-xs text-slate-400">ค่าธรรมเนียม Velnox</p>
              <p className="text-sm font-semibold text-slate-900">
                {(shop.commissionRate * 100).toLocaleString("th-TH")}% ต่อชิ้น
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
              <ShieldCheck className="size-5 text-[#10B981]" />
            </span>
            <div>
              <p className="text-xs text-slate-400">นโยบายตีกลับ</p>
              <p className="text-sm font-semibold text-slate-900">ครอบคลุมไม่เกิน 10% ของยอดขาย</p>
            </div>
          </div>
        </div>

        {/* products */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">สินค้าของฉัน</h2>
            <span className="text-xs text-slate-400">{products.length} รายการ</span>
          </div>

          {products.length === 0 ? (
            <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
                <Package className="size-7 text-[#10B981]" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">ยังไม่มีสินค้า</h3>
              <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
                เพิ่มสินค้าตัวแรกพร้อมอัปโหลดรูป — เมื่อประกาศขาย ลูกค้าจะเห็นที่หน้าร้าน velshop ทันที
              </p>
              <Button
                className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" />
                เพิ่มสินค้าแรก
              </Button>
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-slate-400">สินค้า</TableHead>
                    <TableHead className="text-slate-400">ราคา</TableHead>
                    <TableHead className="text-slate-400">สต็อก</TableHead>
                    <TableHead className="text-slate-400">สถานะ</TableHead>
                    <TableHead className="pr-5 text-right text-slate-400">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const available = product.inventory?.available ?? product.inventory?.quantity ?? 0;
                    return (
                      <TableRow key={product.id} className="hover:bg-slate-50/60">
                        <TableCell className="pl-5">
                          <div className="flex items-center gap-3">
                            {product.primaryImage ? (
                              <img
                                src={product.primaryImage.thumbUrl || product.primaryImage.url}
                                alt={product.name}
                                className="size-12 shrink-0 rounded-[10px] object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-slate-100">
                                <ImageOff className="size-5 text-slate-300" />
                              </span>
                            )}
                            <div>
                              <p className="font-medium text-slate-900">{product.name}</p>
                              <p className="text-xs text-slate-400">
                                {PRODUCT_CATEGORY_META[product.category].label}
                                {product.images && product.images.length > 0
                                  ? ` · ${product.images.length} รูป`
                                  : " · ยังไม่มีรูป"}
                                {product.supplier ? ` · ${product.supplier}` : ""}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium tabular-nums text-slate-900">
                            {formatBaht(product.price)}
                            <span className="text-xs font-normal text-slate-400"> / {product.unit}</span>
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium tabular-nums text-slate-900">{available}</p>
                          <p className="text-xs text-slate-400">
                            {product.inventory?.reservedQuantity
                              ? `จองแล้ว ${product.inventory.reservedQuantity} · จุดสั่งซื้อซ้ำ ${product.inventory.reorderLevel}`
                              : `จุดสั่งซื้อซ้ำ ${product.inventory?.reorderLevel ?? 0}`}
                          </p>
                        </TableCell>
                        <TableCell>
                          {product.status === "published" ? (
                            <Badge className="gap-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15 hover:bg-emerald-50">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              ขายหน้าร้าน
                            </Badge>
                          ) : (
                            <Badge className="gap-1 rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-600/10 hover:bg-slate-100">
                              <span className="size-1.5 rounded-full bg-slate-400" />
                              ฉบับร่าง
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-slate-200 text-slate-600"
                              onClick={() => handleTogglePublish(product)}
                              disabled={togglingId === product.id}
                            >
                              {togglingId === product.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : product.status === "published" ? (
                                <EyeOff className="size-3.5" />
                              ) : (
                                <Eye className="size-3.5" />
                              )}
                              {product.status === "published" ? "ปิดขาย" : "ประกาศขาย"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-slate-200 text-slate-600"
                              onClick={() => {
                                setEditing(product);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-3.5" />
                              แก้ไข
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              onClick={() => setDeleting(product)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </main>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        shop={shop}
        product={editing}
        onSaved={(updated) => {
          setProducts((prev) => {
            const exists = prev.some((p) => p.id === updated.id);
            return exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev];
          });
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบสินค้านี้?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.name}” จะถูกลบออกจากร้านค้า พร้อมรูปภาพและข้อมูลสต็อกทั้งหมด
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={deletingBusy}
            >
              {deletingBusy ? "กำลังลบ..." : "ลบสินค้า"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
