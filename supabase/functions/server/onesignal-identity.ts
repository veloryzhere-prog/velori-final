import { service, type Ctx } from "./admin-core.ts";
import { signOneSignalIdentityToken } from "./onesignal-identity-token.ts";

const APP_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function handleOneSignalIdentityToken(c: Ctx) {
  const authorization = c.req.header("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!accessToken) return c.json({ error: "Sign in to sync push notifications." }, 401);

  const appId = Deno.env.get("ONESIGNAL_APP_ID")?.trim() ?? "";
  const privateKey = Deno.env.get("ONESIGNAL_IDENTITY_VERIFICATION_SECRET_KEY")?.trim() ?? "";
  if (!APP_ID_PATTERN.test(appId) || !privateKey) {
    return c.json({ error: "Secure push identity is not configured." }, 503);
  }

  const { data, error } = await service().auth.getUser(accessToken);
  if (error || !data.user?.id) {
    return c.json({ error: "The sign-in session is invalid or expired." }, 401);
  }

  try {
    const token = await signOneSignalIdentityToken(data.user.id, appId, privateKey);
    return c.json({ token, expiresIn: 300 });
  } catch {
    return c.json({ error: "Secure push identity could not be issued." }, 503);
  }
}
