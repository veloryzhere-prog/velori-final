import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { m } from "framer-motion";
import { MessageSquareQuote, RefreshCw, Star } from "lucide-react";
import { Dialog, Button, Textarea } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import {
  INITIAL_REVIEW_DELAY_MS,
  remainingReviewTime,
  reviewPromptStateForLogin,
  shouldOpenReviewPrompt,
  type ReviewPromptScheduleState,
} from "./review-prompt-scheduler.mjs";
import "./app-reviews.css";

type PublicReview = {
  id: string;
  rating: number;
  review_text: string;
  is_anonymous: boolean;
  reviewer_display_name: string;
  admin_response: string | null;
  created_at: string;
};

type ReviewSummary = {
  total: number;
  average: number;
  distribution: Record<string, number>;
};

const EMPTY_SUMMARY: ReviewSummary = {
  total: 0,
  average: 0,
  distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
};

const SUGGESTIONS = [
  "VELORI makes it easier to stay close to the people I care about.",
  "I love having a welcoming space to share everyday moments.",
  "The experience feels thoughtful, personal, and easy to use.",
];

function reviewSummary(value: unknown): ReviewSummary | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReviewSummary>;
  if (
    typeof candidate.total !== "number" ||
    !Number.isFinite(candidate.total) ||
    typeof candidate.average !== "number" ||
    !Number.isFinite(candidate.average) ||
    !candidate.distribution ||
    typeof candidate.distribution !== "object"
  ) {
    return null;
  }
  for (const rating of ["1", "2", "3", "4", "5"]) {
    const count = candidate.distribution[rating];
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return null;
  }
  return candidate as ReviewSummary;
}

