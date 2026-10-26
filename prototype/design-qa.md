# Design QA

final result: passed (design prototype); desktop milestone evidence is appended below

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


## Desktop milestone — 2026-10-25

The following supersedes earlier statements that native packaging and all business persistence are unimplemented. Browser preview remains an in-memory demo. Electron desktop uses real local files; real Agent/model execution remains unconnected.

- `npm run check`: production build, 23 business/storage tests and 4 static packaging tests passed (27 total). Tests cover reopen/backup, stale concurrent writes, corruption protection, unknown schema, unsaved export, simulated write failure/retry, task/session separation and protocol path restrictions.
- Official Electron 45.0.0 darwin-arm64 runtime was SHA256 verified; @electron/packager generated a local asar application with ad-hoc signature. No external publication or Apple notarization.
- Native app started from the packaged `.app` without a Vite server dependency. Found and fixed an ESM entry deadlock by registering the readiness continuation without top-level waiting for ready.
- Native UI verified fresh empty launch, explicit unconnected status, creating an independent session, deep theme selection, normal Cmd+Q exit and re-opening the same isolated directory. All three sessions and dark theme restored; tasks remained zero. Backup and primary used local files, primary mode 0600.
- `design/desktop-sessions-restored.png` captures only the developer verification session through a search filter, after restart. Native window title bar, dark theme, unconnected state and real saved indicator are visible. No user conversation contents are committed.
- Native export dialog produced a schema v1 backup containing three sessions and theme. Import selected this same isolated backup, showed an explicit replacement dialog, restored it and reloaded successfully. Previous document remained in `.bak`.
- Native file chooser automation required real typing to trigger macOS path completion; setting an AX value alone did not trigger it. This was an automation interaction issue, not an application storage failure.
- Test data and backup stayed under `/private/tmp/castiel-desktop-smoke-20261025` and `/private/tmp/Castiel-desktop-smoke-backup-20261025.json`, outside Git. Final normal launches use the Application Support directory described in README.

Limits: backend corruption/disk failure tests use controlled fixtures, not physical disk exhaustion or power-loss testing. No real model request, Agent execution, production update, encryption, cross-device sync or sleep/resume execution was validated. Team week planning and daily parsing still use prototype rules pending the real scheduler milestone.

## Local Agent integration — 2026-10-25

This supersedes the desktop milestone's unconnected-Agent limit. Browser execution and daily orchestration remain demonstrations.

- `npm run check` passed: production build, 36 business/storage/runtime tests and 4 static packaging tests (40 total). New coverage includes safe discovery summaries, stdin prompt handling, streaming deduplication, real subprocess stop, permission denials, invalid models, archived sessions, cancellation before launch, owned workspace paths, Codex RPC streaming/resume/interrupt, one-time approval constraints, planning mode, parallel limits, missing-rollout recovery, save during long streams and cross-tool backend-ID isolation. Provider success is not inferred from these fixtures.
- Real Codex returned the requested connection reply. In the native app a new verification conversation received a reply, was saved, quit normally, and reopened from the same isolated data directory. A follow-up returned the prior codeword with the same backend thread ID. Local saved records confirmed real completed output. Ordinary chats did not create tasks.
- Real Claude loaded the local custom-provider model, but its service returned `402 Insufficient Balance`. This is a verified failure, not working Claude inference. The adapter preserves the diagnostic and does not change credentials, provider or permissions.
- Native startup showed the loaded tool state and actual model choices; same-session continuation was exercised. Later recovery/concurrency/handoff changes were covered by the final automated checks. The final 0.2.0 package was rebuilt after the earlier process had exited; its desktop modules were compared byte-for-byte with source, and strict deep ad-hoc signature verification passed.
- The final package was launched using the normal Application Support directory. Its existing one session was retained and task count remained zero. No old input was automatically sent. Isolated integration data, generated apps, logs and user records remain outside Git.
- The native accessibility verification bridge became unavailable during final recapture, so no new final-package screenshot or fresh responsive/theme audit is claimed. The established layout/theme design was preserved; earlier native interaction evidence and current build/runtime checks are distinct.

Remaining limits: Claude interactive permission host, full artifact collection, automatic code validation, durable scheduling and closed-window execution are not implemented. A tool turn completing is not task acceptance. See `../docs/agent-integration.md` for protocol and data boundaries.

## Conversation experience — 2026-10-26, v0.3.0

Scope: improve the existing conversation and structured-input surface, using Codex as a layout reference. Official product/docs pages and the public demo video were inspected; the reference poster and conversation frame are saved as `design/codex-official-reference.webp` and `design/codex-official-conversation.png`. This is an intentional redesign within Castiel's established theme, not a pixel clone. Brand provenance is in `../docs/brand-assets.md`.

| Step | Result | Evidence |
| --- | --- | --- |
| 1. Open an existing conversation | Healthy: user turns align right, Agent replies use an open centered reading surface; tool/model/workspace controls remain present | `design/chat-before.png`, `design/chat-app-light.png` |
| 2. Read Markdown and copy code | Healthy: GFM tables, checklists, headings, inline code, highlighted fenced code and unknown languages render locally; original code is copied | `design/chat-markdown-light.png`, `design/chat-native-light.png` |
| 3. Answer Agent questions | Healthy: described single choices, free text, optional notes, multi-question navigation, no default selection, blank validation and retry without input loss | `design/chat-questions-light.png`, `design/chat-questions-dark.png` |
| 4. Review a permission request | Healthy in component/runtime fixtures: actual command and directory are shown, deny/allow remain explicit; queued backend requests remain answerable | `tests/chat-ui-checks.pw.js`, `tests/agents-runtime.test.mjs` |
| 5. Read history and use smaller windows/themes | Healthy: new output preserves reading position, Return to latest works, multiline input shrinks after sending, context drawer opens/closes; 800px document width stays 800px | `design/chat-app-800.png`, `design/chat-questions-800.png`, `design/chat-native-dark.png` |

