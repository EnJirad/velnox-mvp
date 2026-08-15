import { MapPicker } from "@/components/shop/MapPicker";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface AddressRow {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

interface FormState {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = {
  label: "บ้าน",
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  subdistrict: "",
  district: "",
  province: "",
  postalCode: "",
  latitude: null,
  longitude: null,
  isDefault: false,
};

function formatAddress(a: AddressRow): string {
  return [a.line1, a.line2, a.subdistrict, a.district, a.province, a.postalCode].filter(Boolean).join(" · ");
}

export default function ShopAddresses() {
  const myAddresses = useAction(api.customer.myAddresses);
  const saveAddress = useAction(api.customer.saveAddress);
  const deleteAddress = useAction(api.customer.deleteAddressAction);

  const [addresses, setAddresses] = useState<AddressRow[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAddresses((await myAddresses()) as unknown as AddressRow[]);
    } catch (err) {
      console.error("Load addresses error:", err);
      setAddresses([]);
    }
  }, [myAddresses]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (a: AddressRow) => {
    setEditingId(a.id);
    setForm({
      label: a.label,
      recipientName: a.recipientName,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2 ?? "",
      subdistrict: a.subdistrict ?? "",
      district: a.district ?? "",
      province: a.province ?? "",
      postalCode: a.postalCode ?? "",
      latitude: a.latitude,
      longitude: a.longitude,
      isDefault: a.isDefault,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.recipientName.trim() || !form.phone.trim() || !form.line1.trim()) {
      toast.error("กรุณากรอกชื่อผู้รับ เบอร์โทร และที่อยู่ให้ครบ");
      return;
    }
    if (form.isDefault && (form.latitude == null || form.longitude == null)) {
      toast.error("ที่อยู่หลักต้องมีพิกัด GPS — เลือกตำแหน่งบนแผนที่ก่อนบันทึก");
      return;
    }
    setSubmitting(true);
    try {
      await saveAddress({
        addressId: editingId ?? undefined,
        label: form.label.trim() || "บ้าน",
        recipientName: form.recipientName.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        subdistrict: form.subdistrict.trim() || undefined,
        district: form.district.trim() || undefined,
        province: form.province.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        country: "TH",
        latitude: form.latitude ?? undefined,
        longitude: form.longitude ?? undefined,
        isDefault: form.isDefault,
      });
      toast.success(editingId ? "อัปเดตที่อยู่แล้ว" : "เพิ่มที่อยู่แล้ว");
      setDialogOpen(false);
      await load();
    } catch (err) {
      console.error("Save address error:", err);
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (a: AddressRow) => {
    setDeletingId(a.id);
    try {
      await deleteAddress({ addressId: a.id });
      toast.success("ลบที่อยู่แล้ว");
      await load();
    } catch (err) {
      console.error("Delete address error:", err);
      toast.error("ลบไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (a: AddressRow) => {
    if (a.isDefault) return;
    if (a.latitude == null || a.longitude == null) {
      toast.error("ที่อยู่นี้ยังไม่มีพิกัด GPS — ต้องเลือกตำแหน่งบนแผนที่ก่อนตั้งเป็นที่อยู่หลัก");
      return;
    }
    setSubmitting(true);
    try {
      await saveAddress({
        addressId: a.id,
        label: a.label,
        recipientName: a.recipientName,
        phone: a.phone,
        line1: a.line1,
        line2: a.line2 ?? undefined,
        subdistrict: a.subdistrict ?? undefined,
        district: a.district ?? undefined,
        province: a.province ?? undefined,
        postalCode: a.postalCode ?? undefined,
        country: a.country,
        latitude: a.latitude ?? undefined,
        longitude: a.longitude ?? undefined,
        isDefault: true,
      });
      toast.success("ตั้งเป็นที่อยู่หลักแล้ว");
      await load();
    } catch (err) {
      console.error("Set default error:", err);
      toast.error(err instanceof Error ? err.message : "ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const setCoord = (lat: number, lng: number) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }));

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
              <MapPin className="size-4 text-[#10B981]" />
              velshop · ที่อยู่ของฉัน
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">จัดการที่อยู่</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              ที่อยู่หลักต้องมีพิกัด GPS (เลือกบนแผนที่) ถึงจะใช้จัดส่งได้
            </p>
          </div>
          <Button className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800" onClick={openCreate}>
            <Plus className="size-4" />
            เพิ่มที่อยู่
          </Button>
        </div>

        {addresses === null ? (
          <div className="mt-8 space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        ) : addresses.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
              <MapPin className="size-7 text-slate-400" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">ยังไม่มีที่อยู่</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              เพิ่มที่อยู่พร้อมเลือกตำแหน่งบนแผนที่ เพื่อใช้ในการจัดส่งสินค้า
            </p>
            <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" onClick={openCreate}>
              <Plus className="size-4" />
              เพิ่มที่อยู่แรก
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {addresses.map((a) => {
              const gps = a.latitude != null && a.longitude != null;
              return (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{a.label}</p>
                        {a.isDefault && (
                          <Badge className="gap-1 rounded-full bg-[#ECFDF5] text-emerald-700 ring-1 ring-inset ring-emerald-600/15 hover:bg-[#ECFDF5]">
                            <Star className="size-3 fill-emerald-600 text-emerald-600" />
                            ที่อยู่หลัก
                          </Badge>
                        )}
                        {!gps && (
                          <Badge className="rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15 hover:bg-amber-50">
                            ยังไม่มี GPS
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-slate-600">{formatAddress(a)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {a.recipientName} · {a.phone}
                        {gps && (
                          <span className="ml-2 tabular-nums">
                            GPS {a.latitude!.toFixed(4)}, {a.longitude!.toFixed(4)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!a.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 border-slate-200 text-slate-600"
                          onClick={() => void handleSetDefault(a)}
                          disabled={submitting}
                        >
                          <Star className="size-3.5" />
                          ตั้งเป็นหลัก
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 border-slate-200 text-slate-500"
                        onClick={() => openEdit(a)}
                        aria-label={`แก้ไข ${a.label}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                        onClick={() => void handleDelete(a)}
                        disabled={deletingId === a.id}
                        aria-label={`ลบ ${a.label}`}
                      >
                        {deletingId === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Address form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="size-4 text-[#10B981]" />
              {editingId ? "แก้ไขที่อยู่" : "เพิ่มที่อยู่"}
            </DialogTitle>
            <DialogDescription>
              เลือกตำแหน่งบนแผนที่ (ลากหมุดหรือแตะแผนที่) — ที่อยู่หลักต้องมีพิกัด GPS
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="addr-label">ชื่อที่อยู่</Label>
                <Input
                  id="addr-label"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="บ้าน / ที่ทำงาน"
                  className="rounded-[10px] border-slate-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addr-recipient">ชื่อผู้รับ *</Label>
                <Input
                  id="addr-recipient"
                  value={form.recipientName}
                  onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                  placeholder="ชื่อ-นามสกุล"
                  className="rounded-[10px] border-slate-200"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addr-phone">เบอร์โทร *</Label>
              <Input
                id="addr-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="เช่น 081-234-5678"
                className="rounded-[10px] border-slate-200"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addr-line1">ที่อยู่ (บ้านเลขที่ / ถนน) *</Label>
              <Input
                id="addr-line1"
                value={form.line1}
                onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
                placeholder="เช่น 12/34 ถ.สุขุมวิท"
                className="rounded-[10px] border-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="addr-subdistrict">ตำบล / แขวง</Label>
                <Input
                  id="addr-subdistrict"
                  value={form.subdistrict}
                  onChange={(e) => setForm((f) => ({ ...f, subdistrict: e.target.value }))}
                  className="rounded-[10px] border-slate-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addr-district">อำเภอ / เขต</Label>
                <Input
                  id="addr-district"
                  value={form.district}
                  onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                  className="rounded-[10px] border-slate-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addr-province">จังหวัด</Label>
                <Input
                  id="addr-province"
                  value={form.province}
                  onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                  className="rounded-[10px] border-slate-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addr-postal">รหัสไปรษณีย์</Label>
                <Input
                  id="addr-postal"
                  value={form.postalCode}
                  onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                  className="rounded-[10px] border-slate-200"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>ตำแหน่งบนแผนที่ {form.isDefault && <span className="text-amber-600">(บังคับสำหรับที่อยู่หลัก)</span>}</Label>
              <MapPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={setCoord}
                height="h-56"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="size-4 rounded border-slate-300 text-[#10B981]"
              />
              ตั้งเป็นที่อยู่หลัก (ใช้ตอนสั่งซื้อ)
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" className="border-slate-200 text-slate-700" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800" onClick={handleSave} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              บันทึกที่อยู่
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
