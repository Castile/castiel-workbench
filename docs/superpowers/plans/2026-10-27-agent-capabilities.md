# Agent Capabilities Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans. Continue authorized work autonomously.

**Goal:** Make Codex/Claude settings, thought summaries and local Skills/MCP management real and distinct.
**Architecture:** Existing context-isolated Electron main owns capabilities/config operations; React reads bounded metadata. Native tool adapters consume per-session settings. Preserve all current sessions and local persistence.
**Tech Stack:** Electron 45, React 19, Vite, node:test; no new dependency required by default.
**Spec:** docs/superpowers/specs/2026-10-27-agent-capabilities-design.md

## Global Constraints
- No provider inference, auto-install, telemetry or incidental publishing of data. No permission bypass.
- Keep Project absent, drafts/themes/independent defaults intact. Keep static packaging contract intact.

## Review Focus
- Unsupported effort / reviewer fields must fail before process launch.
- Summary-only and interrupted runs must persist without becoming final answer text.
- Scope traversal / symlinks / hidden credentials cannot escape bounded management API.
- Imported old Gemini records remain readable while new tool selectors omit Gemini.
- Failed config writes / async Agent switching cannot report success or overwrite another source.

## Task 1: Runtime settings and thought events
- [ ] Write and observe failing adapter tests, implement, run tests.
- Files: desktop/agents.mjs, discovery.mjs, state/Agents.jsx, chat/Conversation.jsx, chat/chat.css, tests/agents-runtime.test.mjs.
- Session fields: agentSettingsSnapshot.reasoningEffort ('system' default), approvalsReviewer (Codex system/user/auto_review), permissionMode (Claude system/manual/acceptEdits/auto/plan). CLI uses --effort and permission-mode; Codex turn/start effort and reviewer.
- Catalog tool fields: reasoningEfforts map model => array of strings; configuredReasoningEffort; capabilities with effort boolean, autoReview boolean.
- Run/message thoughts: reasoning array of {id,text}, separate from text, plus reasoningActive boolean. Preserve all completed turn messages in state and render expandable blocks.

## Task 2: Native extensions management
- [ ] Write and observe failing temporary-home/fixture tests, implement main/preload APIs, run tests.
- Files: new desktop/capabilities.mjs, main.mjs, preload.cjs, new tests/capabilities.test.mjs.
- API window.castielDesktop.listCapabilities({agent,workspaceId}) => {skills:[{id,name,description,path,scope,enabled,removable}],mcp:[{id,name,transport,endpoint,scope,enabled,editable}],warnings:[]}. No credentials/raw env/headers.
- manageCapability({agent,workspaceId,kind:'skill'|'mcp',action:'toggle'|'import'|'add'|'remove'|'read',id,enabled,server}) => updated catalog (read returns {text}). skill import invokes main-process directory dialog, no renderer arbitrary path. server {name,transport:'stdio'|'http',command,args:[],url,envKeys:[]} scope user; known workspace MCP sources readable and noneditable if needed. Removals reversible, native API source validation mandatory. Busy operations reject.
- Export a manager injectable with store/runtime/dialog. Runtime calls manager options for Claude permission restrictions where needed; communicate exact integration signature.

## Task 3: Agent settings and capability UI
- [ ] Implement capability management UI against Task 2 interface, differentiated settings and launcher effort selector against Task 1. Inspect browser states.
- Files: AgentViews.jsx, new AgentCapabilities.jsx and agent-settings.css. Expose tabs Skills / MCP, searchable cards/rows, honest empty/error/loading state, explicit add/import forms and remove confirmation, no auto connection. Keep native disabled in browser.
- Config snapshots on Start include new setting fields, current launcher reasoningEffort can override saved default. Pure shared helpers in agentData.js coordinated with parent.

## Task 4: Integration and delivery (parent)
- [ ] Remove new Gemini defaults/entry/auto-allocation with legacy-history compatibility; implement current-conversation effort + model controls and snapshots for sibling/handoff.
- [ ] Validate new schema/session fields persist; run npm run check, isolated native UI and fixture streaming tests; inspect dark/light/narrow states.
- [ ] Independent final review, fix findings, docs/QA evidence, version0.4.0, normal-save quit, package and verify. Commit/push per existing authorization, reopen app preserving data.
