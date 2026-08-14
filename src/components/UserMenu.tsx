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
import { ChevronDown, LogOut } from "lucide-react";
import { useNavigate } from "react-router";

function getInitials(name?: string, email?: string): string {
  const source = name?.trim() || email?.trim() || "V";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const ROLE_LABEL: Record<string, string> = {
  admin: "ผู้ดูแลศูนย์กลาง",
  seller: "เจ้าของธุรกิจ",
  customer: "ลูกค้า",
};

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
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
              {user?.name || "ผู้ใช้งาน"}
            </span>
            <span className="block text-xs text-slate-400">
              {ROLE_LABEL[user?.role ?? ""] ?? "ลูกค้า"}
            </span>
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
  );
}
