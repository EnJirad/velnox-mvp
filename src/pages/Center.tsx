import { Logo } from "@/components/Logo";
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
import { Switch } from "@/components/ui/switch";
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
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Tab = "overview" | "orders" | "intel" | "users" | "products" | "settings";

export default function Center() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const overview = useQuery(api.center.overview);
  const products = useQuery(api.products.listAll);
  const users = useQuery(api.users.listUsers);
  const settings = useQuery(api.center.getSettings);
  const orders = useQuery(api.orders.allOrders);
  const setRole = useMutation(api.users.setRole);
  const togglePublished = useMutation(api.products.togglePublished);
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
    try {
      await updateOrderStatus({ orderId, status });
      toast.success("อัปเดตสถานะออเดอร์แล้ว");
    } catch (error) {
      console.error("Update order status error:", error);
      toast.error("อัปเดตไม่สำเร็จ กรุณาลองอีกครั้ง");
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

  const handleTogglePublished = async (product: Product, published: boolean) => {
    try {
      await togglePublished({ productId: product._id, published });
      toast.success(published ? "ประกาศขายแล้ว" : "ปิดการขายแล้ว");
    } catch (error) {
      console.error("Toggle publish error:", error);
      toast.error(error instanceof Error ? error.message : "ไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  };

  const handleSetRole = async (userId: Id<"users">, role: "customer" | "seller" | "admin") => {
    try {
      await setRole({ userId, role });
      toast.success("อัปเดตบทบาทแล้ว");
    } catch (error) {
      console.error("Set role error:", error);
      toast.error("อัปเดตไม่สำเร็จ กรุณาลองอีกครั้ง");
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
            velcenter · ศูนย์กลางธุรกิจ
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            ศูนย์ควบคุม Velnox
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            ภาพรวมทั้งธุรกิจ ออเดอร์ ระบบอัจฉริยะ และการจัดการผู้ใช้ในที่เดียว
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
            <TabsTrigger value="users" className="gap-1.5 rounded-[10px]">
              <Users className="size-4" /> ผู้ใช้
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5 rounded-[10px]">
              <Package className="size-4" /> สินค้า
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 rounded-[10px]">
              <Settings className="size-4" /> ตั้งค่าร้าน
            </TabsTrigger>
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
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Table>
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
              <ShoppingBag className="size-3.5 text-[#10B981]" />
              ออเดอร์จาก velshop มาที่นี่ — เปลี่ยนสถานะได้ทันที และสต็อกจะถูกคืนอัตโนมัติเมื่อยกเลิก
            </p>
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
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Table>
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
            )}
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
              <BrainCircuit className="size-3.5 text-[#10B981]" />
              Velnox คำนวณจากรอบการสั่งจริงที่ระบบเรียนรู้ — ยิ่งสั่งมาก ยิ่งแม่นยำ
            </p>
          </TabsContent>

          {/* ============ Users ============ */}
          <TabsContent value="users" className="mt-6">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-slate-400">ผู้ใช้</TableHead>
                    <TableHead className="text-slate-400">บทบาท</TableHead>
                    <TableHead className="pr-5 text-right text-slate-400">เปลี่ยนบทบาท</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users ?? []).map((u) => {
                    const role = u.role ?? "customer";
                    const meta = ROLE_META[role as keyof typeof ROLE_META] ?? ROLE_META.customer;
                    return (
                      <TableRow key={u._id} className="hover:bg-slate-50/60">
                        <TableCell className="pl-5">
                          <p className="font-medium text-slate-900">{u.name || "ผู้ใช้ที่ยังไม่ตั้งชื่อ"}</p>
                          <p className="text-xs text-slate-400">{u.email ?? "บัญชีผู้เยี่ยมชม"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={`gap-1 rounded-full ring-1 ring-inset ${meta.badge}`}>
                            {role === "admin" && <BadgeCheck className="size-3" />}
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <Select
                            value={role}
                            onValueChange={(v) =>
                              handleSetRole(u._id, v as "customer" | "seller" | "admin")
                            }
                          >
                            <SelectTrigger className="ml-auto h-9 w-40 rounded-[10px] border-slate-200 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="customer">ลูกค้า</SelectItem>
                              <SelectItem value="seller">เจ้าของร้าน</SelectItem>
                              <SelectItem value="admin">ผู้ดูแลศูนย์กลาง</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ============ Products ============ */}
          <TabsContent value="products" className="mt-6">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-slate-400">สินค้า</TableHead>
                    <TableHead className="text-slate-400">ราคา</TableHead>
                    <TableHead className="text-slate-400">สต็อก</TableHead>
                    <TableHead className="pr-5 text-right text-slate-400">ประกาศขาย</TableHead>
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
                          <Switch
                            checked={p.published ?? false}
                            onCheckedChange={(v) => handleTogglePublished(p, v)}
                            aria-label={`ประกาศขาย ${p.name}`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {products !== undefined && products.length === 0 && (
              <p className="mt-4 text-center text-sm text-slate-400">
                ยังไม่มีสินค้า — เพิ่มสินค้าได้ที่ velseller → Smart Reorder
              </p>
            )}
          </TabsContent>

          {/* ============ Settings ============ */}
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
                      placeholder="เช่น ร้านบ้านสวนของฝาก"
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
        </Tabs>
      </main>
    </div>
  );
}
