# Agent 差异化配置与能力管理

继续用户已授权的自主开发，沿用 Electron + React，不再逐页确认。

1. 默认工具仅 Codex 与 Claude。移除 Gemini 入口、示例与自动分配；保留历史会话内容可读，不静默删除用户记录。
2. 模型支持推理/effort 选择。Codex 级别来自本机 model/list supportedReasoningEfforts，system 映射 configuredModel；未知模型仅沿用工具。Claude 根据本机 CLI 能力显示 --effort；保留服务端可能拒绝的准确说明。默认设置仅用于新会话，当前会话可覆盖下轮模型及 effort。
3. Codex 授权 reviewer 用 system/user/auto_review，与 approvalPolicy/sandbox 分开；Claude 使用本机 permissionMode 与 effort，不冒充 Codex reviewer。均无 bypass 权限选项。全局仅规划优先，默认沿用原工具。
4. 思考展示仅使用工具公开的 reasoning summary/thinking blocks。折叠区显示思考中/已思考/停止/失败，保留 Markdown、原顺序与历史；不展示或假造隐藏推理，不解析私有 encrypted 内容，不能把思考当最终答复。工具未给内容时显示诚实的活动状态。
5. 每个 Agent 专属页加入 Skills 和 MCP。列出本机条目、来源、范围和真实启用状态；搜索/刷新/详情。Skills 可导入本机目录（不覆盖同名），预览文本、启用禁用，只有工作台导入的条目可移除且保留可恢复备份。Codex 使用原生 skills/list/config/write；Claude 按原生用户/工作空间/插件目录发现，用受支持的权限或配置禁用，准确标注差异。
6. MCP 展示原生用户/空间配置，新增 stdio/http（env 仅变量引用，无明文凭据 UI）、启用/禁用、移除用户可编辑配置，显式表单提交。禁止自动安装或自动测试连接；配置成功不等于连通。不可编辑的插件/托管源标注来源与限制。后台使用原 CLI/config API，所有子进程无 shell，所有主进程方法按 agent/scope/workspace 白名单校验；路径来源必须取自本机已保存的空间或原生目录选择器。错误脱敏，凭据不进入 renderer/工作台业务文档。
7. 变更界面保留本轮输入/模型/空间，异步切换不可将返回写入另一 Agent。深浅主题与 800px 窄屏均验收。禁止模型计费调用作为界面测试；离线夹具、真实配置读取及供应商推理分别报告。

官方依据：Codex app-server https://developers.openai.com/codex/app-server；Codex Skills https://developers.openai.com/codex/skills；Codex MCP https://developers.openai.com/codex/mcp；Claude https://code.claude.com/docs/en/skills 、https://code.claude.com/docs/en/mcp 、https://code.claude.com/docs/en/permissions 。本机 Codex 0.164.0-alpha.11.1、Claude 2.1.252，按本机 schema/帮助约束实现。
