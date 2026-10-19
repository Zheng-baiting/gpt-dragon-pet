# Q 版 GPT 白龙娘

按用户指定的白龙娘身份制作：白发、紫瞳、白龙角、尖耳、淡紫翼膜、白色龙尾、银色结饰。体型参照鲸鱼娘实际动画帧，改为大头小身、短腿、圆润蓬松的 Q 版；裙装简化为遮盖完整的白紫小裙与白靴，便于在桌面尺寸下看清表情。

角色与两张动作帧源图使用已获用户同意的内置 OpenAI 图像生成工具。用户附件、鲸鱼娘参考帧不进入公开仓库；本工具生成的动作帧源图保存在 `assets/sheets/`，用于重建基础动画。

提示词组：

1. **角色**：preserve the white-haired lavender-eyed dragon identity, white curved horns, pointed ears, silver knot ornament, lavender wings and fluffy white tail; match the whale pet's roughly two-head-high chibi proportions, huge rounded head, tiny covered white/lavender dress and white boots. Refined dimensional 2D anime shading; one full-body neutral pose on transparent alpha; no blue maid clothing, text, ground or shadow.
2. **待机帧**：exact 4 columns × 2 rows, eight equal cells of the same chibi character, same scale and sole baseline. Neutral open eyes → inhale → half blink → both eyes closed → half open → open/exhale → relax → neutral. Only subtle motion, transparent gaps, all horns/wings/tail/boots visible, no labels or extra limbs.
3. **招手帧**：exact 3 columns × 2 rows, six equal cells of the same character. Neutral → lift hand → palm beside face → wave with both eyes happily closed → wave back with open eyes → lower hand to neutral. Keep identity, dress and camera consistent; transparent alpha, no labels or scenery.

`scripts/build-basic.py` 在本地清理透明区杂点、用脚底对齐画布，使用已绘制的闭眼帧制作眨眼，在关键帧之间做短淡化过渡，并加入轻微的周期呼吸形变。成品为 640×360、30 fps、VP9 Alpha：

- `Q版-眨眼呼吸.webm`：4.5 秒，135 帧。
- `Q版-点击招手.webm`：2.4 秒，72 帧。

这些是基础关键帧动画，不是图生视频服务生成的完整动作。没有用它们冒充鲸鱼娘的 106 段动作视频。基础模式拖动时沿用待机画面，位置与抛掷由原版物理处理；悬空姿态、走路、生活动作等仍未制作。

`assets/gpt-reference.png` 取实际使用的 Q 版待机首帧，与桌面角色保持一致。`assets/basic-preview.gif` 展示待机和招手。当前非官方同人形象不能声称 OpenAI 官方背书、合作或官方吉祥物身份；角色素材仅供个人非商业同人用途。
