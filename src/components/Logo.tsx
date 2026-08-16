import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground",
        className,
      )}
    >
      <Zap className="size-5 fill-current" strokeWidth={2.5} />
    </span>
  );
}

export function Logo({
  to = "/",
  dark = false,
  className,
}: {
  to?: string;
  dark?: boolean;
  className?: string;
}) {
  const link = (
    <span
      className={cn("flex items-center gap-2.5", dark && "text-foreground", className)}
    >
      <LogoMark />
      <span className="text-lg font-black tracking-[0.18em]">VELNOX</span>
    </span>
  );
  return (
    <a
      href={to}
      className="inline-flex items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-90"
      aria-label="Velnox home"
    >
      {link}
    </a>
  );
}
