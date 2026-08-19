import { Logo } from "@velnox/shared/components/Logo";
import { UserMenu } from "@velnox/shared/components/UserMenu";
import { RefreshCw, ShoppingBag, Store, Target, Wallet } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";

const NAV_ITEMS = [
  { to: "/seller/goals", label: "แดชบอร์ดเป้าหมาย", icon: Target },
  { to: "/seller/shop", label: "ร้านของฉัน", icon: Store },
  { to: "/seller/reorder", label: "Smart Reorder", icon: RefreshCw },
  { to: "/seller/orders", label: "ออเดอร์", icon: ShoppingBag },
  { to: "/seller/income", label: "รายได้", icon: Wallet },
];

export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-5">
          <button type="button" onClick={() => navigate("/")} aria-label="Velnox">
            <Logo />
          </button>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <UserMenu />
      </div>
    </header>
  );
}
