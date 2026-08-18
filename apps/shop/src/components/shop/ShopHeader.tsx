import { CartDrawer } from "@/components/shop/CartDrawer";
import { LanguageSwitcher } from "@/components/shop/LanguageSwitcher";
import { Logo } from "@velnox/shared/components/Logo";
import { Button } from "@velnox/shared/components/ui/button";
import { Input } from "@velnox/shared/components/ui/input";
import { useAuth } from "@velnox/shared/hooks/use-auth";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/i18n";
import { Search, ShoppingCart, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

/**
 * VelShop header — kept deliberately minimal so shopping stays the focus.
 * Desktop: logo · Home/Products/Categories · search · language · cart · account.
 * Mobile: logo · search · cart · account (the bottom tab bar is the menu).
 * Everything else (wishlist, notifications, VelRepeat) lives in the profile
 * hub, not the header.
 */
export function ShopHeader() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { count } = useCart();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [imgFailed, setImgFailed] = useState(false);

  // Reset image-failed flag when user changes (e.g. re-login)
  useEffect(() => {
    setImgFailed(false);
  }, [user?.image]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  };

  const navItem = (to: string, label: string, exact = false) => {
    const active = exact ? location.pathname === to : location.pathname.startsWith(to);
    return (
      <Link
        to={to}
        className={`rounded-[10px] px-3 py-2 text-sm font-medium transition-colors ${
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
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        {/* Brand */}
        <Link to="/" aria-label={t("header.ariaHome", { name: "VelShop" })} className="shrink-0">
          <Logo />
        </Link>

        {/* Desktop navigation */}
        <nav className="ml-3 hidden items-center gap-1 md:flex" aria-label={t("nav.home")}>
          {navItem("/", t("nav.home"), true)}
          {navItem("/products", t("nav.products"))}
          {navItem("/categories", t("nav.categories"))}
        </nav>

        {/* Search (desktop) */}
        <form
          onSubmit={submitSearch}
          className="relative ml-auto hidden w-full max-w-[240px] lg:block"
        >
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("header.searchPlaceholder")}
            className="h-9 rounded-[10px] border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:bg-white"
            aria-label={t("header.ariaSearch")}
          />
        </form>

        {/* Utility actions */}
        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          {/* Search (mobile) */}
          <Button
            variant="ghost"
            size="icon"
            className="size-10 cursor-pointer rounded-[10px] text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => navigate("/products")}
            aria-label={t("header.ariaSearch")}
          >
            <Search className="size-5" />
          </Button>

          <div className="hidden md:block">
            <LanguageSwitcher variant="desktop" />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="relative size-10 cursor-pointer rounded-[10px] text-slate-600 hover:bg-slate-100"
            onClick={() => setCartOpen(true)}
            aria-label={t("header.ariaCart")}
          >
            <ShoppingCart className="size-5" />
            {count > 0 && (
              <span className="absolute right-0 top-0 flex size-5 items-center justify-center rounded-full bg-[#10B981] text-[11px] font-bold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Button>

          {isLoading ? null : isAuthenticated ? (
            <Link
              to="/profile"
              className="flex size-10 items-center justify-center rounded-[10px] text-slate-600 transition-colors hover:bg-slate-100"
              aria-label={t("header.ariaProfile")}
            >
              {user?.image && !imgFailed ? (
                <img
                  src={user.image}
                  alt=""
                  className="size-7 rounded-full object-cover"
                  loading="eager"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <User className="size-5" />
              )}
            </Link>
          ) : (
            <Button
              variant="outline"
              className="h-9 border-slate-200 text-slate-700"
              asChild
            >
              <Link to="/auth?returnTo=/">{t("header.login")}</Link>
            </Button>
          )}
        </div>
      </div>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </header>
  );
}
