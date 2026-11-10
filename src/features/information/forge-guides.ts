export const forgeGuides = {
  "forge-payments": {
    label: "Forge payments & billing",
    category: "VELORI FORGE / BILLING",
    title: "Payments, without the guesswork.",
    intro:
      "Understand your allowance, review pricing, and know what happens before and after a Forge purchase.",
    accent: "Clear pricing · Protected checkout",
    status: "Paid services are configuration-dependent",
    sections: [
      {
        title: "Before you buy",
        text: "Open the live pricing screen to see the offers actually available to your signed-in account. Documentation explains the product; it does not activate a subscription. If payment setup is unavailable, no purchase should be implied.",
      },
      {
        title: "Requests and your allowance",
        text: "The workspace reads your allowance from the protected Forge service. Local editing, previewing a saved app and downloading your browser draft remain available when AI generation is unavailable. The new subscription and top-up model is still staged and is not an active billing promise.",
      },
      {
        title: "Secure checkout",
        text: "When billing is enabled, Forge creates a server-selected checkout for your account. Confirm the item, amount, currency and any recurring terms on the provider's checkout before paying. Never share a card number, UPI PIN, one-time code or merchant API key with support or in a chat.",
      },
      {
        title: "After payment",
        text: "Returning from checkout does not prove a payment succeeded. Access is granted only after the backend verifies the provider's signed payment event. If you paid and access is missing, keep the provider's payment reference and contact support. Do not make a second purchase simply to retry activation.",
      },
      {
        title: "Receipts, cancellations and help",
        text: "Use the payment provider's confirmation for the transaction record. Automated Forge receipt emails and recurring subscription self-service are pending activation. For an unresolved purchase, contact VELORI with your account email, payment reference and date. Keep credentials and full payment details private.",
      },
    ],
    actions: [
      { label: "Live offers", to: "/forge/pricing" },
      { label: "Pricing guide", to: "/forge-pricing" },
      { label: "Billing help", to: "/contact" },
    ],
  },
  "forge-api": {
    label: "Forge API reference",
    category: "VELORI FORGE / DOCUMENTATION",
    title: "Forge API reference",
    intro:
      "Reference for the existing VELORI Forge client and backend source. This is not a public third-party API or an offer of anonymous generation access.",
    accent: "VELORI · VELORYZ",
    sections: [
      {
        title: "Transport and identity",
        text: "The React client invokes the velori-studio Supabase Edge function with JSON containing an action and its arguments. Protected operations verify the actual signed-in user token. Never send a service-role key or merchant credential from the browser.",
      },
      {
        title: "Readiness and allowance",
        text: "action=status returns capability booleans without secrets. action=quota returns the verified user's current server allowance. Configuration-gated operations return an unavailable state; callers must not infer success from a rendered button.",
      },
      {
        title: "Generation",
        text: "action=generate accepts a validated requestId, prompt, pages, optional prepared image and bounded history. The backend reserves allowance atomically, validates the structured result and reconciles retries. Reuse the same request identifier after an uncertain result; do not submit simultaneous replacements.",
      },
      {
        title: "Account persistence",
        text: "action=list retrieves owned projects. action=save includes the project, requestId and expected cloud revision. Conflicting changes return a conflict instead of overwriting newer work. Each ownership decision is made on the server.",
      },
      {
        title: "Sharing",
        text: "action=share and action=revoke operate on owned projects. action=preview uses an opaque expiring capability token. A shared preview excludes private prompt history. Treat the link as access to its shared content.",
      },
      {
        title: "Billing boundary",
        text: "Current checkout accepts only configured server-selected SKUs and currencies. The new recurring/top-up commerce helper is staged. Merchant webhooks must verify the raw signature, canonical provider objects, owner/order/amount/currency and replay identity before settlement.",
      },
      {
        title: "Staged transcription endpoint",
        text: "The reviewed source adds POST /functions/v1/velori-studio/transcribe with multipart audio and a real user bearer token. Deployment approval and a configured Node/Whisper host are still required. Source limits: 8 MiB audio, two minutes, one task per worker and one request per user per minute. No paid transcription metering is advertised.",
      },
      {
        title: "Errors and retries",
        text: "Handle authentication, permission, conflict, quota/capacity and unavailable responses distinctly. Keep browser drafts on errors. Redact credentials from diagnostics. Responses and limits may evolve with the deployed version; no stable external developer contract is promised.",
      },
    ],
    actions: [
      {
        label: "Open Forge",
        to: "/forge",
      },
      {
        label: "Pricing",
        to: "/forge/pricing",
      },
      {
        label: "Help",
        to: "/help",
      },
    ],
  },
  "forge-docs": {
    label: "Forge documentation",
    category: "VELORI FORGE / DOCUMENTATION",
    title: "Forge documentation",
    intro:
      "Forge is the app-building workspace inside VELORI. Start with a prompt, edit the generated pages, review changes and export an app you can keep.",
    accent: "VELORI · VELORYZ",
    sections: [
      {
        title: "1. Open your workspace",
        text: "Open Forge from VELORI. A browser draft lets you edit locally. Sign in to use account features when the protected backend is configured.",
      },
      {
        title: "2. Describe and refine",
        text: "Explain the purpose, audience, pages and interactions. You can attach a supported image reference. Generation requires the configured Gemini service and a server allowance.",
      },
      {
        title: "3. Edit and preview",
        text: "Use the HTML, CSS and JavaScript tabs for each validated page. Run the current code in an isolated preview and inspect desktop or phone dimensions.",
      },
      {
        title: "4. Save, share and export",
        text: "Browser drafts, account saves and share links serve different purposes. Account storage and sharing require protected server setup.",
      },
      {
        title: "Current rollout status",
        text: "The workspace and local editing/export are implemented. AI generation, encrypted cloud saves and billing require owner configuration and acceptance. Commercial subscription billing and transcription are staged; this page does not promise they are active.",
      },
      {
        title: "Getting help",
        text: "Keep your project source and the error reference when reporting an issue. Never send passwords, private API keys or payment credentials to support.",
      },
    ],
    actions: [
      {
        label: "Open Forge",
        to: "/forge",
      },
      {
        label: "Pricing",
        to: "/forge/pricing",
      },
      {
        label: "Help",
        to: "/help",
      },
    ],
  },
  "forge-pricing": {
    label: "Forge pricing guide",
    category: "VELORI FORGE / DOCUMENTATION",
    title: "Forge pricing guide",
    intro:
      "Understand the difference between current account offers and the proposed daily, monthly and top-up model. Always use the actual checkout summary before paying.",
    accent: "VELORI · VELORYZ",
    sections: [
      {
        title: "Current offers",
        text: "The current pricing screen reads configured server offers. It may show payments unavailable while merchant setup is incomplete. Existing credits and legacy entitlements are not silently converted.",
      },
      {
        title: "Proposed Free allowance",
        text: "The commercial blueprint proposes 1,000 generation requests per UTC day at ₹0 / $0. It is a future allowance, not a balance automatically applied to your current account.",
      },
      {
        title: "Proposed Pro plan",
        text: "₹999 or $12 per monthly billing period with 50,000 base requests. The cap is explicit; this is not an unlimited request promise. The paid provider service period determines resets.",
      },
      {
        title: "Proposed top-up pack",
        text: "₹249 or $3 once for 5,000 additional requests. Base allowance is spent first; unused top-ups carry forward. Proposed pricing remains subject to accepted commercial rollout.",
      },
      {
        title: "Usage warnings and account restrictions",
        text: "At 90% usage a server-driven warning can explain the balance. Empty balances block metered generation. Manual account restrictions are independent and are never removed simply by purchasing a pack.",
      },
      {
        title: "Checkout and payment confirmation",
        text: "Only a verified provider payment followed by server settlement changes entitlements. A redirect, typed UTR, screenshot or pending authorization does not grant requests. Cards and UPI depend on the merchant account and provider eligibility.",
      },
      {
        title: "Receipts, renewal and support",
        text: "Commercial receipt delivery and subscription lifecycle handling remain pending. A future receipt must use the verified purchaser and the actual amount/currency. Review the provider summary for taxes and billing terms; ask support about unresolved payments without sharing sensitive credentials.",
      },
    ],
    actions: [
      {
        label: "Open Forge",
        to: "/forge",
      },
      {
        label: "Pricing",
        to: "/forge/pricing",
      },
      {
        label: "Help",
        to: "/help",
      },
    ],
  },
  "forge-security": {
    label: "Forge security & setup",
    category: "VELORI FORGE / DOCUMENTATION",
    title: "Forge security & setup",
    intro:
      "How Forge separates user content, application settings and protected server credentials. Public CMS pages never contain secret values.",
    accent: "VELORI · VELORYZ",
    sections: [
      {
        title: "Manage environment",
        text: "Super administrators can open Admin → System → Manage environment. The backend requires the security.edit permission and recent password confirmation for changes. Type the exact variable name before setting or removing a value. Saved values are never returned.",
      },
      {
        title: "One-time backend setup",
        text: "Deploy the reviewed admin environment handlers. In the Supabase dashboard configure VELORI_ENVIRONMENT_MANAGEMENT_TOKEN as a project-scoped token with only Edge Function secret read/write permissions for this VELORI project. Keep this bootstrap token outside the admin editor. Until it is configured, environment changes stay disabled.",
      },
      {
        title: "What this workspace controls",
        text: "Application provider credentials, supported runtime flags and settings, webhook signing values, price IDs, worker tokens and VELORI_CUSTOM_ application secrets. Custom names need backend code that actually reads them; adding a name does not create a new integration.",
      },
      {
        title: "Protected rotations",
        text: "Project access keys, management credentials and existing encryption keys require the hosting/dashboard rotation process. Replacing an encryption key without re-encrypting stored projects can make them unreadable. Frontend VITE_ build values require a rebuild; a runtime secret update does not rewrite a previously built frontend.",
      },
      {
        title: "Scope of changes",
        text: "Supabase Edge secrets are shared by project functions. A change may affect more than Forge. Review the consuming services and verify readiness after updating. The transcription Node host has its own environment and must receive a matching worker token separately.",
      },
      {
        title: "Storage and account protection",
        text: "Owner checks, database row-level security and service-only quota helpers protect account data. Encrypted cloud content requires a protected encryption key. Generated previews are isolated and must not receive privileged credentials.",
      },
      {
        title: "Audit and operational checks",
        text: "Environment changes record the variable name and operation without the submitted value. The server refuses a mutation if it cannot record the request audit. Confirm provider readiness after saving. Do not paste secrets into CMS content, support messages or audit descriptions.",
      },
    ],
    actions: [
      {
        label: "Open Forge",
        to: "/forge",
      },
      {
        label: "Pricing",
        to: "/forge/pricing",
      },
      {
        label: "Help",
        to: "/help",
      },
    ],
  },
};
