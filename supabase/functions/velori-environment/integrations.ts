export const integrationRegistry = [
  {
    id: "gemini",
    label: "Forge AI generation",
    consumer: "Creative assistant, presentations and generated applications",
    keys: [
      "GEMINI_API_KEY",
      "VELORI_GEMINI_MODEL",
      "VELORI_GEMINI_PREMIUM_MODEL",
      "VELORI_GEMINI_FALLBACK_MODEL",
      "VELORI_STUDIO_ENABLED",
      "VELORI_STUDIO_GENERATION_ENABLED",
      "VELORI_STUDIO_ENCRYPTION_KEY",
      "VELORI_STUDIO_DAILY_PROVIDER_CAP",
      "VELORI_STUDIO_ORIGINS",
    ],
  },
  {
    id: "stripe",
    label: "Stripe payments",
    consumer: "Checkout and verified payment settlement",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "VELORI_APP_URL"],
  },
  {
    id: "razorpay",
    label: "UPI commercial proposal",
    consumer: "Not active until commercial settlement is installed",
    keys: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
  },
  {
    id: "email",
    label: "Transactional email",
    consumer: "Configured mail workflows; receipt delivery needs commercial wiring",
    keys: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_EMAIL"],
  },
  {
    id: "github",
    label: "Creator source control",
    consumer: "Existing hosted source-management integration",
    keys: [
      "GITHUB_APP_ID",
      "GITHUB_APP_INSTALLATION_ID",
      "GITHUB_APP_PRIVATE_KEY",
      "GITHUB_REPOSITORY",
    ],
  },
  {
    id: "transcription",
    label: "Audio transcription proposal",
    consumer: "Separate worker setup and approved transcription deployment required",
    keys: ["VELORI_TRANSCRIPTION_WORKER_URL", "VELORI_TRANSCRIPTION_WORKER_TOKEN"],
  },
];
