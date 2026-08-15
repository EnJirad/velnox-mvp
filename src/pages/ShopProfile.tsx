import { ShopHeader } from "@/components/shop/ShopHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  Bell,
  Heart,
  LogOut,
  MapPin,
  Package,
  ShoppingBag,
  User,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

const SECTIONS: Array<{ to: string; label: string; desc: string; icon: LucideIcon }> = [
  { to: "/shop/addresses", label: "ที่อยู่ของฉัน", desc: "จัดการที่อยู่ + พิกัด GPS สำหรับจัดส่ง", icon: MapPin },
  { to: "/shop/orders", label: "ออเดอร์ของฉัน", desc: "ติดตามออเดอร์และพัสดุ", icon: Package },
  { to: "/shop/wishlist", label: "รายการโปรด", desc: "สินค้าที่คุณกดหัวใจไว้", icon: Heart },
  { to: "/shop/notifications", label: "การแจ้งเตือน", desc: "สถานะออเดอร์และโปรโมชัน", icon: Bell },
];

export default function ShopProfile() {
  const { user, isLoading, isAuthenticated, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success("ออกจากระบบแล้ว");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
            <User className="size-4 text-[#10B981]" />
            velshop · โปรไฟล์ของฉัน
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">โปรไฟล์</h1>
        </div>

        {isLoading ? (
          <div className="mt-8 h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ) : isAuthenticated && user ? (
          <>
            <Card className="mt-8 border-slate-200 shadow-none">
              <CardContent className="flex items-center gap-4 p-6">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#ECFDF5] text-lg font-bold text-[#10B981]">
                  {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-slate-900">{user.name ?? "สมาชิก Velnox"}</p>
                  <p className="truncate text-sm text-slate-500">{user.email ?? ""}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto gap-1.5 shrink-0 border-slate-200 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => void handleSignOut()}
                >
                  <LogOut className="size-3.5" />
                  ออกจากระบบ
                </Button>
              </CardContent>
            </Card>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <Link key={s.to} to={s.to} className="group">
                    <Card className="h-full border-slate-200 shadow-none transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[#10B981]/40 group-hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                      <CardHeader className="flex-row items-center gap-3 space-y-0 p-5">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-500 transition-colors group-hover:bg-[#ECFDF5] group-hover:text-[#10B981]">
                          <Icon className="size-4" />
                        </span>
                        <div>
                          <CardTitle className="text-sm font-semibold text-slate-900">{s.label}</CardTitle>
                          <p className="mt-0.5 text-xs text-slate-400">{s.desc}</p>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <ShoppingBag className="size-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">กรุณาเข้าสู่ระบบเพื่อดูโปรไฟล์ของคุณ</p>
            <Button className="mt-5 bg-slate-900 text-white hover:bg-slate-800" asChild>
              <Link to="/auth?returnTo=/shop/profile">เข้าสู่ระบบ</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
