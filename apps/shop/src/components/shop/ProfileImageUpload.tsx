import { useLanguage } from "@/lib/i18n";
import { api } from "@convex/_generated/api";
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches the backend re-validation limit (backend/storage.ts MAX_IMAGE_BYTES)
/** Server-issued signed upload permit (see backend/storage.ts UploadSignature). */
interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId: string;
  signature: string;
  allowedFormats: string;
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
 * Flow: pick a file → client-side validation (MIME type + size, max 10 MB) →
 * instant preview → ask the backend for a Cloudinary signed upload permit →
 * POST the file straight to Cloudinary (no binary through our server) → tell
 * the backend to persist the canonical URL and delete the replaced image.
 * Reuses the exact same storage provider as product images — no new system.
 *
 * Failure handling is stage-specific so the real cause never hides behind a
 * generic toast:
 *   A. signature stage  — backend returned an incomplete/absent permit
 *   B. Cloudinary stage — HTTP status + JSON error body are logged
 *   C. database stage   — Cloudinary succeeded but the profile row failed
 *   D. auth failure     — surfaces as a Convex error on stage A
 *   E. file validation  — rejected client-side before any request
 * No credentials are ever logged; only safe metadata (never the signature
 * value or the API secret).
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
    // Stage E — client-side validation first (type + size). Never send a bad
    // file: checked here, re-checked by the server, and (formats) by Cloudinary.
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
      // Stage A — the backend issues a Cloudinary signed upload permit.
      // The Convex action succeeding server-side is NOT enough: verify every
      // field the request needs actually came back, otherwise the upload
      // would silently POST "undefined" values to Cloudinary.
      const sig = (await getSignature({ kind })) as unknown as UploadSignature | null | undefined;
      if (
        !sig ||
        !sig.cloudName ||
        !sig.apiKey ||
        !sig.timestamp ||
        !sig.folder ||
        !sig.publicId ||
        !sig.signature ||
        !sig.allowedFormats
      ) {
        console.error("[ProfileUpload] Incomplete signature from backend", {
          cloudName: Boolean(sig?.cloudName),
          apiKey: Boolean(sig?.apiKey),
          timestamp: typeof sig?.timestamp,
          folder: Boolean(sig?.folder),
          publicId: Boolean(sig?.publicId),
          signaturePresent: Boolean(sig?.signature),
          allowedFormats: Boolean(sig?.allowedFormats),
        });
        toast.error(t("profile.imageSignatureError"));
        onPreview(null);
        URL.revokeObjectURL(preview);
        return;
      }
      console.log("[ProfileUpload] Signature received", {
        cloudName: sig.cloudName,
        apiKey: sig.apiKey,
        timestamp: sig.timestamp,
        folder: sig.folder,
        publicId: sig.publicId,
        signaturePresent: Boolean(sig.signature),
        allowedFormats: sig.allowedFormats,
      });
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", sig.apiKey);
      body.append("timestamp", String(sig.timestamp));
      body.append("folder", sig.folder);
      body.append("public_id", sig.publicId);
      body.append("signature", sig.signature);
      body.append("allowed_formats", sig.allowedFormats);
      // Stage B — POST straight to Cloudinary. Log the request metadata
      // (never the signature), then ALWAYS read the response body so a 4xx
      // shows the real Cloudinary message (Invalid Signature, unknown
      // parameter, file too large, bad api key…) instead of a generic toast.
      console.log("[ProfileUpload] Starting Cloudinary upload", {
        endpoint: `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        fileSize: file.size,
        fileType: file.type,
        publicId: sig.publicId,
        folder: sig.folder,
        timestamp: sig.timestamp,
      });
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: "POST",
        body,
      });
      const responseText = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        // body was not JSON — keep parsed null
      }
      if (!res.ok) {
        const errBody = (parsed ?? {}) as { error?: { message?: string } };
        const cloudMsg = errBody?.error?.message ?? null;
        console.error("[ProfileUpload] Cloudinary response", {
          status: res.status,
          ok: res.ok,
          errorMessage: cloudMsg,
          body: responseText,
        });
        // Surface Cloudinary's own (safe) error message in the toast — e.g.
        // "Invalid Signature", "File too large", "Unknown parameter" — so the
        // real cause is visible without opening DevTools. Cloudinary error
        // messages never contain account secrets.
        toast.error(
          cloudMsg
            ? `${t("profile.imageUploadFailed")} (${res.status}: ${cloudMsg})`
            : `${t("profile.imageUploadFailed")} (HTTP ${res.status})`,
        );
        onPreview(null);
        URL.revokeObjectURL(preview);
        return;
      }
      const uploaded = (parsed ?? {}) as {
        public_id: string;
        format: string;
        bytes: number;
        width?: number;
        height?: number;
      };
      if (!uploaded.public_id) {
        console.error("[ProfileUpload] Cloudinary 200 response without public_id", {
          status: res.status,
          body: responseText,
        });
        toast.error(t("profile.imageUploadFailed"));
        onPreview(null);
        URL.revokeObjectURL(preview);
        return;
      }
      console.log("[ProfileUpload] Cloudinary upload successful", {
        publicId: uploaded.public_id,
        format: uploaded.format,
        bytes: uploaded.bytes,
      });
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
      // Stage C — persist the canonical URL on the profile row. A failure
      // here is a DIFFERENT error from a Cloudinary failure: the file is
      // already uploaded, only the DB row failed.
      try {
        console.log("[ProfileUpload] Saving profile image", {
          kind,
          publicId: uploaded.public_id,
          format: uploaded.format,
          bytes: uploaded.bytes,
        });
        const profile = (await saveImage(imageArgs)) as unknown as {
          avatarUrl: string | null;
          coverUrl: string | null;
        };
        console.log("[ProfileUpload] Profile image saved successfully");
        onUploaded(kind === "cover" ? profile.coverUrl ?? "" : profile.avatarUrl ?? "");
        // Let React swap the preview <img> to the canonical URL first,
        // then release the blob (no leaked object URLs).
        requestAnimationFrame(() => URL.revokeObjectURL(preview));
      } catch (err) {
        console.error("Profile image save error (backend stage):", err);
        // The backend throws a user-friendly AppError message for this
        // stage (e.g. “อัปโหลดรูปสำเร็จ แต่ไม่สามารถบันทึกโปรไฟล์ได้…”) —
        // surface it instead of a generic fallback.
        toast.error(err instanceof Error && err.message ? err.message : t("profile.imageSaveFailed"));
        onPreview(null);
        URL.revokeObjectURL(preview);
      }
    } catch (err) {
      // Stage A/B network error (fetch never completed, CORS, Convex call
      // rejected, …) — distinct from a Cloudinary HTTP error above.
      console.error("Profile image upload error (signature/network stage):", err);
      const msg = err instanceof Error && err.message ? err.message : "";
      // Backend errors (AppError) carry a user-friendly Thai message — show
      // it. Pure browser network failures (e.g. CORS surfaces as "Failed to
      // fetch") mean nothing to the user, so keep the generic toast there.
      toast.error(msg && msg !== "Failed to fetch" ? msg : t("profile.imageUploadFailed"));
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
