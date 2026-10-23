import { createHash, randomBytes } from "node:crypto";
import { clearCookie, env, hasGoogleConfig, rateLimit, setCookie } from "../../lib/server.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  try {
    if (!hasGoogleConfig()) {
      res.setHeader("Location", "/?auth_error=setup");
      return res.status(303).end();
    }
    await rateLimit(req, "oauth-start", 8, 900);
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const params = new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      redirect_uri: new URL(env("GOOGLE_REDIRECT_URI")).toString(),
      response_type: "code",
      scope: ["openid","email","profile","https://www.googleapis.com/auth/gmail.modify","https://www.googleapis.com/auth/gmail.send"].join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });
    res.setHeader("Set-Cookie", setCookie(req, "mailroom_oauth_state", state + "." + verifier, 600));
    res.setHeader("Location", "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
    return res.status(302).end();
  } catch (error) {
    res.setHeader("Set-Cookie", clearCookie(req, "mailroom_oauth_state"));
    res.setHeader("Location", error?.code === "rate_limited" ? "/?auth_error=rate_limit" : "/?auth_error=setup");
    return res.status(303).end();
  }
}
