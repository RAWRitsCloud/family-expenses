# Apple-design recommendations — family-expenses

Generated with the `apple-design` skill (`.claude/skills/apple-design`). Stack: React 19 + Bootstrap 5, installed as a mobile PWA (`apple-mobile-web-app-capable`), so touch feel matters.

## High impact
1. **Replace the hand-rolled modal + `modal-backdrop fade show` pattern** (`src/layouts/EditorShell.jsx:327-383`, `src/components/EmojiField.jsx:41-65`). Bootstrap's fade is a fixed-duration CSS transition: it can't be interrupted and it fades instead of originating from its trigger. On phones, make the unsaved-changes prompt and emoji picker a bottom sheet (damping 1.0 spring, drag-to-dismiss with velocity projection, §3–6); set `transform-origin` to the trigger on desktop (§7).
2. **Instant press feedback (§1).** Every `btn`/card row (`expenses.jsx:230` card list, dashboard sortable headers `dashboard.jsx:372`) only reacts on click. Add `:active { transform: scale(.97) }` at ~100ms and `touch-action: manipulation` to drop tap delay.
3. **Reduced motion / transparency.** There are no `prefers-reduced-motion` rules at all (§14). Add a block in `src/index.css` disabling Bootstrap's `.fade`/`.collapsing` transitions and Chart.js animation (`animation: false` when the media query matches, `dashboard.jsx:259` chart options).
4. **Destructive actions: prefer undo to confirmation (§16 Agency).** `handleDeleteExpense`, `handleDeleteCategory`, `handleDeletePayer/Child` should delete immediately with a toast "Undo" instead of (or in addition to) a modal. Keep the confirm only for the truly irreversible.

## Medium
5. **Expense list → detail transition** (`expenses.jsx` list ↔ `handleBackToList`): currently a hard swap. Slide in from the right and out to the right (symmetric path, §7) with a critically damped spring; support edge-swipe back with rubber-banding (§9).
6. **Calculator disclosure chevron** (`expenses.jsx:636`): animate the panel height/opacity with the same spring as the chevron, and honour reduced motion.
7. **Typography (§15).** Page headings use `fw-bold` at Bootstrap's default tracking. Add `letter-spacing: -0.02em; line-height: 1.1` for display/h1–h2 and keep body at `0`; use the system font stack (Bootstrap default is fine) and `rem` spacing.
8. **Sticky chrome as material (§12).** The editor header/save bar should be a `backdrop-filter: blur(20px) saturate(180%)` translucent layer with content scrolling underneath, plus a `prefers-reduced-transparency` fallback — instead of an opaque strip.
9. **Inline validation and status feedback (§16).** Save errors appear as a dismissible alert (`EditorShell.jsx:315`); add saving / saved status feedback on the Save button itself and validate fields inline.

## Low / polish
10. Wayfinding: confirm each editor page answers "where am I / how do I get out" (Back and Exit are both present — keep labels specific, e.g. "Expenses" not "Back").
11. Haptics: `navigator.vibrate` isn't on iOS Safari — skip; rely on visual feedback.
