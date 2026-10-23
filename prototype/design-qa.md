# Design QA

final result: passed

## Reference and captured evidence

- Source visual truth: `design/reference.png`, 1487 × 1058 pixels.
- Final light implementation: `design/implementation-final.png`, 1487 × 1058 pixels.
- CSS viewport 1487 × 1058; captured pixels equal CSS dimensions (1×). No density scaling or crop required for the full view.
- State: callback repair selected, initial conversation, execution tab, light theme.
- Full-view paired evidence: `design/comparison-final.png` (reference left, implementation right).
- Focused conversation comparison: `design/focus-final.png`; includes typography, metadata, message surfaces and validation entry.
- Additional state captures: `design/dark-interaction.png` (1280 × 720, simulated handoff), `design/narrow-context-final.png` (1000 × 800, context drawer).

## Findings and iteration history

1. Initial comparison (`comparison-initial.png`, `focus-initial.png`) found P2 text scale and column proportion differences. Increased conversation text to 17px, metadata to 16px, timestamps to 14px; aligned tracks to 197/292/flexible/341px at reference width and adjusted avatar spacing.
2. Recaptured at matching viewport and initial state (`implementation-final.png`), reviewed the paired full view and focused crop. Typography and four-column hierarchy now follow the chosen design. No remaining actionable P0/P1/P2 visual differences.
3. Narrow-window check found no explicit close control on the context overlay (P2). Added a labeled close button; recaptured `narrow-context-final.png`, inspected screenshot and verified opening/closing restores the main view. Escape is also supported. Drawer overlaying the central conversation is intentional at this width.

## Required fidelity surfaces

- Fonts: native macOS/PingFang system stack; title, body, metadata and timestamps are clear. Minor weight differences from raster reference remain P3.
- Layout: navigation, session list, task conversation, right context match the source hierarchy; composer stays visible; long conversation scrolls separately.
- Colors/tokens: neutral cool surfaces and blue accent match the concept; light/dark use shared semantic tokens. System mode follows OS appearance; user preference saved locally.
- Image/asset quality: source contains no photographic/illustrative assets requiring generation. Standard UI icons use Phosphor; text avatars and brand remain text. No placeholder illustrations or custom SVG icons.
- Copy: task, decision, excluded path and next step match the reference; explicit simulation labels are intentional additions. Other navigation opens scope explanations instead of claiming unimplemented pages exist.

## Browser interaction validation

Verified in the in-app browser:

- Switching callback → reconciliation → callback preserves the callback draft and keeps reconciliation input empty.
- Sending an additional instruction appends it, clears input and receives an explicitly simulated reply.
- Handoff preview includes goal/state/decision/excluded path/next step; target and close controls lock during simulated checkpoint; agent updates to Claude with an explicit event afterwards.
- Execution, artifacts and history tabs switch correctly.
- Search filters to reconciliation and opens the correct task.
- New demo task is created and selected, with pending state and context.
- Dark preference survives reload; system mode can be selected. No OS setting was changed to force an appearance-transition test.
- At 1000 × 800 the context panel is available from a dedicated button and closes via its labeled close action.
- Browser warn/error log check returned `[]`.

Production build checked with `npm run build`. No real Agent, integration, deployment, file-content upload or long-running task execution tested: these are outside this interaction prototype.

## Follow-up polish and limits

- P3: small icon-shape and vertical-rhythm differences remain versus the generated reference.
- Theme is persistent; demo task/message changes are intentionally in-memory and reset on refresh.
- Broader PL workflows are specified in the parent design documents; this build implements the chosen task execution surface only.
- Native desktop packaging, Agent enforcement, crash recovery and permission isolation require later software selection and implementation.

## Implementation checklist

- [x] Match selected visual hierarchy and check paired evidence.
- [x] Fix typography, column and drawer close issues.
- [x] Verify core prototype interactions and console.
- [x] Keep local preview available, without external publication.

## Revision 2026-10-23 — Unified Agent and model controls

User-requested changes supersede the original top-level handoff button and passive receiver label. Removed the former and replaced the latter with adjacent, working Agent/model selectors; the rest of the selected visual hierarchy is retained.

Evidence: `design/unified-controls-dark-content.png` full app content and `design/unified-config-detail.png` composer close-up. Combined reference/change region: `design/unified-focus-review.png` (original composer above; revised controls below). The revised capture uses a wider CSS viewport (1983 × 1411, rounded from 1982.67 × 1410.67) than the original 1487 × 1058. Do not infer exact full-frame geometry or pixel fidelity from this comparison. The raw browser screenshot included extra white padding, removed in the content crop; no page content was redrawn or replaced. Focused review evaluates the intentional control change, spacing, legibility and available actions at native captured size.

