# Design system

Where the visual direction stands, and the decision on component primitives. This complements [VisualDirection.md](VisualDirection.md), which stays the source of truth for the type/spacing/radius scale and the colour-restraint rule - this document does not repeat those tables, it reasons about what to build with.

**Decision: Reka UI.** Adopted as the headless-primitives dependency for this project, for the reasoning below. Not shadcn-vue.

## Where the direction stands

Decided (see [VisualDirection.md](VisualDirection.md)): **Linear**, specifically - not a Vercel/Linear blend.

- Type: five named steps (label/body/emphasis/display/display-lg), one Tailwind class each.
- Spacing: tight-cluster / single-control / between-groups / outer-chrome, never an ad hoc `gap-2`/`p-4` picked by feel.
- Radius: two steps only - `rounded-md` for controls, `rounded-lg` for surfaces. `rounded-2xl`/`rounded-xl` are legacy, collapsed on touch.
- Colour: `--forge-*` tokens and every theme variant (6 palettes × light/dark) are untouched. The accent marks exactly one active/selected thing per view; status colours carry real status meaning only, never decoration.
- Border/elevation: one hairline per region, background-tone shift (`bg-panel`/`bg-card`/`bg-elev`) instead of nested borders.

Applied so far (issue #146): `AppShell.vue` (nav chrome), `StatisticScreen.vue`, the Settings screen, the File browser.

Not yet re-passed against the Linear-specific radius/colour rules above (they predate that decision, landed under the looser Vercel/Linear framing): all of the above files need a second look for `rounded-2xl`/`rounded-xl` and any decorative (non-status, non-active) colour use that survived the first pass.

## What forge-ops has today

Every interactive piece in the app is hand-rolled Vue + Tailwind: tabs, dropdowns (native `<select>`), buttons, tooltips (mostly absent), the drawer/panel pattern, dialogs (none - nothing currently opens as a modal overlay). No headless-UI or component-kit dependency exists in `package.json` today. That's the real starting point for the question below.

## Reka UI or shadcn-vue - the reasoning behind the decision

Both are Vue-ecosystem options; they are not actually alternatives to each other:

- **Reka UI** (formerly Radix Vue) is a headless primitives library: `Dialog`, `Popover`, `DropdownMenu`, `Tabs`, `Tooltip`, `Select`, `Combobox`, etc. It ships zero visual opinion - no default padding, radius, colour, or shadow. You get correct behaviour (focus trap, keyboard nav, ARIA roles, portal/positioning) and skin it entirely with our own `--forge-*` tokens and the scale in `VisualDirection.md`. It's a normal npm dependency: versioned, upgradable, a real line in `package-lock.json`.
- **shadcn-vue** is not a library in that sense - it's a CLI that copies pre-written component source into the repo. Under the hood, its components are themselves built on **Reka UI** plus `class-variance-authority`/`tailwind-variants`, styled to a specific default look (particular radius, shadow, spacing) that is close to the Vercel/Linear blend we've explicitly moved away from. Adopting it means: (1) the code becomes ours to maintain the moment it's copied in, duplicating what a dependency would otherwise track upstream, and (2) every component arrives pre-opinionated and has to be re-skinned to match the Linear-specific rules above before it fits.

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

## Calm pass (October 2026)

The interface was too busy. This pass keeps Dracula and Alucard, WCAG AA and the seven locales, and moves the product toward a calm, dense tool for engineers in the spirit of Linear, Vercel and Supabase. VisualDirection.md still owns radius and colour restraint; the points below replace its type rules where they differ.

### Direction

Quiet surfaces, clear hierarchy, editorial whitespace. Structure comes from spacing and one hairline per region, not from boxes, pills and caps.

### Type scale

Four sizes, one weight pair.

| Role | Class | Weight |
|---|---|---|
| Page title | `text-xl` with `title-face` | 600 |
| Body and controls | `text-sm` | 400, 500 for labels |
| Meta | `text-xs` | 400 |
| Figures and ids | `font-mono text-sm` | 400 |

Monospace is for ids, numbers and code only. Titles are sentence case, never italic, never uppercase. No letter-spacing on labels.

### Spacing scale

4px base: 1, 1.5, 2, 3, 4, 6, 8 (Tailwind steps). Gap inside a group 1.5 to 2, between groups 4 to 6, page gutters 4 on phones and 8 on desktop.

### Colour roles

Surface: deep, panel, card, elev. Text: hi, mid, low. Accent marks the current tab and the one primary action. Status colours only for real status. Both themes keep 4.5:1 on body text.

### Removed and why

- Heavy italic uppercase titles: shouting, no function.
- Letter-spaced uppercase captions: replaced by sentence case.
- Four bordered stat tiles: replaced by one inline row of figures.
- Shortcut digits stacked above tabs and titles: the shortcut stays in the tab title and aria-keyshortcuts.
- Redundant borders and pills where spacing is enough.

### Copy rules

Short sentences. No hype words, no exclamation marks, no emoji bullets. Sentence case. Say what the control does. Locale parity is kept: every key exists in the seven locales.

## Calm pass 2 (October 2026)

The first pass removed the loudest decoration. This pass removes boxes.

### Surfaces and borders

- Cards, panels, tiles and chips have no border. They are a background step (deep, panel, card, elev) with spacing around them.
- A divider is one hairline, the `border-hair` token (the line colour at 55 percent). One hairline per region, never a box inside a box.
- Inputs, selects and the primary button keep a visible edge so the control boundary stays above 3:1 (WCAG 1.4.11). Ghost and text buttons have no border and show a background step on hover and focus.
- A coloured border is reserved for a real state (error, drop target, selected).
- Floating layers (tooltips, menus) keep their edge because nothing else separates them from the page.

### One action

Each view has one primary button. Everything else is a ghost or text button.

### Board card

A card shows the title, the story id and one status line. Step details, agent, model, effort, cost and paused reasons live in the drawer or a tooltip. The single contextual action (Launch, Retry, Stop, Validate) stays on the card. Moving a card between steps lives in the drawer and in drag and drop.

### One status

The machine load, the running sessions, the budget and the room left are one quiet line in the shell. It opens the Resource details drawer. Nothing is shown twice.

### Lists

Subjects, roadmap events, statistics and settings are rows with 12 to 16px of vertical padding and one hairline between them, not tiles.

### Touch

Every target is at least 40px at 375 wide. Checkboxes and radios keep their visual size and get a 40px label hit area.

### Checks

After each change: screenshots of the changed screens in both themes at 1280 and 375, axe with 0 violations, and a touch-target sweep at 375.

## Calm pass 3 (October 2026)

The third pass trims the densest screens. Each rule below applies to the whole product.

### Weather and project status

Project weather is one compact line of buttons (colour dot, name, weather glyph, word). The status sentence, alerts and next event open on hover or focus and in the follow-up drawer. Never render weather as a grid of cards.

### Lists with a sidebar

Sidebar views and team members are plain text rows: a label and one figure. No avatars, glyph discs or chips. A row shows its flags (late, blocked) inline after the label.

### Subject rows

A subject row shows the title, one status and the due date. The project, the owner, the story count and the blocked duration are one muted meta line. Tags, requester, links, next event, waiting-on and the status note live in the drawer. The Release action appears on hover or focus of the row (always visible on touch and on the open row).
