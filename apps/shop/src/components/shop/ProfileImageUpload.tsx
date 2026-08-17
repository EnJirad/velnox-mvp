import { useLanguage } from "@/lib/i18n";
import { api } from "@convex/_generated/api";
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — matches the backend signed-upload limit

/** Server-issued signed upload permit (see backend/storage.ts UploadSignature). */
interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId: string;
  signature: string;
  allowedFormats: string;
  maxBytes: number;
}

interface ProfileImageUploadProps {
  /** Which profile image this uploader replaces. */
  kind: "avatar" | "cover";
  /** Called with a local preview URL while the file is being validated/uploaded. */
  onPreview: (url: string | null) => void;
  /** Called with the canonical stored URL after the backend saved the image. */
  onUploaded: (url: string) => void;
  /** The upload button content (icon + label). */
  children: ReactNode;
}

/**
 * VelShop profile image uploader (avatar + cover).
 *
 * Flow (spec §76–§79, §90): pick a file → client-side validation (type + size)
 * → instant preview → ask the backend for a Cloudinary signed upload permit →
 * POST the file straight to Cloudinary (no binary through our server) → tell
 * the backend to persist the canonical URL. Reuses the exact same storage
 * provider as product images — no new image system.
 */
export function ProfileImageUpload({ kind, onPreview, onUploaded, children }: ProfileImageUploadProps) {
  const { t } = useLanguage();
  const getSignature = useAction(api.customer.getProfileImageUploadSignature);
  const saveImage = useAction(api.customer.saveProfileImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    // Client-side validation first — never send a bad file (spec §78).
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(t("profile.imageTypeError"));
      resetInput();
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("profile.imageSizeError"));
      resetInput();
      return;
    }

    const preview = URL.createObjectURL(file);
    onPreview(preview);
    setUploading(true);
    try {
      const sig = (await getSignature({ kind })) as unknown as UploadSignature;
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", sig.apiKey);
      body.append("timestamp", String(sig.timestamp));
      body.append("folder", sig.folder);
      body.append("public_id", sig.publicId);
      body.append("signature", sig.signature);
      body.append("allowed_formats", sig.allowedFormats);
      body.append("max_bytes", String(sig.maxBytes));

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: "POST", body },
      );
      if (!res.ok) throw new Error(`Cloudinary upload failed (${res.status})`);
      const uploaded = (await res.json()) as {
        public_id: string;
        format: string;
        bytes: number;
        width?: number;
        height?: number;
      };

      const imageArgs: {
        kind: string;
        publicId: string;
        format?: string;
        bytes?: number;
        width?: number;
        height?: number;
      } = { kind, publicId: uploaded.public_id };
      if (uploaded.format) imageArgs.format = uploaded.format;
      if (uploaded.bytes != null) imageArgs.bytes = uploaded.bytes;
      if (uploaded.width != null) imageArgs.width = uploaded.width;
      if (uploaded.height != null) imageArgs.height = uploaded.height;
      const profile = (await saveImage(imageArgs)) as unknown as {
        avatarUrl: string | null;
        coverUrl: string | null;
      };
      onUploaded(kind === "cover" ? profile.coverUrl ?? "" : profile.avatarUrl ?? "");
    } catch (err) {
      console.error("Profile image upload error:", err);
      toast.error(t("profile.imageUploadFailed"));
      onPreview(null);
    } finally {
      setUploading(false);
      resetInput();
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-slate-900/80 disabled:opacity-70"
        aria-label={t(kind === "cover" ? "profile.changeCover" : "profile.changeAvatar")}
      >
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : children}
      </button>
    </>
  );
}
