import { AppError, fail, googleApi, json, methodNotAllowed, rateLimit, readJsonBody, requireSameOrigin, requireSession } from "../lib/server.js";

function validId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,180}$/.test(id)) throw new AppError(400, "invalid_message_id", "The message identifier is invalid.");
  return id;
}
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    requireSameOrigin(req);
    const session = await requireSession(req);
    await rateLimit(req, "mail-mutate", 60, 60, session.sessionHash);
    const body = readJsonBody(req, 16 * 1024);
    const id = validId(body.id);
    const action = body.action;
    if (body.folder === "drafts" && action === "delete") {
      await googleApi(session, "drafts/" + encodeURIComponent(id), { method: "DELETE" });
      return json(res, 200, { ok: true, action });
    }
    if (action === "permanent-delete") {
      throw new AppError(403, "permanent_delete_disabled", "Permanent deletion is disabled to avoid requesting broader Gmail permissions. Empty Trash in Gmail instead.");
    }
    if (action === "star") {
      const message = await googleApi(session, "messages/" + encodeURIComponent(id) + "?format=metadata");
      const starred = (message.labelIds || []).includes("STARRED");
      await googleApi(session, "messages/" + encodeURIComponent(id) + "/modify", { method: "POST", body: starred ? { removeLabelIds: ["STARRED"] } : { addLabelIds: ["STARRED"] } });
    } else if (action === "mark-read" || action === "mark-unread") {
      await googleApi(session, "messages/" + encodeURIComponent(id) + "/modify", { method: "POST", body: action === "mark-read" ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] } });
    } else if (action === "unread") {
      const message = await googleApi(session, "messages/" + encodeURIComponent(id) + "?format=metadata");
      const unread = (message.labelIds || []).includes("UNREAD");
      await googleApi(session, "messages/" + encodeURIComponent(id) + "/modify", { method: "POST", body: unread ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] } });
    } else if (action === "archive") {
      await googleApi(session, "messages/" + encodeURIComponent(id) + "/modify", { method: "POST", body: { removeLabelIds: ["INBOX"] } });
    } else if (action === "delete") {
      await googleApi(session, "messages/" + encodeURIComponent(id) + "/trash", { method: "POST", body: {} });
    } else if (action === "restore") {
      await googleApi(session, "messages/" + encodeURIComponent(id) + "/untrash", { method: "POST", body: {} });
    } else {
      throw new AppError(400, "unsupported_action", "That mail action is not supported.");
    }
    return json(res, 200, { ok: true, action });
  } catch (error) { return fail(res, error); }
}
