/**
 * useImageUpload — React hook that wraps Convex useAction for image upload.
 *
 * Handles: validation → compression → server action → result state.
 * The browser NEVER touches Cloudinary directly.
 */

import { useCallback, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { compressImage, validateFile } from "@/lib/upload";
import type { UploadResult, UploadType } from "@/lib/upload";

export function useImageUpload() {
  const uploadAction = useAction(api.upload.uploadImage);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [progress, setProgress] = useState<string>("");

  const upload = useCallback(
    async (file: File, uploadType: UploadType): Promise<UploadResult> => {
      setUploading(true);
      setResult(null);

      try {
        // Step 1: Validate
        setProgress("Validating file…");
        const validationError = validateFile(file);
        if (validationError) {
          const err: UploadResult = {
            success: false,
            error: validationError,
            code: "VALIDATION_ERROR",
          };
          setResult(err);
          return err;
        }

        // Step 2: Compress
        setProgress("Compressing image…");
        const dataUrl = await compressImage(file);

        // Step 3: Upload via server-side action
        setProgress("Uploading to server…");
        const response = await uploadAction({ dataUrl, uploadType });

        // The action returns { success, url, debug } on success,
        // or throws ConvexError on failure.
        const res = response as UploadResult;
        setResult(res);
        return res;
      } catch (error: unknown) {
        // ConvexError from the action — extract the message
        const err = error as { data?: string; message?: string };
        const uploadResult: UploadResult = {
          success: false,
          error: err.data ?? err.message ?? "Upload failed",
          code: "SERVER_ERROR",
        };
        setResult(uploadResult);
        return uploadResult;
      } finally {
        setUploading(false);
        setProgress("");
      }
    },
    [uploadAction],
  );

  const reset = useCallback(() => {
    setResult(null);
    setProgress("");
  }, []);

  return { upload, uploading, result, progress, reset };
}
