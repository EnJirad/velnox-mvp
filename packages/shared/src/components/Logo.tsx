import { cn } from "@velnox/shared/lib/utils";

interface LogoProps {
  className?: string;
  /** Invert the wordmark colors for use on dark surfaces. */
  dark?: boolean;
  /** Show only the brand mark (no wordmark). */
  markOnly?: boolean;
}

/** Velnox brand mark: dark geometric base + Velnox Green check accent. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-9 items-center justify-center rounded-[10px] bg-slate-900",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="#10B981"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12.5 9.5 18 20 6.5" />
      </svg>
    </span>
  );
}

/** Velnox wordmark: "Vel" in slate-900 + "nox" in Velnox Green. */
export function Logo({ className, dark = false, markOnly = false }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!markOnly && (
        <span
          className={cn(
            "text-lg font-bold tracking-tight",
            dark ? "text-white" : "text-slate-900",
          )}
        >
          Vel<span className="text-[#10B981]">nox</span>
        </span>
      )}
    </span>
  );
}
