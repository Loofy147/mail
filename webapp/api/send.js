import { AppError, buildRawEmail, dbRequest, fail, googleApi, json, methodNotAllowed, patchSession, rateLimit, readJsonBody, requireSameOrigin, requireSession } from "../lib/server.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function claimRequest(sessionHash, requestId) {
  const inserted = await dbRequest("mailroom_send_requests", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: { session_hash: sessionHash, request_id: requestId, status: "pending", created_at: new Date().toISOString() }
  });
  if (Array.isArray(inserted) && inserted.length) return { claimed: true };
  const q = new URLSearchParams({ session_hash: "eq." + sessionHash, request_id: "eq." + requestId, select: "status,gmail_message_id" });
  const rows = await dbRequest("mailroom_send_requests?" + q.toString());
  const prior = Array.isArray(rows) ? rows[0] : null;
  if (prior?.status === "sent") return { duplicate: true, messageId: prior.gmail_message_id || null };
  throw new AppError(409, "send_status_unknown", "A previous send attempt with this request ID is unresolved. Check Sent in Gmail before retrying.");
}
async function setRequestResult(sessionHash, requestId, patch) {
  const q = new URLSearchParams({ session_hash: "eq." + sessionHash, request_id: "eq." + requestId });
  await dbRequest("mailroom_send_requests?" + q.toString(), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: patch });
}
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    requireSameOrigin(req);
    const session = await requireSession(req);
    await rateLimit(req, "send-minute", 8, 60, session.sessionHash);
    await rateLimit(req, "send-hour", 50, 3600, session.sessionHash);
    const body = readJsonBody(req, 256 * 1024);
    if (typeof body.requestId !== "string" || !UUID.test(body.requestId)) throw new AppError(400, "invalid_request_id", "The send request ID is invalid.");
    const threadId = typeof body.threadId === "string" && /^[A-Za-z0-9_-]{1,180}$/.test(body.threadId) ? body.threadId : null;
    const inReplyTo = body.inReplyTo == null ? null : body.inReplyTo;
    const raw = buildRawEmail({ to: body.to, subject: body.subject, body: body.body, inReplyTo });
    const claim = await claimRequest(session.sessionHash, body.requestId);
    if (claim.duplicate) return json(res, 200, { ok: true, duplicate: true, messageId: claim.messageId });
    let result;
    try {
      if (typeof body.draftId === "string" && /^[A-Za-z0-9_-]{1,180}$/.test(body.draftId)) {
        const draft = await googleApi(session, "drafts/" + encodeURIComponent(body.draftId) + "?format=full");
        const currentMessage = draft.message || {};
        const update = { message: { raw, ...(currentMessage.threadId ? { threadId: currentMessage.threadId } : threadId ? { threadId } : {}) } };
        await googleApi(session, "drafts/" + encodeURIComponent(body.draftId), { method: "PUT", body: update });
        result = await googleApi(session, "drafts/send", { method: "POST", body: { id: body.draftId } });
      } else {
        result = await googleApi(session, "messages/send", { method: "POST", body: { raw, ...(threadId ? { threadId } : {}) } });
      }
    } catch (error) {
      if (error instanceof AppError && error.status >= 400 && error.status < 500) {
        try { await setRequestResult(session.sessionHash, body.requestId, { status: "failed", updated_at: new Date().toISOString() }); } catch {}
      }
      throw error;
    }
    await setRequestResult(session.sessionHash, body.requestId, { status: "sent", gmail_message_id: result?.id || null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return json(res, 200, { ok: true, messageId: result?.id || null });
  } catch (error) { return fail(res, error); }
}
