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

图像工具的透明边缘质量需要单独检查。重试规格曾要求保留身份与动作，增加单格留白、去除白色杂点和邻格残影；被弃用的重试结果不作为运行素材。最终采用的边缘处理方式应在素材验收后补记于此。

这些图片仍适用 CHARACTER-NOTICE.txt 的非商业使用范围。assets/pet-preview.png、menu-preview.png、workroom-preview.png 是本地 WPF 窗口渲染的界面预览，不是独立生成的产品效果图。
