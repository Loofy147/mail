# Mailroom Web Workspace

This folder is an independent browser workspace beside the existing native Rust/Slint application. It supports two modes:

- **Local demo:** synthetic messages saved only in this browser. Compose never delivers mail.
- **Connected Gmail:** after the server and Google OAuth environment are configured, the same interface reads and modifies the connected Gmail account, manages drafts, and sends real messages.

The root native build and its mail engine are not changed by this browser workspace.

## Connected mode currently supports

- Google OAuth authorization-code flow with PKCE and a state cookie.
- Gmail Inbox, Starred, Sent, Drafts, Archive, Trash, Work and Personal quick views; search and pagination.
- Reading message metadata and plain-text message bodies, marking read/unread, starring, archiving, moving to Trash, restoring, draft creation/update/deletion, and sending.
- Server-side encrypted token storage, HttpOnly session cookies, token refresh, same-origin checks for mutations, rate limits, send idempotency, API no-store headers and provider error handling.
- Permanent deletion is intentionally disabled. The app requests gmail.modify plus gmail.send, not https://mail.google.com/. Gmail's narrower gmail.modify scope excludes immediate permanent deletion. This keeps deletion in Trash and avoids broader access.

Attachments are not integrated in connected mode yet; attachment UI in the local sample messages is illustrative only. Uploading and downloading real attachments are not implemented. HTML email is flattened to plain text for the reader, and external message images/scripts are not loaded. Other providers (Outlook/Microsoft 365, IMAP and JMAP) are not connected in this web workspace yet.

## Run the local demo

From the repository root, run: python3 -m http.server 8080

Open http://localhost:8080/webapp/. This starts **only the static demo**; it does not run the /api/* serverless functions. The service worker is active on localhost or HTTPS.

## Deploy connected mode on Vercel

Create a **separate Vercel project** for this folder rather than replacing the native app's build:

1. Import Loofy147/mail into Vercel. Set **Root Directory** to webapp. Use Node.js 22 or newer. There is no frontend build step; the HTML/CSS/JS are static assets and files under api/ are Node.js functions.
2. Create a **dedicated Supabase project** for this web workspace. Do not reuse another application's database without a separate review.
3. In the dedicated Supabase SQL editor, review and run supabase/bootstrap.sql. It creates a private session table, send-idempotency records, and an atomic rate-limit function. It does not configure Google OAuth or create a Vercel deployment.
4. In Google Cloud Console, create/configure a project, enable the Gmail API, and configure the OAuth consent screen. Create an OAuth client of type **Web application**.
5. Register this exact redirect URI in the Google client: https://YOUR-VERCEL-DOMAIN/api/auth/callback. Set the same URL as GOOGLE_REDIRECT_URI. The exact site origin (without a path) goes in APP_ORIGIN.
6. Add the environment variables below in the Vercel project's Production and Preview environments as appropriate. Never paste secrets into GitHub source code, client variables, or a public issue.
7. Deploy a preview and use a Google account added as a test user. Check auth status, mailbox listing, actions, drafts, send, logout, and logs. Keep the app private to intended testers until the OAuth consent screen and verification requirements are resolved.

### Required server environment variables

| Variable | Value |
| --- | --- |
| APP_ORIGIN | Exact HTTPS origin of the deployed app, e.g. https://your-mail.vercel.app, with no path or trailing slash |
| GOOGLE_CLIENT_ID | Client ID from the Google Cloud OAuth web client |
| GOOGLE_CLIENT_SECRET | Client secret for that Google web client; server-side only |
| GOOGLE_REDIRECT_URI | Exact registered callback, e.g. https://your-mail.vercel.app/api/auth/callback |
| SUPABASE_URL | Project URL of the dedicated Supabase project |
| SUPABASE_SECRET_KEY | Preferred current sb_secret_... key, server-side only |
| TOKEN_ENCRYPTION_KEY | 32 cryptographically random bytes encoded as 64 hex characters |

For older Supabase projects you may use the legacy SUPABASE_SERVICE_ROLE_KEY instead of SUPABASE_SECRET_KEY, but prefer the current secret-key model. Never put either key in browser code or any environment variable with a NEXT_PUBLIC_, VITE_ or equivalent public prefix.

Generate the encryption key locally in a trusted terminal; do not share it in chat or commit the output. Run openssl rand -hex 32 and copy the generated value straight into the deployment's TOKEN_ENCRYPTION_KEY environment setting. Losing or rotating that key makes existing stored sessions unreadable; affected users must reconnect. Key rotation needs a planned re-encryption procedure, which is not included here.

See .env.example for variable names and placeholder values.

## Google OAuth testing and production approval

The app requests openid, email, profile, https://www.googleapis.com/auth/gmail.modify, and https://www.googleapis.com/auth/gmail.send. gmail.modify is a restricted Gmail scope; gmail.send is sensitive. Google's current Gmail scope guidance explains the verification and restricted-scope security assessment requirements for applications that store or transmit restricted-scope data on a server:

- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/protocols/oauth2

For an OAuth consent screen in **Testing** status, add the Google accounts you intend to test. Google limits a Testing app to up to 100 listed test users, and grants/refresh tokens for scopes beyond basic identity can expire after seven days. That mode is useful for development, not a durable public rollout:
https://support.google.com/cloud/answer/15549945

Do not promise public Gmail access until you have reviewed Google's applicable verification, user-data and security-assessment requirements for the intended distribution model.

## Security and data boundaries

- Provider tokens are kept on the server and encrypted with AES-256-GCM before they are written to the database. The browser receives only an opaque HttpOnly session cookie.
- Mutating API requests require a matching origin. API responses are no-store; the service worker explicitly bypasses /api/*.
- Request limits and idempotency checks are backed by the database. A send with an unresolved prior attempt is not automatically re-sent, reducing duplicate-send risk.
- Provider content is untrusted input. Reader content is flattened to escaped plain text; message HTML is not inserted as executable markup.
- The database schema enables RLS, revokes anon and authenticated table permissions, and grants backend access to the service role only.
- Avoid logging OAuth tokens, message bodies, recipient data, cookies or environment values. The code intentionally emits only minimal server error metadata.

This is an integration implementation, **not yet a live-verified mail service**: there are no Google credentials or dedicated Supabase project configured in the repository workflow, no external OAuth test has been performed, and no production deployment has been verified.

## Automated checks

From this directory, with Node.js 22+, run npm test.

The checks validate JavaScript syntax, PWA assets, API/cache isolation, encrypted-token integrity, MIME header-injection handling, same-origin protections, and UI responsiveness. They do not replace a real OAuth run, database migration check, browser testing, or Google policy review.

## File map

- index.html, styles.css, app.js: responsive browser interface and local/connected state.
- api/auth/*: Google OAuth start, callback, status and logout endpoints.
- api/messages.js: Gmail listing, metadata and selected message body.
- api/actions.js: supported Gmail message operations.
- api/drafts.js, api/send.js: Gmail draft and send operations.
- lib/server.js: server-only secrets, session, provider, security and MIME helpers.
- supabase/bootstrap.sql: dedicated database schema and atomic rate-limit/send-key functions.
- tests/static-smoke.test.mjs: dependency-free smoke and security regression checks.
