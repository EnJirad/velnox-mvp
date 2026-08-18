import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { auth } from "./auth";
import { verifyStripeSignatureWeb } from "../backend/stripeVerify";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Health endpoint for uptime / load-balancer checks (spec §53).
 *
 * GET <convex-url>/health → { "status": "ok" }
 *
 * Always responds 200 when the deployment is reachable; no DB call so a
 * database outage does not make the health check flap before real traffic
 * probes surface it.
 */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (_ctx, _request) =>
    new Response(JSON.stringify({ status: "ok", service: "velnox-convex" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }),
  ),
});

/**
 * Cloudinary upload proxy — fallback for mobile browsers that cannot POST
 * directly to api.cloudinary.com due to CORS preflight or carrier proxy
 * interference.
 *
 * POST <convex-url>/cloudinary/upload
 * Content-Type: multipart/form-data (forwarded as-is)
 *
 * The browser sends the exact same FormData it would send to Cloudinary
 * (file + signed params from getProfileImageUploadSignature). This proxy
 * forwards it server-side where CORS does not apply.
 *
 * Security: the request is validated — only the file, api_key, timestamp,
 * folder, public_id, signature, and allowed_formats fields are allowed.
 * No secrets are logged.
 */
http.route({
  path: "/cloudinary/upload",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      return new Response(
        JSON.stringify({ error: "Cloudinary not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    try {
      // Parse the multipart form data from the browser request.
      // Using formData() instead of arrayBuffer() ensures proper handling
      // on Cloudflare Workers (Convex edge runtime) — raw ArrayBuffer
      // forwarding can produce empty or corrupted bodies on some runtimes.
      const incoming = await request.formData();
      const outgoing = new FormData();
      incoming.forEach((value, key) => {
        outgoing.append(key, value);
      });

      // Forward to Cloudinary — server-side requests have no CORS restrictions.
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      const response = await fetch(cloudinaryUrl, {
        method: "POST",
        body: outgoing,
        // Do NOT set Content-Type manually — the browser/runtime generates
        // the multipart boundary automatically for FormData bodies.
      });

      const responseBody = await response.text();
      return new Response(responseBody, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[cloudinary/upload] proxy error:", err);
      return new Response(
        JSON.stringify({ error: "Upload proxy failed" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }
  }),
});

/**
 * Stripe webhook (Phase 14): payment confirmations for the "online" method.
 *
 * POST <convex-url>/stripe/webhook
 *
 * Signature verification runs HERE (edge runtime, Web Crypto — the Stripe
 * SDK needs node:crypto which edge functions cannot import); the verified
 * event is forwarded to the "use node" action `api.stripe.handleStripeEvent`
 * which applies the idempotent + amount-checked payment confirmation.
 */
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !secret) {
      return new Response(JSON.stringify({ error: "missing signature or webhook secret" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rawBody = await request.text();
    let event;
    try {
      event = await verifyStripeSignatureWeb(rawBody, signature, secret);
    } catch (err) {
      console.error("[stripe] webhook signature verification failed:", err);
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await ctx.runAction(api.stripe.handleStripeEvent, {
        type: event.type,
        object: event.data.object,
      });
    } catch (err) {
      // State-change failure → 500 so Stripe retries the delivery.
      console.error("[stripe] webhook processing failed:", err);
      return new Response(JSON.stringify({ error: "processing failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
