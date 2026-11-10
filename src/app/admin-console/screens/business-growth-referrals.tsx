import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  adminPatchReferralProgram,
  adminReferralEvents,
  adminReferralProgram,
  adminReferralRewards,
  adminReferrals,
  adminReverseReferralReward,
  type ReferralProgram,
} from "../../../lib/admin-api";
import { Button, Input, Textarea } from "../primitives";
import { ConsoleScreen } from "../frame";
import { usePermissions } from "../session";
import { Card, Empty, Field, Loading, Notice, Pill, describe, useResource } from "../widgets";
import "./business-growth.css";

type ProgramForm = {
  enabled: boolean;
  starts_at: string;
  ends_at: string;
  require_verified_email: boolean;
  min_successful_generations: string;
  inviter_reward_tokens: string;
  invitee_reward_tokens: string;
  max_rewards_per_inviter: string;
  max_total_qualified_referrals: string;
  max_lifetime_reward_tokens_per_user: string;
};

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function fromProgram(program: ReferralProgram): ProgramForm {
  return {
    enabled: program.enabled,
    starts_at: localDate(program.starts_at),
    ends_at: localDate(program.ends_at),
    require_verified_email: program.require_verified_email,
    min_successful_generations: String(program.min_successful_generations),
    inviter_reward_tokens: String(program.inviter_reward_tokens),
    invitee_reward_tokens: String(program.invitee_reward_tokens),
    max_rewards_per_inviter: String(program.max_rewards_per_inviter),
    max_total_qualified_referrals: String(program.max_total_qualified_referrals),
    max_lifetime_reward_tokens_per_user: String(program.max_lifetime_reward_tokens_per_user),
  };
}

