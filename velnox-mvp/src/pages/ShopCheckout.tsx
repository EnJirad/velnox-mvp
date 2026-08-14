import { ShopHeader } from "@/components/shop/ShopHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/lib/cart";
import { formatBaht } from "@/lib/shop";
import { useMutation } from "convex/react";
import { ArrowLeft, Loader2, ShieldCheck, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

export default function ShopCheckout() {
  const { user } = useAuth();
  const { lines, total, clear } = useCart();
  const placeOrder = useMutation(api.orders.placeOrder);
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lines.length === 0) return;
    if (!name.trim() || !phone.trim()) {
      toast.error("กรุณากรอกชื่อและเบอร์โทรติดต่อ");
      return;
    }
    setSubmitting(true);
    try {
      await placeOrder({
        items: lines.map((l) => ({ productId: l.productId, quantity: l.qty })),
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerAddress: address.trim() || undefined,
        note: note.trim() || undefined,
      });
      clear();
      toast.success("สั่งซื้อสำเร็จ! ร้านค้าจะติดต่อกลับเร็ว ๆ นี้ 🎉");
      navigate("/shop/orders");
    } catch (error) {
      console.error("Place order error:", error);
      toast.error(
        error instanceof Error ? error.message : "สั่งซื้อไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (lines.length === 0 && !submitting) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <ShopHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
            <ShoppingBag className="size-7 text-slate-400" />
          </span>
          <h1 className="mt-5 text-xl font-bold text-slate-900">ตะกร้าของคุณว่างเปล่า</h1>
          <p className="mt-2 text-sm text-slate-500">
            เพิ่มสินค้าก่อน แล้วกลับมาที่หน้านี้เพื่อสั่งซื้อ
          </p>
          <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
            <Link to="/shop">
              <ArrowLeft className="size-4" />
              กลับไปเลือกสินค้า
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-9 text-slate-500" asChild>
            <Link to="/shop" aria-label="กลับไปหน้าร้าน">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ยืนยันการสั่งซื้อ</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              กรอกข้อมูลติดต่อ แล้วร้านค้าจะยืนยันออเดอร์ให้
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-6 lg:grid-cols-5">
          {/* Contact form */}
          <div className="space-y-6 lg:col-span-3">
            <Card className="border-slate-200 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">ข้อมูลติดต่อ</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="checkout-name">ชื่อ-นามสกุล *</Label>
                  <Input
                    id="checkout-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ชื่อผู้รับสินค้า"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="checkout-phone">เบอร์โทรติดต่อ *</Label>
                  <Input
                    id="checkout-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="เช่น 081-234-5678"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="checkout-address">ที่อยู่ (ไม่บังคับ)</Label>
                  <Textarea
                    id="checkout-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="checkout-note">หมายเหตุถึงร้านค้า (ไม่บังคับ)</Label>
                  <Textarea
                    id="checkout-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="เช่น ขอรับหลัง 17:00 น."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-2">
            <Card className="border-slate-200 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">สรุปออเดอร์</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lines.map((line) => (
                    <div key={line.productId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-slate-600">
                        {line.name}{" "}
                        <span className="text-slate-400">
                          × {line.qty} {line.unit}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-slate-900">
                        {formatBaht(line.qty * line.price)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm font-medium text-slate-500">รวมทั้งสิ้น</span>
                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">
                    {formatBaht(total)}
                  </span>
                </div>
                <Button
                  type="submit"
                  className="mt-4 w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      กำลังส่งออเดอร์...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" />
                      ยืนยันสั่งซื้อ · {formatBaht(total)}
                    </>
                  )}
                </Button>
                <p className="mt-3 text-center text-xs text-slate-400">
                  สั่งซื้อแล้วร้านค้าจะติดต่อกลับเพื่อยืนยัน — ยังไม่มีการชำระเงินออนไลน์ในเวอร์ชันนี้
                </p>
              </CardContent>
            </Card>
          </div>
        </form>
      </main>
    </div>
  );
}
