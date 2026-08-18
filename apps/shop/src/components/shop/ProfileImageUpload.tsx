import { useLanguage } from "@/lib/i18n";
import { api } from "@convex/_generated/api";
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches the backend signed-upload limit (backend/storage.ts MAX_IMAGE_BYTES)
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
 * Flow: pick a file → client-side validation (MIME type + size, max 10 MB) →
 * instant preview → ask the backend for a Cloudinary signed upload permit →
 * POST the file straight to Cloudinary (no binary through our server) → tell
 * the backend to persist the canonical URL. Reuses the exact same storage
 * provider as product images — no new image system.
 *
 * Failure handling is stage-specific so the real cause never hides behind a
 * generic “upload failed” toast: Cloudinary errors log the HTTP status AND
 * the JSON error body (invalid signature / bad params / file too large…),
 * while a failure to persist the profile row after a successful Cloudinary
 * upload shows its own message (spec: don't mix the two errors).
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
		// Client-side validation first — never send a bad file (type + size).
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
			// Stage 1 — the backend issues a Cloudinary signed upload permit.
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
			// Stage 2 — POST straight to Cloudinary. On failure read the JSON
			// error body so the REAL reason (invalid signature, file too large,
			// bad params…) is logged instead of a generic message.
			const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
				method: "POST",
				body,
			});
			if (!res.ok) {
				let detail = "(no response body)";
				try {
					const errBody = (await res.json()) as { error?: { message?: string } };
					detail = errBody?.error?.message ?? JSON.stringify(errBody);
				} catch {
					// body was not JSON — keep the default detail
				}
				console.error(`Cloudinary upload failed (HTTP ${res.status}):`, detail);
				toast.error(t("profile.imageUploadFailed"));
				onPreview(null);
				URL.revokeObjectURL(preview);
				return;
			}
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
			// Stage 3 — persist the canonical URL on the profile row. A failure
			// here is a DIFFERENT error from a Cloudinary failure (spec §46).
			try {
				const profile = (await saveImage(imageArgs)) as unknown as {
					avatarUrl: string | null;
					coverUrl: string | null;
				};
				onUploaded(kind === "cover" ? profile.coverUrl ?? "" : profile.avatarUrl ?? "");
				// Let React swap the preview <img> to the canonical URL first,
				// then release the blob (spec §55: no leaked object URLs).
				requestAnimationFrame(() => URL.revokeObjectURL(preview));
			} catch (err) {
				console.error("Profile image save error (backend stage):", err);
				toast.error(t("profile.imageSaveFailed"));
				onPreview(null);
				URL.revokeObjectURL(preview);
			}
		} catch (err) {
			console.error("Profile image upload error (signature/Cloudinary stage):", err);
			toast.error(t("profile.imageUploadFailed"));
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
