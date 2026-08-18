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

      // Stage B — POST straight to Cloudinary.
      // ==========================================
      // DIAGNOSTIC: Full URL + FormData + network diagnostics
      // ==========================================
      failStage = 5;
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;

      // Log the parsed URL components
      let urlInfo: Record<string, string> = {};
      try {
        const urlObj = new URL(cloudinaryUrl);
        urlInfo = {
          full: cloudinaryUrl,
          protocol: urlObj.protocol,
          hostname: urlObj.hostname,
          pathname: urlObj.pathname,
          cloudName: sig.cloudName,
        };
      } catch {
        urlInfo = { full: cloudinaryUrl, parseError: "URL constructor failed" };
      }
      console.log("[ProfileUpload] STEP 5 — Cloudinary URL", urlInfo);

      // Log FormData entries (file name + size, key names, no secrets)
      const formEntries: string[] = [];
      body.forEach((val, key) => {
        if (val instanceof File) {
          formEntries.push(`${key}: (File: ${val.name}, ${val.size} bytes)`);
        } else {
          formEntries.push(`${key}: (string, ${String(val).length} chars)`);
        }
      });
      console.log("[ProfileUpload] STEP 5 — FormData entries", formEntries);

      // Verify no manual Content-Type header is set (critical for FormData)
      console.log("[ProfileUpload] STEP 5 — Request config", {
        method: "POST",
        bodyType: body.constructor.name,
        hasManualContentType: false, // We intentionally do NOT set Content-Type
        browserWillSetContentType: true, // Browser auto-sets multipart/form-data + boundary
      });

      // ==========================================
      // ACTUAL UPLOAD: fetch to Cloudinary (with timeout + retry)
      // The real upload POST IS the connectivity test — no separate precheck.
      // A HEAD/OPTIONS precheck on the upload endpoint fails due to CORS
      // preflight (browser blocks it before any HTTP response), while the
      // actual POST works because Cloudinary returns proper CORS headers
      // for POST with FormData. Direct browser navigation to api.cloudinary.com
      // works (returns 403) because navigation is not subject to CORS.
      // ==========================================
      stepLog(5, "Starting Cloudinary upload", {
        cloudinaryUrl,
        method: "POST",
        hasManualContentType: false,
        fileSize: file.size,
        fileType: file.type,
        publicId: sig.publicId,
        folder: sig.folder,
        timestamp: sig.timestamp,
      });

      let attempt = 0;
      let res: Response | null = null;
      let lastFetchErr: unknown = null;

      while (attempt <= MAX_RETRIES) {
        attempt++;
        const tFetchStart = performance.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
        try {
          console.log(`[ProfileUpload] STEP 5 — Fetch attempt ${attempt}/${MAX_RETRIES + 1}`);
          res = await fetch(cloudinaryUrl, {
            method: "POST",
            body,
            signal: controller.signal,
            // IMPORTANT: Do NOT set Content-Type manually.
            // The browser MUST set "multipart/form-data; boundary=..." automatically.
            // IMPORTANT: Do NOT use mode: "no-cors" — it would hide the response.
          });
          const tFetchEnd = performance.now();
          clearTimeout(timer);
          console.log("[ProfileUpload] STEP 5 — Fetch completed", {
            attempt,
            status: res.status,
            ok: res.ok,
            statusText: res.statusText,
            type: res.type,
            url: res.url,
            redirected: res.redirected,
            ms: Math.round(tFetchEnd - tFetchStart),
          });
          // If we got a response (even HTTP error), Cloudinary is reachable.
          break;
        } catch (fetchErr) {
          const tFetchEnd = performance.now();
          clearTimeout(timer);
          lastFetchErr = fetchErr;
          const elapsed = Math.round(tFetchEnd - tFetchStart);
          console.error(`[ProfileUpload] STEP 5 — Fetch attempt ${attempt} FAILED`, {
            ms: elapsed,
            message: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
            name: fetchErr instanceof Error ? fetchErr.name : typeof fetchErr,
            aborted: controller.signal.aborted,
          });
          inspectError(fetchErr, `STEP 5 FETCH ATTEMPT ${attempt}`);

          if (controller.signal.aborted) {
            console.error("[ProfileUpload] STEP 5 — Fetch ABORTED (timeout)", {
              timeoutMs: UPLOAD_TIMEOUT_MS,
              elapsedMs: elapsed,
            });
          }

          if (attempt <= MAX_RETRIES) {
            console.log("[ProfileUpload] STEP 5 — Retrying in 1s...");
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      if (!res) {
        // All attempts failed — build diagnostic message
        const env = {
          origin: window.location.origin,
          online: navigator.onLine,
          protocol: window.location.protocol,
          target: urlInfo.hostname ?? "api.cloudinary.com",
          userAgent: navigator.userAgent.slice(0, 120),
          platform: navigator.platform,
        };
        const safeDetail = lastFetchErr instanceof Error
          ? `${lastFetchErr.message} | origin: ${env.origin} | online: ${env.online} | target: ${env.target}`
          : `Network error: ${String(lastFetchErr)} | origin: ${env.origin} | online: ${env.online}`;
        console.error("[ProfileUpload] STEP 5 — All fetch attempts failed", env);

        if (lastFetchErr instanceof TypeError) {
          console.error("[ProfileUpload] STEP 5 — TypeError diagnosis", {
            message: lastFetchErr.message,
            possibleCauses: [
              "1. Ad-blocker / browser extension blocking api.cloudinary.com",
              "2. CORS policy — Cloudinary upload endpoint not returning Access-Control-Allow-Origin",
              "3. Mobile carrier proxy or firewall blocking the POST",
              "4. Network interruption during upload",
              "5. Browser DevTools network throttling",
              "6. Service Worker intercepting the request",
              "NOTE: If https://api.cloudinary.com opens in the address bar, the server is reachable — the issue is CORS or request blocking at the browser level",
            ],
          });
        }

        fail(5, "profile.imageUploadFailed", safeDetail, lastFetchErr, preview);
        return;
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
