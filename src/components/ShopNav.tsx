import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/hooks/use-auth";
import { LogoMark } from "@/components/Logo";
import {
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingBag,
  Store,
  User as UserIcon,
  Zap,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router";

export function ShopNav() {
  const { count, setOpen } = useCart();
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors hover:text-foreground ${
      isActive ? "text-foreground" : "text-muted-foreground"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/shop" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-base font-black tracking-[0.18em]">VELNOX</span>
          <span className="ml-1 rounded-full border border-lime-500/30 bg-lime-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-lime-300">
            Velshop
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/shop" className={linkClass} end>
            Marketplace
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/shop/orders" className={linkClass}>
              My orders
            </NavLink>
          )}
          <Link
            to="/seller"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sell on Velnox
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative cursor-pointer"
            onClick={() => setOpen(true)}
            aria-label={`Open cart, ${count} items`}
          >
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-400 px-1 text-[10px] font-bold text-black">
                {count > 99 ? "99" : count}
              </span>
            )}
          </Button>

          {isLoading ? null : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="cursor-pointer">
                  <UserIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium">
                    {user?.name ?? user?.email ?? "Account"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/dashboard">
                    <LayoutDashboard className="mr-2 size-4" /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/shop/orders">
                    <Package className="mr-2 size-4" /> My orders
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/seller">
                    <Store className="mr-2 size-4" /> Seller portal
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void handleSignOut()}
                  className="cursor-pointer text-red-400 focus:text-red-400"
                >
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" className="cursor-pointer">
              <Link to="/auth">
                <Zap className="size-4" /> Sign in
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
