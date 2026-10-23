import { AppError, buildRawEmail, fail, googleApi, json, methodNotAllowed, rateLimit, readJsonBody, requireSameOrigin, requireSession } from "../lib/server.js";

function validId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,180}$/.test(id)) throw new AppError(400, "invalid_draft_id", "The draft identifier is invalid.");
  return id;
}
export default async function handler(req, res) {
  if (!["POST", "PUT", "DELETE"].includes(req.method)) return methodNotAllowed(res, ["POST", "PUT", "DELETE"]);
  try {
    requireSameOrigin(req);
    const session = await requireSession(req);
    await rateLimit(req, "draft-write", 40, 60, session.sessionHash);
    if (req.method === "DELETE") {
      const id = validId(typeof req.query?.id === "string" ? req.query.id : "");
      await googleApi(session, "drafts/" + encodeURIComponent(id), { method: "DELETE" });
      return json(res, 200, { ok: true, id });
    }
    const body = readJsonBody(req, 256 * 1024);
    const raw = buildRawEmail({ to: body.to, subject: body.subject, body: body.body, inReplyTo: body.inReplyTo ?? null });
    const threadId = typeof body.threadId === "string" && /^[A-Za-z0-9_-]{1,180}$/.test(body.threadId) ? body.threadId : null;
    const message = { raw, ...(threadId ? { threadId } : {}) };
    if (req.method === "POST") {
      const result = await googleApi(session, "drafts", { method: "POST", body: { message } });
      return json(res, 201, { ok: true, id: result.id || null });
    }
    const id = validId(body.id);
    const existing = await googleApi(session, "drafts/" + encodeURIComponent(id) + "?format=full");
    const existingThread = existing?.message?.threadId || threadId;
    const updateMessage = { raw, ...(existingThread ? { threadId: existingThread } : {}) };
    const result = await googleApi(session, "drafts/" + encodeURIComponent(id), { method: "PUT", body: { message: updateMessage } });
    return json(res, 200, { ok: true, id: result.id || id });
  } catch (error) { return fail(res, error); }
}
