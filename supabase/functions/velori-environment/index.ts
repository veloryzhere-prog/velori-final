import { installManagementToken, managementKey, validateSetup } from "./setup.ts";
import { registerForgeManagement } from "./management.ts";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  type AdminEnv,
  ALLOWED_ORIGINS,
  requireAdmin,
  requirePermission,
  requireRecentReauth,
  readJson,
  service,
} from "../server/admin-core.ts";
import { safeMetadata, validateChange } from "./policy.ts";
const app = new Hono<AdminEnv>();
app.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  const origin = c.req.header("Origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin))
    return c.json({ error: "Origin is not allowed." }, 403);
  await next();
});
app.use(
  "*",
  cors({
    origin: (o) => (ALLOWED_ORIGINS.includes(o) ? o : ""),
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);
app.use("/admin/*", requireAdmin);
app.use("/admin/environment", requirePermission("security.edit"));
app.all("/admin/environment", async (c) => {
  const principal = c.get("admin");
  if (principal.roleKey !== "super_admin")
    return c.json({ error: "Super administrator access required." }, 403);
  const token = Deno.env.get("VELORI_ENVIRONMENT_MANAGEMENT_TOKEN") || "";
  const project = (Deno.env.get("SUPABASE_URL") || "").match(
    /^https:\/\/([a-z]{20})\.supabase\.co\/?$/,
  )?.[1];
  const ready = !!project && token.length >= 20;
  const target = `https://api.supabase.com/v1/projects/${project}/secrets`;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  if (c.req.method === "GET") {
    if (!ready) return c.json({ ready: false, setupRequired: true, entries: [] });
    try {
      const r = await fetch(target, {
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw Error();
      return c.json({ ready: true, entries: safeMetadata(await r.json()) });
    } catch {
      return c.json({ error: "Environment status is unavailable." }, 503);
    }
  }
  if (c.req.method !== "POST") return c.json({ error: "Method not allowed." }, 405);
  const blocked = await requireRecentReauth(c, 5);
  if (blocked) return blocked;
  const at = Date.parse(principal.session?.reauthenticated_at || "");
  if (!Number.isFinite(at) || Date.now() - at > 300000 || at > Date.now() + 1000)
    return c.json({ error: "Confirm your password.", code: "reauth_required" }, 428);
  const parsed = await readJson(c.req.raw);
  if (!parsed.ok) return c.json({ error: "Invalid request." }, 400);
  if (parsed.value.operation === "setup") {
    if (!project) return c.json({ error: "The server project could not be resolved." }, 503);
    if (ready)
      return c.json(
        {
          error:
            "Management is already installed. Rotate its root credential in the Supabase dashboard.",
        },
        409,
      );
    try {
      const candidate = validateSetup(parsed.value);
      const result = await installManagementToken(project, candidate, async (action) => {
        const audit = await service()
          .from("admin_audit_logs")
          .insert({
            admin_user_id: principal.user.id,
            action,
            target_type: "environment",
            target_id: managementKey,
            metadata: { operation: "setup" },
          });
        if (audit.error) throw Error("Audit unavailable. No change started.");
      });
      return c.json(result);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Setup could not be confirmed." },
        400,
      );
    }
  }
  if (!ready) return c.json({ error: "Complete protected management setup first." }, 503);
  let change;
  try {
    change = validateChange(parsed.value);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Invalid change." }, 400);
  }
  const audit = await service()
    .from("admin_audit_logs")
    .insert({
      admin_user_id: principal.user.id,
      action: `environment.${change.operation}.requested`,
      target_type: "environment",
      target_id: change.name,
      metadata: { operation: change.operation },
    });
  if (audit.error) return c.json({ error: "Audit unavailable. No change started." }, 503);
  try {
    const r = await fetch(target, {
      method: change.operation === "set" ? "POST" : "DELETE",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify(
        change.operation === "set" ? [{ name: change.name, value: change.value }] : [change.name],
      ),
    });
    await r.body?.cancel();
    if (!r.ok) throw Error();
    const confirmedAudit = await service()
      .from("admin_audit_logs")
      .insert({
        admin_user_id: principal.user.id,
        action: `environment.${change.operation}.confirmed`,
        target_type: "environment",
        target_id: change.name,
        metadata: { operation: change.operation },
      });
    return c.json({ saved: true, auditPending: !!confirmedAudit.error });
  } catch {
    return c.json({ error: "Change not confirmed. Refresh status before retrying." }, 503);
  }
});
registerForgeManagement(app);
app.all("*", (c) => c.json({ error: "Not found." }, 404));
Deno.serve((request) => {
  const u = new URL(request.url);
  if (u.pathname.startsWith("/velori-environment/")) u.pathname = u.pathname.slice(19);
  return app.fetch(new Request(u, request));
});
