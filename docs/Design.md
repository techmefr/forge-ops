# Design system

Where the visual direction stands, and the decision on component primitives. This document supersedes the type, radius and elevation rules of VisualDirection.md.

**Decision: Reka UI.** Adopted as the headless-primitives dependency for this project. Not shadcn-vue. The reasoning is below.

## Visual direction: HRFlow structure, Dracula and Alucard colour

The app is warm, professional and friendly: rounded, readable, with clearly structured cards and lists. The structure, type, spacing, radii, elevation and component anatomy come from the HRFlow design system. The colour comes from the existing themes: Dracula (dark, the default) and Alucard (light), plus the other four palettes (Volt, Nord, Gruvbox, Tokyo Night, Solarized) switched through the same `--forge-*` token mechanism. Only token values, radii, shadows, fonts and component classes change; no component hardcodes a colour.

Kept from the earlier calm passes: sentence case, no uppercase shouting, no hype copy, honest copy, one primary action per view, few chips, a quiet status pill, WCAG AA and RGAA, 40px touch targets at 375, seven locales, the GitHub Pages demo. Where the calm passes asked for borderless, flat surfaces, this document supersedes them: cards carry a 1px border and a small shadow again.

### Type

Fonts are self-hosted from the `@fontsource-variable` packages (latin and latin-ext only, `font-display: swap`, no CDN). Chinese falls back to the system CJK stack.

| Role | Font | Size / line | Weight | Class |
|---|---|---|---|---|
| h1, page title | Lexend | 32 / 40 | 700 | `title-face text-2xl` |
| h2, section | Lexend | 24 / 32 | 600 | `title-face text-xl` |
| h3, card heading | Lexend | 20 / 28 | 600 | `title-face text-lg` |
| h4 | Lexend | 16 / 24 | 600 | `title-face text-base` |
| Body | DM Sans | 14 / 22 | 400 | `text-sm` |
| Small, captions, metadata | DM Sans | 12 / 18 | 400 | `text-xs` |
| Mono, ids, codes, numbers only | Roboto Mono | 13 / 20 | 400 | `font-mono` |

Sizes are rem based, so the user font scale keeps working.

### Spacing

Base 8px. xs 4, sm 8, md 16 (component padding), lg 24 (section gaps), xl 32 (card padding), 2xl 48, 3xl 64. Generous whitespace around profile-like cards.

### Radius

sm 4 (chips, small elements), md 8 (buttons, cards, inputs), lg 12 (modals, panels, the drawer), full (avatars, pills). In Tailwind: `rounded-sm`, `rounded-md` and `rounded-lg` are 4, 8 and 8; `rounded-xl` is 12.

### Elevation

| Level | Shadow | Used for |
|---|---|---|
| sm | 0 1px 2px, 5% | inputs, chips, cards |
| md | 0 2px 8px, 8% | elevated cards, dropdowns, tooltips |
| lg | 0 4px 16px, 10% | modals, the drawer |
| focus | 3px ring, primary at 25% | focused inputs |

The shadow colours are tokens (`--forge-shadow-sm`, `-md`, `-lg`). In the dark theme they are stronger black and the surfaces step lighter so depth still reads.

### Colour roles

| Role | Dracula | Alucard |
|---|---|---|
| Page background (`deep`) | #282a36 | cream #f4f0e1 |
| Shell and header (`panel`) | #2c2e3b | #fffbeb |
| Card surface (`card`) | #313343 | near white #fffef8 |
| Raised and hover (`elev`) | #353847 | #ece7d3 |
| Line | #4a4d62 | #d9d4c0 |
| Primary (`acc`) | purple #bd93f9 | purple #644ac9 |
| Secondary, status and progress (`info`) | cyan | cyan #036a96 |
| Tertiary (`orange`) | orange, badges and small accents only | same |
| Success, warning, error | green, yellow, red | same hues, darkened |

Every text and accent token is lifted until it reaches 4.6:1 on all four surfaces (`resolvePalette`), UI component edges reach 3:1 (`controlEdge`). Tests enforce both in both modes.

