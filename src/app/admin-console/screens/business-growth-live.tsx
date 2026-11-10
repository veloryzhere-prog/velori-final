import { useState, type FormEvent } from "react";
import {
  adminCreateOffer,
  adminOffers,
  adminPatchOffer,
  type OfferEligibility,
  type OfferRow,
  type OfferType,
} from "../../../lib/admin-api";
import { Button, Input, Textarea } from "../primitives";
import { ConsoleScreen } from "../frame";
import { usePermissions } from "../session";
import { Card, Empty, Field, Loading, Notice, Pill, describe, useResource } from "../widgets";
import "./business-growth.css";

type OfferForm = {
  title: string;
  description: string;
  offer_type: OfferType;
  eligibility: OfferEligibility;
  starts_at: string;
  ends_at: string;
  usage_limit: string;
};

const EMPTY_FORM: OfferForm = {
  title: "",
  description: "",
  offer_type: "manual",
  eligibility: "all_users",
  starts_at: "",
  ends_at: "",
  usage_limit: "100",
};

function localDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function OfferEditor({
  offer,
  onSaved,
  onCancel,
}: {
  offer: OfferRow | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<OfferForm>(() =>
    offer
      ? {
          title: offer.title,
          description: offer.description,
          offer_type: offer.offer_type,
          eligibility: offer.eligibility,
          starts_at: localDate(offer.starts_at),
          ends_at: localDate(offer.ends_at),
          usage_limit: String(offer.usage_limit),
        }
      : EMPTY_FORM,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        description: form.description,
        offer_type: form.offer_type,
        eligibility: form.eligibility,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        usage_limit: Number(form.usage_limit),
        reason: offer
          ? "Offer details updated in the admin console."
          : "Offer created in the admin console.",
      };
      if (offer) await adminPatchOffer(offer.id, payload);
      else await adminCreateOffer(payload);
      onSaved();
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={offer ? "Edit offer" : "Create offer"}
      subtitle="New offers are saved as drafts and must be activated after review."
    >
      {error && <Notice tone="error">{error}</Notice>}
      <form onSubmit={submit} className="admin-form-grid">
        <Field label="Title">
          <Input
            required
            maxLength={120}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </Field>
        <Field label="Offer type">
          <select
            value={form.offer_type}
            onChange={(event) => setForm({ ...form, offer_type: event.target.value as OfferType })}
          >
            <option value="percentage">Percentage</option>
            <option value="fixed_amount">Fixed amount</option>
            <option value="bundle">Bundle</option>
            <option value="free_trial">Free trial</option>
            <option value="manual">Manual</option>
          </select>
        </Field>
        <Field label="Eligibility">
          <select
            value={form.eligibility}
            onChange={(event) =>
              setForm({ ...form, eligibility: event.target.value as OfferEligibility })
            }
          >
            <option value="all_users">All users</option>
            <option value="new_users">New users</option>
            <option value="pro_users">Pro users</option>
            <option value="creator_users">Creator users</option>
            <option value="vip_users">VIP users</option>
          </select>
        </Field>
        <Field
          label="Usage limit"
          hint="Maximum configured redemptions; the current app has no redemption endpoint."
        >
          <Input
            required
            min={1}
            max={10000000}
            type="number"
            value={form.usage_limit}
            onChange={(event) => setForm({ ...form, usage_limit: event.target.value })}
          />
        </Field>
        <Field label="Starts at">
          <Input
            required
            type="datetime-local"
            value={form.starts_at}
            onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
          />
        </Field>
        <Field label="Ends at">
          <Input
            required
            type="datetime-local"
            value={form.ends_at}
            onChange={(event) => setForm({ ...form, ends_at: event.target.value })}
          />
        </Field>
        <Field label="Description">
          <Textarea
            maxLength={2000}
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>
        <div className="admin-row-actions">
          <Button type="submit" className="admin-button admin-primary" disabled={busy}>
            {busy ? "Saving…" : offer ? "Save changes" : "Create draft"}
          </Button>
          <Button type="button" className="admin-button" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function OffersBody() {
  const permissions = usePermissions();
  const canEdit = permissions.has("offers.edit");
  const resource = useResource(() => adminOffers({ page: 1, perPage: 100 }), []);
  const [editing, setEditing] = useState<OfferRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [mutationError, setMutationError] = useState("");

  async function changeStatus(offer: OfferRow, status: "active" | "paused" | "archived") {
    setMutationError("");
    setMessage("");
    if (
      status === "archived" &&
      !window.confirm(`Archive “${offer.title}”? This cannot be undone.`)
    )
      return;
    try {
      await adminPatchOffer(offer.id, {
        status,
        reason: `Status changed to ${status} in the admin console.`,
      });
      setMessage(`Offer ${status === "paused" ? "deactivated" : status}.`);
      resource.reload();
    } catch (caught) {
      setMutationError(describe(caught));
    }
  }

  function saved() {
    setCreating(false);
    setEditing(null);
    setMessage("Offer saved.");
    resource.reload();
  }

  return (
    <>
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">Business &amp; Growth</p>
          <h1>Offers &amp; Promotions</h1>
          <p>
            Manage offer configuration and lifecycle. Redemption is not connected to checkout, so no
            usage or conversion metrics are reported.
          </p>
        </div>
        {canEdit && (
          <div className="admin-row-actions">
            <Button
              className="admin-button admin-primary"
              onClick={() => {
                setEditing(null);
                setCreating(true);
              }}
            >
              Create offer
            </Button>
          </div>
        )}
      </div>
      {message && <Notice tone="success">{message}</Notice>}
      {mutationError && <Notice tone="error">{mutationError}</Notice>}
      {(creating || editing) && (
        <OfferEditor
          key={editing?.id ?? "new-offer"}
          offer={editing}
          onSaved={saved}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      <Card title="Saved offers" subtitle={`${resource.data?.total ?? 0} offers from the database`}>
        {resource.loading ? (
          <Loading label="Loading saved offers" />
        ) : resource.error ? (
          <Notice tone="error">{resource.error}</Notice>
        ) : resource.data?.offers.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Offer</th>
                  <th>Eligibility</th>
                  <th>Window</th>
                  <th>Usage limit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.offers.map((offer) => (
                  <tr key={offer.id}>
                    <td>
                      <strong>{offer.title}</strong>
                      <small>{offer.offer_type.replace(/_/g, " ")}</small>
                    </td>
                    <td>{offer.eligibility.replace(/_/g, " ")}</td>
                    <td>
                      <small>
                        {new Date(offer.starts_at).toLocaleString()}
                        <br />
                        to {new Date(offer.ends_at).toLocaleString()}
                      </small>
                    </td>
                    <td>{offer.usage_limit}</td>
                    <td>
                      <Pill tone={offer.status === "active" ? "success" : "neutral"}>
                        {offer.status}
                      </Pill>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        {canEdit && offer.status !== "archived" && (
                          <Button
                            className="admin-button"
                            onClick={() => {
                              setCreating(false);
                              setEditing(offer);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        {canEdit && offer.status !== "archived" && offer.status !== "active" && (
                          <Button
                            className="admin-button"
                            onClick={() => void changeStatus(offer, "active")}
                          >
                            Activate
                          </Button>
                        )}
                        {canEdit && offer.status === "active" && (
                          <Button
                            className="admin-button"
                            onClick={() => void changeStatus(offer, "paused")}
                          >
                            Deactivate
                          </Button>
                        )}
                        {canEdit && offer.status !== "archived" && (
                          <Button
                            className="admin-button"
                            onClick={() => void changeStatus(offer, "archived")}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No offers have been saved yet.</Empty>
        )}
      </Card>
    </>
  );
}

export function BusinessGrowthOffersScreen() {
  return (
    <ConsoleScreen anyOf={["offers.view"]}>
      <div className="business-growth-admin business-growth-offers">
        <OffersBody />
      </div>
    </ConsoleScreen>
  );
}
