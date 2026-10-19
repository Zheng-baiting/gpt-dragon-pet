# Q 版 GPT 白龙娘

按用户指定的白龙娘身份制作：白发、紫瞳、白龙角、尖耳、淡紫翼膜、白色龙尾、银色结饰。体型参照鲸鱼娘实际动画帧，改为大头小身、短腿、圆润蓬松的 Q 版；裙装简化为遮盖完整的白紫小裙与白靴，便于在桌面尺寸下看清表情。

角色与两张动作帧源图使用已获用户同意的内置 OpenAI 图像生成工具。用户附件、鲸鱼娘参考帧不进入公开仓库；本工具生成的动作帧源图保存在 `assets/sheets/`，用于重建基础动画。

提示词组：

1. **角色**：preserve the white-haired lavender-eyed dragon identity, white curved horns, pointed ears, silver knot ornament, lavender wings and fluffy white tail; match the whale pet's roughly two-head-high chibi proportions, huge rounded head, tiny covered white/lavender dress and white boots. Refined dimensional 2D anime shading; one full-body neutral pose on transparent alpha; no blue maid clothing, text, ground or shadow.
2. **待机帧**：exact 4 columns × 2 rows, eight equal cells of the same chibi character, same scale and sole baseline. Neutral open eyes → inhale → half blink → both eyes closed → half open → open/exhale → relax → neutral. Only subtle motion, transparent gaps, all horns/wings/tail/boots visible, no labels or extra limbs.
3. **招手帧**：exact 3 columns × 2 rows, six equal cells of the same character. Neutral → lift hand → palm beside face → wave with both eyes happily closed → wave back with open eyes → lower hand to neutral. Keep identity, dress and camera consistent; transparent alpha, no labels or scenery.

`scripts/build-basic.py` 在本地清理透明区杂点、用脚底对齐画布，使用已绘制的闭眼帧制作眨眼。关键帧之间用 OpenCV DIS 双向光流估计运动，在预乘 Alpha 空间补帧；呼吸使用连续亚像素仿射形变，避免整数像素取整产生台阶。成品为 640×360、120 fps、VP9 Alpha：

- `Q版-眨眼呼吸.webm`：4.5 秒，540 帧。
- `Q版-点击招手.webm`：2.4 秒，288 帧。

`assets/basic/manifest.json` 记录时长、帧数、生成帧去重计数和原始关键帧数。相同的停顿姿态会保留，光流不能补出源图未绘制的肢体动作。

重建使用已有 Python 和 FFmpeg，依赖安装到项目内：

```powershell
python -m pip install --target work/tools/python --cache-dir work/pip-cache -r scripts/requirements-motion.txt
$env:PYTHONPATH = (Resolve-Path work/tools/python).Path
python scripts/build-basic.py
```

脚本限制 OpenCV 与编码器各使用两个线程，逐帧送入编码器。只保存少量检查帧到 `work/basic-frames/`；运行桌宠无需 Python 或这些工具依赖。

这些是基础关键帧动画，不是图生视频服务生成的完整动作。没有用它们冒充鲸鱼娘的 106 段动作视频。基础模式拖动时沿用待机画面，位置与抛掷由原版物理处理；悬空姿态、走路、生活动作等仍未制作。

`assets/gpt-reference.png` 取基础待机首帧，用作当前桌面与插件图标。完整视频制作使用 `assets/gpt-video-reference.png`：从同一角色的单张 Q 版定稿清理、对齐而来，保留完整龙角、翅膀和尾巴，避免动作帧网格边界裁切参考图。`scripts/pipeline.py reference` 按原项目的 16:9、头顶与脚底规范生成绿幕参考，供逐动作视频制作。

`assets/basic-preview.gif` 是 10 fps 的待机和招手缩略预览，不用于判断桌面播放帧率。当前非官方同人形象不能声称 OpenAI 官方背书、合作或官方吉祥物身份；角色素材仅供个人非商业同人用途。
