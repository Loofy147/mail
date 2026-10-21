# Mailroom Web Workspace

A separate, installable web workspace prototype alongside the existing native Rust/Slint application. This folder is intentionally isolated: it does not change the native build or claim to replace the desktop/mobile client.

## What works today

- Inbox, Starred, Sent, Drafts, Archive, Trash, and Work/Personal quick views.
- Search across sender, subject, and message body; unread/starred filters; sort order.
- Read/unread, star/unstar, archive, trash, restore, and permanent deletion.
- Compose, save partial drafts, continue editing drafts, and create a local Sent item.
- Light/dark theme, responsive narrow-screen reader, keyboard shortcuts, and installable PWA shell.
- Synthetic messages for first run; changes persist in browser local storage.
- No third-party runtime libraries, external fonts, analytics, or remote scripts.

## Important boundary

**This version is a local prototype, not a connected email service.** The seeded mail is synthetic. “Save to Sent” only creates a local item and does not transmit a message; attachments shown in seed data are examples and cannot be downloaded. Do not enter real email account passwords, OAuth tokens, or private messages here.

Real mail needs a separate, secured integration layer. Browser code should not hold provider refresh tokens or connect directly to arbitrary IMAP/SMTP hosts. A production integration should start with scoped JMAP or provider OAuth, server-side token storage, explicit send authorization, rate limits, and audited account-scoped APIs. No backend credentials are included in this repository.

## Run locally

From the repository root, run:

    python3 -m http.server 8080

Then open http://localhost:8080/webapp/. The service worker requires localhost or HTTPS. Alternatively, deploy the webapp folder as the static root of a separate hosting project. Do not point the native application's root build at this folder.

## Smoke-test checklist

1. Open /webapp/; seeded inbox messages should appear.
2. Search for a sender or phrase, then clear search.
3. Star a message and confirm it appears in Starred.
4. Archive a message, restore a message from Trash, and permanently delete a synthetic message.
5. Compose a message, save as a draft, reopen it, then save it to Sent. Confirm the UI says it was not delivered.
6. Switch light/dark theme and reload; theme and mailbox changes should persist.
7. At a narrow viewport, open a message and return to the list; open and close navigation.
8. After the app loads once on localhost/HTTPS, reload offline and confirm the cached app shell still opens.

## Architecture notes

- index.html: accessible UI structure.
- styles.css: responsive layout and themes, system fonts only.
- app.js: local state and HTML escaping for stored message data.
- sw.js: same-origin app-shell caching only.
- manifest.webmanifest and icon.svg: PWA metadata and local icon.
- tests/static-smoke.test.mjs: dependency-free smoke checks run in GitHub Actions.

This prototype intentionally does not modify the native mail engine, transport, account authentication, cryptographic signing, or message database.
