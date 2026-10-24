# Castiel 工作台

面向个人工作与团队 PL 的本地桌面工作台。开发版采用 Electron + React，已接入真实本地保存、备份恢复和 macOS 打包；Agent 执行、模型调用、调度与发布仍为演示或待接入。

## 开发入口

验证环境：macOS Apple Silicon、Node.js 24.12.0、npm 11.6.2；Node 版本见 `.node-version`。在仓库根目录运行：

```sh
npm run setup             # 按锁文件安装依赖
npm run dev:desktop       # 构建并打开桌面开发版
npm run desktop:package   # 生成当前系统/架构的应用到 release/
npm run check             # 构建、业务与本地存储测试、静态产物检查
npm run dev               # 浏览器演示 http://127.0.0.1:4173
```

首次启动或打包会下载 Electron 官方运行时，安装依赖会访问 npm。下载受限时可将匹配版本、平台、架构的官方 ZIP 放到本地目录，通过 `CASTIEL_ELECTRON_ZIP_DIR=/path/to/zips npm run desktop:package` 使用。桌面界面从应用包加载，无需运行网页服务器。

根目录脚本统一委托 `prototype/`，依赖与锁文件保留在那里。`npm run preview` 在本机 4174 端口预览网页构建。浏览器版本保留虚构示例，业务数据不持久化。

## 本地数据

macOS 默认目录为 `~/Library/Application Support/CastielWorkbench/`，可在「设置 → 数据」查看实际绝对路径。工作数据保存为 `workbench.json`，上一版保留为 `.bak`；缓存也在该目录内。会话、输入草稿、主题、成员、Agent 配置与工作空间自动保存，右下角显示真实保存状态。支持手动导出和恢复版本化 JSON 备份；保存失败保留未保存提示并提供重试。

`CASTIEL_DATA_DIR=/absolute/path` 可隔离开发验证数据。JSON 目前为明文，未实现磁盘加密或密钥管理，请勿填写密钥。未来模型请求依照工具配置，允许调用云模型。

关闭窗口前会等待保存；macOS 默认保留应用进程，点击 Dock 可重开。关闭后台偏好或使用 Cmd+Q 会在保存后退出。当前没有真实后台 Agent 任务，休眠后不承诺任务恢复；强退或掉电只能恢复最近完成的写入。

## 仓库结构

```text
prototype/
  desktop/           Electron 主进程、隔离预加载、本地存储
  src/state/         文档格式、保存控制器、任务与会话数据模型
  src/               已确认的前端界面与演示交互
  tests/             业务、本地保存与静态服务测试
  design/            设计参考与验证截图
  worker/            保留的可选静态托管适配
docs/desktop-architecture.md  桌面选型、数据协议和能力边界
开发计划.md            各阶段状态与完成标准
```

Agent 首页、独立工具设置、会话一级入口、快捷提示词、深浅主题沿用已确认设计。项目一级菜单暂缓，Agent 空间独立于项目；普通会话独立于任务和团队负载。

`node_modules/`、`dist/`、`release/`、缓存、日志、凭据和真实用户数据不提交。未配置远程仓库、自动更新或远程发布；macOS 包为本机临时签名，尚未进行 Developer ID 签名与公证。
