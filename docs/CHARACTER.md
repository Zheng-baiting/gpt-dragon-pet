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

这些是基础关键帧动画，不是图生视频服务生成的完整动作。没有用它们冒充鲸鱼娘的 106 段动作视频。只使用基础动画时，拖动沿用待机画面；正式悬空视频导入后自动接入。位置与抛掷由原版物理处理。

`assets/gpt-reference.png` 取基础待机首帧，用作当前桌面与插件图标。完整视频制作使用 `assets/gpt-video-reference.png`：从同一角色的单张 Q 版定稿清理、对齐而来，保留完整龙角、翅膀和尾巴，避免动作帧网格边界裁切参考图。`scripts/pipeline.py reference` 按原项目的 16:9、头顶与脚底规范生成绿幕参考，供逐动作视频制作。

`assets/basic-preview.gif` 是 10 fps 的待机和招手缩略预览，不用于判断桌面播放帧率。当前非官方同人形象不能声称 OpenAI 官方背书、合作或官方吉祥物身份；角色素材仅供个人非商业同人用途。

## 正式待机视频

2026-10-19，使用豆包 Seedance 2.0 Mini，以完整 Q 版定稿为参考，按 dsh-pet 的“待机呼吸休闲”时序生成一段 16:9、24 fps 视频。实际提交的提示词与保留“豆包 AI 生成”标记的原片见 `assets/sources/`。角色视频为 AI 生成，不能声称为手绘动画。

后期从中央安全区域提取完整角色，保持原画面坐标；复用原版 HSV 抠像、站姿归一化及编码，在白紫角色的绿幕染色处做颜色清理，再用双向光流生成 120 fps 中间帧。成品为 `assets/webm/待机呼吸休闲.webm`，640×360、1205 帧、约 10.04 秒。来源摘要、处理范围与检查结果保存在 `assets/sources/待机呼吸休闲.json`。

该动作包括轻微呼吸、眨眼、左右环顾与回正。重新启动预览会优先使用这段正式待机。

## 正式点击回应

同日使用相同服务、角色参考与原版动作配方制作“点击回应-害羞惊讶”。角色做害羞表情、轻微扭身与摆动，再回到正面站姿。成品为 `assets/webm/点击回应-害羞惊讶.webm`，640×360、120 fps、1205 帧、约 10.04 秒。来源原片、实际提示词、提取区域及摘要保存在 `assets/sources/`，处理流程与待机相同。

“点击回应-傲娇生气”也是同批生成，角色叉腰、闭眼转身，再回到初始正面姿态。源片实际短暂经过背面，超出了配方中直接转至 90 度侧面的要求；保留为已检查的动作变体，差异记录在来源 JSON 中。

## 正式拖拽姿态

2026-10-20 收到此前已排队的“被鼠标拖拽悬空反馈”。角色从站立升起、悬浮轻摆，然后回到原站姿。按相同流程处理为 640×360、120 fps、1205 帧、约 10.04 秒的透明视频，拖动时自动播放。

源片上浮幅度较大，归一化后最高点距画面上沿约 3 像素；扫描全片没有发现裁切，后续可进一步收敛上浮幅度。来源目录保留带 AI 标记的原片、对应配方、摘要和检查记录；该段最初实际提交的聊天提示词未在本地归档，配方文件不冒充实际提交记录。

## 2026-10-20 免费生成的一批动作

同一豆包对话使用每日免费额度新增五段，逐段下载、查看源片和处理后的十二帧检查图，再扫描全片边界与透明通道：

- “点击回应-开心跃动”：轻跳、欢呼和小爱心，随后落地回正。此前裁掉爱心的版本未导入；修正版完整保留爱心，归一化后最高点距上沿约 6 像素。
- “点击回应-元气挥手”：双手挥动、笑脸、音符光点与小小的耶，末尾光点消失并回正。
- “点击回应-挠痒咯咯笑”：惊讶、耸肩缩身、掩嘴笑与恢复站姿。
- “原地漂浮踏步”：双脚原地交替迈步、摆臂，头发与尾巴自然跟随，末尾站稳。
- “螃蟹走路”：身体稍向左倾、原地横向搓步，尾巴向右摆动平衡，然后回正。

每段均为 640×360、120 fps、1205 帧、约 10.04 秒。源片保留豆包 AI 生成标记；实际提交提示词、摘要和检查记录见 `assets/sources/`。两种步行视频接入原版移动规划，运行时由窗口移动产生桌面上的行走，源视频内的人物保持原地。

这一批完成后共有 9/106 段动作，五种点击回应齐全。基础招手仍保留作缺少正式点击素材时的回退。

## 2026-10-20 跨平台免费短版动作

继续使用同一份 Q 版定稿，在即梦与 TapNow 的 Seedance 2.0 Mini 免费试用或赠送额度内制作七段五秒短版：思考冒泡、忙碌点按、清点归档、原地踱步张望、雀跃庆祝、垂头叹气冒汗与哈欠连天。六种工作状态按原版固定顺序接入事件池及右键菜单，哈欠进入原版小动作分类；尚未实现 Codex 会话自动联动。

即梦原片为 1280×720，TapNow 原片为 836×480，实际帧率逐段记录。保持原图比例、完成抠像与站姿对齐后，七段均输出为 640×360、120 fps、605 帧、约 5.04 秒。角色上方少量分离特效经过位置修正以避免裁切；张望、叹气与哈欠末尾用半秒光流过渡接回首帧站姿。修改方法、源片摘要与检查结果见各段来源 JSON。120 fps 来自本地补帧，快速跳跃仍可能短暂变软。

即梦东张西望试片的结束朝向、可灵奔跑试片的横移及残留道具、第一版归档试片的出画纸卷均未通过检查，未导入正式库。当前 16/106 个动作已有素材，其中九段约十秒、七段为五秒短版；其余 90 个仍待制作。
