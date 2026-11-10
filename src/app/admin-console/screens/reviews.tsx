import { useEffect, useState } from "react";
import {
  adminAppReviews,
  adminDeleteAppReview,
  adminModerateAppReview,
  type AdminAppReview,
  type AppReviewStatus,
  type AppReviewSummary,
} from "../../../lib/admin-api";
import { Button, Heading1 } from "../primitives";
import { ConsoleScreen, useScreenReauth } from "../frame";
import { usePermission } from "../session";
import {
  AreaField,
  ConfirmDialog,
  Dialog,
  Empty,
  Loading,
  Metric,
  Notice,
  Pager,
  Pill,
  SelectField,
  TextField,
  formatDate,
  useGuardedAction,
  useResource,
} from "../widgets";

const PER_PAGE = 20;
const STATUS_OPTIONS: { value: AppReviewStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "hidden", label: "Hidden" },
];
const RATING_OPTIONS = [
  { value: "", label: "All ratings" },
  ...[5, 4, 3, 2, 1].map((rating) => ({
    value: String(rating),
    label: `${rating} ${rating === 1 ? "star" : "stars"}`,
  })),
];
const STATUS_TONE: Record<AppReviewStatus, string> = {
  pending: "warn",
  approved: "ok",
  rejected: "fail",
  hidden: "neutral",
};

