import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { SITE_URLS } from "@/lib/sites";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Loader2, Lock, ShieldCheck, Store } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { toast } from "sonner";

interface RequireRoleProps {
  role: "seller" | "center";
  children: ReactNode;
}

/**
 * Route guards for the 3-site ecosystem.
 * - seller: any signed-in user may self-serve "เปิดร้าน" (merchants who open a
 *   shop with us). owner/admin also pass.
 * - center: company-only — owner / admin / staff. No self-serve promotion;
 *   the very first user may claim the company as owner, after that access is
 *   granted exclusively by the owner.
 */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const becomeSeller = useMutation(api.users.becomeSeller);
  const becomeOwner = useMutation(api.users.becomeOwner);
  const ownerExists = useQuery(api.users.ownerExists);
  const [pending, setPending] = useState(false);

  if (isLoading || ownerExists === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} replace />
    );
  }

  const userRole = user?.role;
  const canSell =
    userRole === "seller" || userRole === "admin" || userRole === "owner";
  const canCenter =
    userRole === "owner" || userRole === "admin" || userRole === "staff";

  if (role === "center" ? canCenter : canSell) return children;

  const isOwnerGate = role === "center";
  const open = isOwnerGate ? !ownerExists : true;

  const handlePromote = async () => {
    setPending(true);
    try {
      if (isOwnerGate) {
        await becomeOwner();
        toast.success("คุณคือเจ้าของบริษัท Velnox แล้ว 🏆");
      } else {
        await becomeSeller();
        toast.success("เปิดร้านค้าแล้ว 🎉");
      }
    } catch (error) {
      console.error("Role promotion error:", error);
      toast.error(
        error instanceof Error ? error.message : "ไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      setPending(false);
    }
  };

  const GateIcon = isOwnerGate ? (ownerExists ? Lock : ShieldCheck) : Store;
  const title = isOwnerGate ? "พื้นที่ velcenter" : "พื้นที่ velseller";
  const desc = isOwnerGate
    ? ownerExists
      ? "velcenter เป็นพื้นที่เฉพาะบริษัท — เฉพาะผู้ที่เจ้าของบริษัทกำหนดสิทธิ์ให้เท่านั้นที่เข้าได้"
      : "velcenter ยังไม่มีเจ้าของบริษัท — คนแรกที่สมัครจะได้เป็นเจ้าของ และบริหารสิทธิ์ของพนักงานทั้งหมด"
    : "velseller เป็นเครื่องมือสำหรับพ่อค้าที่เปิดร้านกับ Velnox — จัดการสินค้า รายได้ และออเดอร์ของตัวเอง";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 text-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
          <GateIcon className="size-7 text-[#10B981]" />
        </span>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
        {open && (
          <Button
            className="mt-6 w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
            onClick={handlePromote}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isOwnerGate ? "สมัครเป็นเจ้าของบริษัท" : "เปิดร้านค้าของฉัน"}
            {!pending && <ArrowRight className="size-4" />}
          </Button>
        )}
        <p className="mt-3 text-xs text-slate-400">
          {isOwnerGate
            ? ownerExists
              ? "ติดต่อเจ้าของบริษัทเพื่อขอสิทธิ์เข้าถึง"
              : "เวอร์ชันแรก: คนแรกที่สมัครได้เป็นเจ้าของ"
            : "เปิดร้านได้ทันทีในเวอร์ชันแรก ไม่มีค่าใช้จ่าย"}
        </p>
        <Button variant="ghost" className="mt-2 w-full text-slate-500" asChild>
          <a href={SITE_URLS.velshop}>← กลับไปหน้าร้าน</a>
        </Button>
      </div>
    </div>
  );
}
