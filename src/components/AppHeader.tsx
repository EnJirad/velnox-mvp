import { Logo } from "@/components/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, LogOut, RefreshCw, Target } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";

const NAV_ITEMS = [
  { to: "/dashboard", label: "แดชบอร์ดเป้าหมาย", icon: Target },
  { to: "/reorder", label: "Smart Reorder", icon: RefreshCw },
];

function getInitials(name?: string, email?: string): string {
  const source = name?.trim() || email?.trim() || "V";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <button type="button" onClick={() => navigate("/")} aria-label="Velnox">
            <Logo />
          </button>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              <Avatar className="size-8 border border-slate-200">
                {user?.image && <AvatarImage src={user.image} alt={user?.name ?? ""} />}
                <AvatarFallback className="bg-slate-900 text-xs font-semibold text-white">
                  {getInitials(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-4 text-slate-900">
                  {user?.name || "เจ้าของธุรกิจ"}
                </span>
                <span className="block text-xs text-slate-400">เจ้าของธุรกิจ</span>
              </span>
              <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium text-slate-900">{user?.name || "Velnox"}</p>
              <p className="truncate text-xs font-normal text-slate-400">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              ออกจากระบบ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