- Typography, neutral/blue semantic colors, standard library icon fidelity and source task copy are retained. Agent/model labels remain readable and distinct; both controls appear in one configuration group alongside send, wrapping as needed.
- Agent chooser leads to the existing checkpoint/context handoff preview. Selection, transition lock and successful recipient update verified in browser.
- Model chooser shows system default plus clearly labeled demo options appropriate to the chosen demo tool. Selecting a model preserves draft; changing tasks restores each task's own model; submitted message records the selected tool/model.
- After switching Codex → Claude the model resets to target tool system default. Browser confirmed context remains present and entry updates to Claude; no real backends are invoked.
- `npm run build` passed; browser warning/error logs returned `[]`.
- No new P0/P1/P2 issue found in the changed controls. Existing P3 raster/font and icon differences remain.

final result: passed

## Full workbench design completion — 2026-10-23

Scope: user authorized finishing all product/UI design autonomously. Extended the established task execution visual system to Today, projects, team workload, Agent management, methodology, extensions, settings, notifications and task search. New administrative layouts intentionally use broad tables and focused side insights rather than the execution screen's four columns.

### Visual evidence

- Original selected source remains `design/reference.png` (1487 × 1058).
- Current execution screen: `design/workspace-execution-final.png` (1623 × 1137).
- Paired source/current evidence: `design/workspace-source-comparison.png`; no full-frame pixel-match claim because viewports differ. Source above-fold hierarchy, four-region structure, typography and content were compared, allowing approved changes: unified Agent/model controls, project-scoped session list, shared team owner and additional mock tasks.
- Native-size typography crop comparison: `design/workspace-type-comparison.png`. Reviewed family, weight, message rhythm, truncation and role avatars.
- New-page full views: `workspace-today-final.png`, `workspace-projects-dark.png`, `workspace-board-dark.png`, `workspace-team-dark.png`, `workspace-agents-dark.png`, `workspace-rules-dark.png`, `workspace-extensions-dark.png`, `workspace-appearance-light.png`, `workspace-settings-light.png`, all in `design/`.
- Multi-page overview `design/workspace-overview.png` is for hierarchy/consistency review; individual screenshots were opened where text or controls needed inspection.
- Captures vary between 1623 × 1137 and 1707 × 960 as the browser viewport/zoom changed. Screenshots were not stretched to pretend equal CSS frames. Primary action reachability, scrolling and table containment were reviewed in their actual captured viewports.

### Findings and fixes

- P2: labels wrapping native select controls were not reliably selectable by exact accessible name. Added explicit aria-label to reusable Field controls; verified owner selector and model/task fields afterwards.
- P2: global search could update selected task while staying on a management page. Fixed it to open the execution surface; browser verified correct project and task.
- P2: editing task data could carry stale execution fields and provide a second Agent-switch bypass. Restricted editable data to task metadata, made existing Agent read-only and pointed to the composer selector; running project reassignment also requires pause.
- P2: delayed demonstration results could override paused/cancelled state. Automatic simulation patches now preserve those user states.
- P2: cancelled tasks inflated project progress. Excluded them from active project totals while keeping history.
- P2: fixed-length demo splitting silently ignored task segments after eight. Removed silent truncation; overall input is explicitly bounded instead.
- P3: minor raster reference/font/icon differences remain; font and neutral/blue theme are consistent across modules. No new raster imagery was needed; library icons used throughout.

### Browser-tested journeys

1. Natural-language input → editable two-task plan → simulate execution → new tasks visible in projects/team records with unknown hours retained.
2. Team baseline: 38/32h, 24/32h, 20/28h, 22/28h. Move 4h logs to 小林: 34h/28h respectively; remaining 2h overload displayed. Undo restores 38h/24h.
3. Project overview → project detail → list/kanban → project delivery preview → simulated release record. No real build/deployment was run by that UI.
4. Methodology bad candidate blocks activation. Complete candidate passes demo checks; activation changes default to v1.3; rollback restores v1.2. Results clearly say no real Agent regression ran.
5. Extension candidate check → enable. State persists while navigating among prototype pages.
6. Custom Agent candidate form accepts name/entry and saves disabled-by-default configuration without executing or connecting.
7. Global search from Today opens callback repair execution screen. Original conversation, owner and context remain visible.
8. Edit task acceptance criteria saves while retaining conversation. Agent/model controls remain available at the composer.
9. Settings appearance and local data pages rendered; dark and light screens reviewed. Export code is present; automated download/restore, OS notification and native app update were not claimed as tested.
10. Browser warning/error logs returned `[]` after the final application changes.

### Checks and limits

