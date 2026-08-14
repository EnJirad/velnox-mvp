import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "react-router";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const floatChip = {
  animate: { y: [0, -8, 0] },
  transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const },
};

function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Velnox">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#how"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            วิธีทำงาน
          </a>
          <a
            href="#vision"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            วิสัยทัศน์
          </a>
          <a
            href="#cta"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            เริ่มใช้งาน
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="text-slate-700" asChild>
            <Link to="/auth?returnTo=/dashboard">เข้าสู่ระบบ</Link>
          </Button>
          <Button className="hidden bg-slate-900 text-white hover:bg-slate-800 sm:inline-flex" asChild>
            <Link to="/auth?returnTo=/dashboard">
              เริ่มใช้งานฟรี
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      {/* Mock dashboard canvas */}
      <div
        className="relative rounded-[20px] border border-slate-200 bg-slate-100 p-5 sm:p-6"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      >
        {/* Main goal card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                <TrendingUp className="size-4 text-emerald-600" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">ยอดขายเดือนนี้</p>
                <p className="text-xs text-slate-400">เป้าหมาย · รายเดือน</p>
              </div>
            </div>
            <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-medium text-emerald-700">
              69%
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <p className="text-3xl font-bold tracking-tight text-slate-900">฿412,800</p>
            <p className="text-sm text-slate-400">/ ฿600,000</p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[69%] rounded-full bg-[#10B981]" />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
            <span>อัปเดตล่าสุดวันนี้ 09:12 น.</span>
            <span className="font-medium text-emerald-600">ตามแผน</span>
          </div>
        </div>

        {/* Floating: smart reminder (vision) */}
        <motion.div
          {...floatChip}
          className="absolute -right-3 -top-6 w-56 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.10)] sm:-right-6"
        >
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Sparkles className="size-3.5 text-[#10B981]" />
            Velnox จำแทนคุณ
          </p>
          <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">
            ยาสีฟันน่าจะใกล้หมด
          </p>
          <p className="mt-1 text-xs text-slate-500">รอบการซื้อของคุณเฉลี่ย 40 วัน</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">เหลืออีก 5 วัน</span>
            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
              ซื้ออีกครั้ง
            </span>
          </div>
        </motion.div>

        {/* Floating: goals achieved chip */}
        <motion.div
          {...floatChip}
          transition={{ ...floatChip.transition, delay: 0.8 }}
          className="absolute -bottom-5 -left-3 flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.10)] sm:-left-6"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-[#ECFDF5]">
            <CheckCircle2 className="size-4 text-[#10B981]" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-4 text-slate-900">3/4 เป้าหมาย</p>
            <p className="text-xs text-slate-400">สำเร็จแล้วในเดือนนี้</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="border-b border-slate-100 bg-white">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            <span className="size-1.5 rounded-full bg-[#10B981]" />
            VELNOX · Commerce that remembers you · จำแทนคุณ
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Commerce that{" "}
            <span className="text-[#10B981]">remembers</span>{" "}
            you.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-500 sm:text-lg">
            เครื่องมือสำหรับเจ้าของธุรกิจ ตั้งเป้ายอดขาย ออเดอร์ และลูกค้าใหม่
            พร้อม Smart Reorder ที่จำรอบการสั่งซื้อของคุณ และเตือนเมื่อถึงเวลา
            ให้ Velnox จำแทนคุณ ไม่ต้องคิดเอง
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
              asChild
            >
              <Link to="/auth?returnTo=/dashboard">
                เริ่มต้นใช้งานฟรี
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-slate-200 text-slate-700" asChild>
              <a href="#how">ดูวิธีทำงาน</a>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Check className="size-4 text-[#10B981]" /> ไม่ต้องใช้บัตรเครดิต
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-4 text-[#10B981]" /> ตั้งเป้าได้ไม่จำกัด
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-4 text-[#10B981]" /> ฟรีในเวอร์ชันแรก
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="relative pt-8 lg:pt-0"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Target,
      step: "01",
      title: "ตั้งเป้าหมาย",
      body: "กำหนดเป้าหมายธุรกิจของคุณ เช่น ยอดขายเดือนนี้ 600,000 บาท หรือลูกค้าใหม่ 50 คน — ในไม่กี่คลิก",
    },
    {
      icon: TrendingUp,
      step: "02",
      title: "อัปเดตความคืบหน้า",
      body: "มีตัวเลขใหม่เมื่อไหร่ บันทึกได้ทันที ระบบคำนวณเปอร์เซ็นต์ความสำเร็จและสถานะให้อัตโนมัติ",
    },
    {
      icon: Brain,
      step: "03",
      title: "Velnox จำแทนคุณ",
      body: "ระบบจดจำรอบและกำหนดเวลา เตือนคุณเมื่อเป้าหมายเสี่ยง หรือสินค้าถึงรอบที่ต้องซื้อซ้ำ",
    },
  ];

  return (
    <section id="how" className="bg-[#F8FAFC]">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#10B981]">
            วิธีทำงาน
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            เริ่มต้นง่ายใน 3 ขั้นตอน
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-500">
            เราไม่ได้สร้างแค่เว็บไซต์ขายของ — เรากำลังสร้าง Commerce ที่เข้าใจคุณ
            เริ่มจากแดชบอร์ดเป้าหมายที่ทำงานแทนความจำของคุณ
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.1 }}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[#ECFDF5]">
                  <step.icon className="size-5 text-[#10B981]" />
                </span>
                <span className="text-sm font-bold tabular-nums text-slate-200">
                  {step.step}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Vision() {
  const stages = [
    {
      key: "Remember",
      th: "จำ",
      body: "ระบบจำทุกสิ่งที่คุณทำ — เป้าหมาย ตัวเลข และพฤติกรรม",
    },
    {
      key: "Learn",
      th: "เรียนรู้",
      body: "เข้าใจรอบและรูปแบบของธุรกิจคุณมากขึ้นเรื่อย ๆ",
    },
    {
      key: "Predict",
      th: "คาดการณ์",
      body: "บอกได้ว่าอะไรกำลังจะถึงกำหนด ก่อนที่คุณจะลืม",
    },
    {
      key: "Act",
      th: "ช่วยดำเนินการ",
      body: "กดเดียวก็ทำต่อได้ — ไม่ต้องเริ่มจากศูนย์ทุกครั้ง",
    },
  ];

  return (
    <section id="vision" className="bg-slate-900">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <motion.div {...fadeUp}>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#10B981]">
            Velnox Vision · Roadmap
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            เรากำลังสร้าง Commerce ที่เข้าใจคุณ
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-slate-400">
            หลักการสำคัญของเรา: Remember → Learn → Predict → Act
            ระบบที่จำแทนคุณ ไม่ใช่แค่ระบบที่ขายของให้คุณ
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {stages.map((stage) => (
              <div
                key={stage.key}
                className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-[#10B981]/40"
              >
                <p className="text-sm font-bold text-white">
                  {stage.key}{" "}
                  <span className="ml-1 font-medium text-[#10B981]">{stage.th}</span>
                </p>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">{stage.body}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div {...fadeUp} className="flex items-center">
          <div className="w-full rounded-2xl border border-white/10 bg-[#0F172A] p-6 shadow-[0_30px_70px_rgba(0,0,0,0.4)]">
            <p className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Sparkles className="size-4 text-[#10B981]" />
              Velnox Intelligence · เร็ว ๆ นี้
            </p>
            <p className="mt-4 text-lg font-semibold leading-7 text-white">
              สวัสดี 👋 มี 3 อย่างที่คุณอาจต้องซื้อเร็ว ๆ นี้
            </p>
            <div className="mt-5 space-y-3">
              {[
                { icon: ShoppingBag, name: "ยาสีฟัน", detail: "รอบการซื้อ 40 วัน · เหลืออีก 5 วัน" },
                { icon: Target, name: "กาแฟ", detail: "รอบการซื้อ 21 วัน · เหลืออีก 8 วัน" },
                { icon: Users, name: "แชมพู", detail: "รอบการซื้อ 60 วัน · เหลืออีก 12 วัน" },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="size-4 text-[#10B981]" />
                    <div>
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.detail}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white">
                    ซื้อทั้งหมด
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              มีให้ใช้งานแล้ววันนี้: แดชบอร์ดเป้าหมาย + Smart Reorder —
              ข้อมูลที่คุณป้อนตั้งแต่วันนี้คือรากฐานของ Velnox Intelligence ในอนาคต
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section id="cta" className="border-b border-slate-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24">
        <motion.div {...fadeUp} className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            พร้อมให้ Velnox{" "}
            <span className="text-[#10B981]">จำแทนคุณ</span> หรือยัง?
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-500">
            ตั้งเป้าหมายแรกของคุณในไม่กี่คลิก แล้วเริ่มต้นเดือนนี้ด้วยทิศทางที่ชัดเจน
          </p>
        </motion.div>
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <Button
            size="lg"
            className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
            asChild
          >
            <Link to="/auth?returnTo=/dashboard">
              สร้างบัญชีฟรี
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="border-slate-200 text-slate-700" asChild>
            <Link to="/auth?returnTo=/dashboard">เข้าสู่ระบบ</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div className="max-w-xs">
            <Logo dark />
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Commerce that remembers you.
              <br />
              จำแทนคุณ
            </p>
          </div>
          <div className="grid grid-cols-2 gap-12 text-sm">
            <div>
              <p className="font-semibold text-white">ผลิตภัณฑ์</p>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link to="/dashboard" className="text-slate-400 transition-colors hover:text-white">
                    แดชบอร์ดเป้าหมาย
                  </Link>
                </li>
                <li>
                  <Link to="/reorder" className="text-slate-400 transition-colors hover:text-white">
                    Smart Reorder
                  </Link>
                </li>
                <li>
                  <Link to="/auth?returnTo=/dashboard" className="text-slate-400 transition-colors hover:text-white">
                    เริ่มใช้งาน
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white">บัญชี</p>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link to="/auth?returnTo=/dashboard" className="text-slate-400 transition-colors hover:text-white">
                    เข้าสู่ระบบ
                  </Link>
                </li>
                <li>
                  <Link to="/auth?returnTo=/dashboard" className="text-slate-400 transition-colors hover:text-white">
                    สมัครสมาชิก
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>© 2026 Velnox. สงวนลิขสิทธิ์.</p>
          <p>Commerce that remembers you · จำแทนคุณ</p>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      <NavBar />
      <Hero />
      <HowItWorks />
      <Vision />
      <CtaSection />
      <Footer />
    </div>
  );
}
