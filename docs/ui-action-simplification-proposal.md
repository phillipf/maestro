# UI Action Simplification Proposal

## Goal
Reduce visual clutter while keeping the most common tasks fast and discoverable.

## Core Interaction Conventions
1. Entity click opens detail.
2. Edit is shown as a pencil icon button (with tooltip and `aria-label="Edit <entity>"`).
3. Secondary and destructive actions move into an `Actions` overflow menu (`...` or `Actions`).
4. Filters can collapse behind a funnel icon, but active filter state must stay visible as a count badge.

## Visibility Rules (Use Across All Screens)
1. Keep visible:
   - Primary task for the page (high frequency, high value).
   - At most one primary CTA in each section.
2. Icon-visible:
   - Edit action for the current row/card.
3. Move to `Actions` menu:
   - Status transitions, delete, import/export, archive, restore, advanced operations.
4. Never hide:
   - The single page-primary "create new" action if users do it often.

## Proposed Updates By Screen

## Outcomes List (`OutcomesPage`)
1. Outcome title becomes the main click target to open detail.
2. Remove per-row text button `Open detail`.
3. Replace per-row `Edit` text button with pencil icon.
4. Move status transitions (`Archive`, `Retire`, `Activate`) into per-row `Actions`.
5. Replace separate "Create outcome" card header action with one top-level `+ Add outcome` button.
6. Keep create form hidden by default (drawer/modal/popover), not as a permanent full card.
7. Move filter chips into a filter popover triggered by funnel icon.
8. Show active filter badge (example: `Filter (2)` or funnel badge `2`).
9. Keep "Add output" as visible CTA on each outcome row only if used frequently; otherwise move to `Actions`.

## Outcome Detail (`OutcomeDetailPage`)
1. Keep one visible primary CTA: `+ Add skill`.
2. Replace `Edit outcome` text button with pencil icon in header.
3. Skills list:
   - Clicking skill row/title opens skill detail.
   - Pencil icon for edit.
   - Stage changes move into `Actions`.
4. Replace large inline "Add skill" card with modal or slide-over form.

## Skill Detail (`SkillDetailPage`)
1. Keep stage-change options in `Actions` rather than multiple header buttons.
2. Keep "Back to outcome" as secondary visible text button.
3. If additional skill operations are added later, place them in `Actions` first.

## Metrics (`MetricsPage`)
1. Keep visible primary CTA: `+ Add metric`.
2. Replace per-metric `Edit` text button with pencil icon.
3. Move `Set/Unset primary` and `Delete` into per-metric `Actions`.
4. Entry rows:
   - Keep quick edit icon visible.
   - Move delete into `Actions` if row density becomes high.
5. Move any future filter controls to funnel icon + popover.

## Dashboard (`DashboardPage` and `ScheduledOutputCard`)
1. Keep quick completion actions visible (`Done`, `Missed`) as they are core workflow.
2. Keep secondary operations (expanded notes, skill logging extras) behind progressive disclosure.
3. Use consistent `Actions` menu only for non-core card operations.

## Weekly Review / Settings
1. Use the same icon and menu language for edit and secondary actions.
2. Avoid introducing standalone text action buttons unless they are the page-primary action.

## Standardized Control Language
1. `+ Add <entity>` for primary create.
2. Pencil icon = edit.
3. Kebab (`...`) or `Actions` button = secondary operations.
4. Funnel icon = filters.
5. Row or title click = open detail.

## Accessibility and Usability Requirements
1. All icon-only controls require tooltips and accessible labels.
2. Overflow menus must be keyboard navigable and close on escape.
3. Row-click areas must not interfere with checkbox, links, or inline buttons.
4. Preserve confirmation for destructive actions.

## Rollout Plan
1. Phase 1: Outcomes list + Outcome detail (highest clutter reduction impact).
2. Phase 2: Metrics and Skill detail.
3. Phase 3: Dashboard polish and consistency pass.
4. Phase 4: UX telemetry and tuning (click paths, menu usage, create-task completion rate).

## Success Criteria
1. Fewer visible controls per row/card.
2. No drop in create/edit task completion.
3. Faster first-click path to detail screens.
4. Lower misclick rate on crowded rows.
