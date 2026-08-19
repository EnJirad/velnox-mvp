import { SITE_URLS } from "@velnox/shared/lib/sites";
import { ArrowUpRight, Building2, ShoppingBag, Store } from "lucide-react";
import { STATIC_CONTENT, type StaticPageId } from "./content";

const ECOSYSTEM_APPS = [
  {
    icon: ShoppingBag,
    title: "VelShop",
    description: "หน้าร้านค้าสำหรับลูกค้า — ค้นหา สั่งซื้อ สั่งซ้ำอัตโนมัติ",
    href: SITE_URLS.velshop,
    badge: "สำหรับลูกค้า",
  },
  {
    icon: Store,
    title: "VelSeller",
    description: "เครื่องมือสำหรับเจ้าของร้าน — จัดการสินค้า ออเดอร์ และรายได้",
    href: SITE_URLS.velseller,
    badge: "สำหรับร้านค้า",
  },
  {
    icon: Building2,
    title: "VelCenter",
    description: "ศูนย์กลางธุรกิจภายใน — เฉพาะทีมงาน Velnox ที่ได้รับสิทธิ์",
    href: SITE_URLS.velcenter,
    badge: "ภายในองค์กร",
  },
] as const;

function EcosystemCards() {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-3">
      {ECOSYSTEM_APPS.map((app) => (
        <a
          key={app.title}
          href={app.href}
          target="_blank"
          rel="noreferrer"
          className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <app.icon className="size-5" />
            </span>
            <ArrowUpRight className="size-4 text-slate-300 transition-colors group-hover:text-emerald-500" />
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
            {app.badge}
          </p>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            {app.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{app.description}</p>
        </a>
      ))}
    </div>
  );
}

export function StaticPage({ page }: { page: StaticPageId }) {
  const content = STATIC_CONTENT[page];
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
          Velnox Group
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          {content.title}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
          {content.tagline}
        </p>
      </header>

      {page === "ecosystem" && <EcosystemCards />}

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {content.sections.map((section, i) => (
          <section
            key={section.heading}
            className={
              i === 0 && content.sections.length % 2 === 1
                ? "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:col-span-2 sm:p-8"
                : "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            }
          >
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {section.heading}
            </h2>
            {section.body && (
              <p className="mt-3 text-[15px] leading-7 text-slate-600">
                {section.body}
              </p>
            )}
            {section.points && (
              <ul className="mt-3 space-y-2.5">
                {section.points.map((point) => (
                  <li key={point} className="flex gap-3 text-[15px] leading-7 text-slate-600">
                    <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
