import { ShopFooter } from "@/components/shop/ShopFooter";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@velnox/shared/components/ui/button";
import { Skeleton } from "@velnox/shared/components/ui/skeleton";
import { api } from "@convex/_generated/api";
import { useAuth } from "@velnox/shared/hooks/use-auth";
import { useAction } from "convex/react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Heart,
  LifeBuoy,
  LogOut,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

interface ProfileRow {
  to: string;
  labelKey: string;
  descKey: string;
  icon: LucideIcon;
}

const SECTIONS: ProfileRow[] = [
  { to: "/orders", labelKey: "profile.orders", descKey: "profile.ordersDesc", icon: Package },
  { to: "/velrepeat", labelKey: "profile.velrepeat", descKey: "profile.velrepeatDesc", icon: RefreshCw },
  { to: "/wishlist", labelKey: "profile.wishlist", descKey: "profile.wishlistDesc", icon: Heart },
  { to: "/addresses", labelKey: "profile.addresses", descKey: "profile.addressesDesc", icon: MapPin },
  { to: "/notifications", labelKey: "profile.notifications", descKey: "profile.notificationsDesc", icon: Bell },
  { to: "/profile/account", labelKey: "profile.account", descKey: "profile.accountDesc", icon: CircleUserRound },
  { to: "/profile/account", labelKey: "profile.help", descKey: "profile.helpDesc", icon: LifeBuoy },
];

export default function ShopProfile() {
  const { t } = useLanguage();
  const { user, isLoading, isAuthenticated, signOut } = useAuth();
  const myProfile = useAction(api.customer.myProfile);
  const [profile, setProfile] = useState<{
    name: string | null;
    email: string | null;
    phone: string | null;
    memberSince: number | null;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    myProfile()
      .then((res) => {
        if (!alive) return;
        const data = res as {
          name: string | null;
          email: string | null;
          phone: string | null;
          memberSince: number;
        };
        setProfile({
          name: data.name,
          email: data.email,
          phone: data.phone,
          memberSince: data.memberSince ?? null,
        });
      })
      .catch((err) => {
        console.error("Load profile error:", err);
      });
    return () => {
      alive = false;
    };
  }, [myProfile, isAuthenticated]);

  const handleSignOut = async () => {
    await signOut();
    setProfile(null);
    toast.success(t("profile.signedOut"));
  };

  const displayName = profile?.name ?? user?.name ?? user?.email ?? "";
  const displayEmail = profile?.email ?? user?.email ?? "";
  const memberSince = profile?.memberSince ?? null;

  const formatMemberSince = (ms: number) =>
    new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(ms),
    );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : isAuthenticated ? (
          <>
            {/* Identity header — app-like account hub */}
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="h-20 bg-gradient-to-r from-[#10B981] to-emerald-600" />
              <div className="px-5 pb-5">
                <div className="-mt-9 flex items-end justify-between">
                  <span className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-[#ECFDF5] text-2xl font-bold text-[#10B981] shadow-sm">
                    {(displayName || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-slate-200 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => void handleSignOut()}
                  >
                    <LogOut className="size-3.5" />
                    {t("profile.signOut")}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-slate-900">
                      {displayName || t("profile.member")}
                    </p>
                    {displayEmail && <p className="truncate text-sm text-slate-500">{displayEmail}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        <ShieldCheck className="size-3" />
                        {t("profile.statusActive")}
                      </span>
                      {memberSince && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <CalendarDays className="size-3" />
                          {t("profile.memberSince", { date: formatMemberSince(memberSince) })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    to="/profile/account"
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#10B981] hover:text-emerald-700"
                  >
                    {t("profile.editProfile")}
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </section>

            {/* App-like tappable rows */}
            <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
              {SECTIONS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.to + s.labelKey}
                    to={s.to}
                    className={`flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-[#F8FAFC] ${
                      i > 0 ? "border-t border-slate-100" : ""
                    }`}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-slate-100 text-slate-500">
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{t(s.labelKey)}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">{t(s.descKey)}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-slate-300" />
                  </Link>
                );
              })}
            </section>
          </>
        ) : (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
              <UserRound className="size-7 text-slate-400" />
            </span>
            <p className="mt-3 text-sm text-slate-500">{t("profile.notSignedIn")}</p>
            <Button className="mt-5 bg-slate-900 text-white hover:bg-slate-800" asChild>
              <Link to="/auth?returnTo=/profile">{t("profile.signIn")}</Link>
            </Button>
          </div>
        )}

        {/* Reassurance (honest — all real capabilities) */}
        {isAuthenticated && (
          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <ShoppingBag className="size-3.5 text-[#10B981]" />
            {t("profile.accountNote")}
          </p>
        )}
      </main>

      <ShopFooter />
    </div>
  );
}
