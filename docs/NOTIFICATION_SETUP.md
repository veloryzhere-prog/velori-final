# VELORI notification setup

This guide covers Android and browser OneSignal, the separate VELORI VAPID
browser path, the authenticated Edge Function, and existing in-app notifications.
It does not authorize resetting a database or deploying to an unverified project.

## Current implementation checklist

- [x] Retain the existing notification feed, user preferences, campaign records,
  admin sessions, and chat data.
- [x] Keep browser OneSignal, VELORI VAPID browser push, and native OneSignal
  subscriptions separate.
- [x] Initialize the OneSignal Web SDK using the supplied public App ID and its
  own `/onesignal/` service-worker scope.
- [x] Link opted-in browser subscriptions to the authenticated VELORI account
  using the existing short-lived OneSignal identity token.
- [x] Add an authenticated OneSignal test endpoint restricted to the caller's
  account and a dedicated Notification Settings action.
- [x] Add an Android native bridge for permission state, subscription state,
  secure identity login/logout, settings, and notification-tap payloads.
- [x] Add a first-launch permission introduction and an Android notification
  settings entry.
- [x] Add an authenticated Edge Function endpoint that signs short-lived ES256
  OneSignal identity tokens from the verified Supabase user UUID.
- [x] Add OneSignal campaign push delivery for accounts that opted in to system
  push, with provider status distinct from in-app receipt counts.
- [x] Add idempotent chat push dispatch that checks the authenticated message
  sender, participants, mute state, and push preferences.
- [x] Add a server-only push delivery table and campaign delivery metadata
  migration.
- [ ] Configure the OneSignal REST API key, identity verification key, and
  Android/Firebase credentials in the verified Supabase project.
- [ ] Verify push, permission, identity, foreground/background/terminated tap,
  account switching, and chat flows on real Android devices.

## OneSignal and Firebase setup

1. In OneSignal, open **Settings → Keys & IDs** and confirm the Android app uses
   the App ID `86e2e54e-2c25-49cb-97e5-f64030ac74b9`. The Android `Application`
   initializes that public identifier; it is not a credential.
2. The browser build initializes the same app ID from `index.html`. The OneSignal
    worker is served at `/onesignal/OneSignalSDKWorker.js` and uses the distinct
    `/onesignal/` scope so it does not replace VELORI's existing root service
    worker. Browser users opt in from Notification Settings; permission is never
    requested automatically. The SDK initializes only on the configured
    `https://chat.veloryz.online` origin. Register any development origin in
    OneSignal before testing the browser SDK on it.
3. Configure `ONESIGNAL_REST_API_KEY` and
    `ONESIGNAL_IDENTITY_VERIFICATION_SECRET_KEY` only as Supabase server secrets.
    The test sender targets only the authenticated caller's external ID.
4. In Firebase, add an Android app whose package is exactly
   `online.veloryz.chat`. Download its matching `google-services.json` and
   replace the local Android config only after verifying it belongs to the
   intended Firebase project. The currently present file does not contain a
   matching client, so Android app assembly is blocked.
5. In OneSignal **Settings → Push & In-App → Android**, configure the matching
   Firebase FCM service-account credential. Do not put that private key in
   frontend code, Android assets, or Git.
6. In OneSignal **Settings → Keys & IDs → Identity Verification**, generate an
   ES256 P-256 key pair. Keep the private PEM server-side and add its public key
   in OneSignal. Android and browser clients use a five-minute token minted by
   the authenticated Edge Function for `OneSignal.login`; they never trust an
   external ID supplied by the page without that token.
7. Enable OneSignal Token Identity Verification only after both Android and
   browser clients are deployed with the signed identity-token flow.

## Secrets and Edge Function deployment

Copy the placeholder template to a local, ignored file:

```powershell
Copy-Item supabase/functions/.env.notifications.example supabase/functions/.env.notifications
```

