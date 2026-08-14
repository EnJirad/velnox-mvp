import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/lib/cart";
import { formatBaht } from "@/lib/shop";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const { lines, count, total, setQty, remove } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const goCheckout = () => {
    onOpenChange(false);
    navigate(isAuthenticated ? "/shop/checkout" : "/auth?returnTo=/shop/checkout");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-slate-200 px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="size-4 text-[#10B981]" />
            ตะกร้าสินค้า
            {count > 0 && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                {count}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">สินค้าในตะกร้าของคุณ</SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
              <ShoppingCart className="size-6 text-slate-400" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">ตะกร้ายังว่าง</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                ไปเลือกสินค้าในหน้าร้าน แล้วกด "ใส่ตะกร้า" ได้เลย
              </p>
            </div>
            <Button
              variant="outline"
              className="border-slate-200 text-slate-700"
              onClick={() => {
                onOpenChange(false);
                navigate("/shop");
              }}
            >
              ดูสินค้าทั้งหมด
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {lines.map((line) => (
                <div
                  key={line.productId}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{line.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatBaht(line.price)} / {line.unit}
                    </p>
                    <div className="mt-2 flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6 border-slate-200 text-slate-600"
                        onClick={() => setQty(line.productId, line.qty - 1)}
                        aria-label="ลดจำนวน"
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums text-slate-900">
                        {line.qty}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6 border-slate-200 text-slate-600"
                        onClick={() => setQty(line.productId, line.qty + 1)}
                        disabled={line.qty >= line.stock}
                        aria-label="เพิ่มจำนวน"
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm font-semibold tabular-nums text-slate-900">
                      {formatBaht(line.qty * line.price)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-slate-400 hover:text-red-600"
                      onClick={() => remove(line.productId)}
                      aria-label={`ลบ ${line.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">รวมทั้งสิ้น</p>
                <p className="text-xl font-bold tabular-nums tracking-tight text-slate-900">
                  {formatBaht(total)}
                </p>
              </div>
              <Button
                className="mt-3 w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                onClick={goCheckout}
              >
                <ShoppingCart className="size-4" />
                ไปชำระเงิน / สั่งซื้อ
              </Button>
            </div>
          </>
        )}

        <div className="flex items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <Logo />
          <p className="text-[11px] text-slate-400">Commerce that remembers you · จำแทนคุณ</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
