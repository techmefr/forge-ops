# Privacy

forge-ops is self-hosted. The organisation that runs an instance is the data controller; the project maintainers receive no data. This page lists what the tool stores, why, for how long, and how a person's data is removed.

## Data inventory

| Data | Where | Purpose | Who can read it |
|---|---|---|---|
| Login (`board_user.login`) | Account | Sign in, attribute actions | Every signed-in user |
| Display name | Account | Show who does what | Every signed-in user |
| Email (optional) | Account | Account recovery contact | The account owner only; never listed |
| Password | Account, as a scrypt hash with a per-user salt | Sign in | Nobody; the hash is never returned by any route |
| Role, super admin flag, capacity, active flag | Account | Permissions and load display | Every signed-in user (no email, no hash) |
| Session token | Cookie `forge_identity` (HttpOnly, SameSite=Strict, Secure behind https); stored as a SHA-256 digest | Keep a person signed in for 14 days | The browser that holds it |
| Assignee, claim | `epic.assignee` (login) | Who holds a subject | Every signed-in user |
| Requested by | `epic.requested_by` (free text, may be a person or a team) | Who asked for a subject | Every signed-in user |
| Decided by, risk owner, remark author, hold and step-back requester, state history author | Logins or free text | Traceability of decisions and changes | Every signed-in user |
| Minutes, notes, status sentences | Free text written by users | Project follow-up | Every signed-in user |
| Card conversation messages (`story_message`: what the agent said, what a person told it, with the login of that person), costs, file touches | Instance database and `~/.claude` | Show the conversation again after a reload, run and audit agent sessions | Every signed-in user of the instance |

Not stored: IP addresses, user agents, analytics, advertising identifiers. The server writes no access log of its own and never logs passwords, tokens or email addresses. The demo seed contains fictional data only.

Everyone who can sign in sees the same board: there is no per-project membership, so the visibility above applies to the whole instance.

## Third parties

None. The front is served by the instance itself, including its fonts (Archivo, Barlow and JetBrains Mono, SIL Open Font License, files under `frontend/public/fonts`). The browser makes no call to a CDN, a font service or an analytics service, and the Content-Security-Policy sent with the page forbids it. Agent sessions call the model provider the operator configured (for example Anthropic through the Claude Code CLI); that link is chosen and contracted by the operator, not by forge-ops. Subprocessors of forge-ops itself: none.

## Retention

| Data | Kept |
|---|---|
| Accounts | Until erased (see below); deactivation keeps them |
| Sessions | 14 days, revoked on logout, password change and deactivation |
| Subjects moved to the trash | 90 days, then purged automatically |
| Everything else (stories, decisions, risks, events, minutes) | Until the project is deleted |

The operator may shorten these by deleting a project or trashing subjects.

## Rights and erasure procedure

- **Access and rectification.** A person reads their own account with `GET /api/auth/me` and changes their display name and email with `PUT /api/auth/profile` (Settings, profile).
- **Deactivation.** A director or super admin deactivates an account (`PATCH /api/board-users/:login` with `active: false`). Sessions are revoked at once, the person can no longer sign in, and the history stays attributed to the login. Only a super admin can deactivate a super admin, and the last active super admin cannot be deactivated.
- **Erasure.** A super admin runs `POST /api/board-users/:login/erase`. In one transaction the account loses its display name (replaced by "Former user"), its email, its single sign-on subject, its capacity and its super admin flag; its password hash is replaced by an unusable random one; its sessions are deleted; the projects it administered lose their admin. Its login is replaced by the pseudonym `erased-<id>` in every column that holds a login (assignee, remark and message author, decided by, risk owner, hold and step-back requester, state history), and in `requested_by` when it matches the login or the old display name. The last active super admin cannot be erased.
- **What erasure cannot reach.** Names written inside free text (notes, minutes, remarks, conversations, git history of the repositories) are not searched. Ask the authors to edit them, or delete the subject or project that holds them.
- **Requests.** A person asks the operator of their instance; the operator acts as controller and a super admin applies the steps above. Deleting the database file removes everything.

## Security measures

Passwords are hashed with scrypt; login attempts are rate limited per account and unknown logins cost the same time as known ones; cookies are HttpOnly and SameSite=Strict; the page is served with a strict Content-Security-Policy, `nosniff`, frame denial and no referrer; links entered by users are limited to http and https. See [Deployment.md](Deployment.md) for the token and secret handling.

## Dependency audit and known limits

- `npm audit --omit=dev` reports no known vulnerability in the production dependencies (checked 2026-09-29). Re-run it before each release.
- Tenancy is flat: every signed-in person can read every project. Writes are limited by the project admin, the subject holder and the super admin, not by a per-project membership.
- A subject stays in the project it was created in. Moving it would rewrite story references, workflow steps, milestones, risks and decisions, so it is deliberately not offered.
