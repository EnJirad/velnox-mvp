import { api } from "@convex/_generated/api";
import { Badge } from "@velnox/shared/components/ui/badge";
import { Button } from "@velnox/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@velnox/shared/components/ui/card";
import { Checkbox } from "@velnox/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@velnox/shared/components/ui/dialog";
import { Input } from "@velnox/shared/components/ui/input";
import { Label } from "@velnox/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@velnox/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@velnox/shared/components/ui/table";
import { useAction } from "convex/react";
import {
  BadgeCheck,
  Copy,
  Crown,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface EmployeeRow {
  userId: string;
  neonId: string;
  email: string | null;
  name: string | null;
  role: string;
  department: string | null;
  employeeId: string | null;
  permissions: string[];
  active: boolean;
  mustChangePassword: boolean;
  createdAt: number;
}

interface PermissionItem {
  code: string;
  label: string;
  description: string;
}

const DEPARTMENTS: { id: string; label: string }[] = [
  { id: "general", label: "ทั่วไป" },
  { id: "marketing", label: "การตลาด" },
  { id: "sales", label: "ฝ่ายขาย" },
  { id: "operations", label: "ปฏิบัติการ" },
  { id: "finance", label: "การเงิน" },
];

const DEPARTMENT_LABEL: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.id, d.label]),
);

/**
 * VelCenter employee accounts (spec §9–§11, §42) — owner only.
 *
 * The company can never view an existing password: only the scrypt hash is
 * stored (Convex Auth Password provider). Creating or resetting an employee
 * generates a one-time temporary password that is shown EXACTLY ONCE here,
 * and the employee is forced to set a new one on first login.
 */