function StarRating({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="app-review-stars" aria-label={`${label}: ${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={16}
          aria-hidden="true"
          fill={index < rating ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export function PublicReviews() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(6);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reviewResult, summaryResult] = await Promise.all([
        supabase.rpc("get_public_app_reviews", { p_limit: visible, p_offset: 0 }),
        supabase.rpc("get_public_app_review_summary"),
      ]);
      if (reviewResult.error || summaryResult.error) {
        setError("Reviews could not be loaded right now. Please try again.");
        return;
      }

      const stats = reviewSummary(summaryResult.data);
      if (!Array.isArray(reviewResult.data) || !stats) {
        setError("Reviews could not be loaded right now. Please try again.");
        return;
      }
      const rows = reviewResult.data as unknown as PublicReview[];
      setReviews(rows);
      setSummary(stats);
    } catch {
      setError("Reviews could not be loaded right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [visible, refreshKey]);

  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);

  return (
    <section className="app-reviews-section" aria-labelledby="app-reviews-title">
      <div className="app-reviews-heading">
        <div>
          <span className="app-reviews-eyebrow">A LITTLE LOVE FROM THE CIRCLE</span>
          <h2 id="app-reviews-title">Real voices. Real connection.</h2>
          <p>Reviews shared by VELORI members and approved by our team.</p>
        </div>
        {summary.total > 0 ? (
          <div className="app-review-summary" aria-label="Approved review statistics">
            <strong>{summary.average.toFixed(1)}</strong>
            <StarRating rating={Math.round(summary.average)} label="Average rating" />
            <span>{summary.total} approved reviews</span>
            <div className="app-review-distribution">
              {[5, 4, 3, 2, 1].map((rating) => (
                <span key={rating}>
                  <span>{rating}★</span>
                  <span className="app-review-meter">
                    <span
                      style={{
                        width: `${summary.total ? ((summary.distribution[String(rating)] ?? 0) / summary.total) * 100 : 0}%`,
                      }}
                    />
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="app-reviews-message" role="alert">
          <span>Reviews could not be loaded right now. Please try again.</span>
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)}>
            <RefreshCw size={15} aria-hidden="true" /> Retry
          </button>
        </div>
      ) : loading ? (
        <p className="app-reviews-message" role="status">
          Loading approved reviews…
        </p>
      ) : reviews.length ? (
        <>
          <div className="app-review-grid">
            {reviews.map((review, index) => (
              <m.article
                key={review.id}
                className="app-review-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: Math.min(index * 0.045, 0.2) }}
              >
                <StarRating rating={review.rating} label="Review rating" />
                <p>{review.review_text}</p>
                <div className="app-review-byline">
                  <span>{review.is_anonymous ? "Anonymous" : review.reviewer_display_name}</span>
                  <time dateTime={review.created_at}>
                    {new Intl.DateTimeFormat(undefined, {
                      month: "short",
                      year: "numeric",
                    }).format(new Date(review.created_at))}
                  </time>
                </div>
                {review.admin_response ? (
                  <div className="app-review-response">
                    <strong>VELORI team</strong>
                    <p>{review.admin_response}</p>
                  </div>
                ) : null}
              </m.article>
            ))}
          </div>
          {reviews.length < summary.total && (
            <button
              type="button"
              className="app-review-more"
              onClick={() => setVisible((count) => count + 6)}
            >
              Read more reviews
            </button>
          )}
        </>
      ) : (
        <div className="app-reviews-empty">
          <MessageSquareQuote size={22} aria-hidden="true" />
          <p>Be among the first to share what VELORI means to you.</p>
        </div>
      )}
    </section>
  );
}

const REVIEW_PROMPT_KEY = "velori-review-prompt-v2";
const LEGACY_REVIEW_PROMPT_KEY = "velori-review-prompt-v1";

type ReviewPromptState = ReviewPromptScheduleState;

function readReviewPrompt(userId: string, loginKey: string): ReviewPromptState {
  try {
    const raw = window.localStorage.getItem(`${REVIEW_PROMPT_KEY}:${userId}`);
    const stored = raw
      ? (JSON.parse(raw) as Partial<ReviewPromptState>)
      : (() => {
          const legacy = window.localStorage.getItem(`${LEGACY_REVIEW_PROMPT_KEY}:${userId}`);
          return legacy ? (JSON.parse(legacy) as Partial<ReviewPromptState>) : null;
        })();
    return reviewPromptStateForLogin(stored, loginKey);
  } catch {
    return reviewPromptStateForLogin(null, loginKey);
  }
}

function writeReviewPrompt(userId: string, state: ReviewPromptState) {
  try {
    window.localStorage.setItem(`${REVIEW_PROMPT_KEY}:${userId}`, JSON.stringify(state));
  } catch {
    // A locked-down browser may reject storage, but the prompt should not crash the app.
  }
}

function getReviewLoginKey(userId: string, lastSignInAt: string | null | undefined) {
  if (lastSignInAt) return lastSignInAt;
  const key = `velori-review-login-session:${userId}`;
  try {
    const stored = window.sessionStorage.getItem(key);
    if (stored) return stored;
    const next = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, next);
    return next;
  } catch {
    return `session-${userId}`;
  }
}

export function ReviewAutoPrompt() {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState("");
  const timerRef = useRef<number | null>(null);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const reviewedRef = useRef(false);
  const dismissedRef = useRef(false);
  const loginKeyRef = useRef("");
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      reviewedRef.current = false;
      dismissedRef.current = false;
      if (!authLoading && !user && lastUserIdRef.current) {
        try {
          window.sessionStorage.removeItem(`velori-review-login-session:${lastUserIdRef.current}`);
        } catch {
          // Session storage is optional; the Supabase sign-in timestamp remains the primary key.
        }
        lastUserIdRef.current = null;
      }
      setOpen(false);
      return;
    }

    let active = true;
    let checking = false;
    let retryTimer: number | null = null;
    let retryDelayMs = 15_000;
    const loginKey = getReviewLoginKey(user.id, user.last_sign_in_at);
    loginKeyRef.current = loginKey;
    lastUserIdRef.current = user.id;
    const storedPrompt = readReviewPrompt(user.id, loginKey);
    reviewedRef.current = storedPrompt.reviewed;
    dismissedRef.current = storedPrompt.dismissed;
    let remainingMs = storedPrompt.remainingMs;
    let eligibility: "unknown" | "eligible" | "ineligible" = "unknown";
    let startedAt = 0;
    let promptShown = false;

    const promptVisible = () =>
      shouldOpenReviewPrompt({
        active,
        visible: document.visibilityState === "visible",
        reviewed: reviewedRef.current,
        dismissed: dismissedRef.current,
        eligibility,
      });

    const pauseTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
        remainingMs = remainingReviewTime(remainingMs, startedAt);
        writeReviewPrompt(user.id, {
          remainingMs,
          reviewed: false,
          dismissed: dismissedRef.current,
          loginKey,
        });
      }
    };

    const schedule = () => {
      if (promptShown || !promptVisible()) return;
      if (timerRef.current !== null) return;
      startedAt = Date.now();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (promptShown || !promptVisible()) return;
        remainingMs = 0;
        promptShown = true;
        writeReviewPrompt(user.id, {
          remainingMs: 0,
          reviewed: false,
          dismissed: false,
          loginKey,
        });
        setOpen(true);
        void evaluate();
      }, remainingMs);
    };

    const clearRetry = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const scheduleRetry = () => {
      if (
        !active ||
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        retryTimer !== null
      ) {
        return;
      }
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void evaluate();
      }, retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, 5 * 60_000);
    };

    const evaluate = async () => {
      if (checking || !active || document.visibilityState !== "visible") return;
      clearRetry();
      checking = true;
      try {
        const { data, error: reviewError } = await supabase.rpc("get_my_app_review_status");
        const status = data as { can_submit?: unknown; has_submitted?: unknown } | null;
        const hasSubmissionStatus =
          status !== null && Object.prototype.hasOwnProperty.call(status, "has_submitted");
        if (
          !active ||
          reviewError ||
          typeof status?.can_submit !== "boolean" ||
          (hasSubmissionStatus && typeof status?.has_submitted !== "boolean")
        ) {
          scheduleRetry();
          return;
        }

        retryDelayMs = 15_000;
        if (status.has_submitted === true || !status.can_submit) {
          eligibility = "ineligible";
          reviewedRef.current = status.has_submitted === true;
          pauseTimer();
          dismissedRef.current = true;
          writeReviewPrompt(user.id, {
            remainingMs: 0,
            reviewed: reviewedRef.current,
            dismissed: true,
            loginKey,
          });
          setOpen(false);
          return;
        }

        eligibility = "eligible";
        if (reviewedRef.current || dismissedRef.current) return;
        if (remainingMs <= 0) {
          promptShown = true;
          setOpen(true);
          return;
        }
      } catch (cause) {
        console.error("Automatic review eligibility could not be checked.", cause);
        scheduleRetry();
      } finally {
        checking = false;
      }
    };

    schedule();
    void evaluate();
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void evaluate();
        schedule();
      } else {
        clearRetry();
        pauseTimer();
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      active = false;
      clearRetry();
      pauseTimer();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [authLoading, user?.id, user?.last_sign_in_at, scheduleVersion]);

  const dismiss = () => {
    if (!user || submitting) return;
    setOpen(false);
    setRating(0);
    setReviewText("");
    setHoverRating(0);
    setError("");
    dismissedRef.current = true;
    writeReviewPrompt(user.id, {
      remainingMs: 0,
      reviewed: false,
      dismissed: true,
      loginKey: loginKeyRef.current,
    });
  };

  const submit = async () => {
    if (!user || !rating || reviewText.trim().length < 3 || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      const { error: submitError } = await supabase.rpc("submit_app_review", {
        p_rating: rating,
        p_review_text: reviewText.trim(),
        p_is_anonymous: false,
      });

      if (submitError) {
        setError(
          submitError.message.includes("review_rate_limited")
            ? "You’ve already shared a review recently."
            : submitError.message.includes("invalid_review_text")
              ? "Write a review between 3 and 1,200 characters."
              : "Your review could not be submitted right now.",
        );
        return;
      }

      reviewedRef.current = true;
      writeReviewPrompt(user.id, {
        remainingMs: 0,
        reviewed: true,
        dismissed: true,
        loginKey: loginKeyRef.current,
      });
      setScheduleVersion((version) => version + 1);
      setOpen(false);
      setRating(0);
      setReviewText("");
      setHoverRating(0);
    } catch (cause) {
      console.error("Automatic review submission failed.", cause);
      setError("Your review could not be submitted. Please try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (authLoading || !user || !open) return null;

  return (
    <Dialog
      open
      title="How is VELORI feeling?"
      description="Your honest feedback helps us make room for more meaningful connection."
      onClose={dismiss}
      className="app-review-dialog"
      actions={
        <>
          <Button className="button button-outline" onClick={dismiss} disabled={submitting}>
            Not now
          </Button>
          <Button
            className="app-review-submit"
            disabled={!rating || reviewText.trim().length < 3 || reviewText.trim().length > 1200}
            loading={submitting}
            onClick={() => void submit()}
          >
            Send review
          </Button>
        </>
      }
    >
      <div className="app-review-form">
        <fieldset>
          <legend>Your rating</legend>
          <div
            className="app-review-rating-input"
            role="group"
            aria-label="Choose a rating from 1 to 5 stars"
            onMouseLeave={() => setHoverRating(0)}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <m.button
                key={value}
                type="button"
                aria-pressed={rating === value}
                aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                className={
                  value <= (hoverRating || rating)
                    ? "app-review-star is-selected"
                    : "app-review-star"
                }
                whileHover={{ scale: 1.12, rotate: -4 }}
                whileTap={{ scale: 0.9 }}
                onMouseEnter={() => setHoverRating(value)}
                onFocus={() => setHoverRating(value)}
                onBlur={() => setHoverRating(0)}
                onClick={() => setRating(value)}
              >
                <Star fill={value <= (hoverRating || rating) ? "currentColor" : "none"} />
              </m.button>
            ))}
          </div>
        </fieldset>
        <label className="app-review-text-label">
          Your review
          <Textarea
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value.slice(0, 1200))}
            placeholder="Tell us what you think."
            maxLength={1200}
            rows={5}
          />
        </label>
        {error ? (
          <p className="app-review-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

export function ReviewInvitation({ variant = "card" }: { variant?: "card" | "footer" }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState("");
  const [statusRetry, setStatusRetry] = useState(0);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAvailable(true);
      setStatusError("");
      return;
    }
    let active = true;
    void (async () => {
      try {
        const { data, error: resultError } = await supabase.rpc("get_my_app_review_status");
        if (!active) return;
        if (resultError) {
          setStatusError("Your review invitation could not be checked. Please retry.");
          setAvailable(null);
          return;
        }
        const status = data as unknown as { can_submit?: boolean } | null;
        if (typeof status?.can_submit !== "boolean") {
          setStatusError("Your review invitation could not be checked. Please retry.");
          setAvailable(null);
          return;
        }
        setAvailable(status?.can_submit === true);
        setStatusError("");
      } catch {
        if (!active) return;
        setStatusError("Your review invitation could not be checked. Please retry.");
        setAvailable(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [authLoading, statusRetry, user?.id]);

  const close = () => {
    if (!submitting) setOpen(false);
  };
  const submit = async () => {
    if (!user || !rating || reviewText.trim().length < 3 || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const { error: submitError } = await supabase.rpc("submit_app_review", {
        p_rating: rating,
        p_review_text: reviewText.trim(),
        p_is_anonymous: anonymous,
      });
      if (submitError) {
        setError(
          submitError.message.includes("review_rate_limited")
            ? "You’ve already shared a review recently. You can submit another after 30 days."
            : submitError.message.includes("invalid_review_text")
              ? "Write a review between 3 and 1,200 characters."
              : "Your review could not be submitted. Please try again.",
        );
        return;
      }
      setSubmitted(true);
      setAvailable(false);
    } catch {
      setError("Your review could not be submitted. Please check your connection and try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (authLoading) return null;
  const unavailable = available === false && !submitted;
  const className =
    variant === "footer"
      ? "app-review-invitation app-review-invitation--footer"
      : "app-review-invitation";

  return (
    <>
      {statusError ? (
        <div className="app-review-invitation-error" role="alert">
          {statusError}{" "}
          <button
            type="button"
            onClick={() => {
              setStatusRetry((retry) => retry + 1);
              setStatusError("");
            }}
          >
            Try again
          </button>
        </div>
      ) : null}
      <footer className={className} aria-label="Share feedback">
        <span className="app-review-invitation-icon" aria-hidden="true">
          <Star fill="currentColor" />
        </span>
        <div>
          <strong>
            {variant === "footer" ? "Help make VELORI better" : "Enjoying your time here?"}
          </strong>
          <p>
            {variant === "footer"
              ? "Your feedback helps us make VELORI even better."
              : "A few words can help make VELORI even better."}
          </p>
        </div>
        <button
          type="button"
          className="app-review-invite-cta"
          disabled={Boolean(user) && available === null}
          onClick={() => setOpen(true)}
        >
          {submitted ? "Review sent" : "Leave a review"}
        </button>
      </footer>

      <Dialog
        open={open}
        title={
          submitted
            ? "Thank you for sharing"
            : unavailable
              ? "Thanks for your feedback"
              : "How is VELORI feeling?"
        }
        description={
          submitted
            ? "Your review is in our moderation queue. It will appear here after approval."
            : unavailable
              ? "You’ve already shared a review recently. You can submit another after 30 days."
              : "Your honest feedback helps us make room for more meaningful connection."
        }
        onClose={close}
        className="app-review-dialog"
        actions={
          submitted || unavailable ? (
            <Button className="app-review-submit" onClick={close}>
              {submitted ? "Done" : "Got it"}
            </Button>
          ) : user ? (
            <Button
              className="app-review-submit"
              disabled={!rating || reviewText.trim().length < 3 || reviewText.trim().length > 1200}
              loading={submitting}
              onClick={() => void submit()}
            >
              Send review
            </Button>
          ) : (
            <>
              <Link
                className="button button-primary"
                to="/login"
                state={{ from: location.pathname }}
                onClick={close}
              >
                Log in to review
              </Link>
              <Link
                className="button button-outline"
                to="/signup"
                state={{ from: location.pathname }}
                onClick={close}
              >
                Create account
              </Link>
            </>
          )
        }
      >
        {submitted ? (
          <div className="app-review-success" role="status">
            <span aria-hidden="true">✦</span>
            <p>Your review has been received and is pending moderation.</p>
          </div>
        ) : unavailable ? (
          <p className="app-review-signin-note" role="status">
            Thanks for taking the time to review VELORI. You can share another review after 30 days.
          </p>
        ) : (
          <div className="app-review-form">
            <fieldset>
              <legend>Your rating</legend>
              <div
                className="app-review-rating-input"
                role="group"
                aria-label="Choose a rating from 1 to 5 stars"
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <m.button
                    key={value}
                    type="button"
                    aria-pressed={rating === value}
                    aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                    className={
                      value <= (hoverRating || rating)
                        ? "app-review-star is-selected"
                        : "app-review-star"
                    }
                    whileHover={{ scale: 1.12, rotate: -4 }}
                    whileTap={{ scale: 0.9 }}
                    onMouseEnter={() => setHoverRating(value)}
                    onFocus={() => setHoverRating(value)}
                    onBlur={() => setHoverRating(0)}
                    onClick={() => setRating(value)}
                  >
                    <Star fill={value <= (hoverRating || rating) ? "currentColor" : "none"} />
                  </m.button>
                ))}
              </div>
            </fieldset>
            <div className="app-review-suggestions" aria-label="Suggested review starters">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => setReviewText(suggestion)}
                  aria-pressed={reviewText === suggestion}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <label className="app-review-text-label">
              Your review
              <Textarea
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value.slice(0, 1200))}
                placeholder="Tell us what you think. You can edit any suggested text."
                maxLength={1200}
                rows={5}
                aria-describedby="app-review-character-count"
              />
            </label>
            <span id="app-review-character-count" className="app-review-character-count">
              {reviewText.trim().length}/1,200
            </span>
            {user ? (
              <label className="app-review-anonymous">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(event) => setAnonymous(event.target.checked)}
                />
                Show my name as Anonymous
              </label>
            ) : (
              <p className="app-review-signin-note">
                Sign in or create an account to submit a review. All reviews are moderated before
                appearing publicly.
              </p>
            )}
            {error ? (
              <p className="app-review-form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </Dialog>
    </>
  );
}