Replace placeholders locally. Never add `ONESIGNAL_REST_API_KEY`,
`ONESIGNAL_IDENTITY_VERIFICATION_SECRET_KEY`, or the Supabase service-role key
to a `VITE_` variable. The example is placeholders-only; `SUPABASE_URL` and the
service-role key are normally injected by Supabase and must remain trusted
server-side values.

The local Supabase URL host and `supabase/config.toml` both resolve to
`mvvjyxfojxyuwsykfujf`; an earlier implementation brief instead named
`gmgobchwnfkwfuekhpkr`. Do not deploy to the differing project without owner
confirmation. No database migration or function deployment is performed by this
setup guide.

After the target is confirmed, configure the secrets in that project using a
secure local env file:

```powershell
supabase secrets set --env-file supabase/functions/.env.notifications --project-ref <verified-project-ref>
```

Review the configured secret names without printing secret values. Then deploy
the existing `server` function (do not create a competing notification
function):

```powershell
supabase functions deploy server --project-ref <verified-project-ref>
```

## Safe database migration

The migration
`supabase/migrations/20261102000000_velori_onesignal_campaign_delivery.sql`
adds campaign push status and request-idempotency fields, plus the RLS-locked
`notification_push_deliveries` table. It does not replace existing notification,
profile, or message rows.

Before applying it:

1. Confirm the project reference and database owner.
2. Inspect remote migration history and schema for drift.
3. Review the migration SQL and run the project's supported migration dry-run.
4. Back up according to the project's normal release process.
5. Apply migrations with the normal migration workflow; never use `db reset`.

No migration has been applied remotely by this task.

## Android permission and identity testing

1. Build with the matching `google-services.json`, install on Android 13+ and
   confirm VELORI's introduction appears only after sign-in and only while
   permission can still be requested.
2. Select **Enable Notifications** and verify the actual Android system
   permission prompt appears. Denied users can reopen Android app notification
   settings from VELORI's Notification Settings route.
3. Confirm permission and OneSignal subscription state in Android settings and
   the OneSignal dashboard. A stored preference is not proof of OS permission.
4. Sign in, switch accounts, and sign out. Verify OneSignal `login` receives the
   authenticated Supabase UUID and the server-issued ES256 token, and that
   `logout` clears the prior association before a different account is linked.
5. Tap an announcement or chat notification while foregrounded, backgrounded,
   and after process termination. The native bridge queues the internal route;
   the app validates it before navigation and sends unauthenticated users
   through login with the intended route as return state.

## Campaign and chat push testing

- The existing admin console requires `notifications.send` and recent
  reauthentication. The urgent option requires push delivery and a separate
  final confirmation.
- The server resolves in-app recipients using the existing campaign dispatch
  RPC, then targets only users whose `push_enabled` and `push_system`
  preferences are enabled. User OS permission and OneSignal subscription status
  remain controlled by Android and OneSignal.
- Campaign `push_status` reports `pending`, `accepted`, `partial`, `failed`,
  `not_configured`, `no_recipients`, or `not_requested`. Provider acceptance is
  not proof that a device displayed the notification. `pending` indicates that
  the request was recorded before provider dispatch and its final outcome is not
  yet recorded. Provider error bodies and secrets are not returned or logged.
- Chat dispatch runs after the sender's message is persisted. The server
  verifies message ownership, excludes the sender, skips muted participants and
  recipients without `push_enabled`/`push_messages`, and sends generic text
  rather than private message contents. A unique event/recipient record prevents
  duplicate dispatch. Failed chat pushes are recorded but do not roll back an
  already-sent message.
- Existing campaign history has pagination but no provider retry control or
  provider read receipts. Those are not represented as implemented.

## External release requirements

- A Firebase configuration containing the `online.veloryz.chat` client.
- Matching OneSignal FCM credentials, REST API key, and identity-verification
  key pair.
- Confirmation of the intended Supabase project and authorized migration
  deployment.
- Android device testing for camera-independent notification permission,
  subscription, account switching, notification routing, and chat behavior.
- Release signing credentials and confirmation of the prior package/signing
  identity before claiming APK upgrade compatibility.