function toUtc(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function ProgramSettings() {
  const permissions = usePermissions();
  const canEdit = permissions.has("referrals.edit");
  const program = useResource(() => adminReferralProgram(), []);
  const [form, setForm] = useState<ProgramForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (program.data) setForm(fromProgram(program.data.program));
  }, [program.data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await adminPatchReferralProgram({
        ...form,
        starts_at: toUtc(form.starts_at),
        ends_at: toUtc(form.ends_at),
        min_successful_generations: Number(form.min_successful_generations),
        inviter_reward_tokens: Number(form.inviter_reward_tokens),
        invitee_reward_tokens: Number(form.invitee_reward_tokens),
        max_rewards_per_inviter: Number(form.max_rewards_per_inviter),
        max_total_qualified_referrals: Number(form.max_total_qualified_referrals),
        max_lifetime_reward_tokens_per_user: Number(form.max_lifetime_reward_tokens_per_user),
        reason: "Referral program settings changed in Business & Growth.",
      });
      setNotice("Referral program settings saved.");
      program.reload();
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Program rules"
      subtitle="Reward issuance requires trusted Android installation verification as well as the configured qualification criteria."
    >
      {program.loading && <Loading label="Loading referral program settings" />}
      {program.error && <Notice tone="error">{program.error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <Notice tone="error">
        Android installation verification is not available in this repository: there is no Android
        source or trusted install-evidence integration. The program is kept disabled, and the server
        rejects attempts to enable it. Referral records cannot qualify or issue rewards until
        verification is implemented and deployed.
      </Notice>
      {form && (
        <form className="admin-form-grid" onSubmit={submit}>
          <Field label="Program enabled">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Input
                type="checkbox"
                checked={form.enabled}
                disabled={!canEdit || !form.enabled}
                onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
              />
              {form.enabled
                ? "Accept new referrals and process eligible rewards"
                : "Unavailable until installation verification is deployed"}
            </label>
          </Field>
          <Field label="Require verified email">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Input
                type="checkbox"
                checked={form.require_verified_email}
                disabled={!canEdit}
                onChange={(event) =>
                  setForm({ ...form, require_verified_email: event.target.checked })
                }
              />
              Invitee must verify their email
            </label>
          </Field>
          <Field label="Program starts" hint="Leave blank for no start boundary.">
            <Input
              type="datetime-local"
              value={form.starts_at}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
            />
          </Field>
          <Field label="Program ends" hint="Leave blank for no end boundary.">
            <Input
              type="datetime-local"
              value={form.ends_at}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, ends_at: event.target.value })}
            />
          </Field>
          <Field label="Required successful Forge generations">
            <Input
              required
              type="number"
              min={1}
              max={100}
              value={form.min_successful_generations}
              disabled={!canEdit}
              onChange={(event) =>
                setForm({ ...form, min_successful_generations: event.target.value })
              }
            />
          </Field>
          <Field label="Inviter reward (Forge tokens)">
            <Input
              required
              type="number"
              min={0}
              max={1000}
              value={form.inviter_reward_tokens}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, inviter_reward_tokens: event.target.value })}
            />
          </Field>
          <Field label="Invitee reward (Forge tokens)">
            <Input
              required
              type="number"
              min={0}
              max={1000}
              value={form.invitee_reward_tokens}
              disabled={!canEdit}
              onChange={(event) => setForm({ ...form, invitee_reward_tokens: event.target.value })}
            />
          </Field>
          <Field label="Maximum referrals rewarded per inviter">
            <Input
              required
              type="number"
              min={1}
              max={10000}
              value={form.max_rewards_per_inviter}
              disabled={!canEdit}
              onChange={(event) =>
                setForm({ ...form, max_rewards_per_inviter: event.target.value })
              }
            />
          </Field>
          <Field label="Program-wide qualified referral cap">
            <Input
              required
              type="number"
              min={1}
              max={1000000}
              value={form.max_total_qualified_referrals}
              disabled={!canEdit}
              onChange={(event) =>
                setForm({ ...form, max_total_qualified_referrals: event.target.value })
              }
            />
          </Field>
          <Field label="Lifetime reward-token cap per user">
            <Input
              required
              type="number"
              min={1}
              max={1000000}
              value={form.max_lifetime_reward_tokens_per_user}
              disabled={!canEdit}
              onChange={(event) =>
                setForm({ ...form, max_lifetime_reward_tokens_per_user: event.target.value })
              }
            />
          </Field>
          {canEdit && (
            <div className="admin-row-actions">
              <Button
                type="submit"
                className="admin-button admin-primary"
                disabled={busy || program.loading}
              >
                {busy ? "Saving…" : "Save program rules"}
              </Button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}

function ReferralRecords() {
  const records = useResource(() => adminReferrals({ page: 1, perPage: 100 }), []);
  return (
    <Card
      title="Referral history"
      subtitle={`${records.data?.total ?? 0} persisted referral records`}
    >
      {records.loading ? (
        <Loading label="Loading referral history" />
      ) : records.error ? (
        <Notice tone="error">{records.error}</Notice>
      ) : records.data?.referrals.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Invitee</th>
                <th>Inviter</th>
                <th>Code</th>
                <th>Registered</th>
                <th>Qualified</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {records.data.referrals.map((record) => (
                <tr key={record.id}>
                  <td>
                    <small>{record.invitee_id}</small>
                  </td>
                  <td>
                    <small>{record.inviter_id ?? "No valid inviter"}</small>
                  </td>
                  <td>{record.referral_code}</td>
                  <td>{new Date(record.registered_at).toLocaleString()}</td>
                  <td>
                    {record.qualified_at ? new Date(record.qualified_at).toLocaleString() : "—"}
                  </td>
                  <td>
                    <Pill
                      tone={
                        record.status === "qualified"
                          ? "success"
                          : record.status === "rejected"
                            ? "neutral"
                            : "neutral"
                      }
                    >
                      {record.status}
                      {record.status_reason ? ` · ${record.status_reason}` : ""}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No referrals have been recorded.</Empty>
      )}
    </Card>
  );
}

function RewardTransactions() {
  const permissions = usePermissions();
  const canReverse = permissions.has("referrals.reverse");
  const rewards = useResource(() => adminReferralRewards({ page: 1, perPage: 100 }), []);
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function reverse(event: FormEvent) {
    event.preventDefault();
    if (!reversing || !reason.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await adminReverseReferralReward(reversing, reason.trim());
      setReversing(null);
      setReason("");
      setNotice("Reward reversal recorded and deducted from the recipient’s Forge token balance.");
      rewards.reload();
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Reward transactions"
      subtitle={`${rewards.data?.total ?? 0} database-backed Forge-token transactions`}
    >
      {notice && <Notice tone="success">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {reversing && (
        <form className="admin-form-grid" onSubmit={reverse}>
          <Field label="Reversal reason">
            <Textarea
              required
              minLength={1}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div className="admin-row-actions">
            <Button className="admin-button admin-primary" disabled={busy}>
              {busy ? "Reversing…" : "Confirm reversal"}
            </Button>
            <Button
              type="button"
              className="admin-button"
              disabled={busy}
              onClick={() => setReversing(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {rewards.loading ? (
        <Loading label="Loading reward transactions" />
      ) : rewards.error ? (
        <Notice tone="error">{rewards.error}</Notice>
      ) : rewards.data?.rewards.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Created</th>
                <th>State</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rewards.data.rewards.map((reward) => (
                <tr key={reward.id}>
                  <td>
                    <small>{reward.recipient_id}</small>
                  </td>
                  <td>{reward.reward_type.replace(/_/g, " ")}</td>
                  <td>{reward.amount}</td>
                  <td>{new Date(reward.created_at).toLocaleString()}</td>
                  <td>
                    <Pill tone={reward.status === "granted" ? "success" : "neutral"}>
                      {reward.status}
                    </Pill>
                  </td>
                  <td>
                    {canReverse && reward.status === "granted" && (
                      <Button
                        className="admin-button"
                        onClick={() => {
                          setError("");
                          setReversing(reward.id);
                        }}
                      >
                        Reverse
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No reward transactions have been issued.</Empty>
      )}
    </Card>
  );
}

function ProcessingHistory() {
  const events = useResource(() => adminReferralEvents({ page: 1, perPage: 100 }), []);
  return (
    <Card
      title="Processing & audit history"
      subtitle={`${events.data?.total ?? 0} persisted referral events, including failed reward processing`}
    >
      {events.loading ? (
        <Loading label="Loading referral processing history" />
      ) : events.error ? (
        <Notice tone="error">{events.error}</Notice>
      ) : events.data?.events.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Referral</th>
                <th>Reason</th>
                <th>Details</th>
                <th>Occurred</th>
              </tr>
            </thead>
            <tbody>
              {events.data.events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <Pill tone={event.event_type === "processing_failed" ? "error" : "neutral"}>
                      {event.event_type.replace(/_/g, " ")}
                    </Pill>
                  </td>
                  <td>
                    <small>{event.referral_id}</small>
                  </td>
                  <td>{event.reason || "—"}</td>
                  <td>
                    <small>
                      {event.details.sqlstate ? `SQLSTATE ${String(event.details.sqlstate)}` : "—"}
                    </small>
                  </td>
                  <td>{new Date(event.occurred_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No referral processing events have been recorded.</Empty>
      )}
    </Card>
  );
}

export function BusinessGrowthReferralsScreen() {
  return (
    <ConsoleScreen anyOf={["referrals.view"]}>
      <div className="business-growth-admin business-growth-referrals">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">Business &amp; Growth</p>
            <h1>Referrals &amp; Rewards</h1>
            <p>
              Registration creates pending attribution; reward tokens are issued only after
              server-verified eligibility.
            </p>
          </div>
        </div>
        <p>
          <Link to="/admin/audit" className="admin-inline-link">
            View administrative audit history
          </Link>
        </p>
        <ProgramSettings />
        <ReferralRecords />
        <RewardTransactions />
        <ProcessingHistory />
      </div>
    </ConsoleScreen>
  );
}
