import { ShopHeader } from "@/components/shop/ShopHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { setSeo } from "@/lib/seo";
import { useAction } from "convex/react";
import { ArrowRight, Boxes, ImageOff, LayoutGrid, Package } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

interface CategoryNode {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  level: number;
  productCount: number;
  children: CategoryNode[];
}

export default function ShopCategories() {
  const categoryStats = useAction(api.customer.categoryStatsAction);
  const [tree, setTree] = useState<CategoryNode[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = (await categoryStats()) as unknown as CategoryNode[];
      setTree(rows ?? []);
    } catch (err) {
      console.error("Categories error:", err);
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [categoryStats]);

  useEffect(() => {
    setSeo({
      title: "หมวดหมู่สินค้า — VelShop",
      description: "เลือกหมวดหมู่เพื่อค้นหาสินค้าจากร้านค้าจริงทั่วตลาด Velnox",
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const countFor = (node: CategoryNode): number =>
    node.productCount + node.children.reduce((sum, c) => sum + countFor(c), 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
            <LayoutGrid className="size-4 text-[#10B981]" />
            หมวดหมู่สินค้า · มาร์เก็ตเพลส Velnox
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            หมวดหมู่ทั้งหมด
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
            เลือกหมวดหมู่เพื่อค้นหาสินค้าที่คุณต้องการ — ข้อมูลมาจากร้านค้าจริงทั่วตลาด
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : !tree || tree.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <Boxes className="size-8 text-slate-300" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">ยังไม่มีหมวดหมู่</h2>
            <p className="mt-1.5 text-sm text-slate-500">หมวดหมู่จะแสดงเมื่อมีสินค้าวางขาย</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tree.map((root) => {
              const total = countFor(root);
              const to = `/shop/products?category=${encodeURIComponent(root.slug ?? root.id)}`;
              return (
                <div
                  key={root.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
                >
                  <Link to={to} className="block">
                    <div className="flex h-24 items-center gap-4 bg-gradient-to-r from-[#0f766e] via-[#10B981] to-[#34d399] px-5">
                      {root.imageUrl ? (
                        <img src={root.imageUrl} alt="" className="size-12 rounded-[12px] object-cover" loading="lazy" />
                      ) : (
                        <span className="flex size-12 items-center justify-center rounded-[12px] bg-white/20 backdrop-blur">
                          <Package className="size-6 text-white" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold tracking-tight text-white">{root.name}</h2>
                        <p className="text-xs text-emerald-50/90">
                          {total} สินค้า{root.description ? ` · ${root.description}` : ""}
                        </p>
                      </div>
                    </div>
                  </Link>

                  {root.children.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-5 pt-4">
                      {root.children.map((child) => (
                        <Link
                          key={child.id}
                          to={`/shop/products?category=${encodeURIComponent(child.slug ?? child.id)}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-[#10B981]/40 hover:bg-[#ECFDF5] hover:text-emerald-700"
                        >
                          {child.name} · {child.productCount}
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto p-5 pt-4">
                    <Button
                      variant="ghost"
                      className="h-8 w-full gap-1 text-xs text-slate-500 hover:bg-[#ECFDF5] hover:text-emerald-700"
                      asChild
                    >
                      <Link to={to}>
                        ดูสินค้าในหมวดนี้
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