export default function EmployeeManager() {
  const employeeListAction = useAction(api.employeeAuth.employeeListAction);
  const createEmployeeAction = useAction(api.employeeAuth.createEmployeeAction);
  const resetEmployeePasswordAction = useAction(api.employeeAuth.resetEmployeePasswordAction);
  const setEmployeeActiveAction = useAction(api.employeeAuth.setEmployeeActiveAction);
  const setStaffProfileAction = useAction(api.centerAdmin.setStaffProfileAction);
  const permissionCatalogAction = useAction(api.centerAdmin.permissionCatalog);

  const [employees, setEmployees] = useState<EmployeeRow[] | null>(null);
  const [catalog, setCatalog] = useState<PermissionItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Create-employee dialog
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    employeeId: "",
    department: "general",
    role: "staff",
  });
  const [newPermissions, setNewPermissions] = useState<string[]>([]);

  // One-time temp credential (create or reset) — shown exactly once
  const [tempCredential, setTempCredential] = useState<{ password: string; email: string } | null>(null);

  // Permission editor
  const [permEditor, setPermEditor] = useState<{
    userId: string;
    neonId: string;
    name: string;
    department: string;
    permissions: string[];
  } | null>(null);
  const [permDraft, setPermDraft] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const rows = await employeeListAction();
      setEmployees(rows as unknown as EmployeeRow[]);
    } catch {
      setEmployees([]);
    }
  }, [employeeListAction]);

  useEffect(() => {
    void load();
    void permissionCatalogAction()
      .then((c) => setCatalog(c as unknown as PermissionItem[]))
      .catch(() => setCatalog([]));
  }, [load, permissionCatalogAction]);

  const togglePermission = (code: string) =>
    setNewPermissions((list) =>
      list.includes(code) ? list.filter((c) => c !== code) : [...list, code],
    );

  const togglePermissionDraft = (code: string) =>
    setPermDraft((list) =>
      list.includes(code) ? list.filter((c) => c !== code) : [...list, code],
    );

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    try {
      const result = await createEmployeeAction({
        name: newEmployee.name.trim(),
        email: newEmployee.email.trim(),
        employeeId: newEmployee.employeeId.trim() || undefined,
        department: newEmployee.department,
        role: newEmployee.role,
        permissions: newPermissions,
      });
      setTempCredential({ password: result.tempPassword, email: result.email });
      setShowCreate(false);
      setNewEmployee({ name: "", email: "", employeeId: "", department: "general", role: "staff" });
      setNewPermissions([]);
      toast.success("สร้างบัญชีพนักงานแล้ว — แจ้งรหัสชั่วคราวให้พนักงานทราบ");
      void load();
    } catch (error) {
      console.error("Create employee error:", error);
      toast.error(error instanceof Error ? error.message : "สร้างพนักงานไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  };

  const handleReset = async (employee: EmployeeRow) => {
    if (!window.confirm(`รีเซ็ตรหัสผ่านของ ${employee.name ?? employee.email ?? "พนักงาน"}?`)) return;
    setBusy(employee.userId);
    try {
      const result = await resetEmployeePasswordAction({ userId: employee.userId });
      setTempCredential({ password: result.tempPassword, email: result.email });
      toast.success("รีเซ็ตรหัสผ่านแล้ว — พนักงานต้องตั้งรหัสใหม่เมื่อล็อกอินครั้งหน้า");
      void load();
    } catch (error) {
      console.error("Reset password error:", error);
      toast.error(error instanceof Error ? error.message : "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const handleToggleActive = async (employee: EmployeeRow) => {
    setBusy(employee.userId);
    try {
      await setEmployeeActiveAction({ userId: employee.userId, active: !employee.active });
      toast.success(employee.active ? "ปิดการใช้งานพนักงานแล้ว" : "เปิดการใช้งานพนักงานแล้ว");
      void load();
    } catch (error) {
      console.error("Toggle employee error:", error);
      toast.error(error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const openPermEditor = (employee: EmployeeRow) => {
    setPermEditor({
      userId: employee.userId,
      neonId: employee.neonId,
      name: employee.name ?? employee.email ?? "พนักงาน",
      department: employee.department ?? "general",
      permissions: employee.permissions,
    });
    setPermDraft(employee.permissions);
  };

  const handleSavePermissions = async () => {
    if (!permEditor) return;
    setBusy(permEditor.userId);
    try {
      // setStaffProfileAction keys on the Neon user id
      await setStaffProfileAction({
        userId: permEditor.neonId,
        department: permEditor.department,
        permissions: permDraft,
      });
      toast.success("บันทึกสิทธิ์พนักงานแล้ว");
      setPermEditor(null);
      void load();
    } catch (error) {
      console.error("Save permissions error:", error);
      toast.error(error instanceof Error ? error.message : "บันทึกสิทธิ์ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mb-4 border-slate-200 shadow-none">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-[#10B981]" />
          บัญชีพนักงาน (ล็อกอิน velcenter)
        </CardTitle>
        <Button
          className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
          size="sm"
          onClick={() => setShowCreate(true)}
        >
          <UserPlus className="size-4" />
          สร้างพนักงาน
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-xs leading-5 text-slate-400">
          รหัสผ่านถูกเก็บเป็น hash เท่านั้น — บริษัทไม่สามารถดูรหัสผ่านเดิมของใครได้ การสร้าง/รีเซ็ตจะให้
          รหัสชั่วคราว 1 ครั้ง แล้วบังคับให้พนักงานตั้งรหัสใหม่ตอนล็อกอินครั้งแรก
        </p>

        {employees === null ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            กำลังโหลดพนักงาน...
          </div>
        ) : employees.length === 0 ? (
          <p className="rounded-[10px] bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
            ยังไม่มีพนักงาน — กด “สร้างพนักงาน” เพื่อสร้างบัญชีแรก
          </p>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 text-slate-400">พนักงาน</TableHead>
                    <TableHead className="text-slate-400">รหัสพนักงาน</TableHead>
                    <TableHead className="text-slate-400">บทบาท / ฝ่าย</TableHead>
                    <TableHead className="text-slate-400">สถานะ</TableHead>
                    <TableHead className="pr-4 text-right text-slate-400">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.userId} className="hover:bg-slate-50/60">
                      <TableCell className="pl-4">
                        <p className="font-medium text-slate-900">{e.name ?? "—"}</p>
                        <p className="text-xs text-slate-400">{e.email ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-slate-600">{e.employeeId ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className="gap-1 rounded-full bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/15">
                            {e.role === "admin" && <BadgeCheck className="size-3" />}
                            {e.role === "owner" && <Crown className="size-3" />}
                            {e.role === "admin" ? "ผู้ดูแลฝ่าย" : e.role === "staff" ? "พนักงาน" : e.role}
                          </Badge>
                          {e.department && (
                            <Badge className="rounded-full bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-600/10">
                              {DEPARTMENT_LABEL[e.department] ?? e.department}
                            </Badge>
                          )}
                          {e.mustChangePassword && (
                            <Badge className="gap-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15">
                              <LockKeyhole className="size-3" />
                              ต้องตั้งรหัสใหม่
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {e.active ? (
                          <Badge className="rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                            ใช้งาน
                          </Badge>
                        ) : (
                          <Badge className="rounded-full bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15">
                            ปิดการใช้งาน
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-slate-200 text-slate-600"
                            onClick={() => openPermEditor(e)}
                            disabled={busy === e.userId}
                          >
                            <ShieldCheck className="size-3.5" />
                            สิทธิ์
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-slate-200 text-slate-600"
                            onClick={() => handleReset(e)}
                            disabled={busy === e.userId}
                          >
                            <KeyRound className="size-3.5" />
                            รีเซ็ตรหัส
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`gap-1.5 border-slate-200 ${
                              e.active ? "text-rose-600" : "text-emerald-600"
                            }`}
                            onClick={() => handleToggleActive(e)}
                            disabled={busy === e.userId}
                          >
                            {e.active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: cards */}
            <div className="space-y-3 md:hidden">
              {employees.map((e) => (
                <div
                  key={e.userId}
                  className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{e.name ?? "—"}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{e.email ?? "—"}</p>
                    </div>
                    {e.active ? (
                      <Badge className="shrink-0 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                        ใช้งาน
                      </Badge>
                    ) : (
                      <Badge className="shrink-0 rounded-full bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15">
                        ปิดการใช้งาน
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge className="gap-1 rounded-full bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/15">
                      {e.role === "admin" && <BadgeCheck className="size-3" />}
                      {e.role === "admin" ? "ผู้ดูแลฝ่าย" : e.role === "staff" ? "พนักงาน" : e.role}
                    </Badge>
                    {e.department && (
                      <Badge className="rounded-full bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-600/10">
                        {DEPARTMENT_LABEL[e.department] ?? e.department}
                      </Badge>
                    )}
                    {e.employeeId && (
                      <span className="font-mono text-xs text-slate-400">{e.employeeId}</span>
                    )}
                    {e.mustChangePassword && (
                      <Badge className="gap-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15">
                        <LockKeyhole className="size-3" />
                        ต้องตั้งรหัสใหม่
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-slate-200 text-slate-600"
                      onClick={() => openPermEditor(e)}
                      disabled={busy === e.userId}
                    >
                      <ShieldCheck className="size-3.5" />
                      สิทธิ์
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-slate-200 text-slate-600"
                      onClick={() => handleReset(e)}
                      disabled={busy === e.userId}
                    >
                      <KeyRound className="size-3.5" />
                      รีเซ็ตรหัส
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-1.5 border-slate-200 ${
                        e.active ? "text-rose-600" : "text-emerald-600"
                      }`}
                      onClick={() => handleToggleActive(e)}
                      disabled={busy === e.userId}
                    >
                      {e.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      {/* ---------- Create employee dialog ---------- */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-[#10B981]" />
              สร้างบัญชีพนักงาน
            </DialogTitle>
            <DialogDescription>
              ระบบจะสร้างรหัสผ่านชั่วคราวให้ 1 ครั้ง — พนักงานต้องตั้งรหัสใหม่เมื่อล็อกอินครั้งแรก
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="emp-name">ชื่อ-นามสกุล</Label>
              <Input
                id="emp-name"
                required
                value={newEmployee.name}
                onChange={(e) => setNewEmployee((f) => ({ ...f, name: e.target.value }))}
                placeholder="เช่น สมชาย ใจดี"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-email">อีเมล (ใช้ล็อกอิน)</Label>
              <Input
                id="emp-email"
                type="email"
                required
                value={newEmployee.email}
                onChange={(e) => setNewEmployee((f) => ({ ...f, email: e.target.value }))}
                placeholder="somchai@velnox.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-id">รหัสพนักงาน (ใช้ล็อกอินได้ด้วย)</Label>
              <Input
                id="emp-id"
                value={newEmployee.employeeId}
                onChange={(e) => setNewEmployee((f) => ({ ...f, employeeId: e.target.value }))}
                placeholder="เช่น EMP-001"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>ฝ่าย</Label>
                <Select
                  value={newEmployee.department}
                  onValueChange={(v) => setNewEmployee((f) => ({ ...f, department: v }))}
                >
                  <SelectTrigger className="h-10 rounded-[10px] border-slate-200 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>บทบาท</Label>
                <Select
                  value={newEmployee.role}
                  onValueChange={(v) => setNewEmployee((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger className="h-10 rounded-[10px] border-slate-200 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">พนักงาน (ดูข้อมูล)</SelectItem>
                    <SelectItem value="admin">ผู้ดูแลฝ่าย</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>สิทธิ์เฉพาะ (staff เท่านั้น ใช้ได้จริง — admin/owner ได้ทั้งหมดอยู่แล้ว)</Label>
              <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-[10px] border border-slate-200 p-3">
                {catalog.length === 0 ? (
                  <p className="text-xs text-slate-400">กำลังโหลดรายการสิทธิ์...</p>
                ) : (
                  catalog.map((p) => (
                    <label
                      key={p.code}
                      className="flex cursor-pointer items-start gap-2.5 rounded-[8px] px-1 py-1.5 hover:bg-slate-50"
                    >
                      <Checkbox
                        checked={newPermissions.includes(p.code)}
                        onCheckedChange={() => togglePermission(p.code)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-700">{p.label}</span>
                        <span className="block text-xs text-slate-400">{p.description}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                ยกเลิก
              </Button>
              <Button
                type="submit"
                className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                disabled={creating}
              >
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {creating ? "กำลังสร้าง..." : "สร้างพนักงาน"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- One-time temp credential dialog ---------- */}
      <Dialog open={tempCredential !== null} onOpenChange={(open) => !open && setTempCredential(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-amber-600" />
              รหัสผ่านชั่วคราว (แสดงครั้งเดียวเท่านั้น)
            </DialogTitle>
            <DialogDescription>
              แจ้งรหัสนี้ให้พนักงาน ({tempCredential?.email}) ทราบ — พนักงานต้องตั้งรหัสใหม่ทันทีเมื่อล็อกอินครั้งแรก
              บริษัทเก็บเฉพาะ hash และไม่สามารถดูรหัสนี้ได้อีกหลังจากปิดหน้าต่าง
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <LockKeyhole className="size-4 shrink-0 text-amber-600" />
            <code className="flex-1 select-all font-mono text-lg font-bold tracking-wider text-amber-900">
              {tempCredential?.password}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-amber-700 hover:bg-amber-100"
              onClick={() => {
                if (tempCredential) {
                  void navigator.clipboard?.writeText(tempCredential.password);
                  toast.success("คัดลอกรหัสชั่วคราวแล้ว");
                }
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button
              className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => setTempCredential(null)}
            >
              ปิด — ฉันบันทึกรหัสแล้ว
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Permission editor dialog ---------- */}
      <Dialog open={permEditor !== null} onOpenChange={(open) => !open && setPermEditor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#10B981]" />
              สิทธิ์ของ {permEditor?.name}
            </DialogTitle>
            <DialogDescription>
              ใช้ได้จริงกับบทบาท staff — admin/owner มีสิทธิ์ทั้งหมดอยู่แล้ว
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>ฝ่าย</Label>
              <Select
                value={permEditor?.department ?? "general"}
                onValueChange={(v) =>
                  setPermEditor((e) => (e ? { ...e, department: v } : e))
                }
              >
                <SelectTrigger className="h-10 rounded-[10px] border-slate-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>สิทธิ์</Label>
              <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-[10px] border border-slate-200 p-3">
                {catalog.length === 0 ? (
                  <p className="text-xs text-slate-400">กำลังโหลดรายการสิทธิ์...</p>
                ) : (
                  catalog.map((p) => (
                    <label
                      key={p.code}
                      className="flex cursor-pointer items-start gap-2.5 rounded-[8px] px-1 py-1.5 hover:bg-slate-50"
                    >
                      <Checkbox
                        checked={permDraft.includes(p.code)}
                        onCheckedChange={() => togglePermissionDraft(p.code)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-700">{p.label}</span>
                        <span className="block text-xs text-slate-400">{p.description}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermEditor(null)}>
              ยกเลิก
            </Button>
            <Button
              className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              onClick={handleSavePermissions}
              disabled={busy === permEditor?.userId}
            >
              {busy === permEditor?.userId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              บันทึกสิทธิ์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
