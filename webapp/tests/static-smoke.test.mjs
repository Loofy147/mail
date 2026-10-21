import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  AppError, buildRawEmail, decryptJson, encryptJson, htmlToPlainText, requireSameOrigin, validateEmail
} from "../lib/server.js";

const file = (name) => fileURLToPath(new URL("../" + name, import.meta.url));
const read = (name) => readFile(file(name), "utf8");

test("browser, worker, and every server endpoint parse cleanly", async () => {
  const files = ["app.js", "sw.js", "lib/server.js", "api/auth/start.js", "api/auth/callback.js",
    "api/auth/status.js", "api/auth/logout.js", "api/messages.js", "api/actions.js", "api/send.js", "api/drafts.js"];
  for (const name of files) {
    const path = file(name);
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, name + ": " + result.stderr);
  }
});

test("HTML references local assets and has a restrictive script/content policy", async () => {
  const html = await read("index.html");
  assert.match(html, /name="viewport"/);
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.match(html, /aria-label="Search email"/);
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /id="connectButton"/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href="https?:\/\//i);
});

test("PWA metadata is valid and points to an existing local icon", async () => {
  const manifest = JSON.parse(await read("manifest.webmanifest"));
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((item) => item.src === "./icon.svg"));
  await access(file("icon.svg"));
});

test("service worker caches only same-origin static assets and bypasses APIs", async () => {
  const worker = await read("sw.js");
  for (const asset of ["./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icon.svg"]) {
    assert.ok(worker.includes('"' + asset + '"'), "missing cached asset: " + asset);
    await access(file(asset === "./index.html" ? "index.html" : asset.slice(2)));
  }
  assert.match(worker, /url\.origin!==self\.location\.origin/);
  assert.match(worker, /request\.method!=="GET"/);
  assert.ok(worker.includes("/api"));
  assert.match(worker, /test\(url\.pathname\)\)return;event\.respondWith/);
});

test("browser uses only same-origin endpoints and never holds provider secrets", async () => {
  const app = await read("app.js");
  assert.match(app, /apiJson\("\/api\//);
  assert.match(app, /localStorage\.getItem\(KEY\)/);
  assert.match(app, /localStorage\.setItem\(KEY/);
  assert.match(app, /send_status_unknown/);
  assert.doesNotMatch(app, /gmail\.googleapis\.com/i);
  assert.doesNotMatch(app, /oauth2\.googleapis\.com/i);
  assert.doesNotMatch(app, /GOOGLE_CLIENT_SECRET|SUPABASE_SECRET_KEY|TOKEN_ENCRYPTION_KEY/);
});

test("server token encryption is authenticated and round-trips", () => {
  process.env.TOKEN_ENCRYPTION_KEY = "42".repeat(32);
  const token = { access_token: "access-example", refresh_token: "refresh-example", expires_at: 1770000000000 };
  const sealed = encryptJson(token);
  assert.notEqual(sealed, JSON.stringify(token));
  assert.deepEqual(decryptJson(sealed), token);
  const parts = sealed.split(".");
  parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
  assert.throws(() => decryptJson(parts.join(".")), (error) => error instanceof AppError && error.code === "session_unavailable");
});

test("invalid cookie escapes are rejected without crashing the request", async () => {
  const { cookie, stateEquals } = await import("../lib/server.js");
  assert.equal(cookie({ headers: { cookie: "mailroom_session=%ZZ" } }, "mailroom_session"), null);
  assert.equal(stateEquals("é", "x"), false);
  assert.equal(stateEquals("same-state", "same-state"), true);
});

test("mail header construction validates recipient and rejects CRLF injection", () => {
  assert.equal(validateEmail("hichem@example.com"), true);
  assert.equal(validateEmail("bad\r\nBcc: thief@example.com"), false);
  const raw = Buffer.from(buildRawEmail({ to: "hichem@example.com", subject: "Hello", body: "One\nTwo" }), "base64url").toString("utf8");
  assert.match(raw, /To: hichem@example\.com/);
  assert.match(raw, /Subject: =\?UTF-8\?B\?/);
  assert.match(raw, /One\r\nTwo/);
  assert.throws(() => buildRawEmail({ to: "ok@example.com", subject: "Hello\r\nBcc: bad@example.com", body: "Hi" }),
    (error) => error instanceof AppError && error.code === "invalid_subject");
});

test("HTML mail fallback is reduced to plain text before reaching the reader", () => {
  assert.equal(htmlToPlainText("<p>Hello &amp; welcome</p><script>steal()</script><p>Next</p>"), "Hello & welcome\n Next");
});

test("mutating APIs reject cross-origin browser requests", () => {
  delete process.env.APP_ORIGIN;
  const good = { headers: { origin: "https://mailroom.example", host: "mailroom.example", "x-forwarded-proto": "https" } };
  assert.doesNotThrow(() => requireSameOrigin(good));
  const bad = { headers: { origin: "https://evil.example", host: "mailroom.example", "x-forwarded-proto": "https" } };
  assert.throws(() => requireSameOrigin(bad), (error) => error instanceof AppError && error.code === "origin_rejected");
});

test("Supabase bootstrap has closed SQL function blocks and private send idempotency", async () => {
  const sql = await read("supabase/bootstrap.sql");
  assert.equal((sql.match(/\$\$/g) || []).length, 4, "both PL/pgSQL function bodies must have opening and closing delimiters");
  assert.match(sql, /create or replace function public\.mailroom_consume_rate_limit/i);
  assert.match(sql, /create or replace function public\.mailroom_claim_send_request/i);
  assert.match(sql, /on conflict \(session_hash, request_id\) do nothing/i);
  assert.match(sql, /grant execute on function public\.mailroom_claim_send_request\(text, uuid\) to service_role/i);
  assert.match(sql, /revoke all on table public\.mailroom_sessions from anon, authenticated/i);
});

test("responsive and reduced-motion styles are present", async () => {
  const css = await read("styles.css");
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /:focus-visible/);
});
