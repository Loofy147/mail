import { clearCookie, deleteSession, fail, getSession, json, methodNotAllowed, requireSameOrigin } from "../../lib/server.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    requireSameOrigin(req);
    const session = await getSession(req);
    if (session) {
      try {
        const token = session.tokens.refresh_token || session.tokens.access_token;
        if (token) await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token }).toString(),
          signal: AbortSignal.timeout(8000)
        });
      } catch { /* Clear the local session even if remote revocation fails. */ }
      await deleteSession(session.sessionHash);
    }
    res.setHeader("Set-Cookie", [clearCookie(req, "mailroom_session"), clearCookie(req, "mailroom_oauth_state")]);
    return json(res, 200, { ok: true });
  } catch (error) {
    res.setHeader("Set-Cookie", clearCookie(req, "mailroom_session"));
    return fail(res, error);
  }
}
