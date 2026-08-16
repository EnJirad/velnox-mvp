import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tone: Record<string, string> = {
  // positive
  ACTIVE: "border-lime-500/30 bg-lime-500/10 text-lime-300",
  APPROVED: "border-lime-500/30 bg-lime-500/10 text-lime-300",
  DELIVERED: "border-lime-500/30 bg-lime-500/10 text-lime-300",
  PAID: "border-lime-500/30 bg-lime-500/10 text-lime-300",
  // in-flight
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  UNDER_REVIEW: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  PENDING_REVIEW: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  CONFIRMED: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  PROCESSING: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  SHIPPED: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  AVAILABLE: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  DRAFT: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  // negative / terminal
  REJECTED: "border-red-500/30 bg-red-500/10 text-red-300",
  CANCELLED: "border-red-500/30 bg-red-500/10 text-red-300",
  REFUNDED: "border-red-500/30 bg-red-500/10 text-red-300",
  SUSPENDED: "border-red-500/30 bg-red-500/10 text-red-300",
  DISABLED: "border-red-500/30 bg-red-500/10 text-red-300",
  ARCHIVED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

const labels: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  REJECTED: "Rejected",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  ARCHIVED: "Archived",
  APPROVED: "Approved",
  UNDER_REVIEW: "Under review",
  DISABLED: "Disabled",
  PENDING_PAYOUT: "Pending",
  AVAILABLE: "Available",
  PAID: "Paid",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium normal-case",
        tone[status] ?? "border-zinc-600/40 text-zinc-300",
        className,
      )}
    >
      {labels[status] ?? status}
    </Badge>
  );
}
