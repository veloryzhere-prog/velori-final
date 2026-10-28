import { integrationRegistry } from "./integrations.ts";
import { probeCandidate } from "./rotation.ts";
import type { Hono } from "hono";
import {
  type AdminEnv,
  readJson,
  requirePermission,
  requireRecentReauth,
  service,
} from "../server/admin-core.ts";
import { parseForgeConfig, readForgeConfig } from "./config.ts";
const env = (key: string) => Deno.env.get(key) || "";
const rotations = ["GEMINI_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
export function registerForgeManagement(app: Hono<AdminEnv>) {
  app.use("/admin/forge/*", requirePermission("security.edit"));
  app.all("/admin/forge/:area", async (c) => {
    const principal = c.get("admin");
    if (principal.roleKey !== "super_admin")
      return c.json({ error: "Super administrator access required." }, 403);
    const area = c.req.param("area"),
      managementToken = env("VELORI_ENVIRONMENT_MANAGEMENT_TOKEN");
    const project = env("SUPABASE_URL").match(/^https:\/\/([a-z]{20})\.supabase\.co\/?$/)?.[1];
    const ready = !!project && managementToken.length >= 20;
    const config = readForgeConfig(env);
    if (c.req.method === "GET") {
      if (area === "projects") {
        const page = Math.max(0, Math.min(1000, Number(c.req.query("page")) || 0));
        const r = await service()
          .from("velori_studio_projects")
          .select("id,title,user_id,created_at,updated_at", { count: "exact" })
          .order("updated_at", { ascending: false })
          .range(page * 20, page * 20 + 19);
        return r.error
          ? c.json({ error: "Project metadata could not be loaded." }, 503)
          : c.json({ items: r.data, total: r.count, page });
      }
      if (area === "configuration") {
        let draft = config;
        try {
          const raw = env("VELORI_CUSTOM_FORGE_CONFIG_DRAFT");
          if (raw) draft = parseForgeConfig(JSON.parse(raw));
        } catch {}
        return c.json({
          ready,
          active: config,
          integrations: integrationRegistry.map((i) => ({
            ...i,
            keys: i.keys.map((name) => ({ name, configured: !!env(name) })),
          })),
          draft,
          recurringAvailable: false,
          rotationKeys: rotations.map((name) => ({
            name,
            configured: !!env(name),
            previousAvailable: !!env("VELORI_PREVIOUS_" + name),
          })),
        });
      }
      return c.json({ error: "Not found." }, 404);
    }
    if (c.req.method !== "POST") return c.json({ error: "Method not allowed." }, 405);
    const reauth = await requireRecentReauth(c, 5);
    if (reauth) return reauth;
    const stamp = Date.parse(principal.session?.reauthenticated_at || "");
    if (!Number.isFinite(stamp) || Date.now() - stamp > 300000 || stamp > Date.now() + 1000)
      return c.json({ error: "Confirm your password.", code: "reauth_required" }, 428);
    const parsed = await readJson(c.req.raw);
    if (!parsed.ok) return c.json({ error: "Invalid request." }, 400);
    const body = parsed.value;
    const audit = async (action: string, target: string) => {
      const r = await service()
        .from("admin_audit_logs")
        .insert({
          admin_user_id: principal.user.id,
          action,
          target_type: "forge",
          target_id: target,
          metadata: { operation: action },
        });
      if (r.error) throw Error("Audit unavailable. No change started.");
    };
    try {
      if (area === "projects") {
        if (
          body.operation !== "revoke" ||
          typeof body.projectId !== "string" ||
          body.confirm !== body.projectId ||
          !/^[0-9a-f-]{36}$/i.test(body.projectId)
        )
          throw Error("Confirm the exact project ID to revoke its public links.");
        await audit("forge.project.links.revoke", body.projectId);
        const r = await service()
          .from("velori_studio_shares")
          .update({ revoked_at: new Date().toISOString() })
          .eq("project_id", body.projectId)
          .is("revoked_at", null);
        if (r.error) throw Error("Project links could not be revoked.");
        return c.json({ saved: true });
      }
      if (!ready) return c.json({ error: "Protected management-token setup is required." }, 503);
      const apply = async (values: { name: string; value: string }[]) => {
        const r = await fetch("https://api.supabase.com/v1/projects/" + project + "/secrets", {
          method: "POST",
          headers: {
            authorization: "Bearer " + managementToken,
            "content-type": "application/json",
          },
          redirect: "error",
          signal: AbortSignal.timeout(12000),
          body: JSON.stringify(values),
        });
        await r.body?.cancel();
        if (!r.ok)
          throw Error("The host did not confirm the change. Refresh status before retrying.");
      };
      if (area === "rotation") {
        if (
          typeof body.name !== "string" ||
          !rotations.includes(body.name) ||
          body.confirm !== body.name
        )
          throw Error("Confirm a supported credential name.");
        const name = body.name,
          value = body.operation === "rollback" ? env("VELORI_PREVIOUS_" + name) : body.value;
        if (typeof value !== "string") throw Error("Enter a candidate credential.");
        const message = await probeCandidate(name, value, env);
        if (body.operation === "test") return c.json({ verified: true, message });
        if (!["activate", "rollback"].includes(String(body.operation)))
          throw Error("Invalid rotation operation.");
        if (name === "STRIPE_WEBHOOK_SECRET" && body.webhookAcknowledged !== true)
          throw Error("Acknowledge that real webhook delivery must be checked.");
        await audit("forge.credential." + String(body.operation) + ".requested", name);
        const old = env(name);
        await apply([
          ...(name === "STRIPE_WEBHOOK_SECRET"
            ? [
                {
                  name: "VELORI_PREVIOUS_STRIPE_WEBHOOK_SECRET_UNTIL",
                  value: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
                },
              ]
            : []),
          ...(old ? [{ name: "VELORI_PREVIOUS_" + name, value: old }] : []),
          { name, value },
        ]);
        let auditPending = false;
        try {
          await audit("forge.credential." + String(body.operation) + ".confirmed", name);
        } catch {
          auditPending = true;
        }
        return c.json({
          saved: true,
          message:
            message +
            (auditPending ? " The value was saved, but final audit recording is pending." : ""),
        });
      }
      if (area === "configuration") {
        if (body.baseRevision !== config.revision)
          return c.json({ error: "Configuration changed. Reload before publishing." }, 409);
        const next = parseForgeConfig(body.config);
        if (!["draft", "publish"].includes(String(body.operation)))
          throw Error("Invalid configuration operation.");
        if (body.operation === "publish") {
          const key = env("STRIPE_SECRET_KEY");
          for (const p of next.plans.filter((p) => p.enabled)) {
            if (!key) throw Error("Configure Stripe before publishing an enabled plan.");
            const r = await fetch(
              "https://api.stripe.com/v1/prices/" + encodeURIComponent(p.priceId),
              {
                headers: { authorization: "Bearer " + key },
                redirect: "error",
                signal: AbortSignal.timeout(12000),
              },
            );
            if (!r.ok) {
              await r.body?.cancel();
              throw Error("A plan price could not be verified.");
            }
            const price = await r.json();
            if (
              !price.active ||
              price.type !== "one_time" ||
              price.currency !== p.currency ||
              price.unit_amount !== p.amount ||
              price.livemode !== (env("VELORI_STRIPE_LIVE") === "true")
            )
              throw Error("The plan cost, currency, mode or price type does not match Stripe.");
          }
          // Coupons remain drafts until the discounted order/settlement upgrade is installed.
          if (next.offers.some((o) => o.enabled))
            throw Error(
              "Coupon activation requires the commercial settlement upgrade. Keep offers as drafts.",
            );
        }
        next.revision = crypto.randomUUID();
        await audit("forge.configuration." + String(body.operation) + ".requested", next.revision);
        const values = [{ name: "VELORI_CUSTOM_FORGE_CONFIG_DRAFT", value: JSON.stringify(next) }];
        if (body.operation === "publish")
          values.push(
            { name: "VELORI_CUSTOM_FORGE_CONFIG_PREVIOUS", value: JSON.stringify(config) },
            { name: "VELORI_CUSTOM_FORGE_CONFIG", value: JSON.stringify(next) },
          );
        await apply(values);
        return c.json({ saved: true, revision: next.revision });
      }
      return c.json({ error: "Not found." }, 404);
    } catch (e) {
      return c.json(
        {
          error: e instanceof Error ? e.message : "Forge management could not complete the action.",
        },
        400,
      );
    }
  });
}
