import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { ArrowRight, Loader2, ShieldCheck, Store } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { toast } from "sonner";

interface RequireRoleProps {
  role: "seller" | "admin";
  children: ReactNode;
}

/**
 * Route guard for the seller / admin areas of the 3-site ecosystem.
 * - seller: any signed-in user may self-serve "open your shop" (MVP).
 * - admin:  any signed-in user may self-serve "become admin" (MVP demo).
 */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const becomeSeller = useMutation(api.users.becomeSeller);
  const becomeAdmin = useMutation(api.users.becomeAdmin);
  const [pending, setPending] = useState(false);

  if (isLoading) {
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
  const allowed =
    role === "admin" ? userRole === "admin" : userRole === "seller" || userRole === "admin";

  if (allowed) return children;

  const isAdminGate = role === "admin";
  const action = isAdminGate ? becomeAdmin : becomeSeller;

  const handlePromote = async () => {
    setPending(true);
    try {
      await action();
      toast.success(isAdminGate ? "คุณเป็นผู้ดูแลศูนย์กลางแล้ว" : "เปิดร้านค้าแล้ว 🎉");
    } catch (error) {
      console.error("Role promotion error:", error);
      toast.error("ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setPending(false);
    }
  };

  const GateIcon = isAdminGate ? ShieldCheck : Store;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 text-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
          <GateIcon className="size-7 text-[#10B981]" />
        </span>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
          {isAdminGate ? "พื้นที่ velcenter" : "พื้นที่ velseller"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {isAdminGate
            ? "velcenter เป็นศูนย์กลางจัดการธุรกิจและ Velnox Intelligence สำหรับผู้ดูแลเท่านั้น"
            : "velseller เป็นเครื่องมือสำหรับเจ้าของร้าน — ตั้งเป้าหมาย จัดการสต็อก และรับออเดอร์จากหน้าร้าน"}
        </p>
        <Button
          className="mt-6 w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
          onClick={handlePromote}
          disabled={pending}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isAdminGate ? "สมัครเป็นผู้ดูแลศูนย์กลาง" : "เปิดร้านค้าของฉัน"}
          {!pending && <ArrowRight className="size-4" />}
        </Button>
        <p className="mt-3 text-xs text-slate-400">
          {isAdminGate
            ? "เวอร์ชันแรกเปิดสมัครได้ทันที — เวอร์ชันเต็มจะมีการอนุมัติโดยผู้ดูแล"
            : "เปิดร้านได้ทันทีในเวอร์ชันแรก ไม่มีค่าใช้จ่าย"}
        </p>
        <Button variant="ghost" className="mt-2 w-full text-slate-500" asChild>
          <Link to="/shop">← กลับไปหน้าร้าน</Link>
        </Button>
      </div>
    </div>
  );
}
