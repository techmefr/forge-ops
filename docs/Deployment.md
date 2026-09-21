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

**2. Instance on the laptop, server on a VPS.** The shared board exists; the code and the agents stay on the machine of whoever wrote them. The instance opens no port - it calls out.

**3. Everything on a VPS.** Instance and server hosted, the laptop is a screen. The agent then runs on the VPS, so the repositories and the git identity live there.

**4. Hosted server, self-hosted instances.** What a subscription looks like: we run the server, each team runs its own instance wherever it wants.

Pick by one question: **where do you want the agent to run?** Everything else follows from that answer.

## What every image respects

- **No secret in a layer, and none in a URL.** The board token and the instance token arrive as mounted files or as the environment of the run. A URL ends up in access logs, shell history and the `Referer` header.
- **The instance keeps a volume** - its database, its worktrees, its screenshots. When the volume is missing it says so instead of starting empty and silent.
- **Healthchecks on server and instance**, so a compose file can order the startup instead of racing it.
- **The instance container carries the agent CLI**, and the repositories are mounted: an image that bakes in a checkout is an image that is stale the next day.

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
