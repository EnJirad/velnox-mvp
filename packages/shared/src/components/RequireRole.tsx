import { api } from "@convex/_generated/api";
import { Button } from "@velnox/shared/components/ui/button";
import { Input } from "@velnox/shared/components/ui/input";
import { Label } from "@velnox/shared/components/ui/label";
import { useAuth } from "@velnox/shared/hooks/use-auth";
import { useLanguage } from "@velnox/shared/lib/i18n";
import { SITE_URLS } from "@velnox/shared/lib/sites";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Clock,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Store,
  XCircle,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { toast } from "sonner";

interface RequireRoleProps {
  role: "seller" | "center";
  children: ReactNode;
}

function LoadingGate() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </main>
  );
}

function GateCard({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof Lock;
  title: string;
  desc: string;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 text-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
          <Icon className="size-7 text-[#10B981]" />
        </span>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
        {children}
        <Button variant="ghost" className="mt-4 w-full text-slate-500" asChild>
          <a href={SITE_URLS.velshop}>{t("gate.sellerBackToShop")}</a>
        </Button>
      </div>
    </div>
  );
}

/**
 * Route guards for the 3-site ecosystem.
 *
 * - seller: NO self-promotion. The gate reads the seller's Neon status
 *   (authoritative, server-side). Only APPROVED sellers pass; pending /
 *   rejected / suspended users see their state, and users without an
 *   application submit one (createSellerApplication → pending → center
 *   review → approved).
 * - center: company-only (owner / admin / staff). With no owner yet, the
 *   first claim requires the one-time BOOTSTRAP_OWNER_SECRET code — a
 *   customer can never self-assign owner access.
 */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();

  const ownerStatus = useQuery(api.users.ownerBootstrapStatus);
  const claimOwner = useMutation(api.users.claimOwner);
  const mySellerStatus = useAction(api.commerce.mySellerStatus);
  const createSellerApplication = useAction(api.commerce.createSellerApplication);

  const [seller, setSeller] = useState<{ status: string | null; rejectionReason: string | null } | null>(null);
  const [sellerLoading, setSellerLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bootstrapCode, setBootstrapCode] = useState("");
  const [shopName, setShopName] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    setSellerLoading(true);
    mySellerStatus()
      .then((s) => {
        if (alive) setSeller(s);
      })
      .catch(() => {
        if (alive) setSeller({ status: null, rejectionReason: null });
      })
      .finally(() => {
        if (alive) setSellerLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isAuthenticated, mySellerStatus]);

  if (isLoading) return <LoadingGate />;

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  const userRole = user?.role;

  // ------------------------------------------------------------------ center
  if (role === "center") {
    const canCenter = userRole === "owner" || userRole === "admin" || userRole === "staff";
    if (canCenter) return children;
    if (ownerStatus === undefined) return <LoadingGate />;

    // An owner already exists → access is granted exclusively by the owner.
    if (ownerStatus.ownerExists) {
      return (
        <GateCard icon={Lock} title={t("gate.centerLockedTitle")} desc={t("gate.centerLockedDesc")} />
      );
    }

    // Bootstrap not configured yet — tell the operator, never self-promote.
    if (!ownerStatus.configured) {
      return (
        <GateCard
          icon={ShieldCheck}
          title={t("gate.centerBootstrapTitle")}
          desc={t("gate.centerBootstrapMissing")}
        />
      );
    }

    const handleClaimOwner = async (event: FormEvent) => {
      event.preventDefault();
      if (!bootstrapCode.trim()) return;
      setBusy(true);
      try {
        await claimOwner({ bootstrapCode: bootstrapCode.trim() });
        toast.success(t("gate.centerBootstrapSuccess"));
      } catch (error) {
        console.error("Owner bootstrap error:", error);
        toast.error(error instanceof Error ? error.message : t("gate.centerBootstrapInvalid"));
      } finally {
        setBusy(false);
      }
    };

    return (
      <GateCard
        icon={KeyRound}
        title={t("gate.centerBootstrapTitle")}
        desc={t("gate.centerBootstrapDesc")}
      >
        <form onSubmit={handleClaimOwner} className="mt-6 grid gap-3 text-left">
          <div className="grid gap-2">
            <Label htmlFor="bootstrap-code" className="text-xs font-medium text-slate-500">
              {t("gate.centerBootstrapCode")}
            </Label>
            <Input
              id="bootstrap-code"
              type="password"
              autoComplete="off"
              value={bootstrapCode}
              onChange={(e) => setBootstrapCode(e.target.value)}
              placeholder={t("gate.centerBootstrapCodePlaceholder")}
              className="h-11 rounded-[10px] border-slate-200"
              disabled={busy}
            />
          </div>
          <Button
            type="submit"
            className="mt-1 gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
            disabled={busy || !bootstrapCode.trim()}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t("gate.centerBootstrapSubmit")}
            {!busy && <ArrowRight className="size-4" />}
          </Button>
        </form>
      </GateCard>
    );
  }

  // ------------------------------------------------------------------ seller
  if (sellerLoading || seller === null) return <LoadingGate />;

  if (seller.status === "approved") return children;

  if (seller.status === "pending" || seller.status === "under_review") {
    return (
      <GateCard icon={Clock} title={t("gate.sellerPendingTitle")} desc={t("gate.sellerPendingDesc")} />
    );
  }

  if (seller.status === "suspended") {
    return (
      <GateCard icon={XCircle} title={t("gate.sellerSuspendedTitle")} desc={t("gate.sellerSuspendedDesc")} />
    );
  }

  // No application yet, or rejected (re-apply = fresh review).
  const isRejected = seller.status === "rejected";

  const handleApply = async (event: FormEvent) => {
    event.preventDefault();
    if (!shopName.trim()) {
      toast.error(t("gate.sellerShopNameRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await createSellerApplication({ shopName: shopName.trim() });
      toast.success(t("gate.sellerApplySuccess"));
      const fresh = await mySellerStatus();
      setSeller(fresh);
      if (res.seller.status === "approved") return; // auto-approved → children render next tick
    } catch (error) {
      console.error("Seller application error:", error);
      toast.error(error instanceof Error ? error.message : t("gate.sellerApplySuccess"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <GateCard
      icon={Store}
      title={isRejected ? t("gate.sellerRejectedTitle") : t("gate.sellerTitle")}
      desc={isRejected ? t("gate.sellerRejectedDesc") : t("gate.sellerDesc")}
    >
      {isRejected && seller.rejectionReason && (
        <p className="mt-4 rounded-[10px] bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {t("gate.sellerRejectedReason", { reason: seller.rejectionReason })}
        </p>
      )}
      <form onSubmit={handleApply} className="mt-6 grid gap-3 text-left">
        <div className="grid gap-2">
          <Label htmlFor="shop-name" className="text-xs font-medium text-slate-500">
            {t("gate.sellerShopName")}
          </Label>
          <Input
            id="shop-name"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder={t("gate.sellerShopNamePlaceholder")}
            className="h-11 rounded-[10px] border-slate-200"
            disabled={busy}
          />
        </div>
        <Button
          type="submit"
          className="mt-1 gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
          disabled={busy || !shopName.trim()}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {isRejected ? t("gate.sellerApply") : t("gate.sellerApply")}
          {!busy && <ArrowRight className="size-4" />}
        </Button>
      </form>
    </GateCard>
  );
}
