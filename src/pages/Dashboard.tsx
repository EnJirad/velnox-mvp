import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingBag,
  Store,
  Waypoints,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMoney } from "@/lib/format";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const seller = useQuery(api.sellers.mySeller);
  const employee = useQuery(api.center.isEmployee);
  const orders = useQuery(api.orders.myOrders);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const recentOrders = orders?.slice(0, 3) ?? [];
  const isSeller = seller?.status === "APPROVED";

  const cards = [
    {
      icon: ShoppingBag,
      title: "Velshop",
      blurb: "Browse the marketplace, track orders, reorder essentials.",
      cta: "Open shop",
      href: "/shop",
      accent: true,
    },
    {
      icon: Store,
      title: "Velseller",
      blurb: isSeller
        ? `${seller?.storeName} — products, orders and payouts.`
        : seller
          ? `Application ${seller.status.toLowerCase()} — we'll review it shortly.`
          : "Apply to open your store on Velnox.",
      cta: isSeller ? "Seller desk" : seller ? "View status" : "Apply now",
      href: "/seller",
      accent: false,
    },
    {
      icon: Waypoints,
      title: "Velcenter",
      blurb: employee
        ? "Company command center — reviews, payouts, platform KPIs."
        : "Private employee workspace. Access is restricted.",
      cta: employee ? "Enter center" : "Restricted",
      href: "/center",
      accent: false,
      disabled: !employee,
    },
  ];

  const navItems = [
    { icon: LayoutDashboard, label: "Home", href: "/dashboard", active: true },
    { icon: ShoppingBag, label: "Velshop", href: "/shop" },
    { icon: Store, label: "Velseller", href: "/seller" },
    { icon: Waypoints, label: "Velcenter", href: "/center" },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-card/40 p-4 md:flex">
        <Link to="/" className="flex items-center gap-2.5 px-2 py-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShoppingBag className="size-4" />
          </span>
          <span className="text-base font-black tracking-[0.18em]">VELNOX</span>
        </Link>
        <nav className="mt-6 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                item.active
                  ? "bg-lime-400/10 text-lime-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="size-4" /> {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <Button
            type="button"
            variant="ghost"
            className="w-full cursor-pointer justify-start gap-3 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto w-full max-w-4xl">
          <p className="text-sm font-medium text-muted-foreground">
            {user?.email}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Welcome{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One account for the whole Velnox network.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {cards.map((card) => (
              <Link
                key={card.title}
                to={card.href}
                aria-disabled={card.disabled}
                className={`flex flex-col rounded-2xl border p-5 transition-colors ${
                  card.disabled
                    ? "pointer-events-none border-border/50 opacity-50"
                    : card.accent
                      ? "border-lime-500/30 bg-lime-400/5 hover:border-lime-500/60"
                      : "border-border/70 bg-card hover:border-lime-500/40"
                }`}
              >
                <div
                  className={`flex size-10 items-center justify-center rounded-xl ${
                    card.accent ? "bg-lime-400/15 text-lime-300" : "bg-muted text-foreground"
                  }`}
                >
                  <card.icon className="size-5" />
                </div>
                <p className="mt-4 font-bold tracking-tight">{card.title}</p>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {card.blurb}
                </p>
                <p className="mt-4 flex items-center gap-1 text-sm font-semibold text-lime-300">
                  {card.cta} <ArrowRight className="size-4" />
                </p>
              </Link>
            ))}
          </div>

          {seller && seller.status !== "APPROVED" && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
              <Store className="size-5 text-amber-300" />
              <p className="flex-1 text-sm">
                Your seller application is{" "}
                <StatusBadge status={seller.status} className="mx-1 align-middle" />.
              </p>
              <Button asChild size="sm" variant="outline" className="cursor-pointer">
                <Link to="/seller">Details</Link>
              </Button>
            </div>
          )}

          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Recent orders</h2>
              <Link
                to="/shop/orders"
                className="text-sm font-semibold text-lime-300 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {orders === undefined ? (
                <p className="py-6 text-sm text-muted-foreground">Loading…</p>
              ) : recentOrders.length === 0 ? (
                <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border/70 p-6">
                  <Package className="size-6 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">No orders yet</p>
                    <p className="text-xs text-muted-foreground">
                      Find something you love on Velshop.
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="cursor-pointer">
                    <Link to="/shop">Shop now</Link>
                  </Button>
                </div>
              ) : (
                recentOrders.map(({ order }) => (
                  <Link
                    key={order._id}
                    to="/shop/orders"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4 transition-colors hover:border-lime-500/40"
                  >
                    <div>
                      <p className="text-sm font-bold">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(order.total)}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
