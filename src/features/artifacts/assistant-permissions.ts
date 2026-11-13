import type { CommercialQuota } from "./commercial";
import type { Quota } from "./model";

export type ForgeAction = "ask" | "build";
export type ForgePermissionState =
  | "empty-prompt"
  | "authentication-required"
  | "server-checking"
  | "server-unavailable"
  | "server-setup-incomplete"
  | "provider-unavailable"
  | "consent-required"
  | "consent-not-saved"
  | "consent-cancelled"
  | "account-allowance-loading"
  | "account-allowance-unavailable"
  | "generation-quota-exhausted"
  | "generation-failed";
export type ForgePermissionFeedback = {
  state: ForgePermissionState;
  message: string;
  action?: ForgeAction;
};
export type ForgeReadinessResult =
  | { ok: true }
  | {
      ok: false;
      state:
        | "authentication-required"
        | "server-unavailable"
        | "server-setup-incomplete"
        | "provider-unavailable";
      message: string;
    };
export type ForgeQuotaResult =
  | {
      ok: true;
      quota: CommercialQuota | Quota;
      canRequest: boolean;
      exhausted: boolean;
      accountLocked: boolean;
    }
  | {
      ok: false;
      state: "account-allowance-unavailable";
      message: string;
    };

export type ForgeConsentRecord = {
  version: 1;
  scope: "ask-build-prompt-source-context-and-images";
  consented: true;
  acceptedAt: string;
};

export const FORGE_CONSENT_SCOPE: ForgeConsentRecord["scope"] =
  "ask-build-prompt-source-context-and-images";
export const FORGE_CONSENT_VERSION = 1;
type ConsentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function forgeConsentKey(projectId: string): string {
  return `velori.forge.ai-consent.v${FORGE_CONSENT_VERSION}.${projectId}`;
}

export function readForgeConsent(storage: ConsentStorage, projectId: string): boolean {
  try {
    const raw = storage.getItem(forgeConsentKey(projectId));
    if (!raw) return false;
    const value = JSON.parse(raw) as Partial<ForgeConsentRecord>;
    return (
      value.version === FORGE_CONSENT_VERSION &&
      value.scope === FORGE_CONSENT_SCOPE &&
      value.consented === true &&
      typeof value.acceptedAt === "string" &&
      Number.isFinite(Date.parse(value.acceptedAt))
    );
  } catch {
    return false;
  }
}

