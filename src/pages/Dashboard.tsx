import { api } from "@/convex/_generated/api";
import { StoreHeader } from "@/components/StoreHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import { Sparkles, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

const CATEGORY_STYLES: Record<string, string> = {
  เสื้อผ้า: "from-amber-100/90 to-orange-50",
  กระเป๋า: "from-stone-100 to-stone-200/80",
  เครื่องประดับ: "from-sky-100/80 to-cyan-50",
  รองเท้า: "from-slate-100 to-slate-200/80",
  ของใช้: "from-emerald-100/80 to-teal-50",
  อิเล็กทรอนิกส์: "from-violet-100/80 to-purple-50",
};

function tileStyle(category: string) {
  return (
    CATEGORY_STYLES[category] ??
    "from-neutral-100 to-neutral-200/80"
  );
}

function formatPrice(value: number) {
  return value.toLocaleString("th-TH");
}

export default function Dashboard() {
  const products = useQuery(api.products.list);
  const seed = useMutation(api.products.seed);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (products !== undefined && products.length === 0) {
      void seed();
    }
  }, [products, seed]);

  const categories = useMemo(() => {
    if (!products) return [];
    return Array.from(new Set(products.map((p) => p.category)));
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (!products) return undefined;
    return category
      ? products.filter((p) => p.category === category)
      : products;
  }, [products, category]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StoreHeader />

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        {/* Hero strip */}
        <section className="relative overflow-hidden rounded-2xl border bg-card px-6 py-10 shadow-sm sm:px-10 sm:py-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-brand/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 left-1/3 size-56 rounded-full bg-secondary blur-3xl"
          />
          <div className="relative flex flex-col items-start gap-4 sm:max-w-xl">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="size-3 text-brand" />
              ของใหม่มาถึงแล้วทุกสัปดาห์
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              สินค้าคัดสรร
              <br />
              <span className="text-brand">เรียบง่าย สวยงาม คุ้มค่า</span>
            </h1>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              VelShop คัดสรรของใช้คุณภาพดี ดีไซน์มินิมอล จัดส่งไวทั่วไทย
              เปลี่ยนคืนง่ายภายใน 7 วัน
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <Truck className="size-4 text-brand" />
              จัดส่งฟรีเมื่อสั่งซื้อครบ 990 บาท
            </div>
          </div>
        </section>

        {/* Category filter */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              category === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            ทั้งหมด
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                category === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {visibleProducts === undefined ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border bg-card shadow-sm"
              >
                <Skeleton className="aspect-square w-full rounded-none" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            ไม่พบสินค้าในหมวดนี้
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <article
                key={product._id}
                className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className={cn(
                    "flex aspect-square items-center justify-center bg-gradient-to-br",
                    tileStyle(product.category),
                  )}
                >
                  <span
                    aria-hidden
                    className="text-6xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
                  >
                    {product.emoji}
                  </span>
                </div>
                <div className="space-y-1.5 p-4">
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {product.category}
                  </Badge>
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                    {product.name}
                  </h3>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {product.description}
                  </p>
                  <p className="pt-1 text-base font-bold tracking-tight">
                    ฿{formatPrice(product.price)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* CTA into profile */}
        <section className="mt-14 flex flex-col items-center gap-4 rounded-2xl border bg-card px-6 py-10 text-center shadow-sm sm:py-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            จัดการบัญชีของคุณได้ที่หน้าโปรไฟล์
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            อัปโหลดรูปโปรไฟล์และรูปปก แก้ไขข้อมูลส่วนตัว และติดตามคำสั่งซื้อได้ในที่เดียว
          </p>
          <Button asChild>
            <Link to="/profile">ไปที่โปรไฟล์</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p className="font-semibold text-foreground">VelShop</p>
          <p className="text-xs">
            © {new Date().getFullYear()} VelShop — ช้อปปิ้งออนไลน์ที่เรียบง่ายและสวยงาม
          </p>
        </div>
      </footer>
    </div>
  );
}
