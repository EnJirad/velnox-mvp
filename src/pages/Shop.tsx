import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/ProductCard";
import { ShopNav } from "@/components/ShopNav";
import { CartDrawer } from "@/components/CartDrawer";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Loader2, PackageSearch, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category") ?? undefined;
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  const ensureSeedData = useMutation(api.seed.ensureSeedData);
  const categories = useQuery(api.products.getCategories);
  const products = useQuery(api.products.getPublicProducts, {
    categoryId: selectedCategory as Id<"categories"> | undefined,
    search: debounced || undefined,
  });

  useEffect(() => {
    void ensureSeedData();
  }, [ensureSeedData]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ShopNav />
      <CartDrawer />

      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">
                Marketplace
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything, moving fast.
              </h1>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                !selectedCategory
                  ? "border-lime-500/50 bg-lime-500/10 text-lime-300"
                  : "border-border/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {(categories ?? []).map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSearchParams({ category: category.id })}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  selectedCategory === category.id
                    ? "border-lime-500/50 bg-lime-500/10 text-lime-300"
                    : "border-border/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {category.name.en}
              </button>
            ))}
          </div>

          {products === undefined ? (
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Loading marketplace…
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 py-24 text-center">
              <PackageSearch className="size-10 text-muted-foreground" />
              <div>
                <p className="font-semibold">No products found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different search or category.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  image={product.images[0]}
                  sellerName={product.sellerName}
                  stock={product.stock}
                  reserved={product.reserved}
                  totalSold={product.totalSold}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl border border-lime-500/25 bg-gradient-to-r from-lime-400/10 to-transparent p-8 text-center">
          <p className="text-lg font-bold tracking-tight">
            Got something to sell?
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Open a Velseller store, list your products, and start earning in
            the same day your application is approved.
          </p>
          <Button asChild className="cursor-pointer">
            <Link to="/seller">Apply to sell</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
