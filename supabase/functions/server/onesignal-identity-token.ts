import { importPKCS8, SignJWT } from "jose";

export async function signOneSignalIdentityToken(
  externalId: string,
  appId: string,
  privateKey: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const key = await importPKCS8(privateKey.replace(/\\n/g, "\n"), "ES256");
  return new SignJWT({ identity: { external_id: externalId } })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuer(appId)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 300)
    .sign(key);
}