- `npm run build`: passed.
- `node --test tests/workspace-data.test.mjs`: 5 passed. Cases cover cross-project load, transfer totals, zero capacity, different weeks/cancellation, and demo task parsing.
- Cross-page data flow is implemented in frontend state; model/Agent execution, rule verification, extension generation and deployment remain explicitly simulated.
- Native filesystem durability, desktop packaging, background recovery, real permission enforcement, backend model compatibility, multi-user collaboration and production accessibility validation remain outside this design prototype.
- Error/empty/recovery behavior contracts are specified in the delivery overview; native fault injection was not performed.

final result: passed


## Agent minimal home and primary sessions, 2026-10-23

Design authority: the user explicitly replaced the previous dense Agent catalog home with a large centered composer, bottom tool/model/workspace controls, a separate primary Sessions page, and individual Agent settings pages. This is an intentional scoped redesign; no pixel-match claim against the old catalog image. Existing typography, neutral/blue tokens, navigation language and execution view remain the baseline.

Visual evidence inspected at actual viewport sizes (1623 × 1137 and 1707 × 960):
- `design/agent-home-minimal.png`: large central input; all three selectors and send controls visible, no catalog metrics or cards.
- `design/agent-home-dark.png`: same control anatomy in dark theme.
- `design/agent-independent-settings.png`: separate Agent settings, explicit save and new-session semantics.
- `design/agent-workspaces.png`: shared workspace directory with per-Agent availability/defaults.
- `design/agent-models.png`: independent model defaults, clearly marked demonstration model choices.
- `design/sessions-primary.png`: top-level session inventory and filters; no clipping in reviewed desktop views.

Browser-tested: Codex model default changed to coding and space to personal, with admin disabled; switching to Claude retained system/admin defaults. Per-tool draft survived switching away and back. Claude planning mode and supplemental rules saved independently. New session with reasoning model/admin scope opened execution with the chosen values and planning status. Codex was unavailable for handoff into its disabled admin scope. Session rename, archive, archived input lock, restore and return to inventory passed. New workspace added to Codex did not become enabled for Claude. Light/dark views inspected. Browser warning/error log returned `[]`.

Findings fixed: handoff now uses target Agent default model and requires current-space compatibility; new workspace availability is explicit per Agent; existing sessions snapshot workspace path and Agent supplement rather than reading later default changes; session filters retain a selected Agent even with no sessions; execution resources follow project scope instead of always showing payment references; exported demo snapshots include Agent config and workspace metadata.

Validation: `npm run build` passed. `node --test tests/agent-data.test.mjs tests/workspace-data.test.mjs`: 9 passed. New cases cover independent defaults, preventing automatic space expansion, deleted/empty default handling, and keeping unstarted tasks out of session inventory.

Limits: page-memory prototype, demonstration model names, no actual filesystem binding or Agent process; archive does not stop execution. Formal design separates conversations from tasks, while this prototype uses a linked task record to render an independent session and labels this simplification. No new native durability, backend or mobile-width reliability claim.

final result: passed


## Quick prompt cards, 2026-10-23

Scoped request: add click-to-fill prompt cards to the established minimal Agent start surface. Added four compact cards under the input, shared by the main home and dedicated Agent Start pages. Existing selectors and configuration pages retained.

Evidence: `design/agent-quick-prompts.png` inspected at 1623 × 1137; cards are one clear row and do not compete with the main composer. Colors inherit the established theme tokens; grid switches to two columns below 1100px.

Browser verification: clicking a card fills the input without opening a session. With a known existing draft, appended text retained the original prefix and Undo restored the exact original value (`preserved: true`, `restored: true`). Card action does not modify tool/model/space. Final warning/error log `[]`. `npm run build` passed. No additional unit tests were added for this reversible UI-only change.

final result: passed


## Project menu deferred; workspaces decoupled, 2026-10-23

Removed the Project primary navigation item. Workspace schema and form no longer contain a project relation, Agent session creation does not assign a project, and taskSpace no longer infers a workspace from projectId. Execution sidebar now groups/switches by explicit workspace; session inventory shows workspace only. Earlier project-module design/source is retained for later consideration.

Browser verified: no Project nav item; Add Workspace only asks for name/path; independent workspace “研究资料” saved and selected as default; new Agent session opens under that workspace; switcher shows its one session separately from the three payment-workspace sessions; switching back opens the original session, and primary session table has no project column or sublabel. Warning/error log `[]`.

Evidence `design/workspaces-no-project.png` visually inspected. Build passed; 9 data tests passed, including a regression assertion that projectId alone never supplies workspace identity.

final result: passed

## App typography and composition refinement, 2026-10-24

Source visual truth: `design/polish-before-home-frame.png` and `design/polish-before-team-frame.png`, captured from the established prototype before edits. User explicitly requested larger typography and a more coordinated, refined layout. Intentional changes are specified in `../视觉规范.md`; this pass evaluates those changes and preservation of the established structure, not pixel equality with the earlier compact interface.

