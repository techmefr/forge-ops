# Deployment

Everything ships as containers. The split follows the boundary of [Architecture.md](Architecture.md): the server holds what is shared, the instance holds what executes.

## Three images

| Image | Holds | Needs beside it |
|---|---|---|
| `server` | Accounts, organisations, projects, epics, stories, templates | A database volume. No code, no agent. |
| `instance` | Sessions, worktrees, conversations, metrics, evidence | The agent CLI, a git identity, and the repositories it works on - mounted, never baked in |
| `web` | The built front, served as static files | The addresses of the server and the instance, at runtime |

One built front serves every deployment: its addresses are read when the page starts, not when the bundle is built. Otherwise every install needs its own build.

## Four ways to run it

**1. Everything on one laptop.** Instance and web, no server. One person, no account, nothing shared. This is how someone tries the tool in ten minutes, and it has to keep working forever.

**2. Instance on the laptop, server on a VPS.** The shared board exists; the code and the agents stay on the machine of whoever wrote them. The server never connects to the instance, which calls out. The hub compose files still publish port 4311 on every interface for the board and the hooks, so put a firewall or a reverse proxy in front of it; hub mode requires an identity on every route.

**3. Everything on a VPS.** Instance and server hosted, the laptop is a screen. The agent then runs on the VPS, so the repositories and the git identity live there.

**4. Hosted server, self-hosted instances.** What a subscription looks like: we run the server, each team runs its own instance wherever it wants.

Pick by one question: **where do you want the agent to run?** Everything else follows from that answer.

## What every image respects

- **No secret in a layer, and none in a URL.** The board token and the instance token arrive as mounted files or as the environment of the run. A URL ends up in access logs, shell history and the `Referer` header.
- **The instance keeps a volume** - its database, its worktrees, its screenshots. When the volume is missing it says so instead of starting empty and silent.
- **Healthchecks on server and instance**, so a compose file can order the startup instead of racing it.
- **The instance container carries the agent CLI**, and the repositories are mounted: an image that bakes in a checkout is an image that is stale the next day.

## The first super admin

A super admin is a flag an instance grants to the people it chooses; it is not tied to the director or architect role. The first one comes from the deployment, on the image that holds the accounts (`server`, or the `instance` when there is no server):

| Variable | Meaning |
|---|---|
| `FORGE_SUPER_ADMIN_LOGIN` | Login of the account that gets the flag |
| `FORGE_SUPER_ADMIN_PASSWORD` | Its password, used only when the account is created |
| `FORGE_SUPER_ADMIN_PASSWORD_FILE` | Path of a mounted secret holding the password; wins over the variable |

At start-up, a missing login is created with the flag and a hashed password; an existing one gets the flag back and keeps its password. A password changed in the tool is never overwritten by a restart, and neither value is ever logged.

Without these variables the server still starts, logs a warning, and nobody can manage super admins until they are set. Once one exists, super admins are granted and removed in Settings › Users (`PATCH /api/board-users/:login`). The last super admin cannot lose the flag.

Prefer the file form: `docker/super_admin_password.secret` is mounted as a secret and the login is read from `FORGE_SUPER_ADMIN_LOGIN` in every compose file that runs a hub:

| Compose file | Container that holds the accounts and receives the variables |
|---|---|
| `compose.vps.yml` | `server` |
| `compose.split.yml` | `instance` (in hub mode) |
| `compose.hosted.yml` | `instance` (in hub mode) |

`compose.laptop.yml` runs in local mode, with no accounts, so it takes none of them.

## Guided setup

`npm run forge-ops -- init` asks where the agents run and writes what the chosen topology needs: the secret files under `docker/` (mode `0600`, never overwritten) and `docker/.env`. `npm run forge-ops -- doctor` checks Docker, the secrets and the health of the instance and says what to fix. The `laptop` and `vps` topologies generate their tokens; `split` and `hosted` take the instance token minted by the server. Every topology except `laptop` also asks for the first super admin login and generates `super_admin_password.secret` (shown once).

## Signing in with Google or Microsoft

The accounts live on the `server`, or on the `instance` when there is no server, so that is where the provider variables go (`compose.vps.yml` forwards them to both):

| Variable | Meaning |
|---|---|
| `FORGE_PUBLIC_ORIGIN` | Public address of the board. The redirect URI to register is `<origin>/api/auth/oidc/google/callback` or `…/microsoft/callback` |
| `FORGE_OIDC_GOOGLE_CLIENT_ID` / `_CLIENT_SECRET_FILE` | Google OAuth client. The wizard writes the secret to a 0600 file mounted as a compose secret, never to the environment |
| `FORGE_OIDC_MICROSOFT_CLIENT_ID` / `_CLIENT_SECRET_FILE` | Microsoft Entra app registration, same secret handling |
| `FORGE_OIDC_MICROSOFT_TENANT` | A tenant id (a UUID). The multi-tenant values `common`, `organizations` and `consumers` are refused because the email is not verified by the provider |
| `FORGE_OIDC_ALLOWED_DOMAINS` | Email domains that may create an account on first sign-in, as architects. Empty means nobody can: only existing accounts sign in |

The server runs the authorization code flow with PKCE, a one-time `state` and a `nonce`, and checks the audience, the nonce, the expiry and, for Google and a specific Microsoft tenant, the issuer. An account is matched by `provider:subject`, else linked to the account with the same verified email, else created when the domain is allowed, else the sign-in is refused. Only accounts that were already active can sign in.

The desktop app ends the flow differently: the server redirects to `forgeops://auth?code=…` with a single-use code valid for sixty seconds, and the app trades it for its session. No cookie is set on that path. A client that sends `x-forge-client: desktop` gets its session token in the login response (browsers never do: they keep the `HttpOnly` cookie).

## The desktop app

The installers attached to each GitHub release wrap the same front and update themselves from `latest.json`. They keep a list of servers (instance address, optional board server address, one session each) and reach them through the Tauri HTTP plugin, so there is no CORS to configure on the instance. Releases are cut by pushing a `v*` tag; the repository holds `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and the public key is in `src-tauri/tauri.conf.json`.

## What to run

| Topology | File |
|---|---|
| 1. Everything on one laptop | `docker/compose.laptop.yml` |
| 2. Instance on the laptop, server on a VPS | `docker/compose.split.yml` |
| 3. Everything on a VPS | `docker/compose.vps.yml` |
| 4. Hosted server, self-hosted instances | `docker/compose.hosted.yml` |

```bash
docker compose -f docker/compose.laptop.yml up --build
```

Opens on **http://forge.localhost** — no port, works the same on macOS, Linux and Windows with no host configuration, since every modern browser resolves `.localhost` to the loopback on its own. `web`'s nginx proxies `/api/*` straight to `instance` inside the compose network, so the browser only ever sees one origin; `instance` still declares that origin explicitly (`FORGE_PUBLIC_ORIGIN`) since it binds `0.0.0.0` to be reachable at all, and a bind address is not an origin a browser will ever send.

Each file reads its secrets from `docker/board_token.secret` and, when a server is involved, `docker/instance_token.secret` - mint the second one from the organisation half of the settings. Neither ever enters an image or a URL.

The web image writes `config.js` at startup from `FORGE_INSTANCE_URL` and `FORGE_SERVER_URL`, and the page reads it before it calls anything: the same built bundle serves all four topologies.

Data handling, retention and erasure: see [Privacy.md](Privacy.md).
