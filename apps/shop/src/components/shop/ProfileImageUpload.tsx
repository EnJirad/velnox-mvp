import { useLanguage } from "@/lib/i18n";
import { api } from "@convex/_generated/api";
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches the backend re-validation limit (backend/storage.ts MAX_IMAGE_BYTES)

/** Upload timeout — 30 seconds. Mobile networks can be slow but anything
 *  beyond 30 s likely means a hung connection. */
const UPLOAD_TIMEOUT_MS = 30_000;

/** Number of automatic retries on network failure (1 = total 2 attempts). */
const MAX_RETRIES = 1;

/**
 * Convex HTTP proxy endpoint for Cloudinary uploads.
 * Used as a fallback when the browser cannot POST directly to
 * api.cloudinary.com (mobile CORS preflight failure, carrier proxy, etc.).
 */
function getProxyUploadUrl(): string {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!convexUrl) return "";
  return `${convexUrl}/cloudinary/upload`;
}

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

/** Step log — every stage of the upload pipeline is logged so a failure can
 *  be traced to the exact step in the browser console and correlated with the
 *  error ID shown in the UI. Only safe metadata is ever logged (never the
 *  signature value, never the API secret). */
function stepLog(step: number, label: string, extra?: Record<string, unknown>): void {
  console.log(`[ProfileUpload] STEP ${step} - ${label}`, extra ?? "");
}

/**
 * Full, safe inspection of whatever was thrown. Convex/transport errors are
 * not always `Error` instances, so log type/name/message/cause/stack plus the
 * enumerable keys and a JSON snapshot — without assuming the shape and without
 * logging secrets.
 */
function inspectError(err: unknown, context: string): void {
  const e = (err ?? {}) as { name?: unknown; message?: unknown; cause?: unknown; stack?: unknown };
  console.error(`[ProfileUpload] ERROR TYPE (${context}):`, typeof err);
  console.error(`[ProfileUpload] ERROR NAME (${context}):`, e?.name ?? null);
  console.error(`[ProfileUpload] ERROR MESSAGE (${context}):`, e?.message ?? null);
  console.error(`[ProfileUpload] ERROR CAUSE (${context}):`, e?.cause ?? null);
  console.error(`[ProfileUpload] ERROR STACK (${context}):`, e?.stack ?? null);
  try {
    console.error(`[ProfileUpload] ERROR KEYS (${context}):`, Object.keys(err as object));
    console.error(
      `[ProfileUpload] ERROR JSON (${context}):`,
      JSON.stringify(err, Object.getOwnPropertyNames(err as object)),
    );
  } catch {
    console.error(`[ProfileUpload] ERROR RAW (${context}):`, err);
  }
}

/** Unique id per failure — shown in the toast and logged, so a browser
 *  session can be correlated with server/Convex logs (e.g. PROFILE_UPLOAD_20260818_A1B2). */
