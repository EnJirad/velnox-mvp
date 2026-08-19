import { Link, useLocation } from "react-router";
import { cn } from "@velnox/shared/lib/utils";
import { useLanguage } from "@velnox/shared/lib/i18n";
import type { LucideIcon } from "lucide-react";

export interface MobileTabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /**
   * Custom active check. Default: exact path or `pathname.startsWith(to + "/")`
   * (e.g. /orders matches the /orders tab).
   */
  activeMatch?: (pathname: string, search: string) => boolean;
  /** Optional badge count (e.g. cart item count). Hidden when 0 / null. */
  badge?: number | null;
}

/**
 * App-like floating bottom navigation for mobile (native-app feel). Hidden on
 * md+, where the desktop top-header navigation takes over.
 *
 * The bar is `position: fixed` so it stays attached to the viewport while the
 * page scrolls, and it floats above the content as a rounded, elevated pill
 * (12px gutters + 12px bottom offset + safe-area inset) instead of a
 * full-width footer strip. The outer wrapper is pointer-transparent so taps
 * beside the pill fall through to the page.
 *
 * Page content reserves room for it via the `.site-app` mobile bottom padding
 * (4.75rem + env(safe-area-inset-bottom)) in the shared global CSS.
 *
 * Every site entry renders one of these inside its router:
 *   velshop    → / · /products · /cart · /orders · /profile
 *   velseller  → เป้าหมาย / ร้านของฉัน / ออเดอร์ / รายได้ / สั่งซื้อซ้ำ
 *   velcenter  → rendered inside Center.tsx so it respects role permissions
 */
export function MobileTabBar({ items }: { items: MobileTabItem[] }) {
  const { t } = useLanguage();
  const { pathname, search } = useLocation();

  // The auth flow is a full-screen sheet — hide the tab bar there.
  if (pathname.startsWith("/auth")) return null;

  return (
    <nav
      aria-label={t("nav.ariaMobile")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="pointer-events-auto flex h-16 w-full max-w-md items-stretch rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_10px_34px_rgba(15,23,42,0.14)] backdrop-blur">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.activeMatch
            ? item.activeMatch(pathname, search)
            : pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors",
                active
                  ? "text-[#10B981]"
                  : "text-slate-400 hover:text-slate-600 active:text-slate-500",
              )}
            >
              <span
                className={cn(
                  "relative flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                  active && "bg-[#ECFDF5]",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#10B981] px-1 text-[10px] font-bold leading-none text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none",
                  active ? "font-semibold" : "font-medium",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
