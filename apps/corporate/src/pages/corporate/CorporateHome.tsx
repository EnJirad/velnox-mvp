import { SITE_URLS } from "@velnox/shared/lib/sites";
import { ArrowRight, ArrowUpRight, Check, ShoppingBag, Store } from "lucide-react";

const STEPS = [
  { n: "01", label: "Remember", desc: "ทุกการซื้อคือข้อมูล" },
  { n: "02", label: "Learn", desc: "เข้าใจพฤติกรรมจริง" },
  { n: "03", label: "Understand", desc: "รู้ว่าอะไรสำคัญกับคุณ" },
  { n: "04", label: "Predict", desc: "คาดการณ์รอบถัดไป" },
  { n: "05", label: "Help", desc: "ช่วยเหลือก่อนคุณถาม" },
] as const;

function MemoryCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          VelRepeat · จำแทนคุณ
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
          ใช้งานอยู่
        </span>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xl">
          ☕
        </div>
        <div>
          <p className="font-semibold text-slate-900">กาแฟบด 1 กก. (เมล็ดอาราบิก้า)</p>
          <p className="mt-0.5 text-sm text-slate-500">ร้านบ้านสวนคาเฟ่ · ฿ 380</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">รอบการซื้อที่เรียนรู้ได้</span>
          <span className="font-semibold text-slate-900">ทุก 28 วัน</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-4/5 rounded-full bg-emerald-500" />
        </div>
        <p className="mt-2 text-xs text-slate-400">คำสั่งซื้อถัดไป: 22 ส.ค. 2026 — ระบบจะเตือนคุณก่อน</p>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
        <Check className="size-4" />
        ระบบจำได้แล้ว — คุณไม่ต้องคิด
      </div>
    </div>
  );
}

export function CorporateHome() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Velnox Group · แพลตฟอร์มคอมเมิร์ซ
            </p>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-6xl">
              Commerce that{" "}
              <span className="text-emerald-600">remembers</span> you.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Velnox — <span className="font-semibold text-slate-900">จำแทนคุณ</span>.
              ทุกสิ่งที่คุณซื้อ ระบบจำ เข้าใจ และช่วยให้ครั้งหน้าดียิ่งขึ้น
              — ตั้งแต่การสั่งซื้อครั้งเดียว ไปจนถึงการสั่งซื้อซ้ำแบบอัตโนมัติ
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={SITE_URLS.velshop}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                เริ่มช้อปปิ้งที่ VelShop
                <ArrowRight className="size-4" />
              </a>
              <a
                href={SITE_URLS.velseller}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                สมัครเปิดร้านค้า
                <Store className="size-4" />
              </a>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              ไม่ต้องสมัครก็ดูสินค้าได้ · สมัครใช้รหัส OTP ทางอีเมล ไม่ต้องจำรหัสผ่าน
            </p>
          </div>
          <MemoryCard />
        </div>
      </section>

      {/* Value chain */}
      <section className="bg-slate-900 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
            Customer Memory
          </p>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-4xl">
            ทุกการโต้ตอบคือความรู้ — และความรู้ทุกชิ้นช่วยคนคนเดิม
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-emerald-400/40 hover:bg-white/10"
              >
                <p className="text-sm font-bold text-emerald-400">{step.n}</p>
                <p className="mt-3 text-base font-semibold text-white">{step.label}</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two purchase modes */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
            สองโหมดการซื้อ
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            ซื้อครั้งเดียวก็ได้ สั่งซ้ำอัตโนมัติก็ดี
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            เราไม่เคยบังคับให้ใครใช้ VelRepeat — แต่เมื่อคุณพร้อม ระบบจะจำแทนคุณ
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="inline-flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <ShoppingBag className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Buy Once — ซื้อครั้งเดียว</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              ประสบการณ์มาร์เก็ตเพลสครบรูปแบบ: ค้นหา → ดูสินค้า → ตะกร้า → ชำระเงิน
              → รับออเดอร์ รวดเร็วและสมบูรณ์แบบในตัวมันเอง
            </p>
          </div>
          <div className="relative rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-7 shadow-sm">
            <span className="absolute right-5 top-5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white">
              เป้าหมายหลัก
            </span>
            <div className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Check className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">VelRepeat — สั่งซื้อซ้ำอัตโนมัติ</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              สินค้าที่ซื้อเป็นประจำจะถูกจำไว้ ระบบเรียนรู้รอบการซื้อของคุณ และช่วยสั่งซื้อซ้ำ
              ตามรอบที่กำหนด — เปิดหรือปิดได้ทุกเมื่อ
            </p>
          </div>
        </div>
      </section>

      {/* Ecosystem preview */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
                ระบบนิเวศ
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                หนึ่งแพลตฟอร์ม ครบทุกบทบาท
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                จากลูกค้าที่กำลังช้อปปิ้ง ไปจนถึงเจ้าของร้านและทีมงานบริษัท
                — ทุกคนทำงานบนแบ็กเอนด์และฐานข้อมูลเดียวกัน
              </p>
              <a
                href="/ecosystem"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              >
                ดูระบบนิเวศทั้งหมด
                <ArrowRight className="size-4" />
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
              {[
                {
                  title: "VelShop",
                  desc: "หน้าร้านค้าสำหรับลูกค้า — ค้นหา สั่งซื้อ และสั่งซ้ำอัตโนมัติ",
                  href: SITE_URLS.velshop,
                },
                {
                  title: "VelSeller",
                  desc: "เครื่องมือเจ้าของร้าน — สินค้า ออเดอร์ รายได้ ค่าธรรมเนียม",
                  href: SITE_URLS.velseller,
                },
                {
                  title: "VelCenter",
                  desc: "ศูนย์กลางธุรกิจภายใน — KPI ออเดอร์ และผู้ใช้ (เฉพาะทีมงาน)",
                  href: SITE_URLS.velcenter,
                },
                {
                  title: "Velnox Group",
                  desc: "เว็บไซต์องค์กร — วิสัยทัศน์ ธุรกิจ เทคโนโลยี และข่าวสาร",
                  href: "/about",
                },
              ].map((app) => (
                <a
                  key={app.title}
                  href={app.href}
                  target={app.href.startsWith("http") ? "_blank" : undefined}
                  rel={app.href.startsWith("http") ? "noreferrer" : undefined}
                  className="group rounded-2xl border border-slate-200 bg-background p-6 transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900">{app.title}</h3>
                    <ArrowUpRight className="size-4 text-slate-300 transition-colors group-hover:text-emerald-500" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{app.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="rounded-3xl bg-slate-900 px-6 py-14 text-center sm:px-12">
          <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-4xl">
            พร้อมให้ Velnox จำแทนคุณหรือยัง?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-400">
            เริ่มต้นจากการช้อปปิ้งครั้งแรกของคุณ — ระบบจะค่อย ๆ เรียนรู้และช่วยเหลือคุณมากขึ้นทุกครั้ง
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href={SITE_URLS.velshop}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              เริ่มช้อปปิ้ง
              <ArrowRight className="size-4" />
            </a>
            <a
              href={SITE_URLS.velseller}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              เปิดร้านค้าของคุณ
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
