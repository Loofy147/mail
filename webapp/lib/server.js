import {
  createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual
} from "node:crypto";

export class AppError extends Error {
  constructor(status, code, message) { super(message); this.name = "AppError"; this.status = status; this.code = code; }
}
export function applyApiHeaders(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
}
export function json(res, status, body) { applyApiHeaders(res); res.status(status).json(body); }
export function fail(res, error) {
  const known = error instanceof AppError;
  if (!known) console.error("Mailroom API internal error", error?.name || "Error", error?.code || "");
  json(res, known ? error.status : 500, { error: { code: known ? error.code : "internal_error", message: known ? error.message : "The request could not be completed." } });
}
export function methodNotAllowed(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  json(res, 405, { error: { code: "method_not_allowed", message: "Method not allowed." } });
}
export function env(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new AppError(503, "setup_required", "The server integration is not configured yet.");
  return value;
}
function validKeyConfigured() { return /^[a-fA-F0-9]{64}$/.test(process.env.TOKEN_ENCRYPTION_KEY?.trim() || ""); }
export function hasDatabaseConfig() {
  return Boolean(process.env.SUPABASE_URL?.trim() && (process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) && validKeyConfigured());
}
export function hasGoogleConfig() {
  if (!hasDatabaseConfig()) return false;
  try {
    const id = env("GOOGLE_CLIENT_ID"), secret = env("GOOGLE_CLIENT_SECRET"), redirect = new URL(env("GOOGLE_REDIRECT_URI"));
    return Boolean(id && secret && (redirect.protocol === "https:" || (redirect.protocol === "http:" && ["localhost", "127.0.0.1"].includes(redirect.hostname))));
  } catch { return false; }
}
export function encryptionKey() {
  const value = env("TOKEN_ENCRYPTION_KEY");
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new AppError(503, "setup_required", "TOKEN_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hexadecimal characters.");
  return Buffer.from(value, "hex");
}
export function encryptJson(value) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}
export function decryptJson(value) {
  const parts = typeof value === "string" ? value.split(".") : [];
  if (parts.length !== 3) throw new AppError(503, "session_unavailable", "The stored session could not be read.");
  try {
    const iv = Buffer.from(parts[0], "base64url"), tag = Buffer.from(parts[1], "base64url"), data = Buffer.from(parts[2], "base64url");
    if (iv.length !== 12 || tag.length !== 16) throw new Error("invalid encrypted value");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"));
  } catch { throw new AppError(503, "session_unavailable", "The stored session could not be read."); }
}
function databaseKey() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new AppError(503, "storage_unavailable", "The server storage is not configured.");
  return key;
}
export async function dbRequest(path, options = {}) {
  let base;
  try { base = new URL(env("SUPABASE_URL")); } catch { throw new AppError(503, "storage_unavailable", "The server storage URL is invalid."); }
  if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) throw new AppError(503, "storage_unavailable", "The server storage URL must use HTTPS.");
  const key = databaseKey(), url = new URL("/rest/v1/" + String(path).replace(/^\/+/, ""), base), headers = new Headers(options.headers || {});
  headers.set("apikey", key);
  if (!key.startsWith("sb_secret_")) headers.set("Authorization", "Bearer " + key);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  let response;
  try { response = await fetch(url, { method: options.method || "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: AbortSignal.timeout(12000) }); }
  catch { throw new AppError(503, "storage_unavailable", "The server storage could not be reached."); }
  const text = await response.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = null; } }
  if (!response.ok) {
    console.error("Mailroom storage request failed", response.status, String(path).split("?")[0]);
    throw new AppError(503, "storage_unavailable", "The server storage request failed.");
  }
  return data;
}
export function cookie(req, name) {
  for (const item of String(req.headers?.cookie || "").split(";")) {
    const i = item.indexOf("=");
    if (i >= 0 && item.slice(0, i).trim() === name) return decodeURIComponent(item.slice(i + 1).trim());
  }
  return null;
}
export function setCookie(req, name, value, maxAge) {
  const secure = req.headers?.["x-forwarded-proto"] === "https" || Boolean(req.socket?.encrypted);
  const p = [name + "=" + encodeURIComponent(value), "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=" + Math.max(0, Math.floor(maxAge))];
  if (secure) p.push("Secure");
  return p.join("; ");
}
export function clearCookie(req, name) { return setCookie(req, name, "", 0); }
export function stateEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || !a.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function requireSameOrigin(req) {
  const origin = req.headers?.origin;
  if (typeof origin !== "string" || !origin) throw new AppError(403, "origin_rejected", "A same-origin request is required.");
  let parsed;
  try { parsed = new URL(origin); } catch { throw new AppError(403, "origin_rejected", "A same-origin request is required."); }
  if (process.env.APP_ORIGIN?.trim()) {
    let expected;
    try { expected = new URL(process.env.APP_ORIGIN.trim()); } catch { throw new AppError(503, "setup_required", "APP_ORIGIN is invalid."); }
    if (parsed.origin !== expected.origin) throw new AppError(403, "origin_rejected", "A same-origin request is required.");
    return;
  }
  const fh = req.headers?.["x-forwarded-host"];
  const host = (typeof fh === "string" && fh) || req.headers?.host;
  const fp = req.headers?.["x-forwarded-proto"];
  const proto = (typeof fp === "string" && fp.split(",")[0].trim()) || (req.socket?.encrypted ? "https" : "http");
  if (!host || parsed.host.toLowerCase() !== String(host).toLowerCase() || parsed.protocol !== proto + ":") throw new AppError(403, "origin_rejected", "A same-origin request is required.");
}
export function readJsonBody(req, maxBytes = 256 * 1024) {
  if (String(req.headers?.["content-type"] || "").split(";")[0].trim().toLowerCase() !== "application/json") throw new AppError(415, "json_required", "Send a JSON request body.");
  const size = Number(req.headers?.["content-length"] || 0);
  if (Number.isFinite(size) && size > maxBytes) throw new AppError(413, "body_too_large", "The request body is too large.");
  let body = req.body;
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > maxBytes) throw new AppError(413, "body_too_large", "The request body is too large.");
    try { body = JSON.parse(body); } catch { throw new AppError(400, "invalid_json", "The request body is not valid JSON."); }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(400, "invalid_json", "The request body is not valid JSON.");
  return body;
}
function rateKey(label, subject) { return createHmac("sha256", encryptionKey()).update(label + ":" + subject).digest("hex"); }
async function consumeRateLimit(key, limit, seconds) {
  const result = await dbRequest("rpc/mailroom_consume_rate_limit", { method: "POST", body: { p_bucket_key: key, p_window_seconds: seconds, p_limit: limit } });
  if (result !== true) throw new AppError(429, "rate_limited", "Too many requests. Please try again later.");
}
export async function rateLimit(req, action, limit, windowSeconds, hash = null) {
  const fwd = req.headers?.["x-forwarded-for"];
  const ip = (typeof fwd === "string" ? fwd.split(",")[0].trim() : "") || (typeof req.headers?.["x-real-ip"] === "string" ? req.headers["x-real-ip"] : "") || "unknown";
  await consumeRateLimit(rateKey(action, "ip:" + ip), limit, windowSeconds);
  if (hash) await consumeRateLimit(rateKey(action, "session:" + hash), limit, windowSeconds);
}
export function sessionHash(id) { return createHash("sha256").update(id, "utf8").digest("hex"); }
export async function deleteSession(hash) {
  const q = new URLSearchParams({ session_hash: "eq." + hash });
  await dbRequest("mailroom_sessions?" + q.toString(), { method: "DELETE" });
}
export async function storeSession(row) {
  await dbRequest("mailroom_sessions", { method: "POST", headers: { Prefer: "return=minimal" }, body: row });
}
export async function patchSession(hash, patch) {
  const q = new URLSearchParams({ session_hash: "eq." + hash });
  await dbRequest("mailroom_sessions?" + q.toString(), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: patch });
}
export async function getSession(req) {
  const id = cookie(req, "mailroom_session");
  if (!id || !/^[A-Za-z0-9_-]{40,64}$/.test(id)) return null;
  const hash = sessionHash(id), q = new URLSearchParams({ session_hash: "eq." + hash, select: "session_hash,provider,provider_user_id,user_email,encrypted_tokens,expires_at" });
  const rows = await dbRequest("mailroom_sessions?" + q.toString()), row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  if (!row.expires_at || new Date(row.expires_at).getTime() <= Date.now()) { await deleteSession(hash); return null; }
  let tokens;
  try { tokens = decryptJson(row.encrypted_tokens); }
  catch { await deleteSession(hash); throw new AppError(401, "session_expired", "The mail session is no longer valid. Connect your account again."); }
  return { sessionId: id, sessionHash: hash, row, tokens };
}
export async function requireSession(req) {
  const session = await getSession(req);
  if (!session) throw new AppError(401, "not_connected", "Connect a Google account to use live mail.");
  if (session.row.provider !== "google") throw new AppError(401, "not_connected", "This mail provider is not supported by this web workspace.");
  return session;
}
export async function googleAccessToken(session, force = false) {
  if (!force && session.tokens.access_token && Number(session.tokens.expires_at || 0) > Date.now() + 90000) return session.tokens.access_token;
  if (!session.tokens.refresh_token) throw new AppError(401, "reauth_required", "Google needs you to reconnect this mailbox.");
  const body = new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), refresh_token: session.tokens.refresh_token, grant_type: "refresh_token" });
  let response;
  try { response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(), signal: AbortSignal.timeout(12000) }); }
  catch { throw new AppError(502, "provider_unavailable", "Google authentication is temporarily unavailable."); }
  const token = await response.json().catch(() => ({}));
  if (!response.ok || typeof token.access_token !== "string") {
    if (token.error === "invalid_grant") throw new AppError(401, "reauth_required", "Google needs you to reconnect this mailbox.");
    throw new AppError(502, "provider_unavailable", "Google could not refresh the mail session.");
  }
  session.tokens = { access_token: token.access_token, refresh_token: token.refresh_token || session.tokens.refresh_token, token_type: token.token_type || "Bearer", expires_at: Date.now() + Math.max(60, Number(token.expires_in || 3600)) * 1000 };
  await patchSession(session.sessionHash, { encrypted_tokens: encryptJson(session.tokens), updated_at: new Date().toISOString() });
  return session.tokens.access_token;
}
export async function googleApi(session, path, options = {}) {
  if (typeof path !== "string" || path.startsWith("//") || /^[a-z]+:/i.test(path)) throw new AppError(400, "invalid_provider_path", "Invalid provider request.");
  const url = new URL(path.replace(/^\/+/, ""), "https://gmail.googleapis.com/gmail/v1/users/me/");
  async function request(token) {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", "Bearer " + token);
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    return fetch(url, { method: options.method || "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: AbortSignal.timeout(15000) });
  }
  let response;
  try {
    response = await request(await googleAccessToken(session));
    if (response.status === 401) response = await request(await googleAccessToken(session, true));
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError(502, "provider_unavailable", "Google Mail is temporarily unavailable."); }
  const raw = await response.text();
  let data = {};
  if (raw) { try { data = JSON.parse(raw); } catch { data = {}; } }
  if (!response.ok) {
    if (response.status === 401) throw new AppError(401, "reauth_required", "Google needs you to reconnect this mailbox.");
    if (response.status === 403) throw new AppError(403, "provider_permission", "Google denied this mail action. Check the permissions granted to the app.");
    if (response.status === 404) throw new AppError(404, "message_not_found", "That message is no longer available.");
    if (response.status === 429) throw new AppError(429, "provider_rate_limited", "Google is temporarily rate-limiting this mailbox.");
    throw new AppError(502, "provider_unavailable", "Google Mail could not complete the request.");
  }
  return data;
}
export function validateEmail(value) {
  if (typeof value !== "string" || value.length > 254 || /[\r\n]/.test(value)) return false;
  return /^[A-Z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(value);
}
export function buildRawEmail({ to, subject, body, inReplyTo = null }) {
  if (!validateEmail(to)) throw new AppError(400, "invalid_recipient", "Enter a valid recipient email address.");
  if (typeof subject !== "string" || !subject.trim() || subject.length > 240 || /[\r\n]/.test(subject)) throw new AppError(400, "invalid_subject", "Enter a subject of up to 240 characters without line breaks.");
  if (typeof body !== "string" || !body.trim() || Buffer.byteLength(body, "utf8") > 240 * 1024) throw new AppError(400, "invalid_body", "Enter a message up to 240 KB.");
  const normalized = body.replace(/\r\n?/g, "\n").replace(/\n/g, "\r\n");
  const encodedSubject = "=?UTF-8?B?" + Buffer.from(subject.trim(), "utf8").toString("base64") + "?=";
  const headers = ["To: " + to, "Subject: " + encodedSubject, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit"];
  if (inReplyTo !== null) {
    if (typeof inReplyTo !== "string" || !/^<[^<>\r\n]{1,250}>$/.test(inReplyTo)) throw new AppError(400, "invalid_reply_reference", "The reply reference is invalid.");
    headers.push("In-Reply-To: " + inReplyTo, "References: " + inReplyTo);
  }
  return Buffer.from(headers.join("\r\n") + "\r\n\r\n" + normalized, "utf8").toString("base64url");
}
export function decodeBase64Url(value) { if (typeof value !== "string" || !value) return ""; try { return Buffer.from(value, "base64url").toString("utf8"); } catch { return ""; } }
export function htmlToPlainText(value) {
  return String(value || "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
export function publicErrorCode(error) {
  if (!(error instanceof AppError)) return "oauth_failed";
  if (error.code === "setup_required" || error.code === "storage_unavailable") return "setup";
  if (error.code === "rate_limited") return "rate_limit";
  return "oauth_failed";
}
