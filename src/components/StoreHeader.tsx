import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { ShoppingBag } from "lucide-react";
import { Link, NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-secondary text-foreground"
      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
  );
}

export function StoreHeader() {
  const { user } = useAuth();
  const avatarUrl = useQuery(
    api.files.getImageUrl,
    user?.image ? { storageId: user.image as Id<"_storage"> } : "skip",
  );

  const initials = (user?.name ?? user?.email ?? "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/dashboard"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShoppingBag className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">VelShop</span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/dashboard" className={navLinkClass}>
            ร้านค้า
          </NavLink>
          <NavLink to="/profile" className={navLinkClass}>
            โปรไฟล์
          </NavLink>
        </nav>

        <Link
          to="/profile"
          aria-label="ไปที่โปรไฟล์"
          className="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-9 ring-1 ring-border">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={user?.name ?? ""} />}
            <AvatarFallback className="bg-secondary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
