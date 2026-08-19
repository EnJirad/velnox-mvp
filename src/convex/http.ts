import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { uploadProfileImage } from "./upload";

const http = httpRouter();

auth.addHttpRoutes(http);

// ── Server-side image upload ─────────────────────────────────────────
// The browser sends the file here; this handler uploads to Cloudinary
// using the official SDK. No Cloudinary credentials are ever exposed
// to the client.
http.route({
  path: "/upload/image",
  method: "POST",
  handler: uploadProfileImage,
});

export default http;
