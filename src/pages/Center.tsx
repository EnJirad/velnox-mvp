import { Logo } from "@/components/Logo";
import { MobileTabBar, type MobileTabItem } from "@/components/MobileTabBar";
import { SiteSwitcher } from "@/components/SiteSwitcher";
import { UserMenu } from "@/components/UserMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import {
  PRODUCT_CATEGORY_META,
  STATUS_META,
  DAY_MS,
  effectiveCycleDays,
  formatDays,
  formatNumber,
  formatThaiDate,
  reorderInfo,
  type Product,
} from "@/lib/reorder";
import {
  ORDER_STATUS_META,
  ROLE_META,
  formatBaht,
  shortOrderId,
  type OrderStatus,
} from "@/lib/shop";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  BrainCircuit,
  Crown,
  Loader2,
  Megaphone,
  Package,
  Save,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

type Tab = "overview" | "orders" | "intel" | "products" | "staff" | "settings";

const DEPARTMENTS: { id: string; label: string }[] = [
  { id: "general", label: "ทั่วไป" },
  { id: "marketing", label: "การตลาด" },
  { id: "sales", label: "ฝ่ายขาย" },
  { id: "operations", label: "ปฏิบัติการ" },
  { id: "finance", label: "การเงิน" },
];

const DEPARTMENT_LABEL: Record<string, string> = {
  general: "ทั่วไป",
  marketing: "การตลาด",
  sales: "ฝ่ายขาย",
  operations: "ปฏิบัติการ",
  finance: "การเงิน",
};

/**
 * velcenter permission model (company-only):
 * - owner:  everything, including managing employees
 * - admin:  business data + manage orders, but NO employee management
 *           (department-scoped in production; e.g. marketing admin)
 * - staff:  view business numbers only (overview / orders / intel / products)
 */
function canSeeTab(tab: Tab, role?: string, department?: string): boolean {
  switch (tab) {
    case "overview":
    case "orders":
    case "intel":
    case "products":
      return true;
    case "staff":
      return role === "owner";
    case "settings":
      return role === "owner" || (role === "admin" && department === "general");
  }
}

