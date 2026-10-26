# Agent 品牌资源与界面参考

2026-10-26。资源保存在 `prototype/public/agents/`，应用只加载本地文件，不在运行时请求图标服务。图标用于标识用户已选择的工具，不代表本产品由对应公司出品。

| 文件 | 来源 | 处理 |
| --- | --- | --- |
| codex-light.png、codex-dark.png | 已安装的官方 ChatGPT.app，Contents/Resources/icon-codex-light.png 与 icon-codex-dark-color.png | 原文件复制，按主题选用；保持宽高比 |
| claude.png | [Claude 官网](https://claude.com)，页面公开 favicon `https://assets.claude.com/95a868946ac8a31e5ff832e2899f294aa368b836.png?w=128&h=128` | 原文件保存；服务实际返回 32px，按 17–35px 控件显示 |
| gemini.png | [Gemini 官网](https://gemini.google.com/)，页面公开图标 `https://www.gstatic.com/lamda/images/gemini_sparkle_4g_512_lt_f94943af3be039176192d.png` | 原文件保存，保持宽高比 |

Codex 的官方[产品介绍](https://openai.com/index/introducing-the-codex-app/)与[桌面文档](https://learn.chatgpt.com/docs/app)作为设计参考。`prototype/design/codex-official-reference.webp` 来自文档的视频封面，`codex-official-conversation.png` 是同页公开演示视频 `https://cdn.openai.com/devhub/videos-learn/proactive-teammate-v2-1080p-v1.mp4` 的约 14 秒帧。参考了开放式回复正文和简洁输入区；工作台保留自己的导航、主题和权限行为，不做像素级复刻。