### Components

- **Buttons.** Primary: filled primary, hover darker. Secondary: transparent, primary text, 1px primary border, hover tint. Ghost: muted text, hover surface. Destructive: only for irreversible actions. Sizes sm 32px/12px, md 40px/14px, lg 48px/16px. Disabled is 50% opacity with no hover. At most two primary buttons per view; the board has one.
- **Cards.** Surface fill, 1px border, sm shadow, 8px radius, 24px padding. The elevated variant has no border and a md shadow.
- **Inputs.** 40px high, 8px 12px padding, 8px radius. Hover tints the border, focus shows the primary border and the 3px ring, error shows an error border and a tinted fill. The label is DM Sans 500 14px with 4px below it, helper text is 12px.
- **Chips.** Filter chips: tinted primary fill, primary text, 1px primary border, pill. Status chips: tinted fill and coloured text, no border, pill (active green, pending warning, inactive or error red).
- **Lists.** 48px rows, 12px 16px padding, 1px divider, tinted hover. A selected row has a tinted background and a 3px primary left border.
- **Checkboxes and radios.** 18px, 2px border, primary when checked, an 8px gap to the label, a 40px hit area at 375.
- **Tooltips.** Dark fill, 12px text, 4px radius, md shadow, 240px maximum width.

### Do and don't

Warm, people-centred labels. Avatars or initials in list rows where a person appears. Secondary cyan for status and progress. Destructive only for irreversible actions. Tertiary orange only for badges and small accents. Clear loading and empty states. Multi-step flows show a progress indicator.

### Touch

Every target is at least 40px at 375 wide. Small buttons grow to 40px on phones. Checkboxes and radios keep their visual size and get a 40px label hit area.

### Copy rules

Short sentences. No hype words, no exclamation marks, no emoji bullets. Sentence case. Say what the control does. Locale parity is kept: every key exists in the seven locales.

### Checks

After each change: screenshots of the changed screens in both themes at 1440 and 375, axe with 0 violations, and a touch-target sweep at 375.

## What forge-ops has today

Every interactive piece in the app is hand-rolled Vue + Tailwind: tabs, dropdowns (native `<select>`), buttons, tooltips (mostly absent), the drawer/panel pattern, dialogs (none - nothing currently opens as a modal overlay). No headless-UI or component-kit dependency exists in `package.json` today. That's the real starting point for the question below.

## Reka UI or shadcn-vue - the reasoning behind the decision

Both are Vue-ecosystem options; they are not actually alternatives to each other:

- **Reka UI** (formerly Radix Vue) is a headless primitives library: `Dialog`, `Popover`, `DropdownMenu`, `Tabs`, `Tooltip`, `Select`, `Combobox`, etc. It ships zero visual opinion - no default padding, radius, colour, or shadow. You get correct behaviour (focus trap, keyboard nav, ARIA roles, portal/positioning) and skin it entirely with our own `--forge-*` tokens and the scale in the sections above. It's a normal npm dependency: versioned, upgradable, a real line in `package-lock.json`.
- **shadcn-vue** is not a library in that sense - it's a CLI that copies pre-written component source into the repo. Under the hood, its components are themselves built on **Reka UI** plus `class-variance-authority`/`tailwind-variants`, styled to a specific default look (particular radius, shadow, spacing) whose default look is not the HRFlow direction. Adopting it means: (1) the code becomes ours to maintain the moment it's copied in, duplicating what a dependency would otherwise track upstream, and (2) every component arrives pre-opinionated and has to be re-skinned to match the rules above before it fits.

### Why

Depend on **Reka UI directly**, skip shadcn-vue:

1. shadcn-vue's entire value proposition - components that already look a certain way - is a liability here, not a benefit: our look is already decided and specific, and undoing shadcn's defaults costs more than styling a blank primitive from scratch.
2. The copy-into-repo model conflicts with this codebase's own discipline (`global:no-god-classes`, "one way to do it" - see `heryjs-one-way-to-do-it` precedent from a sibling project): it turns a handful of components into permanently-owned, un-upgradable code the moment they land.
3. Reka UI is the same accessible-primitives value (focus trap, ARIA, positioning) as a real dependency, with none of the pre-styling to strip.

