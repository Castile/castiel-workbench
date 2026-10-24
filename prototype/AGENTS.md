# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Confirmed product design decisions

- Desktop personal workbench with team PL project/personnel/workload views; first version is single-user.
- Local storage and cache; model inference follows configured tools and may use cloud models.
- Keep selected task execution layout and common light/dark/system themes across all pages.
- Agent handoff and agent switching share the composer Agent selector. Adjacent model selector is task-scoped and defaults to tool settings.
- Continue authorized work autonomously without requesting page-by-page confirmation. Desktop implementation is now authorized; preserve the confirmed UI while adding real capabilities. Real Agent execution remains a separate integration milestone.
- Prototype must explicitly distinguish simulated Agent/validation/release state from real execution; do not publish or upload user data.

## Agent home and sessions refinement, 2026-10-23

- Agent is the minimal default home: a large central composer with tool, model, and workspace selectors at the bottom. Do not restore the previous catalog dashboard as its default.
- Sessions is a separate primary navigation item. Agent tool names link to dedicated pages with Start, Settings, Workspaces, and Models tabs.
- Each Agent owns its defaults and allowed workspace selection. Default changes affect new sessions only. New workspaces do not automatically become available to other Agents.
- Workspace is a file/context scope, separate from project management. Existing sessions keep a scope snapshot; handoff preserves this scope and requires target compatibility.
- Archive organizes sessions without cancelling execution. Archived sessions cannot accept input or change execution configuration until restored.

- Agent home and each Agent Start page show four compact quick-prompt cards below the composer: code review, debugging, task planning, and project weekly report. Clicking fills the draft without sending or changing tool/model/space. Existing text is appended to, not overwritten; the last unedited fill can be undone. Preserve the minimal layout.

## Project menu deferred and workspace independence, 2026-10-23

- Remove Project from primary navigation for now. Retain prior project-module source/design for possible later use; do not restore its menu without a user request.
- Agent workspaces contain name, local path and their own identity only. No linked-project selector, project-derived workspace fallback or automatic project assignment when starting an Agent session.
- Session inventory displays workspace only. Execution sidebar groups and switches sessions by explicit workspace identity, not project. Team/task management records remain separate from Agent workspace configuration.

## Typography and layout refinement, 2026-10-24

- User wants a larger, more refined and coherent visual system across the entire app. The new shared scale in `src/refinement.css` supersedes the previous compact sizing.
- Keep the minimal Agent composer, quick prompt cards, independent Agent settings and workspace semantics; Project stays absent from primary navigation.
- Wide desktop navigation is 232px; the launcher max-width is 960px. Use 44px home display type, 34px page headings, 22px section headings, 15–17px body text and 13–14px secondary/control text. Scale intentionally by role rather than applying CSS zoom.
- Use local system fonts with Chinese fallback, restrained indigo accents, legible neutral text, consistent 8–20px corner radii and measured spacing. No remote font dependency or decorative illustration is required.
- Dense columns collapse as windows narrow; Sessions remains a primary entry when the execution sibling-session column is hidden. Preserve keyboard focus and context-drawer dismissal.

## Desktop implementation, 2026-10-25

- Electron main process owns local disk writes. Renderer uses a small context-isolated preload API; do not expose arbitrary filesystem, shell, IPC or network operations.
- Native first launch starts with empty tasks/sessions and one local user. Browser preview retains fictional demo data. Keep demo execution explicitly labeled in both modes.
- Persist tasks and sessions as separate collections. Ordinary Agent chats never create task or team workload entries. Renaming a linked session does not rename its task.
- Working data uses a versioned local document, atomic replacement and one previous revision backup. Failed saves and recovery must remain visible; do not silently replace unreadable or newer-version data.
- Do not persist provider credentials in workbench JSON. Model and command fields are configuration placeholders until a real adapter is implemented.
