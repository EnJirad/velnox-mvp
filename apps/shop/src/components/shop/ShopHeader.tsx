import { CartDrawer } from "@/components/shop/CartDrawer";
import { Logo } from "@velnox/shared/components/Logo";
import { SiteSwitcher } from "@velnox/shared/components/SiteSwitcher";
import { UserMenu } from "@velnox/shared/components/UserMenu";
import { Button } from "@velnox/shared/components/ui/button";
import { Input } from "@velnox/shared/components/ui/input";
import { useAuth } from "@velnox/shared/hooks/use-auth";
import { SITE_URLS } from "@velnox/shared/lib/sites";
import { useCart } from "@/lib/cart";
import { Bell, RefreshCw, Search, ShoppingCart, User } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

export function ShopHeader() {
  const { isAuthenticated, isLoading } = useAuth();
  const { count } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState("");

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop/products?q=${encodeURIComponent(q)}` : "/shop/products");
  };

  const navItem = (to: string, label: string, exact = false) => {
    const active = exact ? location.pathname === to : location.pathname.startsWith(to);
    return (
      <Link
        to={to}
        className={`rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors ${
          active
            ? "bg-slate-100 text-slate-900"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-5">
          <Link to="/shop" aria-label="velshop">
            <Logo />
          </Link>
          <SiteSwitcher />
          <nav className="hidden items-center gap-1 md:flex">
            {navItem("/shop", "หน้าแรก", true)}
            {navItem("/shop/products", "สินค้า")}
            {navItem("/shop/categories", "หมวดหมู่")}
            {isAuthenticated && navItem("/shop/orders", "ออเดอร์")}
            {isAuthenticated && navItem("/shop/wishlist", "รายการโปรด")}
            <a
              href={SITE_URLS.velseller}
              className="rounded-[10px] px-3 py-1.5 text-sm font-semibold text-[#10B981] transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            >
              ขายของ
            </a>
          </nav>
        </div>

        {/* Search (desktop) */}
        <form onSubmit={submitSearch} className="relative hidden w-full max-w-[220px] xl:max-w-xs lg:block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาสินค้า..."
            className="h-9 rounded-[10px] border-slate-200 bg-slate-50 pl-9 text-sm focus:bg-white"
            aria-label="ค้นหาสินค้า"
          />
        </form>

        <div className="flex items-center gap-1.5">
          {/* Search (mobile) */}
          <Button
            variant="ghost"
            className="cursor-pointer rounded-[10px] px-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => navigate("/shop/products")}
            aria-label="ค้นหาสินค้า"
          >
            <Search className="size-5" />
          </Button>
          {isAuthenticated && (
            <Link
              to="/shop/velrepeat"
              className="rounded-[10px] p-2 text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="การสั่งซื้ออัตโนมัติ (VelRepeat)"
            >
              <RefreshCw className="size-5" />
            </Link>
          )}
          {isAuthenticated && (
            <Link
              to="/shop/notifications"
              className="rounded-[10px] p-2 text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="การแจ้งเตือน"
            >
              <Bell className="size-5" />
            </Link>
          )}
          <Button
            variant="ghost"
            className="relative cursor-pointer rounded-[10px] px-2.5 text-slate-600 hover:bg-slate-100"
            onClick={() => setCartOpen(true)}
            aria-label="เปิดตะกร้าสินค้า"
          >
            <ShoppingCart className="size-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-[#10B981] text-[11px] font-bold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Button>

          {isLoading ? null : isAuthenticated ? (
            <Link
              to="/shop/profile"
              className="rounded-[10px] p-2 text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="โปรไฟล์"
            >
              <User className="size-5" />
            </Link>
          ) : (
            <Button variant="outline" className="border-slate-200 text-slate-700" asChild>
              <Link to="/auth?returnTo=/shop">เข้าสู่ระบบ</Link>
            </Button>
          )}
        </div>
      </div>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </header>
  );
}
