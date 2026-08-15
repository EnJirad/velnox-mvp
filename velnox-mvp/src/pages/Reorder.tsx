import { AppHeader } from "@/components/AppHeader";
import { ProductFormDialog } from "@/components/reorder/ProductFormDialog";
import { ReorderDialog } from "@/components/reorder/ReorderDialog";
import { StockDialog } from "@/components/reorder/StockDialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  STATUS_META,
  effectiveCycleDays,
  formatDays,
  formatNumber,
  formatThaiDate,
  reorderInfo,
  type Product,
} from "@/lib/reorder";
import { formatBaht } from "@/lib/shop";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  MinusCircle,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function Reorder() {
  const products = useQuery(api.products.list);
  const purchases = useQuery(api.products.listPurchases, { limit: 10 });
  const removeProduct = useMutation(api.products.remove);
  const togglePublished = useMutation(api.products.togglePublished);

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [reorderProduct, setReorderProduct] = useState<Product | null>(null);
  const [saleProduct, setSaleProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { due, upcoming, lowStock, attention, byId } = useMemo(() => {
    const list = products ?? [];
    const dueList: Product[] = [];
    const upcomingList: Product[] = [];
    const lowList: Product[] = [];
    const attentionList: Product[] = [];
    const map = new Map<string, Product>();

    for (const p of list) {
      map.set(p._id, p);
      const info = reorderInfo(p);
      if (info.status === "due") dueList.push(p);
      if (info.status === "upcoming") upcomingList.push(p);
      if (info.lowStock) lowList.push(p);
      if (info.status === "due" || info.lowStock) attentionList.push(p);
    }

    const sortByUrgency = (a: Product, b: Product) => {
      const aInfo = reorderInfo(a);
      const bInfo = reorderInfo(b);
      const aDue = aInfo.status === "due" ? 0 : 1;
      const bDue = bInfo.status === "due" ? 0 : 1;
      if (aDue !== bDue) return aDue - bDue;
      const aLeft = aInfo.daysUntilDue ?? Number.MAX_SAFE_INTEGER;
      const bLeft = bInfo.daysUntilDue ?? Number.MAX_SAFE_INTEGER;
      return aLeft - bLeft;
    };

    return {
      due: dueList,
      upcoming: upcomingList,
      lowStock: lowList,
      attention: attentionList.sort(sortByUrgency),
      byId: map,
    };
  }, [products]);

  const recentPurchases = useMemo(() => {
    const list = purchases ?? [];
    return list
      .filter((p) => byId.has(p.productId))
      .map((p) => ({ purchase: p, product: byId.get(p.productId)! }))
      .slice(0, 6);
  }, [purchases, byId]);

  const handleTogglePublish = async (product: Product) => {
    try {
      await togglePublished({
        productId: product._id,
        published: !product.published,
      });
      toast.success(product.published ? "ปิดการขายหน้าร้านแล้ว" : "ประกาศขายหน้าร้านแล้ว 🛍️");
    } catch (error) {
      console.error("Toggle publish error:", error);
      toast.error(error instanceof Error ? error.message : "ไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;
    setDeleting(true);
    try {
      await removeProduct({ productId: deleteProduct._id });
      toast.success("ลบสินค้าแล้ว");
      setDeleteProduct(null);
    } catch (error) {
      console.error("Product delete error:", error);
      toast.error("ลบไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
              <RefreshCw className="size-4 text-[#10B981]" />
              Velnox จำแทนคุณ · Smart Reorder
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              สินค้าที่ต้องสั่งซื้อซ้ำ
            </h1>
            <p className="mt-1.5 max-w-lg text-sm leading-6 text-slate-500">
              ระบบจดจำรอบการซื้อของคุณ และเตือนเมื่อถึงเวลาที่ต้องสั่งของ —
              กดสั่งซื้อซ้ำได้ในคลิกเดียว ไม่ต้องจำเองอีกต่อไป
            </p>
          </div>
          <Button
            className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => {
              setEditingProduct(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            เพิ่มสินค้า
          </Button>
        </div>

        {/* KPI row */}
        <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="size-4" />
              <p className="text-xs font-medium uppercase tracking-wide">ต้องสั่งตอนนี้</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {due.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">เลยรอบการสั่งแล้ว</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-amber-500">
              <CalendarClock className="size-4" />
              <p className="text-xs font-medium uppercase tracking-wide">ใกล้ถึงรอบสั่ง</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {upcoming.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">อีกไม่เกิน 30% ของรอบ</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <Boxes className="size-4" />
              <p className="text-xs font-medium uppercase tracking-wide">สต็อกต่ำ</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {lowStock.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">ถึงหรือต่ำกว่าจุดสั่งซื้อซ้ำ</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <Package className="size-4" />
              <p className="text-xs font-medium uppercase tracking-wide">สินค้าทั้งหมด</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {products?.length ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-400">ในคลังของคุณ</p>
          </div>
        </div>

        {products === undefined ? (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
              <Package className="size-7 text-[#10B981]" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              ยังไม่มีสินค้าในคลัง
            </h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              เพิ่มสินค้าที่คุณสั่งซื้อเป็นประจำ พร้อมจุดสั่งซื้อซ้ำ
              แล้ว Velnox จะเรียนรู้รอบการสั่งและเตือนคุณเอง
            </p>
            <Button
              className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => {
                setEditingProduct(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              เพิ่มสินค้าแรก
            </Button>
          </div>
        ) : (
          <>
            {/* Attention list */}
            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  ถึงเวลาสั่งซื้อแล้ว
                </h2>
                <span className="text-xs text-slate-400">
                  {attention.length} รายการที่ต้องการความสนใจ
                </span>
              </div>

              {attention.length === 0 ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
                  <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                    <CheckCircle2 className="size-4 text-[#10B981]" />
                  </span>
                  <p className="text-sm text-slate-500">
                    ไม่มีสินค้าที่ต้องสั่งตอนนี้ — ทุกอย่างอยู่ในรอบที่ Velnox จำไว้ 🎉
                  </p>
                </div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {attention.map((product) => {
                    const meta = PRODUCT_CATEGORY_META[product.category];
                    const info = reorderInfo(product);
                    const statusMeta = STATUS_META[info.status];
                    const cycle = effectiveCycleDays(product);
                    const Icon = meta.icon;
                    return (
                      <div
                        key={product._id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex size-9 items-center justify-center rounded-[10px] ring-1 ring-inset ${meta.chip}`}
                            >
                              <Icon className={`size-4 ${meta.iconClass}`} />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                              <p className="mt-0.5 text-xs text-slate-400">{meta.label}</p>
                            </div>
                          </div>
                          <Badge
                            className={`gap-1 rounded-full ring-1 ring-inset ${statusMeta.badge}`}
                          >
                            <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                            {statusMeta.label}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between rounded-[10px] bg-slate-50 px-3 py-2.5 text-xs">
                          <span className="text-slate-500">
                            สต็อก{" "}
                            <span className="font-semibold text-slate-900">
                              {formatNumber(product.currentStock)} {product.unit}
                            </span>
                          </span>
                          <span className="text-slate-400">
                            จุดสั่งซื้อซ้ำ {formatNumber(product.reorderLevel)} {product.unit}
                          </span>
                        </div>

                        <p className="flex items-center gap-1.5 text-xs text-slate-400">
                          <RefreshCw className="size-3.5 text-[#10B981]" />
                          {cycle !== undefined ? (
                            <>
                              รอบการซื้อเฉลี่ย {formatDays(cycle)}
                              {info.daysUntilDue !== undefined &&
                                (info.daysUntilDue > 0 ? (
                                  <span>· เหลืออีก {formatDays(info.daysUntilDue)}</span>
                                ) : (
                                  <span className="font-medium text-rose-600">
                                    · เลยกำหนด {formatDays(-info.daysUntilDue)}
                                  </span>
                                ))}
                            </>
                          ) : (
                            "ยังไม่มีรอบการซื้อ — สั่งครั้งแรกเพื่อให้ระบบเรียนรู้"
                          )}
                        </p>

                        <div className="mt-auto flex gap-2">
                          <Button
                            className="flex-1 gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                            onClick={() => setReorderProduct(product)}
                          >
                            <RefreshCw className="size-4" />
                            สั่งซื้อซ้ำ
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                            onClick={() => setSaleProduct(product)}
                            aria-label={`บันทึกการขาย ${product.name}`}
                          >
                            <MinusCircle className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Inventory table */}
            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">คลังสินค้าทั้งหมด</h2>
                <span className="text-xs text-slate-400">{products.length} รายการ</span>
              </div>

              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 text-slate-400">สินค้า</TableHead>
                      <TableHead className="text-slate-400">สต็อก</TableHead>
                      <TableHead className="text-slate-400">รอบการซื้อ</TableHead>
                      <TableHead className="text-slate-400">สั่งล่าสุด</TableHead>
                      <TableHead className="text-slate-400">สถานะ</TableHead>
                      <TableHead className="pr-5 text-right text-slate-400">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const meta = PRODUCT_CATEGORY_META[product.category];
                      const info = reorderInfo(product);
                      const statusMeta = STATUS_META[info.status];
                      const cycle = effectiveCycleDays(product);
                      const Icon = meta.icon;
                      return (
                        <TableRow key={product._id} className="hover:bg-slate-50/60">
                          <TableCell className="pl-5">
                            <div className="flex items-center gap-3">
                              <span
                                className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset ${meta.chip}`}
                              >
                                <Icon className={`size-4 ${meta.iconClass}`} />
                              </span>
                              <div>
                                <p className="font-medium text-slate-900">{product.name}</p>
                                <p className="text-xs text-slate-400">
                                  {meta.label}
                                  {product.price !== undefined && ` · ${formatBaht(product.price)}`}
                                  {product.supplier && ` · ${product.supplier}`}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium tabular-nums text-slate-900">
                              {formatNumber(product.currentStock)}{" "}
                              <span className="text-xs font-normal text-slate-400">{product.unit}</span>
                            </p>
                            <p className="text-xs text-slate-400">
                              จุดสั่งซื้อซ้ำ {formatNumber(product.reorderLevel)}
                            </p>
                          </TableCell>
                          <TableCell>
                            {cycle !== undefined ? (
                              <p className="font-medium tabular-nums text-slate-900">
                                {formatDays(cycle)}
                              </p>
                            ) : (
                              <p className="text-slate-400">—</p>
                            )}
                            <p className="text-xs text-slate-400">
                              {product.purchaseCount > 0
                                ? `เรียนรู้จาก ${product.purchaseCount} ครั้ง`
                                : product.estimatedCycleDays
                                  ? "คาดการณ์จากที่ตั้งไว้"
                                  : "ยังไม่มีการสั่ง"}
                            </p>
                          </TableCell>
                          <TableCell>
                            {product.lastOrderedAt !== undefined ? (
                              <p className="text-sm text-slate-600">
                                {formatThaiDate(product.lastOrderedAt)}
                              </p>
                            ) : (
                              <p className="text-slate-400">—</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-1">
                              <Badge
                                className={`gap-1 rounded-full ring-1 ring-inset ${statusMeta.badge}`}
                              >
                                <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                                {statusMeta.label}
                              </Badge>
                              {info.lowStock && (
                                <Badge className="gap-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15 hover:bg-rose-50">
                                  สต็อกต่ำ
                                </Badge>
                              )}
                              {product.published && (
                                <Badge className="gap-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15 hover:bg-emerald-50">
                                  ขายหน้าร้าน
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <MoreHorizontal className="size-4" />
                                  <span className="sr-only">การจัดการ {product.name}</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => setReorderProduct(product)}
                                >
                                  <RefreshCw className="size-4" />
                                  สั่งซื้อซ้ำ
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => setSaleProduct(product)}
                                >
                                  <MinusCircle className="size-4" />
                                  บันทึกการขาย / ใช้ไป
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => handleTogglePublish(product)}
                                >
                                  {product.published ? (
                                    <EyeOff className="size-4" />
                                  ) : (
                                    <Eye className="size-4" />
                                  )}
                                  {product.published
                                    ? "ปิดการขายหน้าร้าน"
                                    : "ประกาศขายหน้าร้าน"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil className="size-4" />
                                  แก้ไขสินค้า
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600"
                                  onClick={() => setDeleteProduct(product)}
                                >
                                  <Trash2 className="size-4" />
                                  ลบสินค้า
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>

            {/* Recent reorder history */}
            {recentPurchases.length > 0 && (
              <section className="mt-8">
                <h2 className="text-base font-semibold text-slate-900">ประวัติการสั่งซื้อล่าสุด</h2>
                <div className="mt-3 space-y-2">
                  {recentPurchases.map(({ purchase, product }) => (
                    <div
                      key={purchase._id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-[10px] bg-slate-100">
                          <RefreshCw className="size-3.5 text-slate-500" />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-400">{formatThaiDate(purchase.orderedAt)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-slate-900">
                          +{formatNumber(purchase.quantity)} {product.unit}
                        </p>
                        {purchase.cost !== undefined && (
                          <p className="text-xs text-slate-400">
                            ฿{formatNumber(purchase.cost)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Dialogs */}
      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editingProduct} />
      <ReorderDialog
        product={reorderProduct}
        open={reorderProduct !== null}
        onOpenChange={(open) => {
          if (!open) setReorderProduct(null);
        }}
      />
      <StockDialog
        product={saleProduct}
        open={saleProduct !== null}
        onOpenChange={(open) => {
          if (!open) setSaleProduct(null);
        }}
      />

      <AlertDialog
        open={deleteProduct !== null}
        onOpenChange={(open) => !open && setDeleteProduct(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบสินค้านี้?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteProduct?.name}” และประวัติการสั่งซื้อทั้งหมดจะถูกลบถาวร
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "กำลังลบ..." : "ลบสินค้า"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
