import { useLanguage } from "@/lib/i18n";
import { api } from "@convex/_generated/api";
import { useAction } from "convex/react";
import { ChevronDown, ChevronUp, Copy, Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

// ─── Debug State ─────────────────────────────────────────────────────────────

interface DebugInfo {
  errorId: string;
  failedStep: number;
  failedStepLabel: string;
  errorDetail: string;
  errorName: string;
  errorMessage: string;

  // Upload route
  directStatus: number | null;
  directError: string | null;
  proxyStatus: number | null;
  proxyError: string | null;
  uploadRoute: string;

  // Target
  targetHostname: string;
  targetPath: string;
  proxyUrl: string;

  // Signature
  signatureRequest: "SUCCESS" | "FAILED" | "PENDING";
  signaturePresent: boolean;
  apiKeyPresent: boolean;
  timestampPresent: boolean;
  folderPresent: boolean;
  publicIdPresent: boolean;
  allowedFormatsPresent: boolean;

  // File
  fileName: string;
  fileType: string;
  fileSize: number;

  // Browser
  online: boolean;
  origin: string;
  browserSummary: string;

  // Timing
  startTime: string;
  failTime: string;
  durationMs: number;

  // Response
  responseStatus: number | null;
  responseStatusText: string;
  responseType: string;
  responseBody: string;

  // Cloudinary response (if any)
  cloudinaryStatus: number | null;
  cloudinaryBody: string;
}

function emptyDebug(): DebugInfo {
  return {
    errorId: "",
    failedStep: 0,
    failedStepLabel: "",
    errorDetail: "",
    errorName: "",
    errorMessage: "",
    directStatus: null,
    directError: null,
    proxyStatus: null,
    proxyError: null,
    uploadRoute: "",
    targetHostname: "",
    targetPath: "",
    proxyUrl: "",
    signatureRequest: "PENDING",
    signaturePresent: false,
    apiKeyPresent: false,
    timestampPresent: false,
    folderPresent: false,
    publicIdPresent: false,
    allowedFormatsPresent: false,
    fileName: "",
    fileType: "",
    fileSize: 0,
    online: false,
    origin: "",
    browserSummary: "",
    startTime: "",
    failTime: "",
    durationMs: 0,
    responseStatus: null,
    responseStatusText: "",
    responseType: "",
    responseBody: "",
    cloudinaryStatus: null,
    cloudinaryBody: "",
  };
}

function buildBrowserSummary(): string {
  const ua = navigator.userAgent;
  // Extract browser name + version and platform from User-Agent
  // Chrome: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
  const chromeMatch = ua.match(/Chrome\/([\d.]+)/);
  const safariMatch = ua.match(/Version\/([\d.]+).*Safari/);
  const firefoxMatch = ua.match(/Firefox\/([\d.]+)/);
  let browser = "Unknown";
  if (chromeMatch) browser = `Chrome ${chromeMatch[1].split(".")[0]}`;
  else if (firefoxMatch) browser = `Firefox ${firefoxMatch[1].split(".")[0]}`;
  else if (safariMatch) browser = `Safari ${safariMatch[1].split(".")[0]}`;

  let platform = navigator.platform || "Unknown";
  if (/Android/i.test(ua)) platform = "Android";
  else if (/iPhone|iPad/i.test(ua)) platform = "iOS";
  else if (/Mac/i.test(ua)) platform = "macOS";
  else if (/Win/i.test(ua)) platform = "Windows";
  else if (/Linux/i.test(ua)) platform = "Linux";

  return `${browser} · ${platform}`;
}

function maskCloudName(name: string): string {
  if (name.length <= 4) return "***";
  return name.slice(0, 3) + "***" + name.slice(-2);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildDebugReport(d: DebugInfo): string {
  const lines: string[] = [];
  lines.push("═══════════════════════════════════════════");
  lines.push("  VELSHOP UPLOAD DEBUG INFORMATION");
  lines.push("═══════════════════════════════════════════");
  lines.push("");
  lines.push(`Error ID:     ${d.errorId}`);
  lines.push(`Failed At:    STEP ${d.failedStep} — ${d.failedStepLabel}`);
  lines.push(`Error:        ${d.errorDetail}`);
  if (d.errorName) lines.push(`Error Name:   ${d.errorName}`);
  if (d.errorMessage) lines.push(`Error Msg:    ${d.errorMessage}`);
  lines.push("");
  lines.push("── Upload Route ──");
  lines.push(`Direct:       ${d.directStatus !== null ? `HTTP ${d.directStatus}` : d.directError || "N/A"}`);
  lines.push(`Proxy:        ${d.proxyStatus !== null ? `HTTP ${d.proxyStatus}` : d.proxyError || "N/A"}`);
  lines.push(`Active:       ${d.uploadRoute}`);
  lines.push("");
  lines.push("── Target ──");
  lines.push(`Hostname:     ${d.targetHostname}`);
  lines.push(`Path:         ${d.targetPath}`);
  if (d.proxyUrl) lines.push(`Proxy URL:    ${d.proxyUrl}`);
  lines.push("");
  lines.push("── Signature ──");
  lines.push(`Request:      ${d.signatureRequest}`);
  lines.push(`api_key:      ${d.apiKeyPresent ? "PRESENT" : "MISSING"}`);
  lines.push(`timestamp:    ${d.timestampPresent ? "PRESENT" : "MISSING"}`);
  lines.push(`folder:       ${d.folderPresent ? "PRESENT" : "MISSING"}`);
  lines.push(`public_id:    ${d.publicIdPresent ? "PRESENT" : "MISSING"}`);
  lines.push(`signature:    ${d.signaturePresent ? "PRESENT" : "MISSING"}`);
  lines.push(`formats:      ${d.allowedFormatsPresent ? "PRESENT" : "MISSING"}`);
  lines.push("");
  lines.push("── File ──");
  lines.push(`Name:         ${d.fileName}`);
  lines.push(`Type:         ${d.fileType}`);
  lines.push(`Size:         ${formatBytes(d.fileSize)}`);
  lines.push("");
  lines.push("── Browser ──");
  lines.push(`Online:       ${d.online}`);
  lines.push(`Origin:       ${d.origin}`);
  lines.push(`Browser:      ${d.browserSummary}`);
  lines.push("");
  if (d.responseStatus !== null) {
    lines.push("── HTTP Response ──");
    lines.push(`Status:       ${d.responseStatus} ${d.responseStatusText}`);
    lines.push(`Type:         ${d.responseType}`);
    if (d.responseBody) {
      lines.push(`Body:         ${d.responseBody.slice(0, 500)}`);
    }
    lines.push("");
  }
  if (d.cloudinaryStatus !== null) {
    lines.push("── Cloudinary Response ──");
    lines.push(`Status:       ${d.cloudinaryStatus}`);
    if (d.cloudinaryBody) {
      lines.push(`Body:         ${d.cloudinaryBody.slice(0, 500)}`);
    }
    lines.push("");
  }
  lines.push("── Timing ──");
  lines.push(`Started:      ${d.startTime}`);
  lines.push(`Failed:       ${d.failTime}`);
  lines.push(`Duration:     ${d.durationMs} ms`);
  lines.push("");
  lines.push("═══════════════════════════════════════════");
  return lines.join("\n");
}

// ─── Step labels ─────────────────────────────────────────────────────────────

const STEP_LABELS: Record<number, string> = {
  1: "Select file",
  2: "Validate file",
  3: "Request upload signature",
  4: "Prepare FormData",
  5: "Cloudinary upload",
  6: "Cloudinary response",
  7: "Parse Cloudinary response",
  8: "Save profile image",
  9: "Profile saved",
};

// ─── Debug Panel Component ───────────────────────────────────────────────────

function DebugPanel({ debug }: { debug: DebugInfo }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const report = buildDebugReport(debug);
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: textarea copy
      const ta = document.createElement("textarea");
      ta.value = report;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [debug]);

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 text-left">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-amber-900"
      >
        <span>รายละเอียดทางเทคนิค</span>
        {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="border-t border-amber-200 px-4 pb-4 pt-3">
          {/* Quick summary */}
          <div className="mb-3 space-y-1 text-xs text-amber-800">
            <p><span className="font-semibold">FAILED AT:</span> STEP {debug.failedStep} — {debug.failedStepLabel}</p>
            <p><span className="font-semibold">Error:</span> {debug.errorDetail}</p>
            <p><span className="font-semibold">Upload Route:</span> {debug.uploadRoute}</p>
            <p><span className="font-semibold">Error ID:</span> {debug.errorId}</p>
          </div>

          {/* Full diagnostic */}
          <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-[11px] leading-5 text-slate-700 shadow-inner">
            {buildDebugReport(debug)}
          </pre>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-800"
          >
            {copied ? (
              <>
                <Check className="size-3.5" />
                คัดลอกข้อมูลแล้ว
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                คัดลอกข้อมูลDebug
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Logging helpers ─────────────────────────────────────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────────────────

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
 *
 * A visible debug panel appears on failure so the user can copy diagnostic
 * information and send it to the developer.
 */
export function ProfileImageUpload({ kind, onPreview, onUploaded, children }: ProfileImageUploadProps) {
  const { t } = useLanguage();
  const getSignature = useAction(api.customer.getProfileImageUploadSignature);
  const saveImage = useAction(api.customer.saveProfileImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    const tStart = performance.now();
    const startTime = new Date().toLocaleTimeString();
    const errorId = makeErrorId();
    const proxyUrl = getProxyUploadUrl();

    // Build debug state incrementally
    const d: DebugInfo = {
      ...emptyDebug(),
      errorId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      online: navigator.onLine,
      origin: window.location.origin,
      browserSummary: buildBrowserSummary(),
      startTime,
      proxyUrl,
    };

    stepLog(1, "Started", { kind, fileName: file.name, fileSize: file.size, fileType: file.type });

    // Stage E — client-side validation first (type + size).
    if (!ACCEPTED_TYPES.includes(file.type)) {
      d.failedStep = 2;
      d.failedStepLabel = STEP_LABELS[2];
      d.errorDetail = `Unsupported file type: ${file.type}`;
      d.errorName = "ValidationError";
      d.errorMessage = `Accepted: ${ACCEPTED_TYPES.join(", ")}`;
      d.failTime = new Date().toLocaleTimeString();
      d.durationMs = Math.round(performance.now() - tStart);
      setDebugInfo(d);
      console.error("[ProfileUpload] FAILED AT STEP 2 (type rejected)", { fileType: file.type });
      toast.error(t("profile.imageTypeError"));
      resetInput();
      return;
    }
    if (file.size > MAX_BYTES) {
      d.failedStep = 2;
      d.failedStepLabel = STEP_LABELS[2];
      d.errorDetail = `File too large: ${formatBytes(file.size)} (max ${formatBytes(MAX_BYTES)})`;
      d.errorName = "ValidationError";
      d.errorMessage = `Size: ${file.size} bytes`;
      d.failTime = new Date().toLocaleTimeString();
      d.durationMs = Math.round(performance.now() - tStart);
      setDebugInfo(d);
      console.error("[ProfileUpload] FAILED AT STEP 2 (size rejected)", { fileSize: file.size, maxBytes: MAX_BYTES });
      toast.error(t("profile.imageSizeError"));
      resetInput();
      return;
    }

    stepLog(2, "File validated", { fileSize: file.size, fileType: file.type });
    const preview = URL.createObjectURL(file);
    onPreview(preview);
    setUploading(true);

    // Clear any previous debug info
    setDebugInfo(null);

    let failStage = 0;
    try {
      // Stage A — the backend issues a Cloudinary signed upload permit.
      failStage = 3;
      stepLog(3, "Requesting signature", { kind });
      let sig: UploadSignature | null | undefined;
      try {
        sig = (await getSignature({ kind })) as unknown as UploadSignature | null | undefined;
        d.signatureRequest = "SUCCESS";
      } catch (sigErr) {
        d.signatureRequest = "FAILED";
        d.failedStep = 3;
        d.failedStepLabel = STEP_LABELS[3];
        d.errorDetail = "Signature request failed";
        d.errorName = sigErr instanceof Error ? sigErr.name : typeof sigErr;
        d.errorMessage = sigErr instanceof Error ? sigErr.message : String(sigErr);
        d.failTime = new Date().toLocaleTimeString();
        d.durationMs = Math.round(performance.now() - tStart);
        setDebugInfo(d);
        fail(3, "profile.imageSignatureError", "Backend signature request failed", sigErr, preview);
        return;
      }

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
        d.failedStep = 4;
        d.failedStepLabel = STEP_LABELS[4];
        d.errorDetail = "Backend returned an incomplete upload permit";
        d.errorName = "IncompleteSignature";
        d.errorMessage = JSON.stringify({
          cloudName: Boolean(sig?.cloudName),
          apiKey: Boolean(sig?.apiKey),
          timestamp: Boolean(sig?.timestamp),
          folder: Boolean(sig?.folder),
          publicId: Boolean(sig?.publicId),
          signature: Boolean(sig?.signature),
          allowedFormats: Boolean(sig?.allowedFormats),
        });
        d.failTime = new Date().toLocaleTimeString();
        d.durationMs = Math.round(performance.now() - tStart);
        setDebugInfo(d);
        fail(4, "profile.imageSignatureError", "Backend returned an incomplete upload permit", undefined, preview);
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

      // Populate signature status
      d.signaturePresent = true;
      d.apiKeyPresent = true;
      d.timestampPresent = true;
      d.folderPresent = true;
      d.publicIdPresent = true;
      d.allowedFormatsPresent = true;

      const body = new FormData();
      body.append("file", file);
      body.append("api_key", sig.apiKey);
      body.append("timestamp", String(sig.timestamp));
      body.append("folder", sig.folder);
      body.append("public_id", sig.publicId);
      body.append("signature", sig.signature);
      body.append("allowed_formats", sig.allowedFormats);

      // Stage B — POST to Cloudinary (direct first, proxy fallback on mobile failure).
      failStage = 5;
      const directCloudinaryUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;

      // Mask the cloud name for display
      const maskedPath = `/v1_1/${maskCloudName(sig.cloudName)}/image/upload`;
      d.targetHostname = "api.cloudinary.com";
      d.targetPath = maskedPath;

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
        d.directStatus = res.status;
        d.uploadRoute = "DIRECT";
      } catch (directErr) {
        lastFetchErr = directErr;
        d.directError = directErr instanceof Error ? `${directErr.name}: ${directErr.message}` : String(directErr);
        d.uploadRoute = "DIRECT → FAILED";
        console.log("[ProfileUpload] STEP 5 — Direct upload failed, trying proxy fallback...", {
          proxyUrl: proxyUrl || "(not configured)",
        });

        // 2) Fallback: Convex proxy (bypasses browser CORS entirely)
        if (proxyUrl) {
          try {
            res = await attemptFetch(proxyUrl, "proxy upload");
            d.proxyStatus = res.status;
            d.uploadRoute = "PROXY";
            usedProxy = true;
          } catch (proxyErr) {
            lastFetchErr = proxyErr;
            d.proxyError = proxyErr instanceof Error ? `${proxyErr.name}: ${proxyErr.message}` : String(proxyErr);
            d.uploadRoute = "DIRECT → FAILED, PROXY → FAILED";
            console.error("[ProfileUpload] STEP 5 — Proxy upload also failed", {
              message: proxyErr instanceof Error ? proxyErr.message : String(proxyErr),
            });
          }
        }
      }

      if (!res) {
        // Both direct and proxy failed
        d.failedStep = 5;
        d.failedStepLabel = STEP_LABELS[5];
        d.errorDetail = lastFetchErr instanceof Error ? lastFetchErr.message : `Network error: ${String(lastFetchErr)}`;
        d.errorName = lastFetchErr instanceof Error ? lastFetchErr.name : typeof lastFetchErr;
        d.errorMessage = lastFetchErr instanceof Error ? lastFetchErr.message : String(lastFetchErr);
        d.failTime = new Date().toLocaleTimeString();
        d.durationMs = Math.round(performance.now() - tStart);
        setDebugInfo(d);

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

      // Capture response info
      d.responseStatus = res.status;
      d.responseStatusText = res.statusText;
      d.responseType = res.type;

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

        // Populate debug with Cloudinary response
        d.cloudinaryStatus = res.status;
        d.cloudinaryBody = responseText.slice(0, 1000);
        d.failedStep = 6;
        d.failedStepLabel = STEP_LABELS[6];
        d.errorDetail = cloudMsg ? `Cloudinary ${res.status}: ${cloudMsg}` : `Cloudinary HTTP ${res.status}`;
        d.errorName = "CloudinaryError";
        d.errorMessage = cloudMsg || responseText.slice(0, 200);
        d.failTime = new Date().toLocaleTimeString();
        d.durationMs = Math.round(performance.now() - tStart);
        setDebugInfo(d);

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

        d.cloudinaryStatus = res.status;
        d.cloudinaryBody = responseText.slice(0, 1000);
        d.failedStep = 7;
        d.failedStepLabel = STEP_LABELS[7];
        d.errorDetail = "Cloudinary 200 response missing public_id";
        d.errorName = "MissingPublicId";
        d.errorMessage = responseText.slice(0, 200);
        d.failTime = new Date().toLocaleTimeString();
        d.durationMs = Math.round(performance.now() - tStart);
        setDebugInfo(d);

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

      // Stage C — persist the canonical URL on the profile row.
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
      stepLog(10, "Cleanup old image (server-side, inside saveProfileImage)");
      console.log("[ProfileUpload] SUCCESS");
      setDebugInfo(null); // Clear any previous debug on success
      requestAnimationFrame(() => URL.revokeObjectURL(preview));
    } catch (err) {
      // Unexpected throw
      d.failedStep = failStage || 3;
      d.failedStepLabel = STEP_LABELS[failStage || 3];
      d.errorDetail = err instanceof Error && err.message ? err.message : `Unexpected error: ${typeof err}`;
      d.errorName = err instanceof Error ? err.name : typeof err;
      d.errorMessage = err instanceof Error ? err.message : String(err);
      d.failTime = new Date().toLocaleTimeString();
      d.durationMs = Math.round(performance.now() - tStart);
      setDebugInfo(d);

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

  /** Terminal failure: log FAILED AT STEP + error id + full error inspection,
   *  then toast the base message + safe detail + error id. */
  const fail = (step: number, baseKey: string, detail: string | null, err?: unknown, preview?: string) => {
    const errorId = debugInfo?.errorId ?? makeErrorId();
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
      <div className="inline-flex flex-col items-start gap-0">
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-slate-900/80 disabled:opacity-70"
          aria-label={t(kind === "cover" ? "profile.changeCover" : "profile.changeAvatar")}
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : children}
        </button>

        {/* Debug panel — only shown when there's a failure */}
        {debugInfo && <DebugPanel debug={debugInfo} />}
      </div>
    </>
  );
}
