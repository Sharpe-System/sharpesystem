# SYSTEM_AUTH_CONTRACT.md
SharpeSystem — Auth Core v1 (FROZEN CANON)

This document is the single source of truth for auth/tier enforcement, page tagging, and entitlement vocabulary.
If code conflicts with this file, the code must be changed — not the contract.

--------------------------------------------------------------------
1) FROZEN INTERFACES (DO NOT BREAK)
--------------------------------------------------------------------
These are treated as “interfaces,” not implementation details:

A) /gate.js behavior
- Reads <body> attributes (data-require-*)
- Performs deterministic redirects with reason codes
- Sanitizes next=... (no offsite redirects, no loops)

B) /firebase-config.js exports used by other modules
- Existing exports may not be renamed or removed.
- Additive exports are allowed (adding new helpers is OK).

C) Canonical footer stack order (on all directly served HTML pages)
Place immediately above </body>:

  <script src="/ui.js" defer></script>
  <script src="/header-loader.js" defer></script>
  <script src="/partials/header.js" defer></script>
  <script src="/i18n.js" defer></script>
  <script type="module" src="/gate.js"></script>

No other placements. No duplicates. No alternate stacks.

D) Firestore user entitlement fields read by gate
- users/{uid}.tier
- users/{uid}.active
- (optional future) users/{uid}.role

These field names and meanings are frozen.

--------------------------------------------------------------------
2) CANONICAL ENTITLEMENT VOCABULARY (LOCKED)
--------------------------------------------------------------------
Stored values (Firestore):
- tier: "free" | "basic" | "pro" | "attorney"
- active: true | false
- role: "user" (v1; future may add "admin")

Marketing mapping:
- “Tier 1” (marketing term) == tier: "basic" (stored value)

Hard rule:
- Do NOT store tier: "tier1" going forward.
- Any legacy "tier1" must be migrated to "basic".

Tier rank (for comparisons):
- free = 0
- basic = 1
- pro = 2
- attorney = 3

--------------------------------------------------------------------
3) PAGE CLASSES + ENFORCEMENT (LOCKED)
--------------------------------------------------------------------
A) PUBLIC
- No auth required
- Gate must no-op
<body> has NO data-require-* attrs

B) AUTH-ONLY
- Requires login only
<body data-require-auth="1">

C) PAID (BASIC+ACTIVE)
- Requires login + minimum tier + active=true
<body data-require-auth="1" data-require-tier="basic" data-require-active="1">

Notes:
- data-require-tier is minimum tier (rank compare), not exact match.

--------------------------------------------------------------------
4) DETERMINISTIC REDIRECTS + REASON CODES (LOCKED)
--------------------------------------------------------------------
Gate redirects ALWAYS include reason=... and next=... (sanitized).

Reason codes:
- login_required
- insufficient_tier
- inactive_account

Destinations (frozen):
- Logged out -> /login.html?reason=login_required&next=...
- Logged in but inactive (when active required) -> /subscribe.html?reason=inactive_account&next=...
- Logged in but tier insufficient -> /tier1.html?reason=insufficient_tier&next=...

Loop protection:
- next cannot be /login.html or /signup.html
- next must be same-origin path starting with "/"
- fallback next is /dashboard.html

--------------------------------------------------------------------
5) SECURITY MODEL (LOCKED)
--------------------------------------------------------------------
Client must NEVER be trusted for tier/active/role.

Firestore rules must prevent:
- Any client writes to users/{uid}.tier
- Any client writes to users/{uid}.active
- Any client writes to users/{uid}.role

Client may write only “user-owned content” fields (examples):
- intake, timeline, checklist, rfoIntake, snapshot, etc.

Entitlements must be set by server/admin process only (e.g., Stripe/Square webhook, admin console, migration script).

--------------------------------------------------------------------
6) ONE-TIME MIGRATION REQUIREMENT (LOCKED)
--------------------------------------------------------------------
Legacy migration:
- users/{uid}.tier == "tier1" -> "basic"
- if tier missing -> "free"
- if active missing -> false
- if role missing -> "user"

Migration must be idempotent:
- safe to run twice
- skip no-op writes
- produce summary counts

--------------------------------------------------------------------
7) DEVELOPMENT RULES (ANTI-DRIFT)
--------------------------------------------------------------------
- Gate owns enforcement. Page scripts do not redirect for auth/tier.
- Header auth helper is UI-only (no gating, no tier logic, no redirects except optional logout destination).
- No Firebase re-init outside firebase-config.js (no duplicate initializeApp/getAuth wiring).
- Any new modules (peace, immigration, binder, etc.) must comply with this contract.

END.