export function saveForgeConsent(storage: ConsentStorage, projectId: string): boolean {
  const record: ForgeConsentRecord = {
    version: FORGE_CONSENT_VERSION,
    scope: FORGE_CONSENT_SCOPE,
    consented: true,
    acceptedAt: new Date().toISOString(),
  };
  try {
    storage.setItem(forgeConsentKey(projectId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function revokeForgeConsent(storage: ConsentStorage, projectId: string): boolean {
  try {
    storage.removeItem(forgeConsentKey(projectId));
    return true;
  } catch {
    return false;
  }
}

export class ForgePermissionFlow {
  private active = false;
  private submitting = false;
  private pendingAction: ForgeAction | null = null;
  private generation = 0;
  private readonly deps: {
    hasPrompt: (action: ForgeAction) => boolean;
    isAuthenticated: () => boolean;
    checkReadiness: (action: ForgeAction) => Promise<ForgeReadinessResult>;
    hasConsent: (action: ForgeAction) => boolean;
    saveConsent: (action: ForgeAction) => boolean;
    refreshQuota: () => Promise<ForgeQuotaResult>;
    submit: (action: ForgeAction) => Promise<void>;
    cancelGeneration: () => void;
    onPendingAction: (action: ForgeAction | null) => void;
    onConsentDialog: (open: boolean) => void;
    onFeedback: (feedback: ForgePermissionFeedback | null) => void;
    onQuotaUnavailable: (quota: CommercialQuota | Quota) => void;
  };

  constructor(deps: {
    hasPrompt: (action: ForgeAction) => boolean;
    isAuthenticated: () => boolean;
    checkReadiness: (action: ForgeAction) => Promise<ForgeReadinessResult>;
    hasConsent: (action: ForgeAction) => boolean;
    saveConsent: (action: ForgeAction) => boolean;
    refreshQuota: () => Promise<ForgeQuotaResult>;
    submit: (action: ForgeAction) => Promise<void>;
    cancelGeneration: () => void;
    onPendingAction: (action: ForgeAction | null) => void;
    onConsentDialog: (open: boolean) => void;
    onFeedback: (feedback: ForgePermissionFeedback | null) => void;
    onQuotaUnavailable: (quota: CommercialQuota | Quota) => void;
  }) {
    this.deps = deps;
  }

  async request(action: ForgeAction): Promise<void> {
    if (this.active) return;
    if (!this.deps.hasPrompt(action)) {
      this.deps.onFeedback({
        state: "empty-prompt",
        message: "Write a prompt before asking FORGE to respond or prepare a revision.",
      });
      return;
    }

    this.active = true;
    this.pendingAction = action;
    const generation = ++this.generation;
    this.deps.onPendingAction(action);
    if (!this.deps.isAuthenticated()) {
      this.fail(generation, {
        state: "authentication-required",
        message: "Sign in to your VELORI account before using FORGE Ask or Build.",
        action,
      });
      return;
    }

    this.deps.onFeedback({
      state: "server-checking",
      message: "Checking your sign-in and FORGE server readiness…",
      action,
    });
    let readiness: ForgeReadinessResult;
    try {
      readiness = await this.deps.checkReadiness(action);
    } catch {
      readiness = {
        ok: false,
        state: "server-unavailable",
        message: "The FORGE server could not be reached. Check the connection and retry.",
      };
    }
    if (generation !== this.generation) return;
    if (!readiness.ok) {
      this.fail(
        generation,
        readiness.state === "authentication-required"
          ? {
              state: "authentication-required",
              message: readiness.message,
              action,
            }
          : { ...readiness, action },
      );
      return;
    }

    if (!this.deps.hasConsent(action)) {
      this.deps.onFeedback({
        state: "consent-required",
        message: "Review and accept the AI processing details to continue this request.",
        action,
      });
      this.deps.onConsentDialog(true);
      return;
    }
    await this.startWithAllowance(action, generation);
  }

  async acceptConsent(checked: boolean): Promise<void> {
    const action = this.pendingAction;
    const generation = this.generation;
    if (!this.active || !action || this.submitting) return;
    if (!checked) {
      this.deps.onFeedback({
        state: "consent-required",
        message: "Check the required consent box before continuing. Nothing has been sent.",
        action,
      });
      return;
    }
    if (!this.deps.saveConsent(action)) {
      this.deps.onFeedback({
        state: "consent-not-saved",
        message: "Consent could not be saved in this browser. Enable site storage and try again.",
        action,
      });
      return;
    }
    this.deps.onConsentDialog(false);
    await this.startWithAllowance(action, generation);
  }

  cancelConsent(): void {
    if (!this.active || this.submitting) return;
    const generation = this.generation;
    this.deps.onConsentDialog(false);
    this.fail(generation, {
      state: "consent-cancelled",
      message:
        "Consent was not granted. No prompt, project source, conversation, or image was sent.",
    });
  }

  cancelRequest(): void {
    if (!this.active) return;
    if (this.submitting) {
      this.deps.cancelGeneration();
      return;
    }
    this.cancelConsent();
  }

  private async startWithAllowance(action: ForgeAction, generation: number): Promise<void> {
    this.deps.onFeedback({
      state: "account-allowance-loading",
      message: "Checking your account allowance before sending this request…",
      action,
    });
    let allowance: ForgeQuotaResult;
    try {
      allowance = await this.deps.refreshQuota();
    } catch {
      allowance = {
        ok: false,
        state: "account-allowance-unavailable",
        message: "The account allowance check failed. Retry before sending this request.",
      };
    }
    if (generation !== this.generation) return;
    if (!allowance.ok) {
      this.fail(generation, { ...allowance, action });
      return;
    }
    if (allowance.exhausted || !allowance.canRequest) {
      this.deps.onQuotaUnavailable(allowance.quota);
      this.fail(generation, {
        state: allowance.exhausted ? "generation-quota-exhausted" : "account-allowance-unavailable",
        message: allowance.exhausted
          ? "Your verified generation allowance is exhausted. Review your usage or available plans before retrying."
          : allowance.accountLocked
            ? "Requests are paused for this account. Review the allowance details or contact support."
            : "The verified account allowance does not currently permit this request.",
        action,
      });
      return;
    }

    this.submitting = true;
    this.deps.onConsentDialog(false);
    this.deps.onFeedback(null);
    try {
      await this.deps.submit(action);
    } catch {
      if (generation === this.generation)
        this.deps.onFeedback({
          state: "generation-failed",
          message:
            "FORGE could not complete this request. Your project remains unchanged; retry when ready.",
          action,
        });
    } finally {
      this.submitting = false;
      this.clear(generation);
    }
  }

  private fail(generation: number, feedback: ForgePermissionFeedback): void {
    if (generation !== this.generation) return;
    this.deps.onFeedback(feedback);
    this.clear(generation);
  }

  private clear(generation: number): void {
    if (generation !== this.generation) return;
    this.active = false;
    this.pendingAction = null;
    this.deps.onPendingAction(null);
  }
}
