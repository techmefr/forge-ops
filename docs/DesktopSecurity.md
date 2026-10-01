# Desktop security

The desktop shell wraps the web build in a Tauri webview.

## Content Security Policy

`src-tauri/tauri.conf.json` sets a strict policy: scripts, styles, images and fonts only from the bundle, `object-src 'none'`, and `connect-src` limited to the bundle and the Tauri IPC channel. The webview cannot open a network connection by itself, so every request to a Forge server goes through `plugin-http` (`DesktopFetch.ts`), including the reachability probe of the connect screen.

Inline styles stay allowed because Vue and the theme loader write style attributes. Inline scripts are not: Tauri hashes the bootstrap script of `index.html` at build time.

## HTTP plugin scope

Servers are chosen by the user at runtime, so the scope cannot list their origins in advance. The decision:

- `https://*` is allowed for any host and port.
- Plain `http://` is allowed only for `localhost`, `127.0.0.1` and the RFC1918 ranges (`10/8`, `172.16/12`, `192.168/16`), matching the address rules of the connect screen.
- Any other `http://` origin is refused by the plugin, so a cleartext bearer token cannot leave for a public host.

Scripts cannot be injected in the first place because of the policy above; the scope is the second layer, not the only one. Narrowing it further to the saved server origins would need a Rust command that rewrites the scope on every server change, which Tauri 2 does not offer for `plugin-http` today.

## Known limits

The board event stream uses `EventSource`, which `connect-src` blocks for a remote origin. It resolves a relative path today, so it already needs to be routed through `plugin-http` for the desktop shell.

## Saved server tokens

localStorage keeps the server list without tokens. The token of each server lives in the OS keychain (`src-tauri/src/keychain.rs`, service `dev.forgeops.desktop`, one entry per server id). On startup a plaintext token left by an older version is copied to the keychain and wiped from localStorage; if the keychain refuses it, the token stays where it was so nobody is signed out.

Saved addresses must be `https://`, or `http://` for localhost, 127.0.0.1 and RFC1918 hosts, and cannot embed credentials (`addressProblemOf`).
