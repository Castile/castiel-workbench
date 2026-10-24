# 桌面实现与数据约定

2026-10-25，开发版 0.1.0。第一阶段目标是让已确认界面成为可运行、可保存、可本地打包的桌面应用。

## 选型与边界

采用 Electron 45.0.0、React 19.2、Vite 6.4.2、@electron/packager 20.3.0。复用现有界面与 Node 文件系统能力，避免为第一阶段引入尚未安装的 Rust 工具链；后续 Agent 进程管理可放到独立本机适配层。代价是携带 Chromium 和 Node，包体与资源占用高于系统 WebView 方案，后续应实测性能。

依据 Electron 官方[安全清单](https://www.electronjs.org/docs/latest/tutorial/security)、[上下文隔离](https://www.electronjs.org/docs/latest/tutorial/context-isolation)与[自定义协议](https://www.electronjs.org/docs/latest/api/protocol)设计边界：Renderer 不启用 Node，启用 sandbox/contextIsolation，preload 只暴露具名方法，主进程校验来源。界面资源限制在 `castiel://app/` 的打包文件内，拒绝路径越界、新窗口、外站导航和浏览器权限。当前 CSP 和网络拦截禁止 Renderer 外部请求；未来模型调用需专门的主进程适配器，不应直接放开页面网络。

本地目录与生命周期采用官方 [app API](https://www.electronjs.org/docs/latest/api/app)。本阶段没有读取现有供应商密钥或接管工具配置。

## 本地数据协议

默认 macOS Application Support 下的 `CastielWorkbench`，可用绝对路径变量 `CASTIEL_DATA_DIR` 隔离。格式为 `castiel-workbench`、schemaVersion 1，带 revision、savedAt 和 data。桌面首次启动不填虚构任务；网页预览保留演示数据。

- `records.tasks` 为工作任务，`records.sessions` 为会话，允许 taskId 关联任务。普通问答 taskId 为 null，不计入今日与团队负载。会话别名独立于任务标题。
- 独立保存成员、输入草稿、Agent 配置、模型偏好、工作空间、主题、规则候选与历史、扩展候选等状态。默认值只影响新会话；已有会话保留空间与设置快照。
- 工作空间只有独立 id、名称和本地路径，不关联项目。原生目录选择器不自动读取内容。
- 编辑后约 220ms 保存，关闭前完整 flush。串行队列与 revision 检查防止旧写入覆盖新状态；写入中的编辑随后继续保存。
- 主进程验证格式、大小、关联和危险字段，文件上限 10MiB。临时文件以 0600 写入并同步后原子替换，再同步父目录；目录初建 0700。上一版有效文档独立备份。文件为明文，不是加密保险箱。
- 主文件损坏时只读加载有效备份，确认后保留损坏副本再恢复。两者无效则阻止覆盖。未知 schemaVersion 阻止打开，不自动降级；目前没有需要迁移的旧版生产数据。
- 「设置 → 数据」支持导出和恢复 JSON。恢复先验证再展示替换确认，原状态保留为上一版。主目录写入失败时可将内存草稿导出到其他可写位置。备份同样为明文。

单用户 JSON 适合首个可用开发版。大量会话、搜索索引或多进程并发写入需求出现后，应迁移到事务数据库；本版不支持多人协作或跨设备同步。

## 生命周期

macOS 关窗口前保存，默认进程留在 Dock；关闭后台偏好或 Cmd+Q 时保存后退出。保存失败保留窗口并显示重试。休眠由系统暂停进程；尚无真实 Agent 执行，没有实现进程检查点或休眠后续跑。强退和掉电只尝试恢复最近完成的文件，不承诺保留尚未刷盘的字符。

Agent 输出、自然语言任务拆解、规则行为检查、扩展执行与发布仍为演示，不能作为真实完成证据。模型列表包含系统默认与明确标注的示例，启动入口字段不执行命令。下一阶段需要能力探测、真实模型列表、流式输出、停止/恢复和产物验证。

## 本地打包

打包脚本仅暂存桌面模块、共享文档协议和网页构建，不包含设计截图、测试、用户数据及完整开发依赖。生成 asar 应用包；macOS 仅本机 ad-hoc 签名。分发前仍需 Developer ID、公证、安装升级验证；没有上传、GitHub Release、自动更新或生产发布。

本次运行时来自 Electron 官方 GitHub v45.0.0，文件 `electron-v45.0.0-darwin-arm64.zip`，120706020 bytes，SHA256 与 npm 包内官方 checksums.json 一致：

```text
896c3a50b148e89a158dca08a6996a022ddf39b23aac871e107f5b4087f8caa9
```

`CASTIEL_ELECTRON_ZIP_DIR` 可指定匹配版本、平台、架构的官方 ZIP 缓存目录。
