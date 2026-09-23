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

Applied so far (issue #146): `AppShell.vue` (nav chrome), `CardDrawer.vue`, `StatisticScreen.vue`, the Kanban board (`KanbanScreen.vue`, `ColumnPanel.vue`), the Settings screen, the File browser.

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
2. **`Tabs`** next - replaces the two parallel hand-rolled implementations (`AppShell.vue`, `CardDrawer.vue`) with one accessible primitive.
3. **`Dialog`** once an actual modal/overlay need exists (there isn't one yet - `CardDrawer.vue` is a persistent side panel, not a dialog. Don't introduce a `Dialog` usage looking for a problem).

The native `<select>` in `AppearanceSection.vue` stays as-is - it's simpler, accessible by default, and has no real gap to close today. Revisit only if a richer picker (icons, previews) becomes an actual requirement, not preemptively.