export default function Center() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role;
  const userDepartment = user?.department;

  const isOwner = userRole === "owner";
  const canManageOrders = userRole !== "staff";

  // Tabs are URL-driven (?tab=orders) so the mobile bottom nav and the desktop
  // tab strip stay in sync, and every view is shareable/deep-linkable.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = (searchParams.get("tab") as Tab | null) ?? "overview";
  const tab: Tab = canSeeTab(urlTab, userRole, userDepartment) ? urlTab : "overview";
  const setTab = (next: Tab) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("tab", next);
        return params;
      },
      { replace: true },
    );
  };

  // Mobile bottom nav — same tabs as the desktop strip, filtered by role.
  const mobileTabs: MobileTabItem[] = [
    { to: "/?tab=overview", label: "ภาพรวม", icon: TrendingUp, activeMatch: (_, search) => new URLSearchParams(search).get("tab") === "overview" },
    { to: "/?tab=orders", label: "ออเดอร์", icon: ShoppingBag, activeMatch: (_, search) => new URLSearchParams(search).get("tab") === "orders" },
    { to: "/?tab=intel", label: "Intelligence", icon: BrainCircuit, activeMatch: (_, search) => new URLSearchParams(search).get("tab") === "intel" },
    { to: "/?tab=products", label: "สินค้า", icon: Package, activeMatch: (_, search) => new URLSearchParams(search).get("tab") === "products" },
    ...(isOwner
      ? [{ to: "/?tab=staff", label: "พนักงาน", icon: Users, activeMatch: (_, search) => new URLSearchParams(search).get("tab") === "staff" } as MobileTabItem]
      : []),
    ...(canSeeTab("settings", userRole, userDepartment)
      ? [{ to: "/?tab=settings", label: "ตั้งค่า", icon: Settings, activeMatch: (_, search) => new URLSearchParams(search).get("tab") === "settings" } as MobileTabItem]
      : []),
  ];

  const overview = useQuery(api.center.overview);
  const products = useQuery(api.products.listAll);
  // Employee list returns [] for non-owners (the staff tab is owner-only anyway).
  const users = useQuery(api.users.listUsers);
  const settings = useQuery(api.center.getSettings);
  const orders = useQuery(api.orders.allOrders);
  const setUserAccess = useMutation(api.users.setUserAccess);
  const updateSettings = useMutation(api.center.updateSettings);
  const updateOrderStatus = useMutation(api.orders.updateStatus);

  // ---- Intelligence rows (computed from learned cycles) ----
  const intelRows = useMemo(() => {
    const list = products ?? [];
    const rows = list.map((p) => {
      const info = reorderInfo(p);
      const cycle = effectiveCycleDays(p);
      const predictedAt =
        p.lastOrderedAt !== undefined && cycle !== undefined
          ? p.lastOrderedAt + cycle * DAY_MS
          : undefined;
      const daysLeft =
        predictedAt !== undefined ? (predictedAt - Date.now()) / DAY_MS : undefined;
      return { product: p, info, cycle, predictedAt, daysLeft };
    });
    const rank: Record<string, number> = { due: 0, upcoming: 1, unlearned: 2, ok: 3 };
    return rows.sort((a, b) => rank[a.info.status] - rank[b.info.status]);
  }, [products]);

  const dueCount = intelRows.filter((r) => r.info.status === "due").length;
  const pendingOrders = (orders ?? []).filter((o) => o.order.status === "pending").length;

  const handleOrderStatus = async (orderId: Id<"orders">, status: OrderStatus) => {
    if (!canManageOrders) return;
    try {
      await updateOrderStatus({ orderId, status });
      toast.success("อัปเดตสถานะออเดอร์แล้ว");
    } catch (error) {
      console.error("Update order status error:", error);
      toast.error("อัปเดตไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  };

  const handleSetUserAccess = async (
    userId: Id<"users">,
    role: "customer" | "seller" | "admin" | "owner" | "staff",
    department?: string,
  ) => {
    try {
      await setUserAccess({
        userId,
        role,
        department: department as
          | "general"
          | "marketing"
          | "sales"
          | "operations"
          | "finance"
          | undefined,
      });
      toast.success("อัปเดตสิทธิ์แล้ว");
    } catch (error) {
      console.error("Set access error:", error);
      toast.error(error instanceof Error ? error.message : "อัปเดตไม่สำเร็จ");
    }
  };

  // ---- Settings form ----
  const [form, setForm] = useState({
    shopName: "",
    tagline: "",
    phone: "",
    address: "",
    announcement: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    if (settings && !settingsLoaded) {
      setForm({
        shopName: settings.shopName ?? "",
        tagline: settings.tagline ?? "",
        phone: settings.phone ?? "",
        address: settings.address ?? "",
        announcement: settings.announcement ?? "",
      });
      setSettingsLoaded(true);
    }
  }, [settings, settingsLoaded]);

  const handleSaveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSettings(true);
    try {
      await updateSettings({
        shopName: form.shopName || undefined,
        tagline: form.tagline || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        announcement: form.announcement || undefined,
      });
      toast.success("บันทึกตั้งค่าร้านแล้ว");
    } catch (error) {
      console.error("Update settings error:", error);
      toast.error("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSavingSettings(false);
    }
  };

  const stats = useMemo(() => {
    const o = overview;
    return [
      { icon: TrendingUp, label: "ยอดขายรวม", value: o ? formatBaht(o.revenue) : "—", sub: "ออเดอร์ที่เสร็จสิ้น", accent: "text-emerald-600" },
      { icon: ShoppingBag, label: "ออเดอร์ทั้งหมด", value: o ? String(o.orderCount) : "—", sub: `${o?.pendingOrders ?? 0} รอจัดการ`, accent: "text-sky-600" },
      { icon: Target, label: "เป้าหมายสำเร็จ", value: o ? `${o.goalsAchieved}/${o.goalsTotal}` : "—", sub: "จากทั้งหมด", accent: "text-slate-700" },
      { icon: Users, label: "ลูกค้า", value: o ? String(o.customerCount) : "—", sub: "บัญชีลูกค้า", accent: "text-amber-600" },
      { icon: Package, label: "สินค้าทั้งหมด", value: o ? String(o.productCount) : "—", sub: `${o?.publishedCount ?? 0} รายการประกาศขาย`, accent: "text-slate-700" },
      { icon: Boxes, label: "สต็อกต่ำ", value: o ? String(o.lowStockCount) : "—", sub: "ถึงจุดสั่งซื้อซ้ำ", accent: "text-rose-600" },
      { icon: AlertTriangle, label: "ต้องสั่งด่วน", value: o ? String(o.dueReorderCount) : "—", sub: "เลยรอบการสั่ง", accent: "text-rose-600" },
      { icon: ShieldCheck, label: "สินค้าที่ประกาศขาย", value: o ? String(o.publishedCount) : "—", sub: "แสดงใน velshop", accent: "text-emerald-600" },
    ];
  }, [overview]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-5">
            <button type="button" onClick={() => navigate("/")} aria-label="velcenter">
              <Logo />
            </button>
            <SiteSwitcher />
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
            <ShieldCheck className="size-4 text-[#10B981]" />
            velcenter · ศูนย์กลางบริษัท
            {userRole && (
              <Badge className="ml-1 gap-1 rounded-full bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/15">
                {userRole === "owner" ? (
                  <>
                    <Crown className="size-3" />
                    เจ้าของบริษัท
                  </>
                ) : (
                  ROLE_META[userRole as keyof typeof ROLE_META]?.label ?? userRole
                )}
                {userDepartment && ` · ${DEPARTMENT_LABEL[userDepartment] ?? userDepartment}`}
              </Badge>
            )}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            ศูนย์ควบคุม Velnox
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            ภาพรวมทั้งบริษัท ออเดอร์ ระบบอัจฉริยะ และสิทธิ์การเข้าถึงตามยศ
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-7">
          <TabsList className="w-full justify-start overflow-x-auto rounded-[12px] border border-slate-200 bg-white p-1 sm:w-auto">
            <TabsTrigger value="overview" className="gap-1.5 rounded-[10px]">
              <TrendingUp className="size-4" /> ภาพรวม
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5 rounded-[10px]">
              <ShoppingBag className="size-4" /> ออเดอร์
              {pendingOrders > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {pendingOrders}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="intel" className="gap-1.5 rounded-[10px]">
              <BrainCircuit className="size-4" /> Intelligence
              {dueCount > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {dueCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5 rounded-[10px]">
              <Package className="size-4" /> สินค้า
            </TabsTrigger>
            {isOwner && (
              <TabsTrigger value="staff" className="gap-1.5 rounded-[10px]">
                <Users className="size-4" /> พนักงาน
              </TabsTrigger>
            )}
            {canSeeTab("settings", userRole, userDepartment) && (
              <TabsTrigger value="settings" className="gap-1.5 rounded-[10px]">
                <Settings className="size-4" /> ตั้งค่าร้าน
              </TabsTrigger>
            )}
          </TabsList>

          {/* ============ Overview ============ */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <s.icon className={`size-4 ${s.accent}`} />
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {s.label}
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                    {s.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{s.sub}</p>
                </div>
              ))}
            </div>

            <Card className="mt-6 border-slate-200 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-[#10B981]" />
                  Velnox Intelligence สรุป
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-rose-50 p-4">
                    <p className="text-xs font-medium text-rose-600">ถึงเวลาสั่งซื้อซ้ำ</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-rose-700">
                      {dueCount} รายการ
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-medium text-emerald-600">ยอดขายจาก velshop</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
                      {overview ? formatBaht(overview.revenue) : "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-600/70">
                      จากออเดอร์ที่เสร็จสิ้น {overview?.completedOrders ?? 0} ออเดอร์
                    </p>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-4">
                    <p className="text-xs font-medium text-sky-600">ออเดอร์รอจัดการ</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-sky-700">
                      {overview?.pendingOrders ?? 0} ออเดอร์
                    </p>
                    <p className="mt-0.5 text-xs text-sky-600/70">จัดการได้ที่แท็บ ออเดอร์</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ Orders ============ */}
          <TabsContent value="orders" className="mt-6">
            {orders === undefined ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
                  <ShoppingBag className="size-7 text-[#10B981]" />
                </span>
                <h2 className="mt-5 text-lg font-semibold text-slate-900">ยังไม่มีออเดอร์</h2>
                <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
                  เมื่อลูกค้าสั่งซื้อจาก velshop ออเดอร์ทั้งหมดจะถูกรวมอยู่ที่นี่
                </p>
              </div>
            ) : (
              <>
              {/* Desktop: table */}
              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 text-slate-400">ออเดอร์ / ลูกค้า</TableHead>
                      <TableHead className="text-slate-400">วันที่</TableHead>
                      <TableHead className="text-slate-400">รายการ</TableHead>
                      <TableHead className="text-right text-slate-400">ยอดรวม</TableHead>
                      <TableHead className="pr-5 text-right text-slate-400">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(({ order, items }) => {
                      const meta = ORDER_STATUS_META[order.status];
                      return (
                        <TableRow key={order._id} className="hover:bg-slate-50/60">
                          <TableCell className="pl-5">
                            <p className="font-medium text-slate-900">{shortOrderId(order._id)}</p>
                            <p className="text-xs text-slate-400">
                              {order.customerName} · {order.customerPhone}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-slate-600">{formatThaiDate(order.createdAt)}</p>
                            <p className="text-xs text-slate-400">{order.itemCount} ชิ้น</p>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-56 space-y-0.5">
                              {items.slice(0, 2).map((item) => (
                                <p key={item._id} className="truncate text-sm text-slate-600">
                                  {item.productName} × {item.quantity} {item.unit}
                                </p>
                              ))}
                              {items.length > 2 && (
                                <p className="text-xs text-slate-400">+{items.length - 2} รายการ</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="font-semibold tabular-nums text-slate-900">
                              {formatBaht(order.total)}
                            </p>
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            {canManageOrders ? (
                              <Select
                                value={order.status}
                                onValueChange={(v) =>
                                  handleOrderStatus(order._id, v as OrderStatus)
                                }
                              >
                                <SelectTrigger className="ml-auto h-9 w-36 rounded-[10px] border-slate-200 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(
                                    ["pending", "confirmed", "completed", "cancelled"] as OrderStatus[]
                                  ).map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {ORDER_STATUS_META[s].label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={`gap-1.5 rounded-full ring-1 ring-inset ${meta.badge}`}>
                                <span className={`size-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: app-like order cards */}
              <div className="space-y-3 md:hidden">
                {orders.map(({ order, items }) => {
                  const meta = ORDER_STATUS_META[order.status];
                  return (
                    <div
                      key={order._id}
                      className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{shortOrderId(order._id)}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {order.customerName} · {order.customerPhone}
                          </p>
                        </div>
                        {canManageOrders ? (
                          <Select
                            value={order.status}
                            onValueChange={(v) => handleOrderStatus(order._id, v as OrderStatus)}
                          >
                            <SelectTrigger className="h-8 w-32 shrink-0 rounded-[10px] border-slate-200 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["pending", "confirmed", "completed", "cancelled"] as OrderStatus[]).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {ORDER_STATUS_META[s].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={`shrink-0 gap-1.5 rounded-full ring-1 ring-inset ${meta.badge}`}>
                            <span className={`size-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-3 rounded-[10px] bg-slate-50 px-3 py-2.5">
                        {items.slice(0, 2).map((item) => (
                          <p key={item._id} className="truncate text-sm text-slate-600">
                            {item.productName}{" "}
                            <span className="text-slate-400">× {item.quantity} {item.unit}</span>
                          </p>
                        ))}
                        {items.length > 2 && (
                          <p className="text-xs text-slate-400">+{items.length - 2} รายการ</p>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                          {formatThaiDate(order.createdAt)} · {order.itemCount} ชิ้น
                        </p>
                        <p className="font-bold tabular-nums text-slate-900">{formatBaht(order.total)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
            {!canManageOrders && (
              <p className="mt-4 text-xs text-slate-400">
                โหมดพนักงาน: ดูข้อมูลได้ แต่เปลี่ยนสถานะออเดอร์ได้เฉพาะผู้ดูแลและเจ้าของบริษัท
              </p>
            )}
          </TabsContent>

          {/* ============ Intelligence ============ */}
          <TabsContent value="intel" className="mt-6">
            {intelRows.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
                  <BrainCircuit className="size-7 text-[#10B981]" />
                </span>
                <h2 className="mt-5 text-lg font-semibold text-slate-900">ยังไม่มีข้อมูลให้วิเคราะห์</h2>
                <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
                  เพิ่มสินค้าและสั่งซื้อสัก 2-3 รอบ Velnox จะเริ่มคาดการณ์รอบถัดไปให้
                </p>
              </div>
            ) : (
              <>
              {/* Desktop: table */}
              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 text-slate-400">สินค้า</TableHead>
                      <TableHead className="text-slate-400">รอบการซื้อ</TableHead>
                      <TableHead className="text-slate-400">สั่งล่าสุด</TableHead>
                      <TableHead className="text-slate-400">คาดสั่งครั้งหน้า</TableHead>
                      <TableHead className="text-slate-400">เหลืออีก</TableHead>
                      <TableHead className="pr-5 text-right text-slate-400">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {intelRows.map(({ product, info, cycle, predictedAt, daysLeft }) => {
                      const meta = PRODUCT_CATEGORY_META[product.category];
                      const statusMeta = STATUS_META[info.status];
                      const Icon = meta.icon;
                      return (
                        <TableRow key={product._id} className="hover:bg-slate-50/60">
                          <TableCell className="pl-5">
                            <div className="flex items-center gap-3">
                              <span className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset ${meta.chip}`}>
                                <Icon className={`size-4 ${meta.iconClass}`} />
                              </span>
                              <div>
                                <p className="font-medium text-slate-900">{product.name}</p>
                                <p className="text-xs text-slate-400">
                                  สต็อก {formatNumber(product.currentStock)} {product.unit}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {cycle !== undefined ? (
                              <p className="font-medium tabular-nums text-slate-900">{formatDays(cycle)}</p>
                            ) : (
                              <p className="text-slate-400">—</p>
                            )}
                            <p className="text-xs text-slate-400">
                              {product.purchaseCount > 0
                                ? `เรียนรู้จาก ${product.purchaseCount} ครั้ง`
                                : "คาดการณ์จากที่ตั้งไว้"}
                            </p>
                          </TableCell>
                          <TableCell>
                            {product.lastOrderedAt !== undefined ? (
                              <p className="text-sm text-slate-600">{formatThaiDate(product.lastOrderedAt)}</p>
                            ) : (
                              <p className="text-slate-400">—</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {predictedAt !== undefined ? (
                              <p className="text-sm text-slate-600">{formatThaiDate(predictedAt)}</p>
                            ) : (
                              <p className="text-slate-400">—</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {daysLeft !== undefined ? (
                              daysLeft > 0 ? (
                                <p className="font-medium tabular-nums text-slate-900">
                                  {formatDays(daysLeft)}
                                </p>
                              ) : (
                                <p className="font-medium text-rose-600">เลยกำหนด</p>
                              )
                            ) : (
                              <p className="text-slate-400">—</p>
                            )}
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            <Badge className={`gap-1 rounded-full ring-1 ring-inset ${statusMeta.badge}`}>
                              <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                              {statusMeta.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: app-like intelligence cards */}
              <div className="space-y-3 md:hidden">
                {intelRows.map(({ product, info, cycle, predictedAt, daysLeft }) => {
                  const meta = PRODUCT_CATEGORY_META[product.category];
                  const statusMeta = STATUS_META[info.status];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={product._id}
                      className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset ${meta.chip}`}>
                            <Icon className={`size-4 ${meta.iconClass}`} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                            <p className="text-xs text-slate-400">{meta.label}</p>
                          </div>
                        </div>
                        <Badge className={`shrink-0 gap-1 rounded-full ring-1 ring-inset ${statusMeta.badge}`}>
                          <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                          {statusMeta.label}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-[10px] bg-slate-50 p-3 text-xs">
                        <div>
                          <p className="text-slate-400">สต็อกปัจจุบัน</p>
                          <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
                            {formatNumber(product.currentStock)} {product.unit}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">รอบการซื้อ</p>
                          <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
                            {cycle !== undefined ? formatDays(cycle) : "—"}
                            {product.purchaseCount > 0 && (
                              <span className="ml-1 font-normal text-slate-400">({product.purchaseCount} ครั้ง)</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">สั่งล่าสุด</p>
                          <p className="mt-0.5 font-medium text-slate-700">
                            {product.lastOrderedAt !== undefined ? formatThaiDate(product.lastOrderedAt) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">คาดสั่งครั้งหน้า</p>
                          <p className="mt-0.5 font-medium text-slate-700">
                            {predictedAt !== undefined ? formatThaiDate(predictedAt) : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-slate-400">เหลืออีก</p>
                        {daysLeft !== undefined ? (
                          daysLeft > 0 ? (
                            <p className="text-sm font-bold tabular-nums text-slate-900">{formatDays(daysLeft)}</p>
                          ) : (
                            <p className="text-sm font-bold text-rose-600">เลยกำหนด</p>
                          )
                        ) : (
                          <p className="text-sm text-slate-400">—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
              <BrainCircuit className="size-3.5 text-[#10B981]" />
              Velnox คำนวณจากรอบการสั่งจริงที่ระบบเรียนรู้ — ยิ่งสั่งมาก ยิ่งแม่นยำ
            </p>
          </TabsContent>

          {/* ============ Products (view-only registry) ============ */}
          <TabsContent value="products" className="mt-6">
            {/* Desktop: table */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-slate-400">สินค้า</TableHead>
                    <TableHead className="text-slate-400">เจ้าของร้าน</TableHead>
                    <TableHead className="text-slate-400">ราคา</TableHead>
                    <TableHead className="text-slate-400">สต็อก</TableHead>
                    <TableHead className="pr-5 text-right text-slate-400">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(products ?? []).map((p) => {
                    const meta = PRODUCT_CATEGORY_META[p.category];
                    const Icon = meta.icon;
                    return (
                      <TableRow key={p._id} className="hover:bg-slate-50/60">
                        <TableCell className="pl-5">
                          <div className="flex items-center gap-3">
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset ${meta.chip}`}>
                              <Icon className={`size-4 ${meta.iconClass}`} />
                            </span>
                            <div>
                              <p className="font-medium text-slate-900">{p.name}</p>
                              <p className="text-xs text-slate-400">{meta.label}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-slate-600">{p.userId}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium tabular-nums text-slate-900">
                            {p.price !== undefined ? formatBaht(p.price) : "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium tabular-nums text-slate-900">
                            {formatNumber(p.currentStock)}{" "}
                            <span className="text-xs font-normal text-slate-400">{p.unit}</span>
                          </p>
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          {p.published ? (
                            <Badge className="gap-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                              ประกาศขาย
                            </Badge>
                          ) : (
                            <Badge className="gap-1 rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-600/10">
                              ยังไม่ประกาศ
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: app-like product cards */}
            <div className="space-y-3 md:hidden">
              {(products ?? []).map((p) => {
                const meta = PRODUCT_CATEGORY_META[p.category];
                const Icon = meta.icon;
                return (
                  <div
                    key={p._id}
                    className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset ${meta.chip}`}>
                          <Icon className={`size-4 ${meta.iconClass}`} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                          <p className="text-xs text-slate-400">{meta.label}</p>
                        </div>
                      </div>
                      {p.published ? (
                        <Badge className="shrink-0 gap-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                          ประกาศขาย
                        </Badge>
                      ) : (
                        <Badge className="shrink-0 gap-1 rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-600/10">
                          ยังไม่ประกาศ
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-[10px] bg-slate-50 px-3 py-2.5 text-xs">
                      <span className="text-slate-400">
                        ราคา{" "}
                        <span className="font-semibold tabular-nums text-slate-900">
                          {p.price !== undefined ? formatBaht(p.price) : "—"}
                        </span>
                      </span>
                      <span className="text-slate-400">
                        สต็อก{" "}
                        <span className="font-semibold tabular-nums text-slate-900">
                          {formatNumber(p.currentStock)} {p.unit}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
              <Package className="size-3.5 text-[#10B981]" />
              เปิด-ปิดประกาศขายสินค้า: เจ้าของร้านจัดการได้ที่ velseller → Smart Reorder
            </p>
          </TabsContent>

          {/* ============ Staff (owner only) ============ */}
          {isOwner && (
            <TabsContent value="staff" className="mt-6">
              <Card className="mb-4 max-w-2xl border-slate-200 shadow-none">
                <CardContent className="pt-5">
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Crown className="size-4 text-amber-500" />
                    เฉพาะเจ้าของบริษัทเท่านั้นที่จัดการสิทธิ์พนักงาน — admin/พนักงานดูข้อมูลได้แต่แตะตรงนี้ไม่ได้
                  </p>
                </CardContent>
              </Card>
              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
                <Table className="min-w-[560px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 text-slate-400">พนักงาน</TableHead>
                      <TableHead className="text-slate-400">บทบาท</TableHead>
                      <TableHead className="text-slate-400">ฝ่าย</TableHead>
                      <TableHead className="pr-5 text-right text-slate-400">สิทธิ์</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(users ?? []).map((u) => {
                      const role = u.role ?? "customer";
                      const meta =
                        ROLE_META[role as keyof typeof ROLE_META] ?? ROLE_META.customer;
                      const isSelf = u._id === user?._id;
                      return (
                        <TableRow key={u._id} className="hover:bg-slate-50/60">
                          <TableCell className="pl-5">
                            <p className="font-medium text-slate-900">
                              {u.name || "ผู้ใช้ที่ยังไม่ตั้งชื่อ"}
                              {isSelf && <span className="ml-1.5 text-xs text-slate-400">(คุณ)</span>}
                            </p>
                            <p className="text-xs text-slate-400">{u.email ?? "บัญชีผู้เยี่ยมชม"}</p>
                          </TableCell>
                          <TableCell>
                            {isSelf ? (
                              <Badge className={`gap-1 rounded-full ring-1 ring-inset ${meta.badge}`}>
                                {role === "owner" && <Crown className="size-3" />}
                                {role === "admin" && <BadgeCheck className="size-3" />}
                                {meta.label}
                              </Badge>
                            ) : (
                              <Select
                                value={role}
                                onValueChange={(v) =>
                                  handleSetUserAccess(
                                    u._id,
                                    v as "customer" | "seller" | "admin" | "owner" | "staff",
                                    u.department,
                                  )
                                }
                              >
                                <SelectTrigger className="h-9 w-40 rounded-[10px] border-slate-200 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="customer">ลูกค้า</SelectItem>
                                  <SelectItem value="seller">พ่อค้า / ร้านค้า</SelectItem>
                                  <SelectItem value="staff">พนักงาน (ดูข้อมูล)</SelectItem>
                                  <SelectItem value="admin">ผู้ดูแลฝ่าย</SelectItem>
                                  <SelectItem value="owner">เจ้าของบริษัท</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {isSelf ? (
                              <span className="text-sm text-slate-400">
                                {u.department
                                  ? DEPARTMENT_LABEL[u.department] ?? u.department
                                  : "—"}
                              </span>
                            ) : (
                              <Select
                                value={u.department ?? "general"}
                                onValueChange={(v) =>
                                  handleSetUserAccess(u._id, role, v)
                                }
                              >
                                <SelectTrigger className="h-9 w-40 rounded-[10px] border-slate-200 text-sm">
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
                            )}
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            <Badge
                              className={`gap-1 rounded-full ring-1 ring-inset ${meta.badge}`}
                            >
                              {meta.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: app-like staff cards */}
              <div className="space-y-3 md:hidden">
                {(users ?? []).map((u) => {
                  const role = u.role ?? "customer";
                  const meta =
                    ROLE_META[role as keyof typeof ROLE_META] ?? ROLE_META.customer;
                  const isSelf = u._id === user?._id;
                  return (
                    <div
                      key={u._id}
                      className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {u.name || "ผู้ใช้ที่ยังไม่ตั้งชื่อ"}
                            {isSelf && <span className="ml-1.5 text-xs text-slate-400">(คุณ)</span>}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-400">{u.email ?? "บัญชีผู้เยี่ยมชม"}</p>
                        </div>
                        <Badge className={`shrink-0 gap-1 rounded-full ring-1 ring-inset ${meta.badge}`}>
                          {role === "owner" && <Crown className="size-3" />}
                          {role === "admin" && <BadgeCheck className="size-3" />}
                          {meta.label}
                        </Badge>
                      </div>
                      {!isSelf && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Select
                            value={role}
                            onValueChange={(v) =>
                              handleSetUserAccess(
                                u._id,
                                v as "customer" | "seller" | "admin" | "owner" | "staff",
                                u.department,
                              )
                            }
                          >
                            <SelectTrigger className="h-10 w-full rounded-[10px] border-slate-200 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="customer">ลูกค้า</SelectItem>
                              <SelectItem value="seller">พ่อค้า / ร้านค้า</SelectItem>
                              <SelectItem value="staff">พนักงาน (ดูข้อมูล)</SelectItem>
                              <SelectItem value="admin">ผู้ดูแลฝ่าย</SelectItem>
                              <SelectItem value="owner">เจ้าของบริษัท</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={u.department ?? "general"}
                            onValueChange={(v) => handleSetUserAccess(u._id, role, v)}
                          >
                            <SelectTrigger className="h-10 w-full rounded-[10px] border-slate-200 text-sm">
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
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                <Users className="size-3.5 text-[#10B981]" />
                พนักงาน (staff) ดูตัวเลขธุรกิจได้แต่แตะข้อมูลไม่ได้ · ผู้ดูแลฝ่าย (admin) จัดการข้อมูลได้แต่จัดการพนักงานไม่ได้
              </p>
            </TabsContent>
          )}

          {/* ============ Settings ============ */}
          {canSeeTab("settings", userRole, userDepartment) && (
            <TabsContent value="settings" className="mt-6">
              <Card className="max-w-2xl border-slate-200 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Store className="size-4 text-[#10B981]" />
                    ข้อมูลหน้าร้าน (velshop)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveSettings} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="settings-name">ชื่อร้าน</Label>
                      <Input
                        id="settings-name"
                        value={form.shopName}
                        onChange={(e) => setForm((f) => ({ ...f, shopName: e.target.value }))}
                        placeholder="เช่น Velnox Marketplace"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="settings-tagline">คำโปรย / tagline</Label>
                      <Input
                        id="settings-tagline"
                        value={form.tagline}
                        onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                        placeholder="Commerce that remembers you · จำแทนคุณ"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="settings-phone">เบอร์โทรติดต่อ</Label>
                        <Input
                          id="settings-phone"
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="081-234-5678"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="settings-announcement">ประกาศ / แบนเนอร์</Label>
                        <Input
                          id="settings-announcement"
                          value={form.announcement}
                          onChange={(e) => setForm((f) => ({ ...f, announcement: e.target.value }))}
                          placeholder="เช่น สินค้าใหม่เข้าคลังแล้ว!"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="settings-address">ที่อยู่ร้าน</Label>
                      <Textarea
                        id="settings-address"
                        value={form.address}
                        onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                        placeholder="ที่อยู่สำหรับรับสินค้า / นัดรับ"
                        rows={2}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-fit gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                      disabled={savingSettings}
                    >
                      {savingSettings ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      บันทึกตั้งค่า
                    </Button>
                  </form>
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                    <Megaphone className="size-3.5 text-[#10B981]" />
                    ข้อมูลนี้แสดงบนหน้าร้าน velshop ทันทีหลังบันทึก
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* App-like bottom nav on mobile (respects role permissions) */}
      <MobileTabBar items={mobileTabs} />
    </div>
  );
}
