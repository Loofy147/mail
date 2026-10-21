import { randomBytes } from "node:crypto";
import {
  AppError, clearCookie, cookie, deleteSession, encryptJson, env, hasGoogleConfig,
  publicErrorCode, rateLimit, sessionHash, setCookie, stateEquals, storeSession
} from "../../lib/server.js";

function redirectCookies(req, res, entries) {
  res.setHeader("Set-Cookie", entries.map((item) => item.clear
    ? clearCookie(req, item.name)
    : setCookie(req, item.name, item.value, item.maxAge)));
}
function redirect(res, code) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Location", code ? "/?auth_error=" + encodeURIComponent(code) : "/?connected=1");
  return res.status(303).end();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const stateCookie = cookie(req, "mailroom_oauth_state");
  const clearState = { name: "mailroom_oauth_state", clear: true };
  try {
    if (req.query?.error) {
      redirectCookies(req, res, [clearState]);
      return redirect(res, "cancelled");
    }
    const code = typeof req.query?.code === "string" ? req.query.code : "";
    const state = typeof req.query?.state === "string" ? req.query.state : "";
    const split = typeof stateCookie === "string" ? stateCookie.indexOf(".") : -1;
    const expectedState = split > 0 ? stateCookie.slice(0, split) : "";
    const verifier = split > 0 ? stateCookie.slice(split + 1) : "";
    if (!code || code.length > 4096 || !stateEquals(state, expectedState) || !/^[A-Za-z0-9_-]{40,100}$/.test(verifier)) {
      redirectCookies(req, res, [clearState]);
      return redirect(res, "oauth_failed");
    }
    if (!hasGoogleConfig()) {
      redirectCookies(req, res, [clearState]);
      return redirect(res, "setup");
    }
    await rateLimit(req, "oauth-callback", 12, 900);
    const tokenBody = new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: env("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
      code_verifier: verifier
    });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
      signal: AbortSignal.timeout(12000)
    });
    const token = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || typeof token.access_token !== "string") {
      redirectCookies(req, res, [clearState]);
      return redirect(res, "oauth_failed");
    }
    const scopes = new Set(String(token.scope || "").split(/\s+/).filter(Boolean));
    if (!scopes.has("https://www.googleapis.com/auth/gmail.modify") ||
        !scopes.has("https://www.googleapis.com/auth/gmail.send")) {
      redirectCookies(req, res, [clearState]);
      return redirect(res, "scope_missing");
    }
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + token.access_token },
      signal: AbortSignal.timeout(12000)
    });
    const profile = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || typeof profile.sub !== "string" ||
        typeof profile.email !== "string" || profile.email_verified !== true) {
      redirectCookies(req, res, [clearState]);
      return redirect(res, "identity_failed");
    }
    const previousId = cookie(req, "mailroom_session");
    const sessionId = randomBytes(32).toString("base64url");
    const hash = sessionHash(sessionId);
    const tokens = {
      access_token: token.access_token,
      refresh_token: typeof token.refresh_token === "string" ? token.refresh_token : null,
      token_type: "Bearer",
      expires_at: Date.now() + Math.max(60, Number(token.expires_in || 3600)) * 1000
    };
    const now = new Date().toISOString();
    await storeSession({
      session_hash: hash,
      provider: "google",
      provider_user_id: profile.sub,
      user_email: profile.email.toLowerCase(),
      encrypted_tokens: encryptJson(tokens),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: now,
      updated_at: now
    });
    if (previousId && /^[A-Za-z0-9_-]{40,64}$/.test(previousId)) {
      try { await deleteSession(sessionHash(previousId)); } catch {}
    }
    redirectCookies(req, res, [
      clearState,
      { name: "mailroom_session", value: sessionId, maxAge: 30 * 24 * 60 * 60 }
    ]);
    return redirect(res, null);
  } catch (error) {
    redirectCookies(req, res, [clearState]);
    if (error instanceof AppError && error.status === 429) return redirect(res, "rate_limit");
    return redirect(res, publicErrorCode(error));
  }
}
