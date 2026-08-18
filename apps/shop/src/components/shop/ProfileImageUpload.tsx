import { useLanguage } from "@/lib/i18n";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Get the Convex HTTP endpoint URL for server-side profile image upload.
 * The browser sends the file HERE; Convex handles Cloudinary + DB save.
 */
function getUploadEndpoint(): string {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!convexUrl) return "";
  return `${convexUrl}/cloudinary/upload-profile`;
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

/** Unique error ID per failure — shown in toast + logged for correlation. */
function makeErrorId(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PROFILE_UPLOAD_${ymd}_${rand}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * VelShop profile image uploader (avatar + cover).
 *
 * Flow: pick file → client validation → instant preview → POST to Convex
 * server-side endpoint → Convex handles Cloudinary upload + DB save → result.
 *
 * No direct browser→Cloudinary upload. No CORS issues on mobile.
 */
export function ProfileImageUpload({ kind, onPreview, onUploaded, children }: ProfileImageUploadProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    const tStart = performance.now();
    const errorId = makeErrorId();
    const endpoint = getUploadEndpoint();

    // Stage 1 — client-side validation
    if (!ACCEPTED_TYPES.includes(file.type)) {
      console.error("[ProfileUpload] Rejected: unsupported file type", { fileType: file.type });
      toast.error(t("profile.imageTypeError"));
      resetInput();
      return;
    }
    if (file.size > MAX_BYTES) {
      console.error("[ProfileUpload] Rejected: file too large", { fileSize: file.size });
      toast.error(t("profile.imageSizeError"));
      resetInput();
      return;
    }

    console.log("[ProfileUpload] File validated", { kind, fileName: file.name, fileSize: file.size, fileType: file.type });
    const preview = URL.createObjectURL(file);
    onPreview(preview);
    setUploading(true);

    try {
      // Stage 2 — POST to Convex server-side endpoint
      if (!endpoint) {
        throw new Error("Upload endpoint not configured (VITE_CONVEX_URL missing)");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("uploadType", kind);

      console.log("[ProfileUpload] POST to Convex endpoint", { endpoint, kind, fileSize: file.size });

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        // Do NOT set Content-Type — browser generates multipart boundary automatically
      });

      const result = await response.json() as {
        success?: boolean;
        code?: string;
        message?: string;
        profile?: {
          name: string | null;
          email: string | null;
          phone: string | null;
          role: string;
          avatarUrl: string | null;
          coverUrl: string | null;
          memberSince: string;
        };
      };

      const elapsed = Math.round(performance.now() - tStart);
      console.log("[ProfileUpload] Response", { status: response.status, success: result.success, code: result.code, elapsed });

      if (!response.ok || !result.success) {
        const safeDetail = result.message || `HTTP ${response.status}`;
        console.error("[ProfileUpload] Upload failed", { status: response.status, code: result.code, message: result.message });

        toast.error(
          <div className="flex flex-col gap-1 text-left">
            <span>{t("profile.imageUploadFailed")}</span>
            <span className="text-xs opacity-80">{safeDetail}</span>
            <span className="text-xs opacity-60">{t("profile.errorIdLabel")}: {errorId}</span>
          </div>,
        );
        onPreview(null);
        URL.revokeObjectURL(preview);
        return;
      }

      // Stage 3 — success
      console.log("[ProfileUpload] SUCCESS", { elapsed });
      const profileUrl = kind === "cover" ? result.profile?.coverUrl : result.profile?.avatarUrl;
      onUploaded(profileUrl ?? "");
      URL.revokeObjectURL(preview);
    } catch (err) {
      const elapsed = Math.round(performance.now() - tStart);
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[ProfileUpload] Network/unexpected error", { elapsed, error: errMsg });

      toast.error(
        <div className="flex flex-col gap-1 text-left">
          <span>{t("profile.imageUploadFailed")}</span>
          <span className="text-xs opacity-80">{errMsg}</span>
          <span className="text-xs opacity-60">{t("profile.errorIdLabel")}: {errorId}</span>
        </div>,
      );
      onPreview(null);
      URL.revokeObjectURL(preview);
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
