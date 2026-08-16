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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { NotificationsBell } from "@/components/NotificationsBell";
import { StatusBadge } from "@/components/StatusBadge";
import { LogoMark } from "@/components/Logo";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { formatDateTime, formatMoney, placeholderImage } from "@/lib/format";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Hourglass,
  Loader2,
  Package,
  Pencil,
  Plus,
  Rocket,
  Send,
  Settings,
  ShoppingBag,
  Store,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TABS = [
  { id: "overview", label: "Overview", icon: Store },
  { id: "products", label: "Products", icon: Package },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "payouts", label: "Payouts", icon: Wallet },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ---------------------------------------------------------------------------
// Application form
// ---------------------------------------------------------------------------

function ApplyForm({
  seller,
  onDone,
}: {
  seller: Doc<"sellers"> | null;
  onDone?: () => void;
}) {
  const submit = useMutation(api.sellers.submitSellerApplication);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agreed) {
      toast.error("Accept the seller agreement to continue.");
      return;
    }
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    try {
      await submit({
        storeName: String(formData.get("storeName") ?? ""),
        storeSlug: String(formData.get("storeSlug") ?? ""),
        description: String(formData.get("description") ?? "") || undefined,
        contactPerson: String(formData.get("contactPerson") ?? "") || undefined,
        contactPhone: String(formData.get("contactPhone") ?? "") || undefined,
        contactEmail: String(formData.get("contactEmail") ?? "") || undefined,
        businessInfo: String(formData.get("businessInfo") ?? "") || undefined,
        storeAddress: String(formData.get("storeAddress") ?? "") || undefined,
        shippingSettings: {
          shipsNationwide: formData.get("shipsNationwide") === "on",
          flatFee: 4500,
          freeShippingThreshold: 100000,
          processingDays: Number(formData.get("processingDays") ?? 1) || 1,
        },
        paymentInfo: {
          method: "bank",
          accountName: String(formData.get("accountName") ?? "") || undefined,
          accountNumber: String(formData.get("accountNumber") ?? "") || undefined,
          bankName: String(formData.get("bankName") ?? "") || undefined,
        },
        agreementAccepted: agreed,
      });
      toast.success("Application submitted", {
        description: "Our team will review it within 48 hours.",
      });
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex items-center gap-3">
        <LogoMark />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Become a Velseller</h1>
          <p className="text-sm text-muted-foreground">
            Tell us about your store — review takes under 48 hours.
          </p>
        </div>
      </div>

      {seller?.status === "REJECTED" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
          <XCircle className="mt-0.5 size-5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-300">
              Previous application rejected
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {seller.rejectionReason ||
                "Please revise your application and resubmit."}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-8">
        <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-6">
          <h2 className="text-lg font-bold tracking-tight">Store identity</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="storeName">Store name *</Label>
              <Input
                id="storeName"
                name="storeName"
                required
                defaultValue={seller?.storeName}
                placeholder="e.g. Nova Supply Co."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="storeSlug">Store URL</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">velnox.com/</span>
                <Input
                  id="storeSlug"
                  name="storeSlug"
                  defaultValue={seller?.storeSlug}
                  placeholder="nova-supply"
                  required
                />
              </div>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={seller?.description}
                placeholder="What do you sell, and what makes your store different?"
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-6">
          <h2 className="text-lg font-bold tracking-tight">Contact & business</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contactPerson">Contact person</Label>
              <Input id="contactPerson" name="contactPerson" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactPhone">Phone</Label>
              <Input id="contactPhone" name="contactPhone" placeholder="08x-xxx-xxxx" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">Email</Label>
              <Input id="contactEmail" name="contactEmail" type="email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="processingDays">Processing days</Label>
              <Input
                id="processingDays"
                name="processingDays"
                type="number"
                min={1}
                max={7}
                defaultValue={1}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="businessInfo">Business details</Label>
              <Textarea
                id="businessInfo"
                name="businessInfo"
                rows={2}
                placeholder="Registered business name, tax id, product sourcing…"
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-6">
          <h2 className="text-lg font-bold tracking-tight">Payout account</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="accountName">Account name</Label>
              <Input id="accountName" name="accountName" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountNumber">Account number</Label>
              <Input id="accountNumber" name="accountNumber" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bankName">Bank</Label>
              <Input id="bankName" name="bankName" placeholder="e.g. KBank" />
            </div>
          </div>
        </section>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors data-[checked=true]:border-lime-500/50" data-checked={agreed}>
          <Switch checked={agreed} onCheckedChange={setAgreed} />
          <span className="text-sm leading-relaxed text-muted-foreground">
            I agree to the <span className="text-foreground">Velnox Seller Agreement</span>:
            accurate listings, 10% platform commission, and prompt fulfillment
            of every order.
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full cursor-pointer" disabled={busy}>
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4" />
          )}
          Submit application
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product dialog
// ---------------------------------------------------------------------------

