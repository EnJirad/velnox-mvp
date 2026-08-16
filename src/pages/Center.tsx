import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NotificationsBell } from "@/components/NotificationsBell";
import { StatusBadge } from "@/components/StatusBadge";
import { LogoMark } from "@/components/Logo";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  LayoutDashboard,
  Loader2,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserCheck,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "applications", label: "Applications", icon: UserCheck },
  { id: "sellers", label: "Sellers", icon: Store },
  { id: "products", label: "Products", icon: Package },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "payouts", label: "Payouts", icon: Banknote },
] as const;

type TabId = (typeof TABS)[number]["id"];

function ReviewDialog({
  open,
  onOpenChange,
  title,
  description,
  onDecision,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onDecision: (decision: "APPROVED" | "REJECTED" | "ACTIVE", reason?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const handle = async (decision: "APPROVED" | "REJECTED" | "ACTIVE") => {
    setBusy(decision === "ACTIVE" ? "approve" : decision === "APPROVED" ? "approve" : "reject");
    try {
      await onDecision(decision, reason.trim() || undefined);
      onOpenChange(false);
      setReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="reason">Note to seller (optional)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Required when rejecting — shown to the seller."
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 cursor-pointer text-red-400 hover:text-red-300"
            disabled={busy !== null}
            onClick={() => void handle("REJECTED")}
          >
            {busy === "reject" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <XCircle className="mr-2 size-4" />}
            Reject
          </Button>
          <Button
            type="button"
            className="flex-1 cursor-pointer"
            disabled={busy !== null}
            onClick={() => void handle("APPROVED")}
          >
            {busy === "approve" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccessGate() {
  const claim = useMutation(api.center.claimBootstrapAdmin);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  const handleClaim = async () => {
    setBusy(true);
    try {
      await claim();
      toast.success("VelCenter unlocked", {
        description: "You are now the Super Admin of this deployment.",
      });
    } catch (error) {
      setDenied(true);
      toast.error(error instanceof Error ? error.message : "Could not claim access.");
    } finally {
      setBusy(false);
    }
  };

  if (denied) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center">
        <ShieldCheck className="size-12 text-red-400" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Access restricted</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          VelCenter is a private company application. Access is granted only to
          Velnox employees with an active employee record.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center">
      <LogoMark className="size-14 rounded-2xl" />
      <h1 className="mt-6 text-2xl font-bold tracking-tight">VelCenter</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        The private command center. This deployment has no employees yet, so as
        the first person to open VelCenter you can claim the Super Admin seat
        and start reviewing sellers and products.
      </p>
      <Button size="lg" className="mt-8 cursor-pointer" onClick={() => void handleClaim()} disabled={busy}>
        {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}
        Claim Super Admin
      </Button>
    </div>
  );
}

export default function Center() {
  const employee = useQuery(api.center.isEmployee);
  const [tab, setTab] = useState<TabId>("overview");

  if (employee === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-base font-black tracking-[0.18em]">VELNOX</span>
            <Badge variant="outline" className="ml-1 border-violet-500/30 bg-violet-500/10 text-[10px] font-bold uppercase tracking-widest text-violet-300">
              Velcenter
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {employee && <NotificationsBell />}
            <Button asChild variant="ghost" size="sm" className="cursor-pointer">
              <a href="/dashboard">
                Dashboard <ArrowRight className="ml-1 size-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      {!employee ? (
        <AccessGate />
      ) : (
        <CenterDesk employee={employee} tab={tab} setTab={setTab} />
      )}
    </div>
  );
}

function CenterDesk({
  employee,
  tab,
  setTab,
}: {
  employee: { employeeId: string; role: string; department: string };
  tab: TabId;
  setTab: (tab: TabId) => void;
}) {
  const stats = useQuery(api.center.centerStats);
  const applications = useQuery(api.center.listSellerApplications);
  const sellers = useQuery(api.center.listSellers);
  const reviews = useQuery(api.center.listProductReviews);
  const orders = useQuery(api.center.listAllOrders);
  const payouts = useQuery(api.center.listPayouts);

  const reviewSeller = useMutation(api.center.reviewSeller);
  const updateSellerStatus = useMutation(api.center.updateSellerStatus);
  const reviewProduct = useMutation(api.center.reviewProduct);
  const resolvePayout = useMutation(api.center.resolvePayout);

  const [sellerReview, setSellerReview] = useState<{ id: string; name: string } | null>(null);
  const [productReview, setProductReview] = useState<{ id: string; name: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusyKey(key);
    try {
      await action();
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300">
              Command center
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {employee.employeeId} · {employee.role.replace(/_/g, " ")}
            </h1>
          </div>
          <StatusBadge status="ACTIVE" className="border-violet-500/30 bg-violet-500/10 text-violet-300" />
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card p-1">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                tab === tabItem.id
                  ? "bg-violet-400/10 text-violet-300"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tabItem.icon className="size-4" /> {tabItem.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="flex flex-col gap-6">
            {stats === undefined ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Gross merchandise value", value: formatMoney(stats.grossMerchandiseValue), icon: Banknote, accent: true },
                    { label: "Orders", value: String(stats.orders), icon: ShoppingBag },
                    { label: "Live products", value: `${stats.activeProducts}/${stats.products}`, icon: Package },
                    { label: "Approved sellers", value: `${stats.approvedSellers}/${stats.sellers}`, icon: Store },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-border/70 bg-card p-5">
                      <stat.icon className={`size-5 ${stat.accent ? "text-lime-300" : "text-muted-foreground"}`} />
                      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{stat.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "Seller applications pending", count: stats.pendingSellerApplications, icon: UserCheck, href: "#" },
                    { label: "Product reviews pending", count: stats.pendingProductReviews, icon: Package, href: "#" },
                    { label: "Payouts pending", count: stats.pendingPayouts, icon: Banknote, href: "#" },
                  ].map((item, index) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setTab(["applications", "products", "payouts"][index] as TabId)}
                      className="flex cursor-pointer items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 text-left transition-colors hover:border-violet-500/40"
                    >
                      <item.icon className="size-5 text-violet-300" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-2xl font-bold tracking-tight">{item.count}</p>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Applications */}
        {tab === "applications" && (
          <div className="flex flex-col gap-4">
            {applications === undefined ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : applications.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 p-12 text-center text-sm text-muted-foreground">
                No seller applications yet.
              </p>
            ) : (
              applications.map((application) => (
                <div key={application.id} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold tracking-tight">{application.storeName}</p>
                      <StatusBadge status={application.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      velnox.com/{application.storeSlug} · submitted{" "}
                      {formatDateTime(application.submittedAt)}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {application.contactPerson || application.contactEmail} ·{" "}
                      {application.contactPhone || "no phone"} ·{" "}
                      {application.businessInfo || "no business details"}
                    </p>
                    {application.description && (
                      <p className="mt-2 max-w-2xl text-sm">{application.description}</p>
                    )}
                    {application.rejectionReason && (
                      <p className="mt-2 text-xs text-red-400">
                        Rejected: {application.rejectionReason}
                      </p>
                    )}
                  </div>
                  {["PENDING", "UNDER_REVIEW", "REJECTED"].includes(application.status) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 cursor-pointer"
                      onClick={() => setSellerReview({ id: application.id, name: application.storeName })}
                    >
                      Review application
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Sellers */}
        {tab === "sellers" && (
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Products</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Approved</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers === undefined ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        <Loader2 className="mx-auto size-5 animate-spin" />
                      </td>
                    </tr>
                  ) : (
                    sellers.map((seller) => (
                      <tr key={seller.id} className="border-b border-border/50 bg-card/50">
                        <td className="px-4 py-3">
                          <p className="font-medium">velnox.com/{seller.storeSlug}</p>
                          <p className="text-xs text-muted-foreground">{seller.storeName}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{seller.email ?? "—"}</td>
                        <td className="px-4 py-3 tabular-nums">{seller.productCount}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={seller.status} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {seller.approvedAt ? formatDateTime(seller.approvedAt) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {seller.status === "APPROVED" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="cursor-pointer text-red-400"
                                disabled={busyKey === `suspend-${seller.id}`}
                                onClick={() =>
                                  void run(
                                    `suspend-${seller.id}`,
                                    () => updateSellerStatus({ sellerId: seller.id as Id<"sellers">, status: "SUSPENDED" }),
                                    `${seller.storeName} suspended`,
                                  )
                                }
                              >
                                Suspend
                              </Button>
                            )}
                            {(seller.status === "SUSPENDED" || seller.status === "DISABLED") && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="cursor-pointer"
                                disabled={busyKey === `reactivate-${seller.id}`}
                                onClick={() =>
                                  void run(
                                    `reactivate-${seller.id}`,
                                    () => updateSellerStatus({ sellerId: seller.id as Id<"sellers">, status: "APPROVED" }),
                                    `${seller.storeName} reactivated`,
                                  )
                                }
                              >
                                Reactivate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products */}
        {tab === "products" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {reviews === undefined
                ? "Loading…"
                : reviews.length === 0
                  ? "No products waiting for review."
                  : `${reviews.length} product(s) waiting for review.`}
            </p>
            {reviews?.map((product) => (
              <div key={product.id} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 sm:flex-row sm:items-center">
                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {product.images[0] ? (
                    <img src={product.images[0]} alt={product.name} className="size-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold tracking-tight">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.sellerName} · {formatMoney(product.price)} · stock {product.stock}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 cursor-pointer"
                  onClick={() => setProductReview({ id: product.id, name: product.name })}
                >
                  Review product
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Orders */}
        {tab === "orders" && (
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders === undefined ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        <Loader2 className="mx-auto size-5 animate-spin" />
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="border-b border-border/50 bg-card/50">
                        <td className="px-4 py-3">
                          <p className="font-medium">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {order.customerEmail ?? "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{order.itemCount}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums">{formatMoney(order.total)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {order.paymentMethod === "cod" ? "COD" : "Card"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payouts */}
        {tab === "payouts" && (
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Net</th>
                    <th className="px-4 py-3">Commission</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts === undefined ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        <Loader2 className="mx-auto size-5 animate-spin" />
                      </td>
                    </tr>
                  ) : payouts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        No payouts requested yet.
                      </td>
                    </tr>
                  ) : (
                    payouts.map((payout) => (
                      <tr key={payout.id} className="border-b border-border/50 bg-card/50">
                        <td className="px-4 py-3 font-medium">{payout.storeName}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums">{formatMoney(payout.net)}</td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatMoney(payout.commission)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateTime(payout.periodEnd)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={payout.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            {payout.status !== "PAID" ? (
                              <Button
                                type="button"
                                size="sm"
                                className="cursor-pointer"
                                disabled={busyKey === `pay-${payout.id}`}
                                onClick={() =>
                                  void run(
                                    `pay-${payout.id}`,
                                    () => resolvePayout({ payoutId: payout.id as Id<"payouts"> }),
                                    "Payout marked paid",
                                  )
                                }
                              >
                                {busyKey === `pay-${payout.id}` ? (
                                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="mr-1.5 size-3.5" />
                                )}
                                Mark paid
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Paid {payout.paidAt ? formatDateTime(payout.paidAt) : ""}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ReviewDialog
        open={sellerReview !== null}
        onOpenChange={(open) => !open && setSellerReview(null)}
        title={`Review ${sellerReview?.name ?? "application"}`}
        description="Approve to open the store instantly, or reject with a note the seller can act on."
        onDecision={async (decision, reason) => {
          if (!sellerReview) return;
          await reviewSeller({
            sellerId: sellerReview.id as Id<"sellers">,
            decision: decision as "APPROVED" | "REJECTED",
            reason,
          });
          toast.success(decision === "APPROVED" ? "Seller approved" : "Application rejected");
        }}
      />
      <ReviewDialog
        open={productReview !== null}
        onOpenChange={(open) => !open && setProductReview(null)}
        title={`Review ${productReview?.name ?? "product"}`}
        description="Approving puts the product live on Velshop immediately."
        onDecision={async (decision, reason) => {
          if (!productReview) return;
          await reviewProduct({
            productId: productReview.id as Id<"products">,
            decision: decision === "APPROVED" ? "ACTIVE" : "REJECTED",
            reason,
          });
          toast.success(decision === "APPROVED" ? "Product is live" : "Product rejected");
        }}
      />
    </div>
  );
}
