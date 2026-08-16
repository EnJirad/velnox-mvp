import { api } from "@convex/_generated/api";
import { Button } from "@velnox/shared/components/ui/button";
import { Input } from "@velnox/shared/components/ui/input";
import { Label } from "@velnox/shared/components/ui/label";
import { useAction } from "convex/react";
import { KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * VelCenter force password change (spec §10).
 *
 * Shown when the signed-in employee's `mustChangePassword` flag is true
 * (set by the owner on create / password reset). The employee must pick a
 * new password before any dashboard content is usable. `api.users.currentUser`
 * is reactive, so once the backend clears the flag the gate unmounts itself.
 */
export default function ChangePasswordScreen() {
  const setOwnPasswordAction = useAction(api.employeeAuth.setOwnPasswordAction);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirm) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setBusy(true);
    try {
      await setOwnPasswordAction({ newPassword: password });
      toast.success("ตั้งรหัสผ่านใหม่แล้ว");
    } catch (e) {
      console.error("Change password error:", e);
      setError(e instanceof Error ? e.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 text-slate-900">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50">
            <LockKeyhole className="size-6 text-amber-600" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight">ตั้งรหัสผ่านใหม่</h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            นี่คือรหัสชั่วคราวครั้งแรกของคุณ (หรือถูกรีเซ็ตโดยเจ้าของบริษัท) — กรุณาตั้งรหัสผ่านใหม่ก่อนเข้าใช้งาน
          </p>
          <form onSubmit={submit} className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">ยืนยันรหัสผ่าน</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="พิมพ์รหัสผ่านอีกครั้ง"
              />
            </div>
            {error && (
              <p className="rounded-[10px] bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              disabled={busy}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {busy ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
