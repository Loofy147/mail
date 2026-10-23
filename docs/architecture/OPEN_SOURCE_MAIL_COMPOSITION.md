# Mailroom Open-Source Composition Decision

**Status:** Proposed architecture for implementation review  
**Date:** 2026-10-23  
**Decision owner:** Project maintainer  
**Scope:** Browser mail client and integrations; this does not replace the existing native Rust/Slint application.

## Decision summary

Do not continue expanding a bespoke mail protocol/client implementation as the long-term primary path. Evaluate a composition around **Cypht as the primary webmail engine**, with Mailroom/AppDeploy reserved for the product portal, custom workflows, and integrations that are genuinely additive. Keep the existing native application separate until protocol/API boundaries and parity are proven.

Cypht is the best first candidate for a multi-provider browser workspace because its upstream project supports IMAP/SMTP, JMAP, and Exchange Web Services, combines accounts into unified views, and uses a modular architecture. It is a PHP/JavaScript application, not a drop-in library for AppDeploy's current TypeScript backend. It requires a compatible PHP web runtime and deployment; do not pretend it can run natively inside the existing AppDeploy function runtime.

## Candidate roles

| Project | Role in the composition | Why | Boundary / decision |
| --- | --- | --- | --- |
| [Cypht](https://github.com/cypht-org/cypht) | Primary candidate for the actual multi-account webmail engine | Unified views; IMAP/SMTP, JMAP, EWS; modular modules; LGPL-2.1 | Deploy on a compatible PHP host. Run a compatibility and security review before adopting. |
| [SnappyMail](https://github.com/the-djmaze/snappymail) | UX/security benchmark and fallback candidate | Lightweight browser UI; IMAP-based; built-in OpenPGP support; AGPL-3.0 | Do not merge its full application into Cypht. Re-evaluate only if Cypht's UI fails agreed UX tests. |
| [Roundcube](https://github.com/roundcube/roundcubemail) | Feature-parity, MIME, attachment and plugin benchmark | Mature IMAP webmail and broad plugin ecosystem; GPL-3.0-or-later with stated exceptions | Reference and test against it; do not add a second full client without a specific reason. |
| [Supabase](https://supabase.com/) | Optional Mailroom-specific app data only | Existing dedicated project is provisioned | Do not mirror mailbox contents or credentials into Supabase if the selected webmail engine can own account/session handling. Keep least privilege and separate product data from provider mail data. |
| [AppDeploy](https://appdeploy.ai/) | Product shell, custom workflows and lightweight APIs where useful | Current Mailroom preview is already deployed | Not the runtime for Cypht's PHP application. Do not proxy sensitive mail traffic through duplicate custom endpoints without a tested need. |

## Proposed system shape

1. **Mail provider / existing mail server:** authoritative mailbox, message store, delivery, spam controls and IMAP/JMAP/EWS interfaces.
2. **Cypht webmail runtime:** provider connections, mailbox operations, unified inbox and server-side mail interactions.
3. **Mailroom product layer (AppDeploy):** optional onboarding, workspace navigation, custom workflow UI and integrations. Link or securely integrate with the webmail runtime only where session boundaries and origin policy are explicitly designed.
4. **Existing native client:** remains an independent client. Share provider protocols and documented APIs rather than duplicating proprietary data stores.
5. **Supabase:** retain only for Mailroom-specific state that has a clear need; no redundant copy of mail content by default.

## Required implementation gates

- [ ] Inspect the current Cypht release, repository security policy, dependency tree, configuration defaults, and deployment guidance.
- [ ] Verify Cypht's current OAuth2 support for Gmail and Microsoft, including current provider policies and required scopes. Do not assume IMAP OAuth support equals full provider API support.
- [ ] Deploy an isolated proof of concept on a compatible PHP runtime; AppDeploy remains the portal, not the PHP runtime.
- [ ] Test account isolation, session cookies, CSRF, rate limits, OAuth state/PKCE where applicable, secret storage, logout/revocation, and logs for credential/token leakage.
- [ ] Test mail correctness: MIME, HTML sanitization, inline images, attachments, Unicode, threading, drafts, flags, move/copy, archive/trash/restore, search and large mailboxes.
- [ ] Run regression tests against at least one Gmail account and one standard IMAP/SMTP test server; add Microsoft/JMAP only when their auth/runtime prerequisites are available.
- [ ] Review license obligations before modifying, hosting, branding, or distributing any source. Keep notices and source-offer obligations where applicable; request legal review for AGPL/GPL deployment or redistribution questions.
- [ ] Compare with the current custom Mailroom implementation and delete or freeze redundant paths only after parity and rollback are proven.

## Explicit non-decisions

- This record does **not** assert that Cypht has been deployed, audited, or tested against the project's accounts.
- This record does **not** authorize deleting the current AppDeploy preview, native app, or existing PR code.
- No real Gmail/Outlook connection or send test has been completed by this architecture decision.
- No open-source code is copied into this repository by this document.

## Evidence

- Cypht upstream repository: https://github.com/cypht-org/cypht
- Cypht installation requirements: https://www.cypht.org/install/
- SnappyMail upstream repository and license: https://github.com/the-djmaze/snappymail
- Roundcube feature list and requirements: https://roundcube.net/about/
