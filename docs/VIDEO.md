# 按 dsh-pet 原项目制作完整动作

直接复用 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的106个动作配方与原版抠像、站姿归一化和编码脚本，固定上游提交 cc623c7e78aaab7e708f5aede783c3de01b11964、运行包 dsh-pet@0.3.7。原作者说明素材由豆包生成。

## 当前规格

2026-10-21按用户要求回到原版 **640×360、24fps、无音轨的透明VP9 WebM**，停止五倍补帧。21/106段正式动作：16段241帧、约10.042秒，5段121帧、约5.042秒短版；另有2段基础动画108/58帧。尚缺85段，短版不冒充原配方完整十秒。高清带标记原片继续保留；尺寸降低会减少细线细节。

保留已完成的六段固定曲线调色及局部动作修正。除待机外20段使用待机同一首帧作为共同站姿，首9帧约0.375秒接入、末10帧约0.417秒接回，不额外停住；光流只用于这些短桥，不给整片增加运动中间帧。源片中段画风和细节仍有差别，中途打断不保证无缝。

## 配方和参考图

`assets/gpt-video-reference.png` 为角色参考，`prompts/character.md` 约束白发、紫瞳、角翼尾巴、统一照明与颜色。`vendor/dsh-pet/action-prompts.md` 保留原配方，映射在 `assets/actions.json`。

```powershell
npm run media:prompt -- '待机呼吸休闲'
npm run media:recipes
```

生成完整十秒16:9绿幕（#00FF00），固定镜头、人物不横向漂移，首尾使用同一正面站姿，道具按原阶段出现、收回。新片须与待机并排、连续播放检查。固定一个模型、参考图和光照设定，减少跨模型重绘差异。

生成需既有服务和授权。当前仅使用明确免费/赠送额度，不购买。模型或平台变更须有对应素材上传授权；本地脚本不会调用云端模型。

## 本地处理

已有Python/FFmpeg只设置当前进程路径，不修改系统PATH。依赖放项目内；普通运行不需要这些制作依赖。

```powershell
$env:GPT_PET_PYTHON = '你的已有Python目录\python.exe'
$env:GPT_PET_FFMPEG = '你的已有FFmpeg目录\ffmpeg.exe'
& $env:GPT_PET_PYTHON scripts/pipeline.py reference
npm run media:process -- '待机呼吸休闲' 'D:\已有视频\idle.mp4' --chroma 0x00FF00
```

若服务标记位于画面边缘，确认人物、道具和特效全程位于提取范围后可加 `--region 256,0,768,720`。范围外用绿幕补回原尺寸，保持坐标；原始带标记视频不修改。源内已经裁掉的内容须重新生成。

含透明通道的MOV或WebM省略 `--chroma`，保留绿色道具颜色。

流程：绿幕预处理到1280×720/24fps → 原版HSV抠像（含深绿阴影）→ 原版站姿测量和2160×1215归一化母版 → 原版编码到640×360/24fps → 绿幕路线清除白紫角色绿色染边 → 透明度及检查图。保持24fps时间网格，避免末帧因毫秒取整丢失；扫描完整动作，拒绝归一化后裁切。编解码与滤镜各限2线程。

中间文件在 `work/pipeline/<动作名>/`：`step02.webm` 抠像、`step03.webm` 母版、`step04-24fps.webm` 原版编码、`video-24fps.webm` 成品候选、`review.png` 与 `report.json`。输出尺寸仅接受原版360p。

## 共同站姿与导入

只有在起始准备及末尾收势空间足够、主体动作和道具收回已完成时使用短桥；它不能补齐缺失动作。显式指定候选：

```powershell
python scripts/finish-common-standing.py '龙娘屈膝礼仪' --input 'work/pipeline/龙娘屈膝礼仪/video-24fps.webm' --output 'work/video-edit/行礼候选.webm'
```

默认参考正式待机首帧，24fps默认桥9帧、静止hold为0，脚本不自动导入。复核全片、16个边界样本、黑白背景、透明边界、角色和动作，再导入：

```powershell
npm run media:import -- '待机呼吸休闲' 'work/pipeline/待机呼吸休闲/video-24fps.webm'
npm run check
npm test
& $env:GPT_PET_PYTHON scripts/test-pipeline.py
```

只接受640×360/24fps、无音轨、同时有透明背景与可见角色、不超过10.2秒的WebM；按字节复制，不覆盖已有动作。新片的完整动作时序必须另行人工检查，格式通过不能代替验收。

## 旧素材迁移与历史重建

此次从Git `40134882c8be8a2a2ad9f0057016694a7cce9bfd` 的已审120fps成品每五帧取一帧，缩到640×360，保留此前调色及局部动作修复，然后在24fps补共同站姿短桥：

```powershell
python scripts/restore-original-rate.py --input 'work/旧提交的assets/webm' --output 'work/video-edit/24fps候选' --common-standing
```

脚本拒绝覆盖已有候选，不导入。来源JSON `originalRateMigration` 记录输入提交、SHA、旧格式/处理/质量数据；当前顶层格式、摘要、质量和commonStanding对应新24fps成品。`colourMatch` 记录的是迁移前已完成的固定曲线校正，其参考摘要是旧高清待机。原始MP4和实际提示词未改。

`pipeline.retime()`、`scripts/finish-standing.py`、来源目录特殊修复脚本及 `scripts/match-colour.py` 留作历史重建工具；它们的120fps参数不代表当前流程。若要完整重建旧调色或特殊效果，应在对应Git旧提交和其参考文件上执行，再运行此次迁移脚本。不要直接对新24fps成品重复旧调色。

不同模型生成的脸、线条、阴影和尾部细节无法只靠固定曲线统一。六段调色匹配浅色材质20/50/80分位并锚定暗部与高光，主体期间曲线固定，避免逐帧自动曝光；材质分位接近不是角色一致性自动通行证。

## 运行

`npm start` 自动接入已完成正式动作，其余不显示鲸鱼替代；`npm run start:full` 需全部106段齐全。右键菜单、随机权重、拖拽弹簧、甩抛、多屏几何来自原版。视频切换等待新片呈现首帧，保留旧片播放至180ms淡化结束；隔离加法合成减轻透明交叠变淡，素材流式读取。仍需检查真实动作链，不能仅凭帧率认定换片无痕。
