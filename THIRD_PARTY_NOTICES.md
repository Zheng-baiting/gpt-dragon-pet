# 来源与使用范围

## 直接复用的代码

`vendor/dsh-pet/` 的 physics.ts、displays.ts、constants.ts 和 types.ts 来自
[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，Copyright © 2026 PC2005-cloud。
随附原 MIT 许可；构建时仅用 Node.js 内置 TypeScript 类型擦除生成 JavaScript，并补齐本地模块扩展名。
直接复用其拖动弹簧、松手速度估算和边界反弹计算。未复制其鲸鱼动画、AI 对话或服务商凭据代码。

## 角色素材

`assets/reference.png` 复用此前 GPT-Niang 挂件中生成的白龙娘参考胸像；角色来源参考
[T7moris/GPT-Niang](https://github.com/T7moris/GPT-Niang)，不是声称该文件是上游仓库原图。
原素材声明完整保留在 `assets/CHARACTER-NOTICE.txt`。`atlas.png` 与 `walk.png` 使用内置 OpenAI ImageGen，
以该公开角色图为身份参考生成，是其派生角色素材，继续按原素材声明的非商业范围随本项目展示和分发。
图片、角色设计及相关第三方权利不因本项目代码采用 MIT 而被重新授权。

Windows 透明窗口的逐像素命中和不抢焦点处理参考并改写自 GPT-Niang 的 WPF 实现。
其代码采用 MIT，Copyright © 2026 T7moris、GPT-Niang contributors，许可保留在 `vendor/GPT-Niang-LICENSE.txt`。

该项目是个人制作的第三方桌面伴侣，不是 OpenAI、DeepSeek 或原素材作者的官方产品。

## 设计参考（没有复制代码）

- [MerZlin/dsh-pet-indesktop](https://github.com/MerZlin/dsh-pet-indesktop)：独立桌面伴侣、托盘恢复与互动入口。
- [chance-li/orange-cat-deskpet](https://github.com/chance-li/orange-cat-deskpet)：透明精灵窗口和离散姿态播放。
- [AG9898/buddy](https://github.com/AG9898/buddy)：把编码助手的结构化生命周期映射为宠物状态。

本项目不打包第三方运行时；WPF 使用 Windows 随附组件，Node.js 由使用者自行安装。
