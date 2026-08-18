/**
 * ImageUploadButton — Reusable image upload component with debug panel.
 *
 * Handles file selection, preview, progress, error display, and debug info.
 * All uploads go server-side via Convex action → Cloudinary SDK.
 */

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useImageUpload } from "@/hooks/use-image-upload";
import type { UploadType, UploadResult } from "@/lib/upload";

interface ImageUploadButtonProps {
  /** Which image is being uploaded (profile, cover, logo, banner) */
  uploadType: UploadType;
  /** Current image URL (for preview) */
  currentUrl?: string | null;
  /** Callback when upload succeeds with the new URL */
  onUploaded: (url: string) => void;
  /** Button label */
  label?: string;
  /** Optional CSS class for the button */
  className?: string;
  /** Aspect ratio hint for preview (e.g. "aspect-square" or "aspect-video") */
  aspectClass?: string;
}

export function ImageUploadButton({
  uploadType,
  currentUrl,
  onUploaded,
  label = "Upload image",
  className = "",
  aspectClass = "aspect-square",
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, result, progress, reset } = useImageUpload();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Local preview
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      const res: UploadResult = await upload(file, uploadType);

      if (res.success && res.url) {
        onUploaded(res.url);
        // Clear local preview after a short delay (Cloudinary URL will load)
        setTimeout(() => setPreviewUrl(null), 2000);
      }

      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [upload, uploadType, onUploaded],
  );

  const displayUrl = previewUrl ?? currentUrl ?? null;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Preview */}
      {displayUrl && (
        <div
          className={`relative overflow-hidden rounded-xl border border-border/60 bg-muted ${aspectClass}`}
        >
          <img
            src={displayUrl}
            alt={`${uploadType} preview`}
            className="size-full object-cover"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="size-6 animate-spin text-lime-300" />
            </div>
          )}
        </div>
      )}

      {/* Upload button */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Camera className="mr-1.5 size-3.5" />
          )}
          {uploading ? progress || "Uploading…" : label}
        </Button>
        {result?.success && (
          <span className="flex items-center gap-1 text-xs text-lime-300">
            <CheckCircle2 className="size-3.5" /> Done
          </span>
        )}
        {result && !result.success && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="size-3.5" /> {result.error}
          </span>
        )}
      </div>

      {/* Debug panel (temporary) */}
      {result?.debug && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="w-fit cursor-pointer text-[10px] text-muted-foreground underline"
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? "Hide debug" : "Show debug"}
          </button>
          {showDebug && (
            <pre className="max-h-48 overflow-auto rounded-lg border border-border/60 bg-card p-3 text-[10px] leading-relaxed text-muted-foreground">
              {JSON.stringify(result.debug, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
