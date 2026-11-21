# 桌面实现与数据约定

2026-10-26，开发版 0.3.2。已确认界面已成为可运行、可保存、可本地打包的桌面应用，并增加本机 Agent 会话与对话渲染。

## 选型与边界

采用 Electron 45.0.0、React 19.2、Vite 6.4.2、@electron/packager 20.3.0。复用现有界面与 Node 文件系统能力，避免为第一阶段引入尚未安装的 Rust 工具链；后续 Agent 进程管理可放到独立本机适配层。代价是携带 Chromium 和 Node，包体与资源占用高于系统 WebView 方案，后续应实测性能。

依据 Electron 官方[安全清单](https://www.electronjs.org/docs/latest/tutorial/security)、[上下文隔离](https://www.electronjs.org/docs/latest/tutorial/context-isolation)与[自定义协议](https://www.electronjs.org/docs/latest/api/protocol)设计边界：Renderer 不启用 Node，启用 sandbox/contextIsolation，preload 只暴露具名方法，主进程校验来源。界面资源限制在 `castiel://app/` 的打包文件内，拒绝路径越界、新窗口、外站导航和浏览器权限。当前 CSP 和网络拦截禁止 Renderer 外部请求；模型调用现由主进程通过本机工具的私有管道适配器处理，没有放开页面外网请求。

本地目录与生命周期采用官方 [app API](https://www.electronjs.org/docs/latest/api/app)。已增加本机工具探测，认证由原工具管理；工作台只暴露必要的配置摘要，不把密钥复制到工作文档。

对话 Markdown 在 Renderer 内本地解析，不执行原始 HTML、不自动加载远程图片。点击外链时，通过具名 `links:open` 方法验证为不带凭据的 HTTP(S) URL，再交给默认浏览器；不会为 Renderer 放开网络。原生 `clipboard:write` 只接受最多 2Mi 字符的文本，供明确点击复制按钮使用；不暴露剪贴板读取或系统权限扩展。

## 本地数据协议

默认 macOS Application Support 下的 `CastielWorkbench`，可用绝对路径变量 `CASTIEL_DATA_DIR` 隔离。格式为 `castiel-workbench`、schemaVersion 1，带 revision、savedAt 和 data。桌面首次启动不填虚构任务；网页预览保留演示数据。

- `records.tasks` 为工作任务，`records.sessions` 为会话，允许 taskId 关联任务。普通问答 taskId 为 null，不计入今日与团队负载。会话别名独立于任务标题。
- 独立保存成员、输入草稿、Agent 配置、模型偏好、工作空间、主题、规则候选与历史、扩展候选等状态。默认值只影响新会话；已有会话保留空间与设置快照。
- 工作空间只有独立 id、名称和本地路径，不关联项目。原生目录选择器不自动读取内容。
- Agent 首页和各 Agent 开始页的空间下拉菜单直接调用原生目录选择器；复用目录对应的空间，仅更新当前入口，保留草稿、模型、独立默认配置及其他 Agent 范围。选择和取消不触发推理。
- 对话内可显式选择目录并重绑当前空闲、未归档的会话；保留消息/草稿，清除旧后端续接状态，下一轮按新目录建立工具会话。其他会话不受影响。一个空间可有多个空白或已有对话，分别持久化，不创建任务、不自动调用模型。全局空间编辑仍只影响后续使用，不静默迁移已保存的快照。
- 编辑后约 220ms 保存，持续输出期间最多约 1.5 秒触发一次写入，关闭前完整 flush。串行队列与 revision 检查防止旧写入覆盖新状态；写入中的编辑随后继续保存。
- 主进程验证格式、大小、关联和危险字段，文件上限 10MiB。临时文件以 0600 写入并同步后原子替换，再同步父目录；目录初建 0700。上一版有效文档独立备份。文件为明文，不是加密保险箱。
- 主文件损坏时只读加载有效备份，确认后保留损坏副本再恢复。两者无效则阻止覆盖。未知 schemaVersion 阻止打开，不自动降级；目前没有需要迁移的旧版生产数据。
- 「设置 → 数据」支持导出和恢复 JSON。恢复先验证再展示替换确认，原状态保留为上一版。主目录写入失败时可将内存草稿导出到其他可写位置。备份同样为明文。

单用户 JSON 适合首个可用开发版。大量会话、搜索索引或多进程并发写入需求出现后，应迁移到事务数据库；本版不支持多人协作或跨设备同步。

## 生命周期

macOS 关窗口前保存，默认进程留在 Dock；关闭后台偏好或 Cmd+Q 时保存后退出。保存失败保留窗口并显示重试。运行中关闭会提示先停止并保存，当前不支持关窗后继续执行。休眠由系统暂停进程，尚未实现进程检查点或休眠后续跑。强退和掉电只尝试恢复最近完成的文件，不承诺保留尚未刷盘的字符。

桌面 Agent 输出已接入本机 Codex/Claude Code，读取真实配置、流式输出并支持停止/继续；原工具仍管理权限。自然语言任务拆解、规则行为检查、扩展执行和发布仍为演示。浏览器版本继续使用示例模型和模拟回复。接入细节见 agent-integration.md。

## 本地打包

打包脚本仅暂存桌面模块、共享文档协议和网页构建，不包含设计截图、测试、用户数据及完整开发依赖。生成 asar 应用包；macOS 仅本机 ad-hoc 签名。macOS 在 Apple 芯片及 Intel 原生环境分别生成 DMG，验证挂载、应用签名、启动和本地写入。正式开发者签名、公证与安装升级验证仍待接入。Windows x64 使用 Inno Setup 生成按用户安装的程序，通过 GitHub Releases 分发。Windows 上对临时文件执行 flush 后再替换目标文件，父目录同步仅用于 POSIX 系统。

本次运行时来自 Electron 官方 GitHub v45.0.0，文件 `electron-v45.0.0-darwin-arm64.zip`，120706020 bytes，SHA256 与 npm 包内官方 checksums.json 一致：

```text
896c3a50b148e89a158dca08a6996a022ddf39b23aac871e107f5b4087f8caa9
```

`CASTIEL_ELECTRON_ZIP_DIR` 可指定匹配版本、平台、架构的官方 ZIP 缓存目录。

手动触发 Desktop release 后，各构建任务从同一提交打包。只有三种安装包全部通过验证，发布任务才会生成 SHA-256 清单并创建同一版本的 GitHub Release。