function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string; description: string; price: number; stock: number; sku?: string; images: string[]; categoryId?: string } | null;
  categories: { id: string; name: { en: string } }[] | undefined;
}) {
  const upsert = useMutation(api.products.upsertProduct);
  const [busy, setBusy] = useState(false);
  const [categoryId, setCategoryId] = useState<string | undefined>(
    product?.categoryId,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    const price = Number(formData.get("price") ?? 0);
    const stock = Number(formData.get("stock") ?? 0);
    const imageLines = String(formData.get("images") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    try {
      await upsert({
        id: product ? (product.id as Id<"products">) : undefined,
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        price: Math.round(price * 100),
        stock: Math.round(stock),
        categoryId: (categoryId || undefined) as Id<"categories"> | undefined,
        sku: String(formData.get("sku") ?? "") || undefined,
        images: imageLines.length > 0 ? imageLines : [placeholderImage("NEW")],
      });
      toast.success(product ? "Product updated" : "Product created", {
        description: "Publish it when you're ready for review.",
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Products go through Velnox quality review before going live.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" name="name" required defaultValue={product?.name} placeholder="Product name" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-price">Price (THB)</Label>
              <Input
                id="p-price"
                name="price"
                required
                type="number"
                min={1}
                step="0.01"
                defaultValue={product ? (product.price / 100).toFixed(2) : undefined}
                placeholder="1290.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-stock">Stock</Label>
              <Input
                id="p-stock"
                name="stock"
                required
                type="number"
                min={0}
                defaultValue={product?.stock ?? 0}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-sku">SKU</Label>
              <Input id="p-sku" name="sku" defaultValue={product?.sku} placeholder="NVA-001" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="p-category">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-images">Image URLs (one per line)</Label>
            <Textarea
              id="p-images"
              name="images"
              rows={3}
              defaultValue={product?.images.join("\n")}
              placeholder={"https://…/photo1.jpg\nhttps://…/photo2.jpg"}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use a generated placeholder.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-description">Description</Label>
            <Textarea
              id="p-description"
              name="description"
              required
              rows={4}
              defaultValue={product?.description}
              placeholder="What is it, why is it great, what's in the box?"
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="cursor-pointer" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {product ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Approved seller desk
// ---------------------------------------------------------------------------

type SellerProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  reserved: number;
  images: string[];
  status: string;
  rejectionReason?: string;
  totalSold: number;
  categoryName: string | null;
  updatedAt: number;
  description: string;
  sku?: string;
};

function SellerDesk({
  seller,
  tab,
  setTab,
}: {
  seller: Doc<"sellers">;
  tab: TabId;
  setTab: (tab: TabId) => void;
}) {
  const stats = useQuery(api.sellers.sellerStats);
  const products = useQuery(api.products.getMyProducts);
  const orders = useQuery(api.orders.sellerOrders);
  const payouts = useQuery(api.sellers.myPayouts);
  const categories = useQuery(api.products.getCategories);

  const setProductStatus = useMutation(api.products.setProductStatus);
  const deleteProduct = useMutation(api.products.deleteProduct);
  const updateOrderItemStatus = useMutation(api.orders.updateOrderItemStatus);
  const requestPayout = useMutation(api.sellers.requestPayout);

  const [dialog, setDialog] = useState<{
    open: boolean;
    product: SellerProduct | null;
  }>({ open: false, product: null });
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusyAction(key);
    try {
      await action();
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">
                Velseller
              </p>
              <h1 className="text-2xl font-bold tracking-tight">{seller.storeName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <StatusBadge status={seller.status} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card p-1">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                tab === tabItem.id
                  ? "bg-lime-400/10 text-lime-300"
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
            {!stats ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Available balance", value: formatMoney(stats.availableBalance), icon: Wallet, accent: true },
                    { label: "Revenue (delivered)", value: formatMoney(stats.revenue), icon: CheckCircle2 },
                    { label: "In-flight", value: formatMoney(stats.outstanding), icon: Hourglass },
                    { label: "Orders", value: String(stats.orderCount), icon: ShoppingBag },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-border/70 bg-card p-5"
                    >
                      <stat.icon className={`size-5 ${stat.accent ? "text-lime-300" : "text-muted-foreground"}`} />
                      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-5 lg:flex-row">
                  <div className="flex-1 rounded-2xl border border-border/70 bg-card p-5">
                    <div className="flex items-center justify-between">
                      <h2 className="font-bold tracking-tight">Products</h2>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => setDialog({ open: true, product: null })}
                      >
                        <Plus className="mr-1 size-4" /> New product
                      </Button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {([
                        ["Draft", stats.productCounts.DRAFT],
                        ["Pending", stats.productCounts.PENDING_REVIEW],
                        ["Live", stats.productCounts.ACTIVE],
                        ["Archived", stats.productCounts.ARCHIVED],
                      ] as const).map(([label, count]) => (
                        <div key={label} className="rounded-xl border border-border/60 p-3 text-center">
                          <p className="text-xl font-bold">{count}</p>
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 rounded-2xl border border-border/70 bg-card p-5">
                    <h2 className="font-bold tracking-tight">Commission paid</h2>
                    <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-lime-300">
                      {formatMoney(stats.commission)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      10% flat, computed server-side on every order.
                    </p>
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-lime-500/25 bg-lime-400/5 p-3 text-sm">
                      <Wallet className="size-4 shrink-0 text-lime-300" />
                      <span className="text-muted-foreground">
                        Request a payout of{" "}
                        <span className="font-semibold text-foreground">
                          {formatMoney(stats.availableBalance)}
                        </span>{" "}
                        anytime — VelCenter pays it out.
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Products */}
        {tab === "products" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <Button
                type="button"
                className="cursor-pointer"
                onClick={() => setDialog({ open: true, product: null })}
              >
                <Plus className="mr-1 size-4" /> New product
              </Button>
            </div>
            {!products ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 py-20 text-center">
                <Package className="size-8 text-muted-foreground" />
                <p className="font-semibold">No products yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first listing and send it for review.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border/70">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3">Sold</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="border-b border-border/50 bg-card/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                                {product.images[0] ? (
                                  <img src={product.images[0]} alt={product.name} className="size-full object-cover" />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium">{product.name}</p>
                                <p className="text-xs text-muted-foreground">{product.sku || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 tabular-nums">{formatMoney(product.price)}</td>
                          <td className="px-4 py-3 tabular-nums">{product.stock}</td>
                          <td className="px-4 py-3 tabular-nums">{product.totalSold}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={product.status} />
                            {product.status === "REJECTED" && product.rejectionReason && (
                              <p className="mt-1 max-w-40 text-[10px] leading-tight text-red-400">
                                {product.rejectionReason}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8 cursor-pointer"
                                onClick={() => setDialog({ open: true, product })}
                                aria-label="Edit"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              {product.status !== "ACTIVE" && product.status !== "ARCHIVED" && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-8 cursor-pointer text-lime-300"
                                  disabled={busyAction === `pub-${product.id}`}
                                  onClick={() =>
                                    void run(
                                      `pub-${product.id}`,
                                      () => setProductStatus({ productId: product.id as Id<"products">, action: "publish" }),
                                      "Sent for review",
                                    )
                                  }
                                  aria-label="Publish"
                                >
                                  {busyAction === `pub-${product.id}` ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Rocket className="size-4" />
                                  )}
                                </Button>
                              )}
                              {product.status === "ACTIVE" && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-8 cursor-pointer"
                                  disabled={busyAction === `arc-${product.id}`}
                                  onClick={() =>
                                    void run(
                                      `arc-${product.id}`,
                                      () => setProductStatus({ productId: product.id as Id<"products">, action: "archive" }),
                                      "Product archived",
                                    )
                                  }
                                  aria-label="Archive"
                                >
                                  <Archive className="size-4" />
                                </Button>
                              )}
                              {["DRAFT", "REJECTED", "ARCHIVED"].includes(product.status) && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-8 cursor-pointer text-red-400"
                                  disabled={busyAction === `del-${product.id}`}
                                  onClick={() =>
                                    void run(
                                      `del-${product.id}`,
                                      () => deleteProduct({ productId: product.id as Id<"products"> }),
                                      "Product deleted",
                                    )
                                  }
                                  aria-label="Delete"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Orders */}
        {tab === "orders" && (
          <div className="flex flex-col gap-4">
            {!orders ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 py-20 text-center">
                <ShoppingBag className="size-8 text-muted-foreground" />
                <p className="font-semibold">No orders yet</p>
                <p className="text-sm text-muted-foreground">
                  Orders for your products will appear here in realtime.
                </p>
              </div>
            ) : (
              orders.map(({ item, order }) => (
                <div
                  key={item._id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.image ? (
                        <img src={item.image} alt={item.productName} className="size-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.orderNumber} · {formatDateTime(order.createdAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.customerName} · {item.quantity} × {formatMoney(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    {item.status === "PENDING" && (
                      <Button
                        type="button"
                        size="sm"
                        className="cursor-pointer"
                        disabled={busyAction === `confirm-${item._id}`}
                        onClick={() =>
                          void run(
                            `confirm-${item._id}`,
                            () => updateOrderItemStatus({ orderItemId: item._id, status: "CONFIRMED" }),
                            "Order confirmed",
                          )
                        }
                      >
                        {busyAction === `confirm-${item._id}` ? (
                          <Loader2 className="mr-1 size-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1 size-3.5" />
                        )}
                        Confirm
                      </Button>
                    )}
                    {item.status === "CONFIRMED" && (
                      <Button
                        type="button"
                        size="sm"
                        className="cursor-pointer"
                        disabled={busyAction === `process-${item._id}`}
                        onClick={() =>
                          void run(
                            `process-${item._id}`,
                            () => updateOrderItemStatus({ orderItemId: item._id, status: "PROCESSING" }),
                            "Now processing",
                          )
                        }
                      >
                        Start processing
                      </Button>
                    )}
                    {item.status === "PROCESSING" && (
                      <Button
                        type="button"
                        size="sm"
                        className="cursor-pointer"
                        disabled={busyAction === `ship-${item._id}`}
                        onClick={() =>
                          void run(
                            `ship-${item._id}`,
                            () => updateOrderItemStatus({ orderItemId: item._id, status: "SHIPPED" }),
                            "Marked shipped",
                          )
                        }
                      >
                        Mark shipped
                      </Button>
                    )}
                    {item.status === "SHIPPED" && (
                      <Button
                        type="button"
                        size="sm"
                        className="cursor-pointer"
                        disabled={busyAction === `deliver-${item._id}`}
                        onClick={() =>
                          void run(
                            `deliver-${item._id}`,
                            () => updateOrderItemStatus({ orderItemId: item._id, status: "DELIVERED" }),
                            "Delivered — revenue unlocked",
                          )
                        }
                      >
                        Mark delivered
                      </Button>
                    )}
                    {["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"].includes(item.status) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer text-red-400"
                        disabled={busyAction === `cancel-${item._id}`}
                        onClick={() =>
                          void run(
                            `cancel-${item._id}`,
                            () => updateOrderItemStatus({ orderItemId: item._id, status: "CANCELLED" }),
                            "Item cancelled",
                          )
                        }
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Payouts */}
        {tab === "payouts" && (
          <div className="flex flex-col gap-5">
            {!stats ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-lime-500/25 bg-lime-400/5 p-6 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Available balance
                  </p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-lime-300">
                    {formatMoney(stats.availableBalance)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Paid out: {formatMoney(stats.paidPayouts)} · Requested:{" "}
                    {formatMoney(stats.requestedPayouts)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="cursor-pointer"
                  disabled={stats.availableBalance <= 0 || busyAction === "payout"}
                  onClick={() =>
                    void run("payout", requestPayout, "Payout requested — VelCenter will process it.")
                  }
                >
                  {busyAction === "payout" ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Wallet className="mr-2 size-4" />
                  )}
                  Request payout
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold tracking-tight">Payout history</h2>
              {!payouts ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : payouts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                  No payouts yet. Delivered orders build your balance.
                </p>
              ) : (
                payouts.map((payout) => (
                  <div
                    key={payout._id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoney(payout.net)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(payout.periodEnd)}
                      </p>
                    </div>
                    <StatusBadge status={payout.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Settings */}
        {tab === "settings" && <SettingsTab seller={seller} />}
      </div>

      <ProductDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, product: dialog.product })}
        product={dialog.product
          ? {
              id: dialog.product.id,
              name: dialog.product.name,
              description: dialog.product.description,
              price: dialog.product.price,
              stock: dialog.product.stock,
              sku: dialog.product.sku,
              images: dialog.product.images,
              categoryId: undefined,
            }
          : null}
        categories={categories}
      />
    </div>
  );
}

function SettingsTab({ seller }: { seller: Doc<"sellers"> }) {
  const update = useMutation(api.sellers.updateSellerProfile);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    try {
      await update({
        storeName: String(formData.get("storeName") ?? ""),
        description: String(formData.get("description") ?? "") || undefined,
        contactPerson: String(formData.get("contactPerson") ?? "") || undefined,
        contactPhone: String(formData.get("contactPhone") ?? "") || undefined,
        contactEmail: String(formData.get("contactEmail") ?? "") || undefined,
        storeAddress: String(formData.get("storeAddress") ?? "") || undefined,
        shippingSettings: {
          shipsNationwide: true,
          flatFee: 4500,
          freeShippingThreshold: 100000,
          processingDays: Number(formData.get("processingDays") ?? 1) || 1,
        },
        paymentInfo: {
          method: "bank",
          accountName: String(formData.get("accountName") ?? "") || undefined,
          accountNumber: String(formData.get("accountNumber") ?? "") || undefined,
          bankName: String(formData.get("bankName") ?? "") || undefined,
        },
      });
      toast.success("Store settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-2xl flex-col gap-5 rounded-2xl border border-border/70 bg-card p-6"
    >
      <h2 className="text-lg font-bold tracking-tight">Store settings</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="s-name">Store name</Label>
          <Input id="s-name" name="storeName" defaultValue={seller.storeName} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="s-phone">Contact phone</Label>
          <Input id="s-phone" name="contactPhone" defaultValue={seller.contactPhone} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="s-email">Contact email</Label>
          <Input id="s-email" name="contactEmail" defaultValue={seller.contactEmail} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="s-days">Processing days</Label>
          <Input
            id="s-days"
            name="processingDays"
            type="number"
            min={1}
            max={7}
            defaultValue={seller.shippingSettings?.processingDays ?? 1}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="s-desc">Description</Label>
          <Textarea
            id="s-desc"
            name="description"
            rows={3}
            defaultValue={seller.description}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="s-address">Store / return address</Label>
          <Textarea
            id="s-address"
            name="storeAddress"
            rows={2}
            defaultValue={seller.storeAddress}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="s-acc">Payout account name</Label>
          <Input id="s-acc" name="accountName" defaultValue={seller.paymentInfo?.accountName} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="s-accnum">Account number</Label>
          <Input id="s-accnum" name="accountNumber" defaultValue={seller.paymentInfo?.accountNumber} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="s-bank">Bank</Label>
          <Input id="s-bank" name="bankName" defaultValue={seller.paymentInfo?.bankName} />
        </div>
      </div>
      <Button type="submit" className="w-fit cursor-pointer" disabled={busy}>
        {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
        Save settings
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export default function Seller() {
  const seller = useQuery(api.sellers.mySeller);
  const [tab, setTab] = useState<TabId>("overview");

  if (seller === undefined) {
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
          <a href="/seller" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-base font-black tracking-[0.18em]">VELNOX</span>
            <Badge variant="outline" className="ml-1 border-lime-500/30 bg-lime-500/10 text-[10px] font-bold uppercase tracking-widest text-lime-300">
              Velseller
            </Badge>
          </a>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="cursor-pointer">
              <a href="/dashboard">
                Dashboard <ArrowRight className="ml-1 size-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      {!seller ? (
        <ApplyForm seller={null} />
      ) : seller.status === "APPROVED" ? (
        <SellerDesk seller={seller} tab={tab} setTab={setTab} />
      ) : ["PENDING", "UNDER_REVIEW"].includes(seller.status) ? (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-24 text-center">
          <Hourglass className="size-12 text-amber-300" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Application under review</h1>
          <p className="mt-3 text-muted-foreground">
            <span className="font-semibold text-foreground">{seller.storeName}</span>{" "}
            is {seller.status.toLowerCase()}. Our team reviews every application
            within 48 hours — you'll be notified the moment it's approved.
          </p>
          <StatusBadge status={seller.status} className="mt-5" />
        </div>
      ) : seller.status === "SUSPENDED" || seller.status === "DISABLED" ? (
        <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-24 text-center">
          <XCircle className="size-12 text-red-400" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Store {seller.status.toLowerCase()}</h1>
          <p className="mt-3 text-muted-foreground">
            Your store is currently {seller.status.toLowerCase()}. Contact
            Velnox support if you believe this is a mistake.
          </p>
        </div>
      ) : (
        <ApplyForm seller={seller} onDone={() => setTab("overview")} />
      )}
    </div>
  );
}