Implementation: `design/polish-home-final-frame.png`, `design/polish-team-final-frame.png`, `design/polish-sessions-frame.png`, `design/polish-today-frame.png`, `design/polish-settings-frame.png`, `design/polish-workspaces-frame.png`, `design/polish-execution-dark-final-frame.png`, `design/polish-rules-frame.png`, `design/polish-extensions-frame.png`.

Viewport and normalization: desktop DOM viewport 1706.67 × 960 CSS pixels, reported devicePixelRatio 0.75 from existing browser zoom. Screenshot service returned a 2275 × 1280 canvas containing the app at approximately 1707 × 960 with unused right/bottom padding. Normalized `-frame.png` copies crop only that padding; app pixels were not resampled. Before/final pairs use the same viewport, theme, route, empty-home/team-default state and sample content. Narrow tests used actual measured 1000 × 840 and 800 × 800 CSS viewports. Temporary viewport overrides were reset. A pre-reset execution capture retained the small frame; it was excluded, recaptured after viewport observation, and replaced by the correctly sized `polish-execution-dark-final-frame.png` evidence.

Full-view comparison inputs: `design/polish-home-comparison.png`, `design/polish-team-comparison.png` for iteration one; `design/polish-home-final-comparison.png`, `design/polish-team-final-comparison.png` for the final pass. Each pairs source and implementation in one image. Focused native-pixel comparison: `design/polish-type-comparison.png`, showing the original 13/11px prompt labels and descriptions beside revised 16/13px typography.

### Findings and comparison history

- [P2, resolved] First visual pass retained a slightly weak secondary text color on the selected-row background (4.22:1). Updated muted text from #687286 to #606b7e; the checked selected-background contrast is now 4.70:1. Final home/team captures show the fix in context.
- [P2, resolved] Existing amber warning text was too light for comfortable small-text reading. Added theme-specific warning text colors; checked #9b5b15 against #eceffc is 4.70:1. Final team capture shows the darker overload label while retaining the amber load bar.
- The intentional larger rows move some secondary task details below the fold in Team/Today. Content remains accessible in the main scroll region, while navigation and the primary work surface remain usable. This is an accepted tradeoff for the user's readability request.
- No remaining actionable P0/P1/P2 visual findings in reviewed states. Native mobile layouts below the desktop prototype's existing 580px minimum are outside this pass.

### Required surfaces reviewed

1. Fonts: local system sans stack with Chinese fallback, antialiasing, role-specific weight and spacing. Home heading 44px, page heading 34px, sections 22–25px, body 15–17px, controls/secondary content 13–16px. Confirmed heading size from rendered computed style. Native prompt-card crop verifies the increase without scaling the whole UI. Chinese wrapping, numeric alignment, task-name truncation and controls were inspected.
2. Layout: 232px desktop navigation, 960px home column, shared composer/card alignment, consistent margins, bounded management reading width and relaxed table rows. Inputs, tabs, forms, button height, borders, radius and subtle input elevation were checked across views. At narrower widths prompt cards become two columns; execution hides the sibling-session column and retains primary Sessions navigation; the context drawer opens and closes correctly.
3. Colors: shared light/dark semantic tokens, restrained indigo selection, neutral surfaces, meaningful status labels. Checked primary white-on-indigo contrast 5.21:1 and dark secondary text against main background 7.90:1. This is a check of key pairs, not a full accessibility certification.
4. Assets: existing Phosphor icon family retained with consistent scale; no image assets were replaced or newly invented. Brand remains the established text wordmark with a small product descriptor. No remote font or decorative raster dependency was introduced.
5. Copy/content: existing navigation and content retained, Project menu remains absent, workspace configuration remains independent of projects, demo limitations remain visible. No new feature or hidden-backend capability was implied.

### Browser and build checks

- All primary pages rendered and their screenshots inspected: Agent, Sessions, Today, Team, Methodology, Extensions, Settings and dedicated Agent Workspaces.
- Quick prompt click filled the draft, Undo remained usable, and no session was automatically sent.
- Opened an existing session; at 800px CSS width the context drawer opened/closed and the model selector applied a subsequent-request model change. Wide execution view retained the four-region structure.
- Light/dark theme switching retained state. At 1000px CSS width document width matched viewport width and the send button remained inside the viewport; tall content scrolled within the main surface.
- Warning/error console log returned `[]` after the final style change.
- `npm run build`: passed. No additional unit tests added for this typography/layout change; no business or backend behavior was changed.

Implementation checklist: role-specific scale applied across modules; contrast fixes recaptured; desktop/narrow/theme interactions checked; viewport override reset; local preview retained; design decisions recorded in AGENTS.md and the visual specification.

final result: passed
