import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/Logo";
import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChevronRight,
  Globe,
  Repeat,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Store,
  Waypoints,
  Zap,
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const ensureSeedData = useMutation(api.seed.ensureSeedData);
  const products = useQuery(api.products.getPublicProducts, {});
  const categories = useQuery(api.products.getCategories);

  useEffect(() => {
    void ensureSeedData();
  }, [ensureSeedData]);

  const preview = products?.slice(0, 4) ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo to="/" />
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#platform" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Platform
            </a>
            <Link to="/shop" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Marketplace
            </Link>
            <Link to="/seller" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Sell
            </Link>
            <a href="#footer" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Company
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {!isLoading && isAuthenticated ? (
              <Button asChild variant="outline" className="cursor-pointer">
                <Link to="/dashboard">
                  Dashboard <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" className="cursor-pointer">
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
            <Button asChild className="cursor-pointer">
              <Link to="/shop">
                <ShoppingBag className="size-4" /> Shop now
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="velnox-grid relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-lime-400/10 blur-[120px]" />
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 pb-20 pt-24 text-center sm:px-6 sm:pt-32"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-500/30 bg-lime-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-lime-300">
              <Zap className="size-3.5" /> The Velnox Commerce Network
            </span>
          </motion.div>
          <motion.h1
            variants={fadeUp}
            className="mt-7 max-w-4xl text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl md:text-7xl"
          >
            Commerce at the{" "}
            <span className="bg-gradient-to-r from-lime-300 via-lime-400 to-emerald-300 bg-clip-text text-transparent">
              speed of light
            </span>
            .
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Velnox is the operating system for fast commerce — a marketplace,
            seller tools, and a command center in one network. Built for
            Thailand, Myanmar and beyond.
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="w-full cursor-pointer sm:w-auto">
              <Link to="/shop">
                <ShoppingBag className="size-4" /> Start shopping
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full cursor-pointer sm:w-auto"
            >
              <Link to="/seller">
                <Store className="size-4" /> Sell with Velnox
              </Link>
            </Button>
          </motion.div>
          <motion.div
            variants={fadeUp}
            className="mt-14 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/40 sm:grid-cols-4"
          >
            {[
              ["4", "independent apps"],
              ["10%", "flat commission"],
              ["฿1,000", "free-ship threshold"],
              ["24/7", "realtime operations"],
            ].map(([value, label]) => (
              <div key={label} className="bg-card px-4 py-5">
                <p className="text-2xl font-bold tracking-tight text-lime-300">
                  {value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-y border-border/60 bg-lime-400 py-3">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, copy) => (
            <div key={copy} className="flex shrink-0 gap-10">
              {[
                "VELSHOP",
                "VELSELLER",
                "VELCENTER",
                "VELNOX.COM",
                "VELREPEAT",
                "REALTIME COMMERCE",
              ].map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-10 text-sm font-black tracking-[0.25em] text-black"
                >
                  {item} <Zap className="size-4" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Platform */}
      <section id="platform" className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="flex flex-col items-center text-center"
        >
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">
            One network · four products
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl"
          >
            Every surface of commerce, one stack.
          </motion.h2>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            {
              icon: ShoppingBag,
              name: "Velshop",
              blurb: "A lightning-fast marketplace for customers — browse, cart and check out in seconds.",
              href: "/shop",
              cta: "Open the shop",
            },
            {
              icon: Store,
              name: "Velseller",
              blurb: "Your store OS: list products, manage inventory and fulfill orders from one desk.",
              href: "/seller",
              cta: "Start selling",
            },
            {
              icon: Waypoints,
              name: "Velcenter",
              blurb: "The private command center — reviews, sellers, payouts and platform KPIs in realtime.",
              href: "/center",
              cta: "Enter center",
            },
            {
              icon: Globe,
              name: "velnox.com",
              blurb: "The public home of the company — brand, trust and everything in between.",
              href: "/",
              cta: "You are here",
            },
          ].map((product) => (
            <motion.div key={product.name} variants={fadeUp}>
              <Link
                to={product.href}
                className="group flex h-full flex-col rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:border-lime-500/40"
              >
                <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-lime-400/10 text-lime-300">
                  <product.icon className="size-5" />
                </div>
                <p className="text-lg font-bold tracking-tight">{product.name}</p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {product.blurb}
                </p>
                <p className="mt-5 flex items-center gap-1 text-sm font-semibold text-lime-300">
                  {product.cta}
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Marketplace preview */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">
                Live on Velshop
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                What's moving right now
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(categories ?? []).slice(0, 5).map((category) => (
                <Link
                  key={category.id}
                  to={`/shop?category=${category.id}`}
                  className="rounded-full border border-border/70 bg-background px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-500/40 hover:text-foreground"
                >
                  {category.name.en}
                </Link>
              ))}
            </div>
          </motion.div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {preview.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
                image={product.images[0]}
                sellerName={product.sellerName}
                stock={product.stock}
                reserved={product.reserved}
                totalSold={product.totalSold}
              />
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Button asChild variant="outline" className="cursor-pointer">
              <Link to="/shop">
                Browse the full marketplace <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Sell with Velnox */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid items-center gap-12 lg:grid-cols-2"
        >
          <div>
            <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">
              For sellers
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl"
            >
              From first listing to first payout, fast.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-5 max-w-lg leading-relaxed text-muted-foreground"
            >
              Apply in minutes. Every application is reviewed by a real team,
              every product goes through quality review, and every payout is
              computed on the server — 10% commission, nothing hidden.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-4">
              {[
                { icon: Rocket, title: "Apply in minutes", body: "Tell us about your store; our team reviews it in under 48 hours." },
                { icon: ShoppingBag, title: "List & ship", body: "Create products, manage stock, and fulfill orders from your seller desk." },
                { icon: ShieldCheck, title: "Get paid", body: "Delivered orders earn net revenue you can withdraw as payouts anytime." },
              ].map((step) => (
                <div key={step.title} className="flex gap-4">
                  <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/30 bg-lime-500/10 text-lime-300">
                    <step.icon className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </div>
              ))}
            </motion.div>
            <motion.div variants={fadeUp} className="mt-9">
              <Button asChild size="lg" className="cursor-pointer">
                <Link to="/seller">
                  <Store className="size-4" /> Apply to sell
                </Link>
              </Button>
            </motion.div>
          </div>

          <motion.div
            variants={fadeUp}
            className="rounded-3xl border border-border/70 bg-card p-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LogoMark />
                <div>
                  <p className="font-bold">Velseller desk</p>
                  <p className="text-xs text-muted-foreground">Nova Supply Co.</p>
                </div>
              </div>
              <span className="rounded-full border border-lime-500/30 bg-lime-500/10 px-3 py-1 text-xs font-semibold text-lime-300">
                Approved
              </span>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                ["฿48,200", "Available"],
                ["124", "Orders"],
                ["38", "Live items"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-xl border border-border/60 bg-background p-4"
                >
                  <p className="text-lg font-bold tracking-tight text-lime-300">
                    {value}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              {[
                ["Order VL-K8X2M1", "Delivered · +฿1,080", "bg-lime-400"],
                ["Order VL-M4P7QA", "Shipped · +฿2,340", "bg-indigo-400"],
                ["Order VL-T9Z3BC", "Confirmed · +฿540", "bg-sky-400"],
              ].map(([order, detail, dot]) => (
                <div
                  key={order}
                  className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className={`size-2 rounded-full ${dot}`} />
                    <div>
                      <p className="text-sm font-medium">{order}</p>
                      <p className="text-xs text-muted-foreground">{detail}</p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* VelRepeat */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="flex size-14 items-center justify-center rounded-2xl bg-lime-400/10 text-lime-300"
          >
            <Repeat className="size-7" />
          </motion.div>
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-6 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl"
          >
            VelRepeat. The essentials that refill themselves.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-5 max-w-xl text-muted-foreground"
          >
            Schedule recurring orders for the things you never want to run out
            of — coffee, skincare, home goods — with full control to pause or
            cancel anytime.
          </motion.p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl border border-lime-500/25 bg-gradient-to-br from-lime-400/15 via-card to-card px-6 py-16 text-center sm:px-12"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-lime-400/15 blur-3xl" />
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
            Ready to move at the speed of light?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join the marketplace or open your store — both take less than five
            minutes.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full cursor-pointer sm:w-auto">
              <Link to="/shop">
                <ShoppingBag className="size-4" /> Shop the marketplace
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full cursor-pointer sm:w-auto"
            >
              <Link to="/seller">
                <Store className="size-4" /> Become a seller
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer id="footer" className="border-t border-border/60">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo to="/" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The commerce network for Southeast Asia. One account, four apps,
              realtime everything.
            </p>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Products
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/shop" className="text-muted-foreground transition-colors hover:text-foreground">Velshop</Link></li>
              <li><Link to="/seller" className="text-muted-foreground transition-colors hover:text-foreground">Velseller</Link></li>
              <li><Link to="/center" className="text-muted-foreground transition-colors hover:text-foreground">Velcenter</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Account
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/auth" className="text-muted-foreground transition-colors hover:text-foreground">Sign in</Link></li>
              <li><Link to="/dashboard" className="text-muted-foreground transition-colors hover:text-foreground">Dashboard</Link></li>
              <li><Link to="/shop/orders" className="text-muted-foreground transition-colors hover:text-foreground">My orders</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <p>© {new Date().getFullYear()} Velnox. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              Built for speed <Zap className="size-3 text-lime-300" />
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
