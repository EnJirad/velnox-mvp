import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SITE_URLS, type SiteId } from "@/lib/sites";
import { Briefcase, ChevronDown, ShieldCheck, Store, type LucideIcon } from "lucide-react";
import { useLocation } from "react-router";

const SITES: {
  id: SiteId;
  label: string;
  th: string;
  icon: LucideIcon;
  desc: string;
}[] = [
  {
    id: "velshop",
    label: "velshop",
    th: "ร้านค้า",
    icon: Store,
    desc: "หน้าร้านสำหรับลูกค้า",
  },
  {
    id: "velseller",
    label: "velseller",
    th: "พ่อค้า",
    icon: Briefcase,
    desc: "เครื่องมือพ่อค้า",
  },
  {
    id: "velcenter",
    label: "velcenter",
    th: "ศูนย์กลางบริษัท",
    icon: ShieldCheck,
    desc: "จัดการระบบ + Intelligence",
  },
];

export function SiteSwitcher() {
  const location = useLocation();
  const current =
    SITES.find((s) => {
      if (s.id === "velshop") return location.pathname.startsWith("/shop");
      if (s.id === "velseller") return location.pathname.startsWith("/seller");
      return location.pathname.startsWith("/center");
    }) ?? SITES[0];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-slate-700 hover:bg-slate-100"
        >
          <CurrentIcon className="size-4 text-[#10B981]" />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-sm font-semibold text-slate-900">{current.label}</span>
            <span className="hidden text-[11px] text-slate-400 sm:block">{current.th}</span>
          </span>
          <ChevronDown className="size-4 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>เว็บไซต์ Velnox</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SITES.map((site) => {
          const Icon = site.icon;
          const active = site.id === current.id;
          return (
            <DropdownMenuItem
              key={site.id}
              asChild
              className={`cursor-pointer ${active ? "bg-slate-50" : ""}`}
            >
              {/* Plain anchor: each site is a SEPARATE app (own entry + deploy),
                  so switching sites is a full page load, not a client route. */}
              <a href={SITE_URLS[site.id]} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-[10px] bg-slate-100">
                  <Icon className="size-4 text-slate-600" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">{site.label}</span>
                  <span className="text-xs text-slate-400">{site.desc}</span>
                </span>
              </a>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
