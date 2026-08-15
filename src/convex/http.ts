import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

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

export default http;
