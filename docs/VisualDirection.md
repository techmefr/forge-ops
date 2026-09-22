# Visual direction

Reference for the Vercel/Linear-inspired pass tracked in issue #146. This is slice 1: the scale below, applied first to the shared shell chrome (`AppShell.vue`). It states what to use going forward; it does not retire any colour token or theme variant - `--forge-*` stays exactly as defined in `frontend/src/style.css` and `frontend/src/technical/Appearance`.

## Type scale

Five named steps, each one Tailwind class. Nothing outside this list on new or touched markup.

| Step | Class | Use |
|---|---|---|
| label | `text-[11px]` | Meta text: shortcut digits, counters, status pills, timestamps |
| body | `text-sm` (14px) | Default running text: tab labels, descriptions, list rows |
| emphasis | `text-[13px]` with `font-semibold` or `display-italic` | A line that needs to stand slightly above body without becoming a heading |
| display | `text-[22px]` with `display-italic` | A brand or section mark in a strip of chrome (the `Forge.ops` logotype) |
| display-lg | `text-[28px]` with `display-italic` | The one page-title heading in a screen's header |

`text-[9px]`/`text-[9.5px]`/`text-[10px]`/`text-[12px]`/`text-[12.5px]`/`text-[34px]` and similar one-off sizes are legacy from before this pass; they still work but are not reused when a component is touched - collapse to the nearest step above instead.

## Spacing scale

| Value | Applies to |
|---|---|
| `gap-1.5` / `px-2.5` / `py-1.5` | Inside a tight, related cluster (an icon next to its label, a digit next to its badge) |
| `gap-3` / `px-4` / `py-2.5` | Inside one control (a tab's own padding, a button's own padding) |
| `gap-6` / `px-6` | Between distinct groups that share a row (the logotype block vs. the tab strip) |
| `px-8` / `py-4` and above | Outer padding of a chrome region against the viewport edge |

Tighter gaps within a related group, wider gaps between unrelated groups - never the same `gap-2`/`p-4` regardless of relationship.

## Border and elevation rule

- One hairline, `border-line` (usually `border-b`), separates a whole region from what comes after it - a header from the screen body, a tab strip from the header above it. Never nest a second bordered box inside that region to further separate its children.
- To distinguish content within a region, shift background tone instead of adding a border: `bg-panel` for the chrome shell, `bg-card` for content sitting on it, `bg-elev` for something raised one step further (a popover, an active/hover surface).
- Current-state (active tab, selected item) gets exactly one signal - here, the accent underline (`border-acc` on `border-b-[3px]`) plus the accent-coloured meta label. It does not also change background, weight and border simultaneously.
