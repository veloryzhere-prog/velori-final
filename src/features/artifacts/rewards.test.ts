import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_REWARD_CAMPAIGN,
  normalizeReferralCode,
  generateReferralCode,
  applyCampaignGrant,
  applyReferralReward,
  rewardBalance,
  type RewardLedgerEntry,
} from "./rewards.ts";

test("referral codes normalize and remain unique within a campaign", () => {
  const a = normalizeReferralCode(" forge-7kq2m9 ");
  const b = normalizeReferralCode("FORGE-7KQ2M9");
  assert.equal(a, "FORGE-7KQ2M9");
  assert.equal(b, "FORGE-7KQ2M9");
  const codes = new Set([generateReferralCode("user-1"), generateReferralCode("user-2")]);
  assert.equal(codes.size, 2);
  assert.match([...codes][0], /^FORGE-[A-Z0-9]{7}$/);
});

test("campaign grants enforce the bonus cap and remain idempotent", () => {
  const ledger: RewardLedgerEntry[] = [
    {
      id: "intro-1",
      userId: "u-1",
      campaignId: DEFAULT_REWARD_CAMPAIGN.id,
      type: "introductory",
      amount: 2,
      status: "granted",
      createdAt: new Date().toISOString(),
      eventId: "event-1",
      idempotencyKey: "same-1",
    },
    {
      id: "intro-2",
      userId: "u-1",
      campaignId: DEFAULT_REWARD_CAMPAIGN.id,
      type: "introductory",
      amount: 2,
      status: "granted",
      createdAt: new Date().toISOString(),
      eventId: "event-2",
      idempotencyKey: "same-2",
    },
  ];

  const limit = applyCampaignGrant({
    initialCredits: 5,
    campaign: DEFAULT_REWARD_CAMPAIGN,
    ledger,
    eventId: "event-3",
    amount: 2,
    type: "introductory",
  });

  assert.equal(limit.amount, 1);
  assert.equal(limit.granted, true);
  assert.equal(limit.reason, "remaining-capacity");

  const duplicate = applyCampaignGrant({
    initialCredits: 5,
    campaign: DEFAULT_REWARD_CAMPAIGN,
    ledger: [...ledger, limit.entry!],
    eventId: "event-3",
    amount: 2,
    type: "introductory",
  });
  assert.equal(duplicate.granted, false);
  assert.equal(duplicate.reason, "duplicate-event");
});

test("referral reward application blocks self referrals and respects existing credits", () => {
  const summary = applyReferralReward({
    inviterId: "user-1",
    inviteeId: "user-1",
    campaign: DEFAULT_REWARD_CAMPAIGN,
    ledger: [],
    inviteeReward: 2,
    inviterReward: 2,
    eventId: "self-referral",
  });
  assert.equal(summary.granted, false);
  assert.equal(summary.reason, "self-referral");

  const resumed = rewardBalance({
    initialCredits: 5,
    ledger: [
      {
        id: "r-1",
        userId: "user-2",
        campaignId: DEFAULT_REWARD_CAMPAIGN.id,
        type: "referral-invitee",
        amount: 2,
        status: "granted",
        createdAt: new Date().toISOString(),
        eventId: "event-4",
        idempotencyKey: "same-4",
      },
    ],
  });
  assert.equal(resumed.promoBonus, 2);
  assert.equal(resumed.remainingBalance, 3);
});
