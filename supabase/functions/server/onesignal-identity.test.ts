import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { signOneSignalIdentityToken } from "./onesignal-identity-token.ts";

Deno.test("identity token signs the authenticated external id with a short expiry", async () => {
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  const privatePem = await exportPKCS8(privateKey);
  const now = 1_798_000_000;
  const externalId = "123e4567-e89b-42d3-a456-426614174000";
  const token = await signOneSignalIdentityToken(
    externalId,
    "86e2e54e-2c25-49cb-97e5-f64030ac74b9",
    privatePem,
    now,
  );
  const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
    issuer: "86e2e54e-2c25-49cb-97e5-f64030ac74b9",
    currentDate: new Date(now * 1000),
  });
  const identity = payload.identity as { external_id?: string } | undefined;

  if (protectedHeader.alg !== "ES256" || identity?.external_id !== externalId) {
    throw new Error("Identity JWT must contain the authenticated OneSignal external id.");
  }
  if (payload.exp !== now + 300 || payload.iat !== now) {
    throw new Error("Identity JWT must expire after five minutes.");
  }
});

Deno.test("identity token verification rejects a different external id or app id", async () => {
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  const privatePem = await exportPKCS8(privateKey);
  const token = await signOneSignalIdentityToken(
    "123e4567-e89b-42d3-a456-426614174000",
    "86e2e54e-2c25-49cb-97e5-f64030ac74b9",
    privatePem,
    1_798_000_000,
  );

  await jwtVerify(token, publicKey, {
    issuer: "86e2e54e-2c25-49cb-97e5-f64030ac74b9",
    currentDate: new Date(1_798_000_000 * 1000),
  });
  await jwtVerify(token, publicKey, {
    issuer: "00000000-0000-4000-8000-000000000000",
    currentDate: new Date(1_798_000_000 * 1000),
  }).then(
    () => {
      throw new Error("Identity JWTs for another app must be rejected.");
    },
    () => undefined,
  );
});
