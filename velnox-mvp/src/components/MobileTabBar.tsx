import { Link, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface MobileTabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /**
   * Custom active check. Default: exact path or `pathname.startsWith(to + "/")`
   * (e.g. /shop/orders matches the /shop/orders tab).
   */
  activeMatch?: (pathname: string, search: string) => boolean;
  /** Optional badge count (e.g. cart item count). Hidden when 0 / null. */
  badge?: number | null;
}

/**
 * App-like bottom navigation for mobile (native-app feel). Hidden on md+,
 * where the desktop top-header navigation takes over. Fixed to the bottom
 * with iOS/Android safe-area inset support.
 *
 * Every site entry renders one of these inside its router:
 *   velshop    → หน้าแรก / สินค้า / ตะกร้า / ออเดอร์ / โปรไฟล์
 *   velseller  → เป้าหมาย / ร้านของฉัน / ออเดอร์ / รายได้ / สั่งซื้อซ้ำ
 *   velcenter  → rendered inside Center.tsx so it respects role permissions
 */
export function MobileTabBar({ items }: { items: MobileTabItem[] }) {
  const { pathname, search } = useLocation();

  // The auth flow is a full-screen sheet — hide the tab bar there.
  if (pathname.startsWith("/auth")) return null;

  return (
    <nav
      aria-label="เมนูหลักบนมือถือ"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-16 grid-cols-5">
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
                "relative flex flex-col items-center justify-center gap-1 transition-colors",
                active
                  ? "text-[#10B981]"
                  : "text-slate-400 hover:text-slate-600 active:text-slate-500",
              )}
            >
              <span className="relative">
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#10B981] px-1 text-[10px] font-bold leading-none text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
