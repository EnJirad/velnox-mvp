import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CreditCard,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

const FEATURES = [
  {
    icon: Sparkles,
    title: "สินค้าคัดสรร",
    description:
      "ทุกชิ้นผ่านการคัดเลือกอย่างพิถีพิถัน เน้นคุณภาพ ดีไซน์มินิมอล และราคาที่คุ้มค่า",
  },
  {
    icon: Truck,
    title: "จัดส่งรวดเร็ว",
    description:
      "จัดส่งทั่วไทย เก็บเงินปลายทางได้ ออเดอร์ก่อนเที่ยงส่งได้ในวันเดียวกัน",
  },
  {
    icon: CreditCard,
    title: "ชำระเงินปลอดภัย",
    description:
      "รองรับทุกช่องทาง ทั้งบัตรเครดิต โอนผ่านธนาคาร และพร้อมเพย์ ปลอดภัย 100%",
  },
  {
    icon: RefreshCcw,
    title: "เปลี่ยนคืนง่าย",
    description:
      "ไม่ถูกใจ เปลี่ยนคืนได้ภายใน 7 วัน ไม่ต้องถามคำถาม ยินดีคืนเงินเต็มจำนวน",
  },
];

const FEATURED = [
  {
    emoji: "🎧",
    name: "หูฟังไร้สาย Soundly Air",
    price: "2,490",
    category: "อิเล็กทรอนิกส์",
    tile: "from-violet-100/80 to-purple-50",
  },
  {
    emoji: "👜",
    name: "กระเป๋าโท้ทผ้าแคนวาส",
    price: "490",
    category: "กระเป๋า",
    tile: "from-stone-100 to-stone-200/80",
  },
  {
    emoji: "⌚",
    name: "นาฬิกาข้อมือ Minimal Steel",
    price: "1,290",
    category: "เครื่องประดับ",
    tile: "from-sky-100/80 to-cyan-50",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ============ NAV ============ */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShoppingBag className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">VelShop</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-muted-foreground">
              <Link to="/auth">เข้าสู่ระบบ</Link>
            </Button>
            <Button asChild className="gap-1.5">
              <Link to="/auth?returnTo=%2Fdashboard">
                เริ่มช้อปปิ้ง
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-0 size-96 rounded-full bg-brand/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-secondary blur-3xl"
        />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative"
          >
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="size-3 text-brand" />
              VelShop · Lifestyle Store
            </Badge>
            <h1 className="mt-5 text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              ช้อปปิ้งที่{" "}
              <span className="text-brand">เรียบง่าย</span>
              <br />
              สวยงาม และคุ้มค่า
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
              VelShop รวมของใช้และไลฟ์สไตล์คุณภาพดี ดีไซน์มินิมอล
              คัดสรรมาอย่างตั้งใจ เพื่อชีวิตที่เรียบง่ายแต่เต็มไปด้วยคุณภาพ
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2 rounded-full px-7">
                <Link to="/auth?returnTo=%2Fdashboard">
                  เริ่มช้อปปิ้ง
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                <Link to="/auth">ดูสินค้า</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Truck className="size-4 text-brand" /> จัดส่งทั่วไทย
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-brand" /> เปลี่ยนคืน 7 วัน
              </span>
            </div>
          </motion.div>

          {/* Hero visual: layered product tiles */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            className="relative hidden md:block"
          >
            <div className="relative mx-auto aspect-square w-full max-w-md">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-0 top-6 w-56 rotate-[-6deg] rounded-2xl border bg-card p-3 shadow-lg"
              >
                <div className="flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-violet-100/80 to-purple-50">
                  <span className="text-6xl">🎧</span>
                </div>
                <p className="mt-3 text-sm font-semibold">หูฟังไร้สาย Soundly Air</p>
                <p className="text-sm font-bold text-brand">฿2,490</p>
              </motion.div>

              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                className="absolute right-0 top-0 w-52 rotate-[7deg] rounded-2xl border bg-card p-3 shadow-lg"
              >
                <div className="flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-stone-100 to-stone-200/80">
                  <span className="text-6xl">👜</span>
                </div>
                <p className="mt-3 text-sm font-semibold">กระเป๋าโท้ทผ้าแคนวาส</p>
                <p className="text-sm font-bold text-brand">฿490</p>
              </motion.div>

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-0 left-1/2 w-48 -translate-x-1/2 rotate-[-2deg] rounded-2xl border bg-card p-3 shadow-lg"
              >
                <div className="flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-sky-100/80 to-cyan-50">
                  <span className="text-6xl">⌚</span>
                </div>
                <p className="mt-3 text-sm font-semibold">นาฬิกา Minimal Steel</p>
                <p className="text-sm font-bold text-brand">฿1,290</p>
              </motion.div>

              <div className="absolute -bottom-4 right-4 rounded-full border bg-card px-4 py-2 text-xs font-medium shadow-sm">
                ★ 4.9 · รีวิว 2,300+ รายการ
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ TRUST STRIP ============ */}
      <section className="border-y bg-card/60">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-4 py-8 text-center sm:grid-cols-4 sm:px-6">
          {[
            ["1,000+", "สินค้าคัดสรร"],
            ["48 ชม.", "จัดส่งไวทั่วไทย"],
            ["7 วัน", "เปลี่ยนคืนง่าย"],
            ["100%", "ชำระเงินปลอดภัย"],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <motion.div {...fadeUp} className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            ทำไมต้อง <span className="text-brand">VelShop</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            เราทำให้การช้อปปิ้งออนไลน์เป็นเรื่องง่าย สบายตา และไว้ใจได้
          </p>
        </motion.div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              {...fadeUp}
              transition={{ duration: 0.55, ease: "easeOut", delay: index * 0.08 }}
              className="group rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/5 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <feature.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============ FEATURED PRODUCTS ============ */}
      <section className="border-y bg-card/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <motion.div {...fadeUp} className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">สินค้ามาใหม่</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                เปิดตัวทุกสัปดาห์ คัดมาแล้วว่าดีจริง
              </p>
            </div>
            <Button asChild variant="outline" className="gap-1.5 rounded-full">
              <Link to="/auth?returnTo=%2Fdashboard">
                ดูสินค้าทั้งหมด
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </motion.div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {FEATURED.map((item, index) => (
              <motion.article
                key={item.name}
                {...fadeUp}
                transition={{ duration: 0.55, ease: "easeOut", delay: index * 0.08 }}
                className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className={cn(
                    "flex aspect-[4/3] items-center justify-center bg-gradient-to-br",
                    item.tile,
                  )}
                >
                  <span
                    aria-hidden
                    className="text-7xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
                  >
                    {item.emoji}
                  </span>
                </div>
                <div className="p-5">
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {item.category}
                  </Badge>
                  <h3 className="mt-2.5 text-base font-semibold">{item.name}</h3>
                  <p className="mt-1 text-lg font-bold tracking-tight text-brand">
                    ฿{item.price}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <motion.div
          {...fadeUp}
          className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12 sm:py-16"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-white/5 blur-3xl"
          />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            พร้อมเริ่มช้อปปิ้งแล้วหรือยัง?
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm text-primary-foreground/70 sm:text-base">
            สมัครสมาชิกฟรี รับสิทธิพิเศษ ข่าวสารโปรโมชัน และการจัดการคำสั่งซื้อในที่เดียว
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="relative mt-8 gap-2 rounded-full px-8"
          >
            <Link to="/auth?returnTo=%2Fdashboard">
              สร้างบัญชีฟรี
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p className="font-semibold text-foreground">VelShop</p>
          <p className="text-xs">
            © {new Date().getFullYear()} VelShop — ช้อปปิ้งออนไลน์ที่เรียบง่ายและสวยงาม
          </p>
        </div>
      </footer>
    </div>
  );
}
