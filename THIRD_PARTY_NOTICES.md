# 来源与使用范围

## dsh-pet

重点参考 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，检查版本 `6c5f04321be050525b5cbb7bb8ee5f53e89deb6f`，Copyright © 2026 PC2005-cloud，MIT。

- `vendor/dsh-pet/` 保留 physics.ts、displays.ts、constants.ts 和 types.ts 与原 MIT 许可。Node.js 内置类型擦除生成本地测试用 JavaScript。
- `src/DragonAnimator.cs` 移植并调整弹簧、松手速度估算和边界反弹公式，放入原生渲染循环；运行时不再通过 Node.js 逐帧计算窗口位置。
- `assets/actions.json` 按上述版本的 `dsh-pet/assets/config.jsonc` 整理 13 类、106 个动作名称与权重，并保留原名称字段。界面使用龙娘主题名称。右键菜单参考其三级结构、随机闲时动作和点击回应组织方式。

没有复制鲸鱼角色视频、音频、AI 对话实现或服务商凭据代码。动作通过本项目的基础帧、程序运动和道具重新组合实现，不声称演出与原视频一致。

## GPT-Niang 与角色素材

`assets/reference.png` 是此前 GPT-Niang 挂件中生成的白龙娘参考胸像；角色来源参考 [T7moris/GPT-Niang](https://github.com/T7moris/GPT-Niang)，不是声称该文件是上游仓库原图。

原素材声明保留在 `assets/CHARACTER-NOTICE.txt`。`atlas.png`、`walk.png` 和 `motion/*.png` 使用内置 OpenAI ImageGen，以公开角色图为参考生成；它们及含角色的界面截图继续按来源声明的非商业范围展示和分发。图片、角色设计及相关第三方权利不因本项目代码采用 MIT 而重新授权。

Windows 透明窗口的逐像素命中与不抢焦点处理参考并改写自 GPT-Niang 的 WPF 实现。其代码采用 MIT，Copyright © 2026 T7moris、GPT-Niang contributors，许可保留在 `vendor/GPT-Niang-LICENSE.txt`。

本项目是个人制作的第三方桌面伴侣，不是 OpenAI、DeepSeek 或原素材作者的官方产品。

## 其他设计参考

没有直接复制以下项目的代码：

- [MerZlin/dsh-pet-indesktop](https://github.com/MerZlin/dsh-pet-indesktop)：独立桌面伴侣、托盘恢复与互动入口。
- [chance-li/orange-cat-deskpet](https://github.com/chance-li/orange-cat-deskpet)：透明精灵窗口和离散姿态播放。
- [AG9898/buddy](https://github.com/AG9898/buddy)：将编码助手的结构化生命周期映射为宠物状态。

本项目不打包第三方运行时；WPF 使用 Windows 随附组件，Node.js 由使用者自行安装。