function makeErrorId(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PROFILE_UPLOAD_${ymd}_${rand}`;
}

/**
 * VelShop profile image uploader (avatar + cover).
 *
 * Flow: pick a file → client-side validation (MIME type + size, max 10 MB) →
 * instant preview → ask the backend for a Cloudinary signed upload permit →
 * POST the file straight to Cloudinary with timeout + retry (no binary through
 * our server) → tell the backend to persist the canonical URL (old-image cleanup
 * runs server-side inside saveProfileImage, after the DB row uses the new image).
 *
 * Failure handling: every failure logs `FAILED AT STEP X` with a unique error
 * ID and full error inspection, and the toast ALWAYS shows the base message
 * plus any safe detail (the real Cloudinary/server error) plus the error ID —
 * the generic message is never the only thing the user sees during debugging.
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

  /** Terminal failure: log FAILED AT STEP + error id + full error inspection,
   *  then toast the base message + safe detail + error id. */
  const fail = (step: number, baseKey: string, detail: string | null, err?: unknown, preview?: string) => {
    const errorId = makeErrorId();
    console.error(`[ProfileUpload] FAILED AT STEP ${step}`, { errorId, detail });
    if (err !== undefined) inspectError(err, `FAILED AT STEP ${step}`);
    toast.error(
      <div className="flex flex-col gap-1 text-left">
        <span>{t(baseKey)}</span>
        {detail ? <span className="text-xs opacity-80">{detail}</span> : null}
        <span className="text-xs opacity-60">
          {t("profile.errorIdLabel")}: {errorId}
        </span>
      </div>,
    );
    if (preview !== undefined) {
      onPreview(null);
      URL.revokeObjectURL(preview);
    }
  };

  const handleFile = async (file: File) => {
    stepLog(1, "Started", { kind, fileName: file.name, fileSize: file.size, fileType: file.type });
    // Stage E — client-side validation first (type + size). Never send a bad
    // file: checked here, re-checked by the server, and (formats) by Cloudinary.
    if (!ACCEPTED_TYPES.includes(file.type)) {
      console.error("[ProfileUpload] FAILED AT STEP 2 (type rejected)", { fileType: file.type });
      toast.error(t("profile.imageTypeError"));
      resetInput();
      return;
    }
    if (file.size > MAX_BYTES) {
      console.error("[ProfileUpload] FAILED AT STEP 2 (size rejected)", { fileSize: file.size, maxBytes: MAX_BYTES });
      toast.error(t("profile.imageSizeError"));
      resetInput();
      return;
    }
    stepLog(2, "File validated", { fileSize: file.size, fileType: file.type });
    const preview = URL.createObjectURL(file);
    onPreview(preview);
    setUploading(true);
    let failStage = 0;
    try {
      // Stage A — the backend issues a Cloudinary signed upload permit.
      failStage = 3;
      stepLog(3, "Requesting signature", { kind });
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
        fail(
          4,
          "profile.imageSignatureError",
          "Backend returned an incomplete upload permit",
          undefined,
          preview,
        );
        return;
      }
      stepLog(4, "Signature received", {
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

      // Stage B — POST to Cloudinary (direct first, proxy fallback on mobile failure).
      // ==========================================
      failStage = 5;
      const directCloudinaryUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;
      const proxyUrl = getProxyUploadUrl();

      console.log("[ProfileUpload] STEP 5 — Upload targets", {
        direct: directCloudinaryUrl,
        proxy: proxyUrl || "(not configured)",
        fileSize: file.size,
        fileType: file.type,
      });

      // ==========================================
      // UPLOAD: direct to Cloudinary, fallback to proxy on mobile failure
      // ==========================================
      stepLog(5, "Starting Cloudinary upload", {
        directUrl: directCloudinaryUrl,
        proxyUrl: proxyUrl || "(not configured)",
        fileSize: file.size,
        fileType: file.type,
        publicId: sig.publicId,
        folder: sig.folder,
      });

      let res: Response | null = null;
      let lastFetchErr: unknown = null;
      let usedProxy = false;

      // Helper: attempt a single fetch to a given URL
      async function attemptFetch(url: string, label: string): Promise<Response> {
        const tFetchStart = performance.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
        try {
          console.log(`[ProfileUpload] STEP 5 — ${label} → ${url}`);
          const r = await fetch(url, {
            method: "POST",
            body,
            signal: controller.signal,
          });
          const ms = Math.round(performance.now() - tFetchStart);
          clearTimeout(timer);
          console.log(`[ProfileUpload] STEP 5 — ${label} completed`, {
            status: r.status,
            ok: r.ok,
            ms,
          });
          return r;
        } catch (err) {
          const ms = Math.round(performance.now() - tFetchStart);
          clearTimeout(timer);
          console.error(`[ProfileUpload] STEP 5 — ${label} FAILED`, {
            ms,
            message: err instanceof Error ? err.message : String(err),
            name: err instanceof Error ? err.name : typeof err,
          });
          inspectError(err, `STEP 5 ${label}`);
          throw err;
        }
      }

      // 1) Try direct upload first (works on desktop)
      try {
        res = await attemptFetch(directCloudinaryUrl, "direct upload");
      } catch (directErr) {
        lastFetchErr = directErr;
        console.log("[ProfileUpload] STEP 5 — Direct upload failed, trying proxy fallback...", {
          proxyUrl: proxyUrl || "(not configured)",
        });

        // 2) Fallback: Convex proxy (bypasses browser CORS entirely)
        if (proxyUrl) {
          try {
            res = await attemptFetch(proxyUrl, "proxy upload");
            usedProxy = true;
          } catch (proxyErr) {
            lastFetchErr = proxyErr;
            console.error("[ProfileUpload] STEP 5 — Proxy upload also failed", {
              message: proxyErr instanceof Error ? proxyErr.message : String(proxyErr),
            });
          }
        }
      }

      if (!res) {
        // Both direct and proxy failed
        const env = {
          origin: window.location.origin,
          online: navigator.onLine,
          target: directCloudinaryUrl.replace(/\/v1_1\/.*/, "/..."),
          proxy: proxyUrl || "(not configured)",
        };
        const safeDetail = lastFetchErr instanceof Error
          ? `${lastFetchErr.message} | origin: ${env.origin} | online: ${env.online}`
          : `Network error: ${String(lastFetchErr)} | origin: ${env.origin}`;
        console.error("[ProfileUpload] STEP 5 — All upload attempts failed", env);
        fail(5, "profile.imageUploadFailed", safeDetail, lastFetchErr, preview);
        return;
      }

      if (usedProxy) {
        console.log("[ProfileUpload] STEP 5 — Upload succeeded via proxy");
      }

      failStage = 6;
      stepLog(6, "Cloudinary response received", { status: res.status, ok: res.ok });
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
        fail(
          6,
          "profile.imageUploadFailed",
          cloudMsg ? `Cloudinary ${res.status}: ${cloudMsg}` : `Cloudinary HTTP ${res.status}`,
          undefined,
          preview,
        );
        return;
      }
      const uploaded = (parsed ?? {}) as {
        public_id: string;
        format: string;
        bytes: number;
        width?: number;
        height?: number;
      };
      stepLog(7, "Cloudinary parsed", {
        publicId: uploaded?.public_id ?? null,
        format: uploaded?.format ?? null,
        bytes: uploaded?.bytes ?? null,
      });
      if (!uploaded.public_id) {
        console.error("[ProfileUpload] Cloudinary 200 response without public_id", {
          status: res.status,
          body: responseText,
        });
        fail(7, "profile.imageUploadFailed", "Cloudinary 200 response missing public_id", undefined, preview);
        return;
      }
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
      // Stage C — persist the canonical URL on the profile row. A failure here
      // is a DIFFERENT error from a Cloudinary failure: the file is already
      // uploaded, only the DB row failed.
      failStage = 8;
      stepLog(8, "Saving profile", {
        kind,
        publicId: uploaded.public_id,
        format: uploaded.format,
        bytes: uploaded.bytes,
      });
      const profile = (await saveImage(imageArgs)) as unknown as {
        avatarUrl: string | null;
        coverUrl: string | null;
      };
      failStage = 9;
      stepLog(9, "Profile saved", {
        kind,
        avatarUrl: profile?.avatarUrl ?? null,
        coverUrl: profile?.coverUrl ?? null,
      });
      onUploaded(kind === "cover" ? profile.coverUrl ?? "" : profile.avatarUrl ?? "");
      // Old-image cleanup runs server-side inside saveProfileImage, after the
      // DB row uses the new image (§31/§38 order: upload → save → delete old).
      stepLog(10, "Cleanup old image (server-side, inside saveProfileImage)");
      console.log("[ProfileUpload] SUCCESS");
      // Let React swap the preview <img> to the canonical URL first, then
      // release the blob (no leaked object URLs).
      requestAnimationFrame(() => URL.revokeObjectURL(preview));
    } catch (err) {
      // Stage A/B/C — any unexpected throw (Convex transport error, network
      // failure, CORS "Failed to fetch", response parsing, …). Show the actual
      // safe error — never a generic-only message.
      fail(
        failStage || 3,
        "profile.imageUploadFailed",
        err instanceof Error && err.message ? err.message : `Unexpected error: ${typeof err}`,
        err,
        preview,
      );
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