### Where Reka UI would actually replace something today

Concrete, not speculative - each maps to a real gap:

- **`Dialog`** - `CardDrawer.vue` currently has no focus trap and no escape/outside-click-to-close; a real overlay/modal (if one gets added later) has nothing to sit on today.
- **`DropdownMenu`/`Select`** - the theme-palette picker and language picker in `Setting/AppearanceSection.vue` are native `<select>` today; fine as-is for plain option lists, a candidate only if a richer picker (icons, previews) is ever wanted.
- **`Tabs`** - the hand-rolled tab logic in `AppShell.vue` and `CardDrawer.vue` (manual `aria-current`, manual active-state class) could become one accessible primitive instead of two parallel hand-written implementations.
- **`Tooltip`** - icon-only buttons rely on `aria-label` alone right now; a real tooltip primitive would give sighted users the same information screen-reader users already get, closing a real RGAA gap cheaply.
- **`Popover`** - nothing needs it today; note for later if a non-modal floating panel (a filter, a quick-add) shows up.

### What stays exactly as-is

Layout, cards/tiles, the type/spacing/radius scale, and the colour system are all *our* opinion, not something a primitives library has any stake in - Reka UI would sit underneath all of it unchanged.

## Adoption plan

Introduce Reka UI incrementally, smallest and lowest-risk first, each as its own mergeable slice:

1. **`Tooltip`** first - validates the dependency and the skinning approach (our tokens, our scale) on the smallest possible surface, and closes a real RGAA gap on icon-only buttons immediately.
2. **`Tabs`** next - replaces the two parallel hand-rolled implementations (`AppShell.vue`) with one accessible primitive.
3. **`Dialog`** once an actual modal/overlay need exists (there isn't one yet - `CardDrawer.vue` is a persistent side panel, not a dialog. Don't introduce a `Dialog` usage looking for a problem).

The native `<select>` in `AppearanceSection.vue` stays as-is - it's simpler, accessible by default, and has no real gap to close today. Revisit only if a richer picker (icons, previews) becomes an actual requirement, not preemptively.

## Screen rules carried over

Rules from the earlier calm passes that still hold. The surface, border and type rules of those passes are replaced by the sections above.

### Weather and project status

Project weather is one compact line of buttons (colour dot, name, weather glyph, word). The status sentence, alerts and next event open on hover or focus and in the follow-up drawer. Never render weather as a grid of cards.

### Subject rows

A subject row shows the title, one status and the due date. The project, the owner, the story count and the blocked duration are one muted meta line. Tags, requester, links, next event, waiting-on and the status note live in the drawer. The Release action appears on hover or focus of the row (always visible on touch and on the open row).

### Roadmap timeline

No page title that repeats the tab name. Event markers are 8px diamonds inside a 24px hit area (40px at 375). Markers whose hit areas would overlap are stacked on separate lanes, so two events one day apart never share a target. Only the next three events of a project carry a visible label; the others show it on hover or focus. Subject rows carry the bar only; their events live on the project band.

### Phone header

At 375 the chrome above the content stays under about 200px. The main navigation and the sub tabs are single rows that scroll sideways (no wrapping grid), the page subtitle is hidden, the title shares a line with the shell controls, the personal tally is one scrolling line, and the weather line scrolls sideways. The skip link stays the first focusable element and every target keeps 40px.

### Card drawer

The header is two lines: where the card lives (project, subject, step) and who works on it (agent and session). Proofs are one collapsed section with a count, never bubbles in the conversation. The conversation shows an author label only when the author changes, and consecutive messages of one author share a single bubble.

### My forge primary action

The board has exactly one filled button, Add story. Launch, Retry, Stop and Validate on cards, the view switch, the project switch and the workflow settings stay ghost or text buttons.
