import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useAuthToken } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreHeader } from "@/components/StoreHeader";
import { toast } from "sonner";
import {
  CalendarDays,
  Camera,
  ImagePlus,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

// ── Server-side upload helpers ───────────────────────────────────────
/**
 * Derive the Convex site URL so the browser sends the file to our
 * backend (NOT directly to Cloudinary).
 */
function getConvexSiteUrl(): string {
  const cloudUrl = import.meta.env.VITE_CONVEX_URL as string;
  return cloudUrl.replace(".convex.cloud", ".convex.site");
}

/**
 * Upload an image through the Velnox backend → Cloudinary.
 * The browser NEVER communicates with Cloudinary directly.
 */
async function uploadViaBackend(
  file: File,
  kind: "avatar" | "cover",
  token: string | undefined,
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  const res = await fetch(`${getConvexSiteUrl()}/upload/image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const data = (await res.json()) as {
    url?: string;
    error?: string;
    detail?: string;
  };
  if (!res.ok) {
    console.error("[Profile] Upload failed:", res.status, data.detail ?? data.error);
    throw new Error(data.error || `อัปโหลดไม่สำเร็จ (HTTP ${res.status})`);
  }
  if (!data.url) throw new Error("ไม่ได้รับ URL จากระบบอัปโหลด");
  return data.url;
}

/** Check if a stored value is a URL (Cloudinary) vs a Convex storage ID. */
function isImageUrl(v?: string | null): boolean {
  return Boolean(v && (v.startsWith("http://") || v.startsWith("https://")));
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MIN_DIMENSION = 100;

type ImageKind = "avatar" | "cover";

/** Client-side validation: file type + size. Returns a Thai error message or null. */
function validateImageFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const looksLikeImage =
    ALLOWED_TYPES.includes(file.type) ||
    ALLOWED_EXTENSIONS.includes(extension);
  if (!looksLikeImage) {
    return "รูปภาพไม่รองรับ กรุณาเลือก JPG, PNG หรือ WebP";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "ไฟล์มีขนาดใหญ่เกินไป กรุณาเลือกรูปที่มีขนาดเล็กลง";
  }
  return null;
}

/** Dimension check so tiny/blank images never reach the backend. */
function validateImageDimensions(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth < MIN_DIMENSION || img.naturalHeight < MIN_DIMENSION) {
        resolve(
          `รูปมีขนาดเล็กเกินไป กรุณาเลือกรูปที่มีขนาดอย่างน้อย ${MIN_DIMENSION}×${MIN_DIMENSION} พิกเซล`,
        );
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("ไม่สามารถอ่านรูปภาพได้ กรุณาลองเลือกรูปอื่น");
    };
    img.src = url;
  });
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="mt-0.5 truncate text-sm font-medium text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

function EmptySection({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function Profile() {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const updateProfile = useMutation(api.users.updateProfile);
  const token = useAuthToken();

  // ── Resolve image URLs ────────────────────────────────────────────
  // New uploads store Cloudinary URLs directly.
  // Legacy uploads may hold a Convex storage ID — resolve via getImageUrl.
  const avatarStorageUrl = useQuery(
    api.files.getImageUrl,
    user?.image && !isImageUrl(user.image)
      ? { storageId: user.image as Id<"_storage"> }
      : "skip",
  );
  const coverStorageUrl = useQuery(
    api.files.getImageUrl,
    user?.coverImage && !isImageUrl(user.coverImage)
      ? { storageId: user.coverImage as Id<"_storage"> }
      : "skip",
  );
  const avatarUrl = isImageUrl(user?.image) ? user!.image! : avatarStorageUrl;
  const coverUrl = isImageUrl(user?.coverImage) ? user!.coverImage! : coverStorageUrl;

  // ---- edit dialog state ----
  const [editOpen, setEditOpen] = useState(false);
  const [autoPick, setAutoPick] = useState<ImageKind | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<Partial<Record<ImageKind, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Sync form fields when the dialog opens or the user data changes.
  useEffect(() => {
    if (editOpen) {
      setName(user?.name ?? "");
      setPhone(user?.phone ?? "");
      setSaveError(null);
    }
  }, [editOpen, user?.name, user?.phone]);

  // Open the dialog and immediately open the matching file picker.
  const handleChangeImage = (kind: ImageKind) => {
    setImageError((prev) => ({ ...prev, [kind]: undefined }));
    setEditOpen(true);
    setAutoPick(kind);
  };

  useEffect(() => {
    if (editOpen && autoPick) {
      const timer = window.setTimeout(() => {
        if (autoPick === "avatar") avatarInputRef.current?.click();
        else coverInputRef.current?.click();
        setAutoPick(null);
      }, 80);
      return () => window.clearTimeout(timer);
    }
  }, [editOpen, autoPick]);

  // Clean up object URLs when the dialog closes.
  useEffect(() => {
    if (!editOpen) {
      setPendingAvatar(null);
      setPendingCover(null);
      setAvatarPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setCoverPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setImageError({});
    }
  }, [editOpen]);

  const handleFilePicked = async (
    kind: ImageKind,
    file: File | undefined,
  ) => {
    if (!file) return;
    const typeError = validateImageFile(file);
    if (typeError) {
      setImageError((prev) => ({ ...prev, [kind]: typeError }));
      return;
    }
    const dimensionError = await validateImageDimensions(file);
    if (dimensionError) {
      setImageError((prev) => ({ ...prev, [kind]: dimensionError }));
      return;
    }
    const preview = URL.createObjectURL(file);
    if (kind === "avatar") {
      setPendingAvatar(file);
      setAvatarPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return preview;
      });
    } else {
      setPendingCover(file);
      setCoverPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return preview;
      });
    }
    setImageError((prev) => ({ ...prev, [kind]: undefined }));
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError("กรุณากรอกชื่อ");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // Upload through Velnox backend → Cloudinary.
      // The browser NEVER talks to Cloudinary directly.
      let imageUrl: string | undefined;
      let coverImageUrl: string | undefined;
      if (pendingAvatar) imageUrl = await uploadViaBackend(pendingAvatar, "avatar", token ?? undefined);
      if (pendingCover) coverImageUrl = await uploadViaBackend(pendingCover, "cover", token ?? undefined);

      await updateProfile({
        name: trimmedName,
        phone: phone.trim(), // empty string clears the field
        ...(imageUrl ? { image: imageUrl } : {}),
        ...(coverImageUrl ? { coverImage: coverImageUrl } : {}),
      });

      toast.success("บันทึกโปรไฟล์เรียบร้อยแล้ว");
      setEditOpen(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("ออกจากระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  const initials = (user?.name ?? user?.email ?? "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();
  const memberSince = user?._creationTime
    ? new Date(user._creationTime).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const isVerified = Boolean(user?.emailVerificationTime);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <StoreHeader />
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <Skeleton className="h-44 w-full rounded-2xl md:h-52" />
          <div className="flex items-end gap-4 px-4">
            <Skeleton className="size-28 rounded-full ring-4 ring-background md:size-32" />
            <div className="flex-1 space-y-2 pb-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <StoreHeader />

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        {/* ============ COVER ============ */}
        <div className="relative overflow-hidden rounded-2xl border bg-muted">
          <div className="aspect-[16/6] w-full sm:aspect-[3/1]">
            {coverPreview ? (
              <img
                src={coverPreview}
                alt="รูปปกใหม่ (พรีวิว)"
                className="size-full object-cover"
              />
            ) : coverUrl ? (
              <img
                src={coverUrl}
                alt="รูปปก"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-secondary via-muted to-secondary/60">
                <ImagePlus className="size-8 text-muted-foreground/50" />
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute right-3 top-3 gap-1.5 shadow-sm backdrop-blur-md"
            onClick={() => handleChangeImage("cover")}
          >
            <Camera className="size-3.5" />
            เปลี่ยนรูปปก
          </Button>
        </div>

        {/* ============ AVATAR + NAME ============ */}
        <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-end sm:gap-5">
          <button
            type="button"
            onClick={() => handleChangeImage("avatar")}
            className="group relative -mt-14 shrink-0 self-start rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring md:-mt-16"
            aria-label="เปลี่ยนรูปโปรไฟล์"
          >
            <div className="relative size-28 overflow-hidden rounded-full border-4 border-background bg-secondary shadow-md md:size-32">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="รูปโปรไฟล์ใหม่ (พรีวิว)"
                  className="size-full object-cover"
                />
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="รูปโปรไฟล์"
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                  {initials}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                <Camera className="size-6 text-transparent transition-colors group-hover:text-white" />
              </span>
            </div>
          </button>

          <div className="min-w-0 flex-1 pb-1 sm:pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {user.name || "ผู้ใช้ VelShop"}
              </h1>
              {isVerified && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-emerald-700 dark:text-emerald-300"
                >
                  <ShieldCheck className="size-3" />
                  ยืนยันแล้ว
                </Badge>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="size-3.5" />
              <span className="truncate">{user.email ?? "—"}</span>
            </p>
            {memberSince && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/80">
                <CalendarDays className="size-3.5" />
                เป็นสมาชิกตั้งแต่ {memberSince}
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            className="gap-2 self-start sm:mb-3"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" />
            แก้ไขโปรไฟล์
          </Button>
        </div>

        {/* ============ PROFILE INFORMATION ============ */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            ข้อมูลส่วนตัว
          </h2>
          <div className="rounded-2xl border bg-card px-5 py-4 shadow-sm">
            <InfoRow icon={<UserIcon className="size-4" />} label="ชื่อ">
              {user.name || "—"}
            </InfoRow>
            <Separator />
            <InfoRow icon={<Mail className="size-4" />} label="อีเมล">
              {user.email || "—"}
            </InfoRow>
            <Separator />
            <InfoRow icon={<Phone className="size-4" />} label="เบอร์โทรศัพท์">
              {user.phone || "ยังไม่ได้เพิ่มเบอร์โทรศัพท์"}
            </InfoRow>
            <Separator />
            <InfoRow icon={<MapPin className="size-4" />} label="ที่อยู่">
              <span className="font-normal text-muted-foreground">
                ยังไม่ได้เพิ่มที่อยู่ — จัดการได้จากหน้า &quot;ที่อยู่&quot;
              </span>
            </InfoRow>
            <Separator />
            <InfoRow
              icon={<ShieldCheck className="size-4" />}
              label="สถานะบัญชี"
            >
              <Badge
                variant={isVerified ? "secondary" : "outline"}
                className={
                  isVerified
                    ? "text-emerald-700 dark:text-emerald-300"
                    : undefined
                }
              >
                {isVerified ? "บัญชีปกติ" : "รอการยืนยัน"}
              </Badge>
            </InfoRow>
          </div>
        </section>

        {/* ============ MY ORDERS ============ */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            คำสั่งซื้อของฉัน
          </h2>
          <EmptySection
            icon={<Package className="size-5" />}
            title="ยังไม่มีคำสั่งซื้อ"
            description="เมื่อคุณสั่งซื้อสินค้า คำสั่งซื้อจะแสดงที่นี่"
          />
        </section>

        {/* ============ ADDRESSES ============ */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            ที่อยู่
          </h2>
          <EmptySection
            icon={<MapPin className="size-5" />}
            title="ยังไม่มีที่อยู่จัดส่ง"
            description="เพิ่มที่อยู่เพื่อให้การจัดส่งรวดเร็วขึ้น"
          />
        </section>

        {/* ============ ACCOUNT SETTINGS ============ */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            ตั้งค่าบัญชี
          </h2>
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
                <Pencil className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">แก้ไขข้อมูลส่วนตัว</p>
                <p className="text-sm text-muted-foreground">
                  เปลี่ยนชื่อ เบอร์โทร รูปโปรไฟล์ และรูปปก
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-3.5" />
              แก้ไขโปรไฟล์
            </Button>
          </div>
        </section>

        {/* ============ LOGOUT (bottom of the page, separated) ============ */}
        <section className="mt-10 border-t pt-8">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive sm:w-auto"
              >
                <LogOut className="size-4" />
                ออกจากระบบ
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>ออกจากระบบ?</AlertDialogTitle>
                <AlertDialogDescription>
                  คุณจะถูกนำกลับไปยังหน้าแรก คุณสามารถเข้าสู่ระบบใหม่ได้ทุกเมื่อ
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSignOut}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  ออกจากระบบ
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </main>

      {/* ============ EDIT PROFILE DIALOG ============ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขโปรไฟล์</DialogTitle>
            <DialogDescription>
              เปลี่ยนรูปโปรไฟล์ รูปปก ชื่อ และเบอร์โทรได้ที่นี่
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-full border bg-secondary">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="พรีวิวรูปโปรไฟล์"
                    className="size-full object-cover"
                  />
                ) : avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="รูปโปรไฟล์"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-lg font-semibold text-muted-foreground">
                    {initials}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">รูปโปรไฟล์</p>                  <p className="mb-2 text-xs text-muted-foreground">
                    JPG, PNG, WebP, AVIF หรือ GIF · ไม่เกิน 10 MB
                  </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Camera className="size-3.5" />
                  เปลี่ยนรูปโปรไฟล์
                </Button>
              </div>
            </div>

            {/* Cover */}
            <div>
              <p className="mb-2 text-sm font-medium">รูปปก</p>
              <div className="relative mb-2 aspect-[3/1] w-full overflow-hidden rounded-lg border bg-muted">
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="พรีวิวรูปปก"
                    className="size-full object-cover"
                  />
                ) : coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="รูปปก"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <ImagePlus className="size-6 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => coverInputRef.current?.click()}
              >
                <Camera className="size-3.5" />
                เปลี่ยนรูปปก
              </Button>
            </div>

            {(imageError.avatar || imageError.cover) && (
              <p className="text-sm text-destructive">
                {imageError.avatar ?? imageError.cover}
              </p>
            )}

            <Separator />

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">ชื่อ</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อของคุณ"
                  maxLength={60}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-phone">เบอร์โทรศัพท์</Label>
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="เช่น 081-234-5678"
                  maxLength={30}
                  inputMode="tel"
                />
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                "บันทึกการเปลี่ยนแปลง"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file inputs (inside the dialog, triggered on demand) */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleFilePicked("avatar", e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleFilePicked("cover", e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <p className="mx-auto w-full max-w-3xl px-4 pb-8 text-center text-xs text-muted-foreground/70 sm:px-6">
        VelShop · ช้อปปิ้งออนไลน์ที่เรียบง่ายและสวยงาม
      </p>
    </div>
  );
}
