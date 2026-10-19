# 动作素材生成记录

提供方：内置 OpenAI ImageGen。使用前已获用户同意，将公开的 GPT-Niang 参考图交给该工具处理。
生成结果保留真实透明通道，没有使用其他提供方。

来源链：GPT-Niang 公开角色参考 → 先前挂件已生成的白龙娘胸像（reference.png）→ 本项目全身姿态与行走图。

## atlas.png

身份参考：reference.png。4 列 × 2 行，1536 × 1024，每格 384 × 512。

提示规格：identity-preserve；同一个白发紫瞳 Q 版龙娘，弯曲白龙角、尖耳、右侧白色结形发饰、
双菱形珠与流苏、白色与浅紫高领层叠裙装、小白靴、白色龙尾。深灰紫粗描边、简单平涂。
严格保留无嘴巴设定，不加嘴、点或唇线。全身、等尺寸、相同基线，完整保留角、头发与尾巴，
透明背景，无地板、投影、文字或格线。

从左至右、从上至下：

1. 放松站立、半睁眼。
2. 同样姿态闭眼，用于眨眼。
3. 手靠脸颊思考。
4. 抱浅紫小电脑认真工作。
5. 双手合拢，等待。
6. 小幅挥手，闭眼庆祝。
7. 双手举起、睁大眼睛，惊讶。
8. 坐下抱膝蜷缩、闭眼睡眠。

## walk.png

身份参考：reference.png；全身比例参考：atlas.png。4 列 × 1 行，2172 × 724，每格 543 × 724。

提示规格：identity-preserve；与上图同一角色、比例、服装、色彩和线条；朝画面右侧的轻微三分之四朝向，
四帧温和行走循环，交替脚步与手臂，轻微上下起伏。固定头部尺寸与脚底基线，完整保留龙角和尾巴，
无嘴巴、无背景、无地面阴影、无文字，各格互不重叠。

实际播放由程序裁取原始图集，不对原始生成图片进行离线改绘。图片继续适用 CHARACTER-NOTICE.txt 的范围。

## motion/*.png（0.2）

提供方仍为内置 OpenAI ImageGen。以 reference.png 的角色身份和 atlas.png 的全身比例为参考，生成带柔和体积光影的白龙娘。运行时按 4 × 4 网格加载，每张图 16 帧，共 64 帧。四帧基础循环叠加程序运动和本地绘制的道具，映射到 actions.json 中的 106 个动作入口。

通用提示规格（各图共同部分）：

> Use case: stylized-concept / identity-preserve. Production transparent sprite sheet for a desktop pet. Preserve the same white-lavender chibi dragon girl: curved horns, purple eyes, curled forelock, knot ornament, pointed ears, layered pale purple dress, boots and dragon tail. Full body, soft sculpted 3D miniature volume, matte surfaces, consistent character identity, scale and baseline. Regular four-column, four-row grid, one complete pose per cell, generous transparent gutters, no text, labels or grid lines. Actual transparent background; no floor or background scene.

各图姿态规格（行从 1 起，每行从左至右四个连续姿态）：

| 文件 | 第 1 行 | 第 2 行 | 第 3 行 | 第 4 行 |
| --- | --- | --- | --- | --- |
| motion/core.png | 放松待机与眨眼 | 开心、举手、轻跳、回落 | 托腮思考、侧看 | 抱电脑、点按键盘 |
| motion/emotion.png | 害羞、脸红、回避视线 | 傲娇、鼓脸、小幅摇头 | 挠痒、笑、缩肩 | 被提起悬空、惊讶、手脚摆动 |
| motion/life.png | 坐下抱膝入睡 | 打哈欠与伸懒腰 | 提裙屈膝行礼 | 双手持物、操作、放下的空手基础姿态 |
| motion/move.png | 行走交替脚步 | 奔跑交替脚步 | 张手舞动 | 正面、侧面、背面、另一侧面 |

图像工具的透明边缘质量需要单独检查。重试规格曾要求保留身份与动作，增加单格留白、去除白色杂点和邻格残影；被弃用的重试结果不作为运行素材。1.0 运行时不再读取这些原始网格，改用下述清理和补帧结果。