function ReviewDialog({
  review,
  canModerate,
  busy,
  onClose,
  onSave,
}: {
  review: AdminAppReview;
  canModerate: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (status: AppReviewStatus, response: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<AppReviewStatus>(review.status);
  const [response, setResponse] = useState(review.admin_response ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(review.status);
    setResponse(review.admin_response ?? "");
    setError("");
  }, [review.id, review.status, review.admin_response]);

  return (
    <Dialog
      title="Review details"
      description={`Submitted ${formatDate(review.created_at)} · ${review.rating} ${review.rating === 1 ? "star" : "stars"}`}
      onClose={onClose}
      actions={
        <>
          {canModerate ? (
            <Button
              className="admin-primary"
              disabled={
                busy ||
                response.trim().length > 1200 ||
                (status === review.status && response.trim() === (review.admin_response ?? ""))
              }
              onClick={() => {
                setError("");
                void onSave(status, response).catch((caught: unknown) =>
                  setError(
                    caught instanceof Error ? caught.message : "The review could not be saved.",
                  ),
                );
              }}
            >
              {busy ? "Saving…" : "Save review"}
            </Button>
          ) : null}
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="admin-review-detail">
        <p>
          <strong>Reviewer:</strong>{" "}
          {review.is_anonymous ? "Anonymous" : review.reviewer_display_name}
        </p>
        <blockquote>{review.review_text}</blockquote>
      </div>
      {canModerate ? (
        <>
          <SelectField
            label="Moderation status"
            value={status}
            options={STATUS_OPTIONS.filter((option) => option.value)}
            onChange={(value) => setStatus(value as AppReviewStatus)}
          />
          <AreaField
            label="Public response"
            value={response}
            onChange={setResponse}
            hint="Optional response shown with this approved review."
            maxLength={1200}
          />
        </>
      ) : review.admin_response ? (
        <p>
          <strong>VELORI team response:</strong> {review.admin_response}
        </p>
      ) : null}
      <p className="admin-muted">
        {review.moderated_at
          ? `Last moderated ${formatDate(review.moderated_at)}.`
          : "Not yet moderated."}
        {canModerate ? " Changes require recent password verification and are audit logged." : ""}
      </p>
    </Dialog>
  );
}

function ReviewManagementBody() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AppReviewStatus | "">("");
  const [rating, setRating] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<AdminAppReview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAppReview | null>(null);
  const [actionError, setActionError] = useState("");
  const canModerate = usePermission("reviews.moderate");
  const canDelete = usePermission("reviews.delete");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const reviews = useResource(
    () =>
      adminAppReviews({
        page,
        perPage: PER_PAGE,
        status,
        rating: rating ? Number(rating) : "",
        sort,
        startDate,
        endDate,
        q: search,
      }),
    [page, status, rating, sort, startDate, endDate, search],
  );
  const data = reviews.data;
  const summary: AppReviewSummary | undefined = data?.summary;

  const saveReview = async (
    review: AdminAppReview,
    nextStatus: AppReviewStatus,
    response: string,
  ) => {
    setActionError("");
    await guarded(async () => {
      await adminModerateAppReview(review.id, {
        status: nextStatus,
        admin_response: response,
      });
      setTarget(null);
      reviews.reload();
    });
  };

  const filterByStatus = (nextStatus: AppReviewStatus | "") => {
    setPage(1);
    setStatus(nextStatus);
  };

  return (
    <ConsoleScreen anyOf={["reviews.view"]}>
      <div className="admin-panel-heading">
        <div>
          <Heading1>App reviews</Heading1>
          <p>
            Review member feedback, manage public responses, and moderate what appears in VELORI.
          </p>
        </div>
      </div>

      {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      {summary ? (
        <div className="admin-metrics">
          <Metric
            label="All reviews"
            value={summary.total}
            onClick={() => filterByStatus("")}
            pressed={status === ""}
          />
          <Metric
            label="Pending"
            value={summary.pending}
            onClick={() => filterByStatus("pending")}
            pressed={status === "pending"}
          />
          <Metric
            label="Approved"
            value={summary.approved}
            onClick={() => filterByStatus("approved")}
            pressed={status === "approved"}
          />
          <Metric
            label="Rejected"
            value={summary.rejected}
            onClick={() => filterByStatus("rejected")}
            pressed={status === "rejected"}
          />
          <Metric
            label="Hidden"
            value={summary.hidden}
            onClick={() => filterByStatus("hidden")}
            pressed={status === "hidden"}
          />
          <Metric
            label="Approved average"
            value={`${Number(summary.average).toFixed(2)} / 5`}
            note={`${Object.values(summary.distribution).reduce((total, count) => total + count, 0)} published ratings`}
          />
        </div>
      ) : null}

      <div className="admin-card admin-review-filters">
        <form
          className="admin-search"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(term.trim());
          }}
        >
          <TextField
            label="Search review text"
            value={term}
            onChange={setTerm}
            placeholder="Search reviews"
          />
          <Button type="submit" className="admin-primary">
            Search
          </Button>
        </form>
        <div className="admin-review-filter-grid">
          <SelectField
            label="Status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(value) => {
              setPage(1);
              setStatus(value);
            }}
          />
          <SelectField
            label="Rating"
            value={rating}
            options={RATING_OPTIONS}
            onChange={(value) => {
              setPage(1);
              setRating(value);
            }}
          />
          <SelectField
            label="Date order"
            value={sort}
            options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ]}
            onChange={(value) => setSort(value)}
          />
          <TextField
            label="From date"
            type="date"
            value={startDate}
            onChange={(value) => {
              setPage(1);
              setStartDate(value);
            }}
          />
          <TextField
            label="Through date"
            type="date"
            value={endDate}
            onChange={(value) => {
              setPage(1);
              setEndDate(value);
            }}
          />
        </div>
      </div>

      {reviews.loading ? (
        <Loading label="Loading reviews" />
      ) : reviews.error ? (
        <>
          <Notice tone="error">{reviews.error}</Notice>
          <Button type="button" onClick={reviews.reload}>
            Retry
          </Button>
        </>
      ) : data?.items.length ? (
        <>
          <div className="admin-review-list">
            {data.items.map((review) => (
              <article className="admin-card admin-review-item" key={review.id}>
                <div className="admin-review-item-heading">
                  <div>
                    <strong>
                      {review.is_anonymous ? "Anonymous" : review.reviewer_display_name}
                    </strong>
                    <span className="admin-muted">
                      {review.rating} ★ · {formatDate(review.created_at)}
                    </span>
                  </div>
                  <Pill tone={STATUS_TONE[review.status]}>{review.status}</Pill>
                </div>
                <p className="admin-review-excerpt">{review.review_text}</p>
                <div className="admin-row-actions">
                  <Button type="button" onClick={() => setTarget(review)}>
                    {canModerate ? "Review & moderate" : "View review"}
                  </Button>
                  {canModerate && review.status !== "approved" ? (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void guarded(async () => {
                          await adminModerateAppReview(review.id, { status: "approved" });
                          reviews.reload();
                        }).catch((caught: unknown) =>
                          setActionError(
                            caught instanceof Error
                              ? caught.message
                              : "The review could not be approved.",
                          ),
                        );
                      }}
                    >
                      Approve
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      className="admin-danger"
                      onClick={() => setDeleteTarget(review)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <Pager page={page} perPage={PER_PAGE} total={data.total} onPage={setPage} />
        </>
      ) : (
        <Empty>No reviews match these filters.</Empty>
      )}

      {target ? (
        <ReviewDialog
          review={target}
          canModerate={canModerate}
          busy={busy}
          onClose={() => setTarget(null)}
          onSave={(nextStatus, response) => saveReview(target, nextStatus, response)}
        />
      ) : null}
      {deleteTarget ? (
        <ConfirmDialog
          title="Permanently delete this review?"
          description="This removes the review and its moderation history permanently. The action is audit logged."
          confirmLabel="Delete review"
          busy={busy}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await guarded(async () => {
              await adminDeleteAppReview(deleteTarget.id);
              setDeleteTarget(null);
              reviews.reload();
            });
          }}
        />
      ) : null}
    </ConsoleScreen>
  );
}

export function ReviewsScreen() {
  return <ReviewManagementBody />;
}
