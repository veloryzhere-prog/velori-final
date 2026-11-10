import { handleTranscription } from "./transcription.ts";
/** Deploy only after explicit approval and verification of the Studio schema. */
import { createClient } from "@supabase/supabase-js";
import {
  parsePages,
  parseImage,
  validId,
  boundedText,
  tokenHash,
  generate,
  converse,
} from "./policy.ts";
import { encryptionKey, open } from "./crypto.ts";
import { parseSourceFiles, parseForgeStack } from "../../../src/features/artifacts/multi-file.ts";
import { StripeClient, verifyEvent, paymentMatches } from "./payments.ts";
import {
  validMonthlyPrice,
  verifiedSubscription,
  periodEnd,
  monthlyCheckoutParams,
  subscriptionEligible,
  type CanonicalSubscription,
} from "./subscriptions.ts";
import { runtimeKey, capabilities, defaultOrigins } from "./runtime.ts";
const env = (name: string) => Deno.env.get(name)?.trim() ?? "";
const url = env("SUPABASE_URL");
const serviceKey = runtimeKey(
  env,
  ["VELORI_SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  "SUPABASE_SECRET_KEYS",
);
const publicKey = runtimeKey(
  env,
  ["VELORI_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"],
  "SUPABASE_PUBLISHABLE_KEYS",
);
const origins = env("VELORI_STUDIO_ORIGINS")
  ? env("VELORI_STUDIO_ORIGINS")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : defaultOrigins;
const enabled = env("VELORI_STUDIO_ENABLED") === "true";
const keyPromise = encryptionKey(env("VELORI_STUDIO_ENCRYPTION_KEY")).catch(() => null);
const aiKey = env("GEMINI_API_KEY");
const model = env("VELORI_GEMINI_MODEL");
const premium = env("VELORI_GEMINI_PREMIUM_MODEL") || model;
const fallback = env("VELORI_GEMINI_FALLBACK_MODEL");
const stripeKey = env("STRIPE_SECRET_KEY");
const hookSecret = env("STRIPE_WEBHOOK_SECRET");
const live = env("VELORI_STRIPE_LIVE") === "true";
const appUrl = env("VELORI_APP_URL").replace(/\/$/, "");
const validApp =
  origins.includes(appUrl) &&
  (/^https:\/\/[^/]+$/.test(appUrl) || /^http:\/\/(?:localhost|127\.0\.0\.1):[0-9]+$/.test(appUrl));
const prices: { sku: string; currency: string; id: string }[] = [];
for (const sku of ["PACK100", "PREMIUM"])
  for (const currency of ["inr", "usd"]) {
    const id = env(`VELORI_STRIPE_${sku}_${currency.toUpperCase()}_PRICE`);
    if (/^price_[A-Za-z0-9]+$/.test(id)) prices.push({ sku, currency, id });
  }
const monthlyPrices: { sku: "PRO_MONTHLY"; currency: string; id: string }[] = [];
for (const currency of ["inr", "usd"]) {
  const id = env(`VELORI_STRIPE_PRO_MONTHLY_${currency.toUpperCase()}_PRICE`);
  if (/^price_[A-Za-z0-9]+$/.test(id)) monthlyPrices.push({ sku: "PRO_MONTHLY", currency, id });
}
const billingReady =
  !!stripeKey && !!hookSecret && validApp && (!!prices.length || !!monthlyPrices.length);
const oneTimeReady = !!stripeKey && !!hookSecret && validApp && !!prices.length;
const db = createClient(url || "https://unconfigured.invalid", serviceKey || "unconfigured", {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stripe = new StripeClient(stripeKey);
/** Events are sanitized fixed strings. Logging failures never consume or discard a generation. */
async function event(userId: string, requestId: string, kind: string, message: string) {
  if (!validId(requestId)) return;
  await db
    .from("velori_studio_run_events")
    .insert({
      user_id: userId,
      request_id: requestId,
      kind,
      message: message.slice(0, 500),
    })
    .then(
      () => undefined,
      () => undefined,
    );
}
Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
    ...(origin && origins.includes(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization,apikey,x-client-info,content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  if (origin && !origins.includes(origin))
    return reply({ error: "This Studio origin is not enabled." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  if (new URL(request.url).pathname.endsWith("/transcribe")) {
    const response = await handleTranscription(request, {
      enabled: env("VELORI_TRANSCRIPTION_ENABLED") === "true",
      url: env("VELORI_TRANSCRIPTION_WORKER_URL"),
      token: env("VELORI_TRANSCRIPTION_WORKER_TOKEN"),
      authenticate: async (token) => {
        if (!url || !publicKey) return null;
        const client = createClient(url, publicKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await client.auth.getUser(token);
        return error || !data.user || data.user.is_anonymous ? null : data.user.id;
      },
    });
    return new Response(response.body, { status: response.status, headers });
  }
  // Public readiness never reveals secrets or enables a protected action.
  if (!new URL(request.url).pathname.endsWith("/webhook")) {
    let parsed;
    try {
      parsed = JSON.parse(await boundedText(request.clone(), 4000000));
    } catch {
      return reply({ error: "Invalid Studio request." }, 400);
    }
    if (parsed?.action === "status") {
      const check =
        url && serviceKey && publicKey
          ? await db.from("velori_studio_accounts").select("user_id").limit(0)
          : { error: true };
      return reply(
        capabilities({
          database: !check.error,
          encryption: !!(await keyPromise),
          serverEnabled: enabled,
          provider: !!aiKey && !!model,
          generationEnabled: env("VELORI_STUDIO_GENERATION_ENABLED") === "true",
          billing: billingReady,
        }),
      );
    }
  }
  const key = await keyPromise;
  if (!enabled || !url || !serviceKey || !publicKey || !key)
    return reply(
      {
        error: "Studio cloud services await approved database and protected server configuration.",
      },
      503,
    );
  if (new URL(request.url).pathname.endsWith("/webhook")) {
    if (!billingReady) return reply({ error: "Billing is not configured." }, 503);
    let event;
    try {
      event = await verifyEvent(
        await boundedText(request, 300000),
        request.headers.get("stripe-signature"),
        hookSecret,
      );
    } catch {
      return reply({ error: "Invalid payment event." }, 400);
    }
    if (event.livemode !== live) return reply({ error: "Payment mode mismatch." }, 400);
    try {
      // Subscription state is retrieved from Stripe's canonical API, never trusted
      // from an event payload, a client-supplied plan, or admin marketing text.
      if (
        ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(
          event.type,
        ) &&
        /^cs_[A-Za-z0-9]+$/.test(event.data.object.id ?? "")
      ) {
        const checked = await stripe.session(event.data.object.id!);
        if (checked.mode === "subscription") {
          const uid = checked.metadata?.veloriUserId;
          if (
            !checked.subscription?.startsWith("sub_") ||
            !checked.customer?.startsWith("cus_") ||
            !validId(uid) ||
            checked.client_reference_id !== uid ||
            checked.metadata?.veloriPlan !== "PRO_MONTHLY" ||
            checked.status !== "complete" ||
            checked.livemode !== live
          )
            throw new Error("Invalid verified monthly checkout.");
          const stored = await db
            .from("velori_studio_subscriptions")
            .select("user_id,checkout_session_id,stripe_price_id")
            .eq("user_id", uid)
            .eq("checkout_session_id", checked.id)
            .maybeSingle();
          const subscriptionRecord = stored.data;
          if (stored.error || !subscriptionRecord)
            throw new Error("Monthly checkout ownership could not be verified.");
          const configured = monthlyPrices.find((p) => p.id === subscriptionRecord.stripe_price_id);
          if (
            !configured ||
            checked.line_items?.data.length !== 1 ||
            checked.line_items.data[0].price.id !== configured.id ||
            checked.line_items.data[0].quantity !== 1
          )
            throw new Error("Monthly checkout price mismatch.");
          const sub = await stripe.request<CanonicalSubscription>(
            "GET",
            `subscriptions/${encodeURIComponent(checked.subscription)}`,
          );
          if (!verifiedSubscription(sub, configured.id, live) || sub.customer !== checked.customer)
            throw new Error("Invalid monthly entitlement.");
          const saved = await db
            .from("velori_studio_subscriptions")
            .update({
              subscription_id: sub.id,
              customer_id: sub.customer,
              status: sub.status,
              current_period_end: new Date(periodEnd(sub) * 1000).toISOString(),
              cancel_at_period_end: !!sub.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", uid)
            .eq("checkout_session_id", checked.id);
          if (saved.error) throw new Error("Monthly entitlement could not be recorded.");
          return reply({ received: true });
        }
      }
      if (
        [
          "customer.subscription.updated",
          "customer.subscription.deleted",
          "customer.subscription.created",
        ].includes(event.type)
      ) {
        const subId = event.data.object.id;
        if (!/^sub_[A-Za-z0-9]+$/.test(subId ?? ""))
          throw new Error("Invalid subscription identity.");
        const stored = await db
          .from("velori_studio_subscriptions")
          .select("user_id,customer_id,stripe_price_id")
          .eq("subscription_id", subId)
          .maybeSingle();
        if (stored.error) throw new Error("Monthly account state unavailable.");
        if (!stored.data) return reply({ received: true, pending: true }); // Checkout event will bind ownership.
        const sub = await stripe.request<CanonicalSubscription>(
          "GET",
          `subscriptions/${encodeURIComponent(subId!)}`,
        );
        if (
          (!verifiedSubscription(sub, stored.data.stripe_price_id, live) &&
            !(sub.id === subId && sub.status === "canceled" && sub.livemode === live)) ||
          sub.customer !== stored.data.customer_id
        )
          throw new Error("Subscription ownership or price mismatch.");
        const updated = await db
          .from("velori_studio_subscriptions")
          .update({
            status: sub.status,
            current_period_end: new Date(periodEnd(sub) * 1000).toISOString(),
            cancel_at_period_end: !!sub.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", stored.data.user_id)
          .eq("subscription_id", subId);
        if (updated.error) throw new Error("Subscription renewal status could not be persisted.");
        return reply({ received: true });
      }
      if (
        ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(
          event.type,
        )
      ) {
        if (!event.data.object.id?.startsWith("cs_")) throw new Error();
        const session = await stripe.session(event.data.object.id);
        if (session.payment_status !== "paid") return reply({ received: true, pending: true });
        const orderId = session.metadata?.veloriOrderId;
        if (!validId(orderId)) throw new Error();
        const order = await db
          .from("velori_studio_orders")
          .select("*")
          .eq("id", orderId)
          .maybeSingle();
        if (order.error || !order.data || !paymentMatches(session, order.data)) throw new Error();
        const result = await db.rpc("velori_studio_fulfill", {
          p_event: event.id,
          p_order: orderId,
          p_checkout: session.id,
          p_payment: session.payment_intent,
        });
        if (result.error || result.data !== true) throw new Error();
      } else if (["charge.refunded", "charge.dispute.created"].includes(event.type)) {
        const payment = event.data.object.payment_intent;
        if (!payment?.startsWith("pi_")) throw new Error();
        if (event.type === "charge.refunded") {
          const charge = await stripe.request<{
            refunded: boolean;
            amount: number;
            amount_refunded: number;
            payment_intent: string;
          }>("GET", `charges/${encodeURIComponent(event.data.object.id ?? "")}`);
          if (
            !charge.refunded ||
            charge.amount !== charge.amount_refunded ||
            charge.payment_intent !== payment
          )
            return reply({ received: true, partialRefund: true });
        }
        const result = await db.rpc("velori_studio_revoke_payment", {
          p_event: event.id,
          p_payment: payment,
        });
        if (result.error || result.data !== true) throw new Error();
      }
      return reply({ received: true });
    } catch {
      return reply({ error: "Payment reconciliation pending. This event must be retried." }, 503);
    }
  }
  try {
    const body = JSON.parse(await boundedText(request, 4000000));
    if (!body || typeof body.action !== "string")
      return reply({ error: "Invalid Studio request." }, 400);
    if (body.action === "plans") {
      if (!billingReady) return reply({ plans: [] });
      const monthlyTable =
        monthlyPrices.length &&
        !(await db.from("velori_studio_subscriptions").select("user_id").limit(0)).error;
      const plans = await Promise.all(
        [...prices, ...monthlyPrices].map(async (p) => {
          const price = await stripe.price(p.id);
          return {
            sku: p.sku,
            currency: p.currency,
            amount: price.unit_amount,
            available:
              price.active &&
              (p.sku === "PRO_MONTHLY"
                ? !!monthlyTable && validMonthlyPrice(price, p.id, p.currency, live)
                : price.type === "one_time") &&
              price.currency === p.currency &&
              price.livemode === live &&
              Number.isInteger(price.unit_amount) &&
              price.unit_amount > 0,
          };
        }),
      );
      return reply({ plans });
    }
    if (body.action === "preview") {
      if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token))
        return reply({ error: "This link is unavailable or expired." }, 404);
      const shared = await db
        .from("velori_studio_shares")
        .select("project_id,user_id")
        .eq("token_hash", await tokenHash(body.token))
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (shared.error || !shared.data)
        return reply({ error: "This link is unavailable or expired." }, 404);
      const saved = await db
        .from("velori_studio_projects")
        .select("id,user_id,title,pages")
        .eq("id", shared.data.project_id)
        .eq("user_id", shared.data.user_id)
        .maybeSingle();
      if (saved.error || !saved.data)
        return reply({ error: "This shared app is unavailable." }, 404);
      const p = (await open(
        saved.data.pages,
        key,
        `project:${saved.data.user_id}:${saved.data.id}`,
      )) as { pages: unknown };
      const account = await db
        .from("velori_studio_accounts")
        .select("plan")
        .eq("user_id", saved.data.user_id)
        .maybeSingle();
      return reply({
        title: saved.data.title,
        pages: parsePages(p.pages),
        branded: account.data?.plan !== "PREMIUM",
      });
    }
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply({ error: "Sign in to use Studio cloud services." }, 401);
    const auth = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await auth.auth.getUser(token);
    if (authError || !user || user.is_anonymous)
      return reply({ error: "Sign in to use Studio cloud services." }, 401);
    if (body.action === "runEvents") {
      if (!validId(body.requestId)) return reply({ error: "Invalid run identifier." }, 400);
      const events = await db
        .from("velori_studio_run_events")
        .select("id,kind,message,created_at")
        .eq("user_id", user.id)
        .eq("request_id", body.requestId)
        .order("id", { ascending: true })
        .limit(60);
      if (events.error) return reply({ events: [], available: false });
      return reply({ events: events.data ?? [], available: true });
    }
    if (body.action === "quota") {
      const r = await db.rpc("velori_studio_account", { p_user: user.id });
      if (r.error) throw new Error("Account allowance is unavailable.");
      return reply(r.data);
    }
    if (body.action === "list") {
      const r = await db
        .from("velori_studio_projects")
        .select("id,title,pages,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (r.error) throw new Error("Account projects could not be loaded.");
      return reply(
        await Promise.all(
          (r.data ?? []).map(async (p) => {
            const stored = (await open(p.pages, key, `project:${user.id}:${p.id}`)) as {
              pages: unknown;
              history: unknown;
            };
            return {
              id: p.id,
              title: p.title,
              pages: parsePages(stored.pages),
              history: stored.history,
              updatedAt: p.updated_at,
              cloudUpdatedAt: p.updated_at,
            };
          }),
        ),
      );
    }
    if (body.action === "save")
      return reply(
        {
          error:
            "Cloud source storage is disabled. Your project is saved on this device; export a ZIP backup.",
          code: "local_only",
        },
        410,
      );
    if (body.action === "share")
      return reply(
        {
          error:
            "Cloud source sharing is disabled in device-first mode. Export a ZIP to share intentionally.",
          code: "local_only",
        },
        410,
      );
    if (body.action === "revoke") {
      if (!validId(body.projectId)) throw new Error("Invalid project.");
      const revoked = await db
        .from("velori_studio_shares")
        .update({ revoked_at: new Date().toISOString() })
        .eq("project_id", body.projectId)
        .eq("user_id", user.id)
        .is("revoked_at", null);
      if (revoked.error) throw new Error("Cloud share revocation could not be confirmed.");
      return reply({ revoked: true });
    }
    if (body.action === "legacyDataStatus") {
      const result = await db
        .from("velori_studio_projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      const receipts = await db
        .from("velori_studio_requests")
        .select("request_id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("result", "is", null);
      if (result.error || receipts.error)
        return reply({ error: "Legacy data status unavailable." }, 503);
      return reply({
        legacyCopies: result.count ?? 0,
        legacyGenerationResults: receipts.count ?? 0,
      });
    }
    if (body.action === "deleteLegacyCopies") {
      if (body.confirm !== "DELETE MY LEGACY FORGE COPIES")
        return reply({ error: "Explicit legacy data deletion confirmation is required." }, 400);
      // Old request rows sometimes contained encrypted generated source. Remove it
      // while retaining receipt identity/state for quota reconciliation and refunds.
      const erased = await db
        .from("velori_studio_requests")
        .update({ result: null })
        .eq("user_id", user.id)
        .not("result", "is", null)
        .select("request_id");
      if (erased.error)
        return reply(
          { error: "Legacy generation data cleanup failed. No success was claimed." },
          503,
        );
      const r = await db
        .from("velori_studio_projects")
        .delete()
        .eq("user_id", user.id)
        .select("id");
      if (r.error)
        return reply(
          { error: "Legacy copies could not be deleted. Please retry the cleanup." },
          503,
        );
      return reply({ deleted: r.data?.length ?? 0, receiptsCleared: erased.data?.length ?? 0 });
    }
    if (body.action === "subscriptionStatus") {
      const row = await db
        .from("velori_studio_subscriptions")
        .select("status,current_period_end,cancel_at_period_end,customer_id,subscription_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (row.error) return reply({ available: false, active: false, status: "unavailable" });
      return reply({
        available: true,
        active:
          !!row.data &&
          subscriptionEligible(
            row.data.status,
            Math.floor(new Date(row.data.current_period_end ?? 0).getTime() / 1000),
          ),
        status: row.data?.status ?? "none",
        renewalAt: row.data?.current_period_end ?? null,
        cancelAtPeriodEnd: !!row.data?.cancel_at_period_end,
        canManage: !!row.data?.customer_id,
      });
    }
    if (body.action === "billingHistory") {
      const history = await db
        .from("velori_studio_orders")
        .select("sku,amount,currency,status,created_at,paid_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (history.error) return reply({ error: "Payment history is unavailable." }, 503);
      return reply({ available: true, purchases: history.data ?? [] });
    }
    if (body.action === "checkoutSubscription") {
      const p = monthlyPrices.find((p) => p.currency === body.currency);
      if (!billingReady || !p || !validId(body.requestId))
        return reply({ error: "Monthly subscriptions are not available yet." }, 503);
      const price = await stripe.price(p.id);
      if (!validMonthlyPrice(price, p.id, p.currency, live))
        return reply({ error: "A verified monthly Stripe price is required." }, 503);
      const row = await db
        .from("velori_studio_subscriptions")
        .select("status,current_period_end,subscription_id,checkout_started_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (row.error)
        return reply({ error: "Subscription configuration requires activation." }, 503);
      if (
        row.data &&
        subscriptionEligible(
          row.data.status,
          Math.floor(new Date(row.data.current_period_end ?? 0).getTime() / 1000),
        )
      )
        return reply(
          { error: "You already have an active subscription. Open Manage billing instead." },
          409,
        );
      if (
        row.data?.status === "pending" &&
        Date.now() - new Date(row.data.checkout_started_at ?? 0).getTime() < 86400000
      )
        return reply(
          {
            error:
              "A monthly checkout is already in progress. Finish it or contact support before opening a second one.",
          },
          409,
        );
      const session = await stripe.request<{ id: string; url: string; livemode: boolean }>(
        "POST",
        "checkout/sessions",
        monthlyCheckoutParams({ userId: user.id, priceId: p.id }, appUrl),
        `velori-monthly-${user.id}-${body.requestId}`,
      );
      if (
        !/^cs_[A-Za-z0-9]+$/.test(session.id) ||
        !session.url?.startsWith("https://checkout.stripe.com/") ||
        session.livemode !== live
      )
        return reply({ error: "Monthly checkout could not be verified." }, 503);
      const saved = await db.from("velori_studio_subscriptions").upsert(
        {
          user_id: user.id,
          checkout_session_id: session.id,
          stripe_price_id: p.id,
          status: "pending",
          subscription_id: null,
          customer_id: null,
          current_period_end: null,
          cancel_at_period_end: false,
          checkout_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (saved.error)
        return reply(
          { error: "Monthly checkout could not be recorded. No access was granted." },
          503,
        );
      return reply({ url: session.url });
    }
    if (body.action === "manageSubscription") {
      const row = await db
        .from("velori_studio_subscriptions")
        .select("customer_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (row.error || !row.data?.customer_id || !/^cus_[A-Za-z0-9]+$/.test(row.data.customer_id))
        return reply({ error: "No verified subscription customer is available." }, 404);
      const session = await stripe.request<{ url: string }>(
        "POST",
        "billing_portal/sessions",
        new URLSearchParams({
          customer: row.data.customer_id,
          return_url: `${appUrl}/forge/pricing`,
        }),
      );
      const dest = new URL(session.url);
      if (dest.protocol !== "https:" || dest.hostname !== "billing.stripe.com")
        return reply({ error: "The billing portal destination could not be verified." }, 503);
      return reply({ url: dest.href });
    }
    if (body.action === "checkout") {
      if (!oneTimeReady) return reply({ error: "One-time payments are not open yet." }, 503);
      const p = prices.find((p) => p.sku === body.sku && p.currency === body.currency);
      if (!p || !validId(body.requestId)) throw new Error("Invalid plan or currency.");
      const price = await stripe.price(p.id);
      if (
        !price.active ||
        price.type !== "one_time" ||
        price.currency !== p.currency ||
        price.livemode !== live ||
        !Number.isInteger(price.unit_amount) ||
        price.unit_amount <= 0
      )
        throw new Error("Invalid configured price.");
      const order = await db.rpc("velori_studio_order", {
        p_user: user.id,
        p_request: body.requestId,
        p_sku: p.sku,
        p_price: price.id,
        p_amount: price.unit_amount,
        p_currency: price.currency,
        p_live: live,
      });
      if (order.error || !order.data?.id || order.data.status !== "pending")
        throw new Error("Account checkout could not be created.");
      const session = await stripe.create(
        { id: order.data.id, userId: user.id, sku: p.sku, priceId: price.id },
        appUrl,
      );
      if (!session.url || session.livemode !== live)
        throw new Error("Account checkout could not be confirmed.");
      const saved = await db
        .from("velori_studio_orders")
        .update({ checkout_id: session.id })
        .eq("id", order.data.id)
        .eq("user_id", user.id)
        .is("checkout_id", null);
      if (saved.error)
        throw new Error("Account checkout could not be recorded. Retry before paying.");
      return reply({ url: session.url });
    }
    if (!["generate", "converse"].includes(body.action))
      return reply({ error: "Unknown Studio action." }, 400);
    if (!aiKey || !model || env("VELORI_STUDIO_GENERATION_ENABLED") !== "true")
      return reply({ error: "AI generation awaits server setup." }, 503);
    if (
      !validId(body.requestId) ||
      typeof body.prompt !== "string" ||
      !body.prompt.trim() ||
      body.prompt.length > 4000
    )
      throw new Error("Invalid prompt.");
    const pages = body.action === "converse" ? [] : parsePages(body.pages);
    const files = body.action === "converse" ? [] : parseSourceFiles(body.files);
    const stack = parseForgeStack(body.stack);
    const image = parseImage(body.image);
    const history = Array.isArray(body.history)
      ? body.history.slice(-6).map((t: { prompt?: unknown; result?: unknown } | null) => ({
          prompt: typeof t?.prompt === "string" ? t.prompt.slice(0, 4000) : "",
          result: typeof t?.result === "string" ? t.result.slice(0, 500) : "",
        }))
      : [];
    await event(
      user.id,
      body.requestId,
      "received",
      "Generation request received and authenticated.",
    );
    const cap = Number(env("VELORI_STUDIO_DAILY_PROVIDER_CAP") || "250");
    const r = await db.rpc("velori_studio_reserve", {
      p_user: user.id,
      p_request: body.requestId,
      p_daily_cap: Number.isInteger(cap) ? Math.max(1, Math.min(cap, 10000)) : 250,
    });
    if (r.error)
      return reply(
        { error: "Allowance could not be reserved. No generation was started.", code: "reconcile" },
        503,
      );
    if (r.data?.state === "complete")
      return reply(
        {
          error:
            "This request was completed. Its generated files are kept only on your device; reload your local project or use a source ZIP backup.",
          code: "completed_local",
        },
        409,
      );
    if (r.data?.state !== "reserved") {
      await event(
        user.id,
        body.requestId,
        "quota_blocked",
        "Generation did not start: account quota or service capacity blocked the request.",
      );
      return reply(
        {
          error:
            r.data?.state === "quota"
              ? "Your generation allowance is used. Add credits or view plans."
              : "Studio is busy or at capacity. Keep your draft and try again later.",
          code:
            r.data?.state === "running"
              ? "reconcile"
              : r.data?.state === "quota"
                ? "quota"
                : "capacity",
        },
        429,
      );
    }
    await event(
      user.id,
      body.requestId,
      "reserved",
      "The generation allowance was reserved successfully.",
    );
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55000)]);
    const target = r.data.plan === "PREMIUM" ? premium : model;
    try {
      await event(
        user.id,
        body.requestId,
        "provider_started",
        "Gemini generation request sent. Awaiting a response.",
      );
      let output;
      if (body.action === "converse") {
        try {
          output = await converse(
            aiKey,
            target,
            body.prompt.trim(),
            String(body.projectTitle ?? ""),
            history,
            signal,
            fetch,
            String(body.projectContext ?? ""),
          );
        } catch (e) {
          if (!fallback || fallback === target || signal.aborted) throw e;
          output = await converse(
            aiKey,
            fallback,
            body.prompt.trim(),
            String(body.projectTitle ?? ""),
            history,
            signal,
            fetch,
            String(body.projectContext ?? ""),
          );
        }
      } else
        try {
          output = await generate(
            aiKey,
            target,
            body.prompt.trim(),
            pages,
            signal,
            image,
            history,
            fetch,
            files,
            stack,
          );
        } catch (e) {
          if (!fallback || fallback === target || signal.aborted) throw e;
          output = await generate(
            aiKey,
            fallback,
            body.prompt.trim(),
            pages,
            signal,
            image,
            history,
            fetch,
            files,
            stack,
          );
        }
      await event(
        user.id,
        body.requestId,
        "provider_response",
        body.action === "converse"
          ? "Gemini returned a conversational reply."
          : "Gemini returned valid generated code.",
      );
      // Store an accounting receipt only, never generated page code or files.
      const done = await db.rpc("velori_studio_finish_local", {
        p_user: user.id,
        p_request: body.requestId,
        p_success: true,
      });
      if (done.error || done.data !== true)
        return reply(
          {
            error:
              "Generation needs confirmation. Retry the unchanged prompt to reuse its request identifier.",
            code: "reconcile",
          },
          503,
        );
      await event(
        user.id,
        body.requestId,
        "revision_ready",
        body.action === "converse"
          ? "FORGE replied to the user."
          : "Generated revision verified and returned to your device; no source saved in the cloud.",
      );
      return reply(output);
    } catch (cause) {
      const providerCode =
        cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
      await event(
        user.id,
        body.requestId,
        "failed",
        providerCode === "provider_quota"
          ? "Gemini provider quota or rate limit was reached; the request cannot complete."
          : "Generation failed; the request will be reconciled.",
      );
      const refund = await db.rpc("velori_studio_finish_local", {
        p_user: user.id,
        p_request: body.requestId,
        p_success: false,
      });
      return reply(
        {
          error: refund.error
            ? "Generation failed. Allowance reconciliation is pending; your code is unchanged."
            : providerCode === "provider_quota"
              ? "Gemini provider quota or rate limit reached. Your VELORI allowance was released; your code is unchanged."
              : "Generation failed or the provider is at capacity. Your allowance was released; your code is unchanged.",
          code: refund.error
            ? "reconcile"
            : providerCode === "provider_quota"
              ? "provider_quota"
              : "generation_failed",
        },
        providerCode === "provider_quota" && !refund.error ? 429 : 502,
      );
    }
  } catch (e) {
    const error =
      e instanceof Error && /^(Invalid|Use |Include|A page|Reference|Account )/.test(e.message)
        ? e.message
        : "Studio request is invalid or temporarily unavailable. Your browser draft is unchanged.";
    return reply({ error }, 400);
  }
});