这些图片仍适用 CHARACTER-NOTICE.txt 的非商业使用范围。assets/pet-preview.png、menu-preview.png、workroom-preview.png 是本地 WPF 窗口渲染的界面预览，不是独立生成的产品效果图。

## 1.0：source-idle.png 与 animation/

2026-10-19，用户再次确认允许本地裁齐、透明区清理和补帧。新的待机原图仍使用已获授权的内置 OpenAI ImageGen，输入为 reference.png（身份）与 motion/core.png（体积光影风格）。没有使用其他云提供方。原始输出复制为 source-idle.png，保留原图。

原图为 1278 × 1230，生成网格有偏移，末行不完整。因此按实测边界提取前三行，只选择其中 8 张完整关键姿态；不把末行作为待机素材。其他 15 个基础片段各使用原图的 4 张关键姿态，共 68 个关键姿态。

本地 `scripts/prepare-motion.py` 执行：

1. 提取人物主要透明轮廓，清除不相连杂点，保留柔和透明边缘。
2. 根据头部宽度校准比例，统一脚底基线，预留补帧运动所需的透明空间。
3. 以 OpenCV 双向 DIS 光流预制相邻姿态的中间帧；大差异、遮挡区域优先采用较近关键姿态，减少叠眼与重复手臂。
4. 为每段制作共同站姿进入和退出帧。16 段合计 1,200 帧，其中每段 12 帧进入、12 帧退出；待机循环 96 帧，其他基础循环各 48 帧。
5. 按片段统一 RGBA 调色板保存 PNG，避免逐帧调色板闪动；保持人物实心区域完全不透明。运行时仅需 WPF。

`scripts/check-motion.py` 验证全部帧的有效内容、透明留白以及共同站姿的首尾一致性。`animation-preview.gif` 由实际 WPF 播放器导出并缩小为文档预览，预览为 12 fps，不代表桌面渲染频率。运动补偿无法替代完整视频或骨骼动画中的所有细节，大幅转身等情况仍受原始关键姿态限制。

新增待机图使用的完整提示词（内置工具，transparent_background=true）：

> Use case: stylized-concept / identity-preserve. Production animation sprite atlas for the user's white dragon girl desktop pet. Input1 is character identity reference; input2 is 3D-style reference only, do not reproduce its noise. Create ONE CLEAN RGBA sprite sheet of EXACTLY 16 frames arranged in a strict 4 columns x 4 rows equal grid. Read row-major. All SIXTEEN frames depict one continuous subtle relaxed standing idle cycle, NOT 4 different actions. Same camera, body size, face, horn shape, clothing details, framing, and planted boots in every cell. Each frame full-body fits within the central 76% of its cell with generous transparent gaps on all sides, no overlap, aligned soles at 90% cell height and head centered at 50% cell width. Same white-lavender chibi dragon girl: white hair with curled forelock, pale curved ridged dragon horns, purple eyes with heavy relaxed upper eyelids, pointed ears, white knot ornament with double diamond and tassel on image-right, pale lavender layered high-collar dress, white boots and curled white dragon tail. No mouth or lips in ANY frame. Soft sculpted miniature 3D volume, lavender ambient occlusion, delicately shaded clean edges. Animation choreography: frames1-4 gentle inhalation with shoulders rising just a little and tail tip swaying outward, frames5-6 eyelids lowering into a quick blink, frame7 eyes reopening, frames8-10 gentle tiny head turn toward viewer-left, frames11-13 head returns to front and shoulders relax, frames14-16 return exactly to initial neutral pose for seamless loop. Hair ends and tassel lag the tiny head movement. Hands stay relaxed by sides throughout. DO NOT change proportions, clothing, face expression or foot positions. Do not jump, wave, bow or sit. Subtle believable animation rather than 16 unrelated illustrations. Transparent empty background with NO white speckle, NO drop shadow, NO ground, NO checkerboard printed into pixels, NO outside decorative particles, NO labels/text/gridlines. Maximize temporal consistency and clean alpha.
