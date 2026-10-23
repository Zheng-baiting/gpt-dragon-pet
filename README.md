# GPT 白龙娘桌宠 · 基础版

基于 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的 Windows 透明桌宠，保留 GPT 白龙娘角色、原版点击与拖拽交互、本地视频播放和可选 Codex 插件入口。

**本仓库按基础版交付，使用现有素材，不再以补齐106个动作作为完成条件。** 当前提供22段正式动作、2段基础动画，统一为640×360、24fps。运行不需要视频生成账号、积分或 FFmpeg。

![GPT 白龙娘基础动画](assets/basic-preview.gif)

上图是10fps的轻量GIF缩略预览；桌面播放使用24fps透明WebM。

## 已有功能

| 功能 | 基础版内容 |
| --- | --- |
| 待机与点击 | 呼吸眨眼、开心跃动、害羞惊讶、傲娇生气、挠痒咯咯笑、元气挥手 |
| 桌面互动 | 拖拽悬空姿态、原版弹簧与甩抛、两种移动、多屏几何、透明区点击穿透 |
| 动作点播 | 六种工作状态，以及哈欠、行礼、下蹲、小憩、惊醒、摇摆和受惊 |
| 播放衔接 | 视频预加载与首帧检查、双缓冲过渡、共同站姿、按待机固定校准明暗 |
| 可选插件 | 查询本项目状态、显示或关闭角色 |

基础版以独立桌面陪伴和手动点播为主。工作状态可以从右键菜单播放，尚未自动跟随Codex会话；没有接入额度、Token统计、聊天或完成提醒。不同AI源片的脸型、角尾、线条和清晰度仍有差别，任意动作中途切换也不能保证完全无痕。

## 运行

需要 Windows x64、Node.js 24+。依赖、Electron、缓存和运行日志都保留在项目内。

```powershell
git clone https://github.com/Zheng-baiting/gpt-dragon-pet.git
cd gpt-dragon-pet
npm ci
npm run setup
npm run runtime:install
npm start
```

`npm start`运行已完成素材组成的基础版。启动后也可双击`预览GPT娘.vbs`隐藏终端运行。点击角色触发随机回应，拖动切到悬空姿态；右键「动作」可按分类点播。`npm run stop`关闭本项目窗口，`npm run status`查看状态。

首次安装会下载锁定的`dsh-pet@0.3.7`与Electron 43.3.0。官方下载过慢时，可仅对当前PowerShell终端选择上游默认镜像后重试：

```powershell
$env:GPT_PET_ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
npm run runtime:install
```

运行时不显示底部任务栏图标，不创建登录启动项，不读取账号、额度或聊天，不自动调用模型。Chromium配置、缓存、日志及DSH_HOME隔离在`.runtime/`。

## 可选 Codex 插件

执行`安装GPT娘插件.cmd`。安装器只打包连接配置、说明和图标，连接本地项目；安装后需保留项目目录。插件初始化不会自动弹出角色。

- `get_gpt_pet_status`：查看运行与素材状态。
- `show_gpt_pet`：显示使用现有素材的基础版。
- `hide_gpt_pet`：关闭本项目窗口。

基础版内部沿用`preview`模式名称；无需启用要求全库素材齐全的`--full`模式。上游依赖DSH的聊天、余额和通知操作当前不可用。

## 验证与素材记录

```powershell
npm run check
npm test
```

检查输出中的`productionReady`表示上游106段全库是否齐全，不代表基础版能否启动。基础版只引用已有素材，22段正式动作与2段基础动画均已提供。

保留视频源、提示词、处理参数及Git历史，后续可按[视频制作与导入](docs/VIDEO.md)自行扩展。视频制作需要已有FFmpeg、FFprobe与Python，普通运行无需安装这些工具。历史120fps版本仅保留在Git历史，当前正式播放为24fps。

- [角色制作与已知外观差异](docs/CHARACTER.md)
- [帧率、切换与实播验证](docs/PERFORMANCE.md)
- [第三方声明与许可范围](THIRD_PARTY_NOTICES.md)

## 相关参考

[Wunsch2048/codex-bailong-desktop-pet](https://github.com/Wunsch2048/codex-bailong-desktop-pet)提供另一套以Codex状态、完成提醒、额度和Token统计为重点的桌宠方案。本仓库保留独立基础版；没有复制或接入该项目的实现、素材或账号数据，运行底座仍为dsh-pet。

这是根据用户参考图制作的非官方同人角色，与OpenAI、Codex官方无隶属关系。代码、依赖与角色素材的许可范围见第三方声明；角色素材仅供个人、非商业同人用途。
