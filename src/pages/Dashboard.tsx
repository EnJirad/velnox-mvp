import { Logo } from "@/components/Logo";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalFormDialog } from "@/components/goals/GoalFormDialog";
import { ProgressDialog } from "@/components/goals/ProgressDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import {
  formatNumber,
  formatThaiDate,
  goalPercent,
  isAchieved,
  type Goal,
} from "@/lib/goals";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  ChevronDown,
  Gauge,
  LogOut,
  Plus,
  Target,
  Timer,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function getInitials(name?: string, email?: string): string {
  const source = name?.trim() || email?.trim() || "V";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const goals = useQuery(api.goals.list);
  const removeGoal = useMutation(api.goals.remove);

  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
  const [deleteGoal, setDeleteGoal] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(() => {
    const list = goals ?? [];
    const achieved = list.filter(isAchieved).length;
    const avg =
      list.length > 0
        ? Math.round(list.reduce((sum, g) => sum + goalPercent(g), 0) / list.length)
        : 0;
    return {
      total: list.length,
      active: list.length - achieved,
      achieved,
      avg,
    };
  }, [goals]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDelete = async () => {
    if (!deleteGoal) return;
    setDeleting(true);
    try {
      await removeGoal({ goalId: deleteGoal._id });
      toast.success("ลบเป้าหมายแล้ว");
      setDeleteGoal(null);
    } catch (error) {
      console.error("Goal delete error:", error);
      toast.error("ลบไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setDeleting(false);
    }
  };

  const firstName = user?.name?.split(/\s+/)[0] || "เจ้าของธุรกิจ";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <button type="button" onClick={() => navigate("/")} aria-label="Velnox">
              <Logo />
            </button>
            <nav className="hidden items-center gap-1 sm:flex">
              <span className="rounded-[10px] bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900">
                แดชบอร์ดเป้าหมาย
              </span>
            </nav>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-slate-100"
              >
                <Avatar className="size-8 border border-slate-200">
                  {user?.image && <AvatarImage src={user.image} alt={user?.name ?? ""} />}
                  <AvatarFallback className="bg-slate-900 text-xs font-semibold text-white">
                    {getInitials(user?.name, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-medium leading-4 text-slate-900">
                    {user?.name || "เจ้าของธุรกิจ"}
                  </span>
                  <span className="block text-xs text-slate-400">เจ้าของธุรกิจ</span>
                </span>
                <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm font-medium text-slate-900">{user?.name || "Velnox"}</p>
                <p className="truncate text-xs font-normal text-slate-400">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" />
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">
              {formatThaiDate(Date.now())}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              สวัสดี, {firstName} 👋
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              นี่คือภาพรวมเป้าหมายธุรกิจของคุณวันนี้ — Velnox จำแทนคุณ
            </p>
          </div>
          <Button
            className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => {
              setEditingGoal(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            สร้างเป้าหมาย
          </Button>
        </div>

        {/* KPI row */}
        <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <Target className="size-4" />
              <p className="text-xs font-medium uppercase tracking-wide">เป้าหมายทั้งหมด</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {stats.total}
            </p>
            <p className="mt-1 text-xs text-slate-400">เป้าหมายที่ตั้งไว้</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <Timer className="size-4" />
              <p className="text-xs font-medium uppercase tracking-wide">กำลังดำเนินการ</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {stats.active}
            </p>
            <p className="mt-1 text-xs text-slate-400">ยังไม่ถึงเป้า</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="size-4" />
              <p className="text-xs font-medium uppercase tracking-wide">สำเร็จแล้ว</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {stats.achieved}
            </p>
            <p className="mt-1 text-xs text-slate-400">บรรลุเป้าหมาย</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <Gauge className="size-4" />
              <p className="text-xs font-medium uppercase tracking-wide">ความคืบหน้าเฉลี่ย</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {stats.avg}%
            </p>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#10B981] transition-all duration-500"
                style={{ width: `${stats.avg}%` }}
              />
            </div>
          </div>
        </div>

        {/* Goals grid */}
        {goals === undefined ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
              <Target className="size-7 text-[#10B981]" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              ยังไม่มีเป้าหมายธุรกิจ
            </h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              เริ่มต้นด้วยการตั้งเป้าหมายแรก เช่น ยอดขาย ออเดอร์ หรือลูกค้าใหม่
              แล้วให้ Velnox จำและช่วยคุณติดตาม
            </p>
            <Button
              className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => {
                setEditingGoal(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              สร้างเป้าหมายแรก
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal._id}
                goal={goal}
                onEdit={(g) => {
                  setEditingGoal(g);
                  setFormOpen(true);
                }}
                onDelete={(g) => setDeleteGoal(g)}
                onRecordProgress={(g) => setProgressGoal(g)}
              />
            ))}
          </div>
        )}

        {/* Summary strip */}
        {goals && goals.length > 0 && (
          <div className="mt-8 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-slate-100">
                <Target className="size-4 text-slate-600" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  ผลรวมค่าเป้าหมาย {formatNumber(
                    goals.reduce((sum, g) => sum + g.targetValue, 0),
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  รวมทุกหมวดหมู่ — อัปเดตอัตโนมัติทุกครั้งที่คุณบันทึกความคืบหน้า
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="shrink-0 gap-1.5 border-slate-200 bg-white text-slate-700 hover:border-[#10B981] hover:bg-[#ECFDF5] hover:text-emerald-700"
              onClick={() => {
                setEditingGoal(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              เพิ่มเป้าหมาย
            </Button>
          </div>
        )}
      </main>

      {/* Dialogs */}
      <GoalFormDialog open={formOpen} onOpenChange={setFormOpen} goal={editingGoal} />
      <ProgressDialog
        goal={progressGoal}
        open={progressGoal !== null}
        onOpenChange={(open) => {
          if (!open) setProgressGoal(null);
        }}
      />

      <AlertDialog open={deleteGoal !== null} onOpenChange={(open) => !open && setDeleteGoal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบเป้าหมายนี้?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteGoal?.title}” จะถูกลบถาวร และไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "กำลังลบ..." : "ลบเป้าหมาย"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
