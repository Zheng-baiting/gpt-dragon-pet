# GPT 白龙娘 · 鲸鱼娘原版底座

直接使用 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的透明视频渲染、右键菜单、点击反馈、拖拽弹簧、甩抛与多屏几何。这里维护 GPT 白龙娘角色、动作配置、视频导入和 Codex 插件入口。没有继续使用旧版 WPF 桌宠。

**当前阶段：底座与角色定稿已完成，106 段正式动作视频待制作。** 静态角色定稿可以在原版桌面窗口中预览和拖动；正式模式缺视频时会明确拒绝启动。当前没有自动读取 Codex 会话，也没有实现动画状态联动。

![GPT 白龙娘角色定稿](assets/gpt-reference.png)

这是按用户提供的参考图制作的非官方同人角色，不是 OpenAI 官方形象。白发、紫瞳、白龙角、长裙、翅膀与龙尾作为身份约束。角色图采用内置 OpenAI 图像生成工具，再本地统一透明画布；生成说明见 [角色制作记录](docs/CHARACTER.md)。

## 本地运行

Windows x64、Node.js 24+；制作或导入视频时需要已有的 FFmpeg。所有依赖都安装在项目目录，原来的 GPT-Niang 插件不受影响。

```powershell
npm ci
npm run setup
npm run runtime:install
npm run preview
```

第一次预览会把角色图编码为一段**静态预览视频**。FFmpeg 已在 PATH 时直接可用，否则仅对当前终端设置路径：

```powershell
$env:GPT_PET_FFMPEG = '你的已有FFmpeg目录\ffmpeg.exe'
npm run preview
```

双击 `预览GPT娘.vbs` 可以隐藏终端启动。窗口右键菜单和拖动来自上游；“静态定稿预览”只提供一张角色图，不会假装播放尚未制作的动作。`npm run stop` 关闭本项目窗口；`npm run status` 查看状态。

Electron 固定为上游使用的 43.3.0，下载与缓存都在项目内。官方下载过慢时，可在当前终端使用上游默认镜像再执行安装：

```powershell
$env:GPT_PET_ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
npm run runtime:install
```

运行时不在 Windows 底部任务栏显示图标；透明区支持点击穿透。Chromium 配置、缓存、日志、DSH_HOME 全部隔离在 `.runtime/`。不会创建登录启动项，不会全局安装软件，不会读取账户、额度或聊天，也不会自动调用模型。

## Codex 插件

执行 `安装GPT娘插件.cmd`。安装器只打包连接配置、插件说明和图标三个文件，连接本地项目；因此保留安装后需要保留本项目目录。插件初始化不会自动显示静态预览。

- `get_gpt_pet_status`：查询运行和视频制作状态。
- `show_gpt_pet`：正式模式；缺视频则说明原因。传入 `preview: true` 显示静态定稿预览。
- `hide_gpt_pet`：关闭本项目窗口。

当前没有自动跟随 Codex 开关、登录启动或会话动画联动；这些待动作视频就绪后再接入。上游独立模式的余额、碎碎念、对话、通知依赖 DSH，当前不可用；相应菜单操作会返回上游的不可用说明，不会代为连接模型。

## 制作动作视频

见 [视频制作与导入](docs/VIDEO.md)。`assets/actions.json` 列出全部 106 个入口及上游动作名；`config/gpt.json` 保留原版分类、权重和运动参数，鲸鱼专属动作名称改为白龙版本。

```powershell
npm run media:list
npm run media:import -- '待机呼吸休闲' 'D:\已有素材\idle.webm'
npm run check
npm test
```

正式启动：`npm start`。所有配置引用的视频须先齐全。当前 `0/106`，缺少素材不会回退显示鲸鱼娘。视频导入与预览都只在本地执行。

## 来源与许可

运行依赖锁定 `dsh-pet@0.3.7`，npm 包对应上游提交 `cc623c7e78aaab7e708f5aede783c3de01b11964`，由 lockfile 校验下载内容。上游完整菜单和物理实现直接复用。

本仓库保留旧版 Git 提交历史，当前分支工作文件已切换为这个底座。代码与媒体的许可范围分别见 [第三方声明](THIRD_PARTY_NOTICES.md)；角色素材仅供个人、非商业同人用途。