Visual findings fixed: identical left-aligned user/Agent bubbles, unrendered Markdown, dense duplicated question controls, icon-only navigation lacking accessible names, excess collapsed-sidebar width, wrapping workspace heading and a multiline composer retaining its expanded height. Theme screenshot capture now disables finite transitions; an intermediate dark capture initially showed the prior light colors and was rejected/recaptured. Final selected-question colors were measured as background `rgb(40,50,78)` and text `rgb(163,178,255)`. No full accessibility certification is claimed.

Verification:

- `npm run check`: production build, 39 business/storage/runtime/rendering tests and 4 static packaging tests passed (43 total). Rendering tests exercise the actual component, including unknown/open fences, escaped code, forbidden HTML/images and external-link policy.
- Browser component checks returned all 12 scenarios true: clipboard, Markdown, literal `custom` label, message alignment, questions, blank validation, back navigation, failed-submit retry, free text, secret masking, permission decline and reading position. The UI runner uses the fixture page; no supplier request is made. Multiline input separately verified 180px while editing and 62px after sending.
- Independent read-only review found one definite P2: an actual option labeled `custom` collided with the internal free-text sentinel. Reproduced with a failing UI check, separated answer mode from the option label, and verified the literal `custom` answer payload and full scenario suite. No unresolved review finding remains.
- Native first check showed clipboard failure under Electron's permission policy even though browser copy worked. Fixed with a bounded, write-only main-process method; the packaged app then copied the exact two-line source string and rejected an object payload. No generic clipboard-read method or browser permission expansion was added.
- Final native package rendered real components from isolated local verification records in light and dark themes. Screenshots contain only authored verification content. The application was normally closed after verification, source/asar entries compared, and strict deep local signature verification passed. Native mock records and generated release files remain outside Git.
- Initial Vite edits caused temporary HMR/context errors while related modules were being created; fresh navigation after complete edits rendered correctly. Final browser runs had no application errors; fixture password input produced only a Chromium verbose form advisory. The existing demo/browser and actual model integration remain distinct.

Limits: structured questions/approvals were checked with component fixtures and actual runtime protocol fixtures, not a new live provider turn. Existing integration evidence from the previous milestone is retained; no fresh Claude billing or Codex supplier availability claim is made. Closed-window scheduling, full file artifact collection and automatic task acceptance remain outside this UI change.

## Conversation workspace bugfix — 2026-10-26, v0.3.1

User requirement: allow selecting a computer directory from a conversation's workspace control; one workspace can contain multiple independent conversations. Investigation found that the composer only opened read-only scope information and the sibling-list plus button opened task creation. The data model already supported independent sessions, so no schema migration or project relation was needed.

- Composer workspace dialog now lists enabled spaces and their conversation counts, calls the existing native directory chooser, and applies an explicit selection only to the current idle/unarchived conversation. Directory registration reuses matching paths and grants access only to the choosing Agent. Cancel has no durable effect.
- The sibling plus button creates a blank, independently identified chat in the current scope, with fresh Agent defaults and no task/backend ID. No inference occurs until sending. First input supplies the default chat title. Space browsing also supports empty spaces without detouring to task creation.
- Rebinding preserves the existing messages and draft, updates the selected scope snapshot and invalidates backend continuation. A subprocess fixture verified that the next turn uses the chosen cwd and does not pass Claude `--resume`. Other conversations retain their own path and context.
- `npm run check`: build plus 44 business/storage/runtime/rendering tests and 4 static packaging tests passed (48 total). New cases cover multiple empty chats, directory reuse, independent Agent permissions/defaults, sibling isolation, busy/archive restrictions and backend cwd/session reset.
- Native isolated UI verification created two chats in the original space, moved only the first to a real temporary directory, then created two empty chats there. Results: four sessions, three in the selected space, two empty messages arrays, zero tasks and zero automatic Agent runs. Draft, original user record and untouched sibling path were preserved. Normal exit/relaunch restored all three same-space chats.
- The native test substituted only the OS dialog response (cancel or owned temporary path); real renderer IPC, main-process chooser handler, `realpath`, frontend state and disk storage ran normally. This is not a claim that the OS chooser itself was mouse-automated. No real model request was sent.
- Browser UI verified same-space counts and new-chat empty state. At 800×800 the first capture exposed clipped footer controls; limiting the workspace-list height fixed it. Final Apply button bottom was 719.49px within the dialog bottom 750.49px. Radio choices also support arrow-key navigation.
- Read-only independent review found no actionable P1/P2 issue. Existing running 0.3.0 app was quit normally with its save handshake before packaging, after verifying no persisted active run. Existing local user records were not replaced by test data.

Evidence inspected: `design/workspace-directory-picker.png`, `design/workspace-multiple-conversations.png`, `design/workspace-picker-800.png`. Screens contain only authored verification data. Existing directory/default edits remain non-migrating; only this explicit conversation action can rebind its scope.
