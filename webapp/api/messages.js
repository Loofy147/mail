import { AppError, decodeBase64Url, fail, googleApi, hasGoogleConfig, htmlToPlainText, json, methodNotAllowed, rateLimit, requireSession } from "../lib/server.js";

const FOLDER_QUERY = {
  inbox: "in:inbox",
  starred: "is:starred -in:trash",
  sent: "in:sent",
  drafts: "in:drafts",
  archive: "-in:inbox -in:trash -in:spam -in:drafts -in:sent",
  trash: "in:trash",
  work: "label:Work",
  personal: "label:Personal"
};
const PALETTE = ["teal", "violet", "blue", "amber", "rose", "slate"];
const HEADERS = ["From", "To", "Subject", "Date", "Message-ID", "Reply-To"];

function headerMap(payload) {
  const out = {};
  for (const header of payload?.headers || []) {
    if (typeof header.name === "string" && typeof header.value === "string") out[header.name.toLowerCase()] = header.value;
  }
  return out;
}
function colorFor(value) {
  const text = String(value || "");
  let n = 0;
  for (let i = 0; i < text.length; i++) n = (n * 31 + text.charCodeAt(i)) >>> 0;
  return PALETTE[n % PALETTE.length];
}
function extractBody(payload) {
  const parts = [];
  let visited = 0;
  function walk(part, depth = 0) {
    if (!part || typeof part !== "object" || depth > 20 || visited++ > 500) return;
    if (part.body?.data && typeof part.mimeType === "string" && part.mimeType.toLowerCase() === "text/plain") {
      parts.push({ kind: 0, text: decodeBase64Url(part.body.data) });
    } else if (part.body?.data && typeof part.mimeType === "string" && part.mimeType.toLowerCase() === "text/html") {
      parts.push({ kind: 1, text: htmlToPlainText(decodeBase64Url(part.body.data)) });
    }
    for (const child of part.parts || []) walk(child, depth + 1);
  }
  walk(payload);
  const plain = parts.find((x) => x.kind === 0 && x.text.trim());
  const html = parts.find((x) => x.kind === 1 && x.text.trim());
  return String((plain || html)?.text || "").slice(0, 300000);
}
function parseSender(value) {
  const raw = String(value || "");
  const match = raw.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
  const email = (match ? match[1] : raw).trim().replace(/^mailto:/i, "");
  const name = match ? raw.slice(0, match.index).trim().replace(/^"|"$/g, "") : email;
  return { email: email.slice(0, 254), name: (name || email || "Unknown sender").slice(0, 200) };
}
function mapMessage(message, folder, options = {}) {
  const headers = headerMap(message.payload);
  const sender = parseSender(headers.from);
  const labels = Array.isArray(message.labelIds) ? message.labelIds : [];
  const dateMs = Number(message.internalDate || 0);
  const date = Number.isFinite(dateMs) && dateMs > 0 ? new Date(dateMs).toISOString() : (Date.parse(headers.date || "") ? new Date(headers.date).toISOString() : new Date().toISOString());
  return {
    id: options.draftId || message.id,
    gmailMessageId: message.id || null,
    draftId: options.draftId || null,
    threadId: message.threadId || null,
    rfcMessageId: headers["message-id"] || null,
    inReplyTo: headers["in-reply-to"] || null,
    folder,
    sender: sender.name,
    email: sender.email,
    to: String(headers.to || "").slice(0, 500),
    subject: String(headers.subject || "(no subject)").slice(0, 240),
    snippet: String(message.snippet || "").slice(0, 500),
    body: options.full ? extractBody(message.payload) : "",
    bodyLoaded: Boolean(options.full),
    date,
    unread: labels.includes("UNREAD"),
    starred: labels.includes("STARRED"),
    labels: folder === "work" ? ["Work"] : (folder === "personal" ? ["Personal"] : (labels.includes("Work") ? ["Work"] : (labels.includes("Personal") ? ["Personal"] : []))),
    color: colorFor(sender.email),
    attachments: []
  };
}
async function mapLimit(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}
function validateId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,180}$/.test(id)) throw new AppError(400, "invalid_message_id", "The message identifier is invalid.");
  return id;
}
async function getDetail(session, id, folder) {
  validateId(id);
  if (folder === "drafts") {
    const draft = await googleApi(session, "drafts/" + encodeURIComponent(id) + "?format=full");
    if (!draft.message) throw new AppError(404, "message_not_found", "That draft is no longer available.");
    return mapMessage(draft.message, "drafts", { draftId: draft.id || id, full: true });
  }
  const message = await googleApi(session, "messages/" + encodeURIComponent(id) + "?format=full");
  return mapMessage(message, folder, { full: true });
}
async function listDrafts(session, pageToken) {
  const params = new URLSearchParams({ maxResults: "40" });
  if (pageToken) params.set("pageToken", pageToken);
  const data = await googleApi(session, "drafts?" + params.toString());
  const drafts = Array.isArray(data.drafts) ? data.drafts : [];
  const messages = await mapLimit(drafts, 5, async (draft) => {
    const metadataParams = new URLSearchParams({ format: "metadata" });
    for (const name of HEADERS) metadataParams.append("metadataHeaders", name);
    const detail = await googleApi(session, "drafts/" + encodeURIComponent(draft.id) + "?" + metadataParams.toString());
    if (!detail.message) return null;
    return mapMessage(detail.message, "drafts", { draftId: detail.id || draft.id });
  });
  return { messages: messages.filter(Boolean), nextPageToken: data.nextPageToken || null };
}
async function listMessages(session, folder, q, pageToken) {
  const queryParts = [];
  if (FOLDER_QUERY[folder]) queryParts.push(FOLDER_QUERY[folder]);
  if (q) queryParts.push(q);
  const params = new URLSearchParams({ maxResults: "40" });
  if (queryParts.length) params.set("q", queryParts.join(" "));
  if (pageToken) params.set("pageToken", pageToken);
  const data = await googleApi(session, "messages?" + params.toString());
  const items = Array.isArray(data.messages) ? data.messages : [];
  const mapped = await mapLimit(items, 6, async (item) => {
    const id = validateId(item.id);
    const metadataParams = new URLSearchParams({ format: "metadata" });
    for (const name of HEADERS) metadataParams.append("metadataHeaders", name);
    const detail = await googleApi(session, "messages/" + encodeURIComponent(id) + "?" + metadataParams.toString());
    return mapMessage(detail, folder);
  });
  return { messages: mapped, nextPageToken: data.nextPageToken || null };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const session = await requireSession(req);
    await rateLimit(req, "mail-read", 12, 60, session.sessionHash);
    const id = typeof req.query?.id === "string" ? req.query.id : "";
    const folder = typeof req.query?.folder === "string" && FOLDER_QUERY[req.query.folder] ? req.query.folder : "inbox";
    if (id) {
      const message = await getDetail(session, id, folder);
      return json(res, 200, { message, provider: "google" });
    }
    const q = typeof req.query?.q === "string" ? req.query.q.trim().slice(0, 200) : "";
    if (/[\r\n]/.test(q)) throw new AppError(400, "invalid_search", "The search query is invalid.");
    const pageToken = typeof req.query?.pageToken === "string" ? req.query.pageToken.slice(0, 1800) : "";
    const result = folder === "drafts"
      ? await listDrafts(session, pageToken)
      : await listMessages(session, folder, q, pageToken);
    return json(res, 200, { ...result, folder, provider: "google" });
  } catch (error) { return fail(res, error); }
}
