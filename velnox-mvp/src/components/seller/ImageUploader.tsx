import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAction } from "convex/react";
import {
  ArrowDown,
  ArrowUp,
  Crown,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { StoreProduct, StoreImage } from "@/lib/commerce";

const MAX_IMAGES = 10;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";

interface ImageUploaderProps {
  product: StoreProduct;
  onChange: (product: StoreProduct) => void;
}

export function ImageUploader({ product, onChange }: ImageUploaderProps) {
  const getSignature = useAction(api.commerce.getProductImageUploadSignature);
  const saveImage = useAction(api.commerce.saveProductImage);
  const deleteImage = useAction(api.commerce.deleteProductImageAction);
  const setPrimary = useAction(api.commerce.setPrimaryProductImageAction);
  const reorder = useAction(api.commerce.reorderProductImagesAction);

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const images = product.images ?? [];
  const primaryId = images.find((i) => i.isPrimary)?.id ?? images[0]?.id ?? null;

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, MAX_IMAGES - images.length);
    if (list.length === 0) {
      toast.error(`สินค้ารองรับรูปได้สูงสุด ${MAX_IMAGES} รูป`);
      return;
    }
    setUploading(true);
    try {
      for (const file of list) {
        if (!ACCEPT.split(",").includes(file.type)) {
          toast.error(`ไฟล์ ${file.name} ไม่ใช่รูปภาพที่รองรับ`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`ไฟล์ ${file.name} ใหญ่เกิน 5 MB`);
          continue;
        }
        // 1. signed upload permit (server validates the seller owns the product)
        const sig = await getSignature({ productId: product.id });
        // 2. direct upload to Cloudinary from the browser
        const body = new FormData();
        body.append("file", file);
        body.append("folder", sig.folder);
        body.append("public_id", sig.publicId);
        body.append("timestamp", String(sig.timestamp));
        body.append("api_key", sig.apiKey);
        body.append("signature", sig.signature);
        body.append("allowed_formats", sig.allowedFormats);
        body.append("max_bytes", String(sig.maxBytes));
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
          { method: "POST", body },
        );
        const data = (await res.json()) as {
          secure_url?: string;
          public_id?: string;
          width?: number;
          height?: number;
          format?: string;
          bytes?: number;
          error?: { message?: string };
        };
        if (!res.ok || !data.public_id) {
          throw new Error(data.error?.message ?? "Cloudinary upload failed");
        }
        // 3. persist metadata in Neon (server re-validates type/size + ownership)
        const updated = await saveImage({
          productId: product.id,
          publicId: data.public_id,
          width: data.width,
          height: data.height,
          format: data.format,
          bytes: data.bytes,
        });
        if (updated) onChange(updated);
        toast.success(`อัปโหลด "${file.name}" แล้ว`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (image: StoreImage) => {
    setBusyId(image.id);
    try {
      const updated = await deleteImage({ imageId: image.id });
      if (updated) onChange(updated);
      toast.success("ลบรูปแล้ว");
    } catch (error) {
      console.error("Delete image error:", error);
      toast.error(error instanceof Error ? error.message : "ลบไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const handlePrimary = async (image: StoreImage) => {
    setBusyId(image.id);
    try {
      const updated = await setPrimary({ productId: product.id, imageId: image.id });
      if (updated) onChange(updated);
    } catch (error) {
      console.error("Set primary error:", error);
      toast.error(error instanceof Error ? error.message : "ตั้งรูปหลักไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const handleMove = async (image: StoreImage, dir: -1 | 1) => {
    const idx = images.findIndex((i) => i.id === image.id);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= images.length) return;
    const next = [...images];
    [next[idx], next[target]] = [next[target], next[idx]];
    try {
      const updated = await reorder({
        productId: product.id,
        orderedIds: next.map((i) => i.id),
      });
      if (updated) onChange(updated);
    } catch (error) {
      console.error("Reorder error:", error);
      toast.error("จัดเรียงรูปไม่สำเร็จ");
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">รูปสินค้า</p>
          <p className="text-xs text-slate-400">
            {images.length}/{MAX_IMAGES} รูป · รูปหลักแสดงที่หน้าร้าน · สูงสุด 5 MB/รูป
          </p>
        </div>
        <Badge className="gap-1 rounded-full bg-[#ECFDF5] text-emerald-700 ring-1 ring-inset ring-emerald-600/15 hover:bg-[#ECFDF5]">
          <Crown className="size-3" />
          Cloudinary CDN
        </Badge>
      </div>

      {/* uploaded images */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((image, idx) => {
            const isPrimary = image.id === primaryId;
            return (
              <div
                key={image.id}
                className={`group relative overflow-hidden rounded-[10px] border-2 ${
                  isPrimary ? "border-[#10B981]" : "border-slate-200"
                }`}
              >
                <div className="aspect-square w-full overflow-hidden bg-slate-50">
                  <img
                    src={image.thumbUrl || image.url}
                    alt={image.alt || `รูปที่ ${idx + 1}`}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                </div>
                {isPrimary && (
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-[#10B981] px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Star className="size-2.5 fill-current" />
                    หลัก
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-900/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-white hover:bg-white/20 hover:text-white"
                      disabled={idx === 0}
                      onClick={() => handleMove(image, -1)}
                      aria-label="เลื่อนรูปขึ้น"
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-white hover:bg-white/20 hover:text-white"
                      disabled={idx === images.length - 1}
                      onClick={() => handleMove(image, 1)}
                      aria-label="เลื่อนรูปลง"
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-0.5">
                    {!isPrimary && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-amber-300 hover:bg-white/20 hover:text-amber-300"
                        disabled={busyId === image.id}
                        onClick={() => handlePrimary(image)}
                        aria-label="ตั้งเป็นรูปหลัก"
                      >
                        <Star className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-rose-300 hover:bg-white/20 hover:text-rose-300"
                      disabled={busyId === image.id}
                      onClick={() => handleDelete(image)}
                      aria-label="ลบรูป"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {busyId === image.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <Loader2 className="size-4 animate-spin text-slate-500" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* upload zone */}
      {images.length < MAX_IMAGES && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
          }}
          disabled={uploading}
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 py-8 text-center transition-colors hover:border-[#10B981]/60 hover:bg-[#ECFDF5]/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? (
            <>
              <Loader2 className="size-5 animate-spin text-[#10B981]" />
              <p className="text-sm font-medium text-slate-600">กำลังอัปโหลด...</p>
            </>
          ) : (
            <>
              <ImagePlus className="size-5 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">
                คลิกหรือลากไฟล์มาวางเพื่ออัปโหลดรูป
              </p>
              <p className="text-xs text-slate-400">JPG · PNG · WebP · AVIF · GIF (สูงสุด 5 MB/รูป)</p>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
