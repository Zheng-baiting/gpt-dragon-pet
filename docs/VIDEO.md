# 按 dsh-pet 原项目制作完整动作

直接复用 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的106个动作配方与原版抠像、站姿归一化和编码脚本，固定上游提交 cc623c7e78aaab7e708f5aede783c3de01b11964、运行包 dsh-pet@0.3.7。原作者说明素材由豆包生成。

## 当前规格

2026-10-21按用户要求回到原版 **640×360、24fps、无音轨的透明VP9 WebM**，停止五倍补帧。22/106段正式动作：19段241帧、约10.042秒，3段121帧、约5.042秒短版；另有2段基础动画108/58帧。尚缺84段，短版不冒充原配方完整十秒。高清带标记原片继续保留；尺寸降低会减少细线细节。

保留已完成的六段固定曲线调色及局部动作修正。除待机外21段使用待机同一首帧作为共同站姿，首9帧约0.375秒接入、末10帧约0.417秒接回，不额外停住；光流只用于这些短桥，不给整片增加运动中间帧。源片中段画风和细节仍有差别，中途打断不保证无缝。

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

`npm start` 自动接入已完成正式动作，其余不显示鲸鱼替代；`npm run start:full` 需全部106段齐全。右键菜单、随机权重、拖拽弹簧、甩抛、多屏几何来自原版。视频切换等待新片呈现首帧，保留旧片播放至180ms淡化结束；隔离加法合成减轻透明交叠变淡，素材响应正确的字节范围请求。仍需检查真实动作链，不能仅凭帧率认定换片无痕。


## 2026-10-22：十秒归档替换

使用Seko已有角色首尾帧、Seedance2.0Mini、完整十秒720p，60明确奖励积分、实付0。只新建候选节点，保留原哈欠节点。新归档保留逐张查看、收拢折叠、收好消散和空手复位；生成阶段略早于提示时间，使用原配方允许的折叠纸摞变体，不宣称逐秒精确复现。实际提示词、带标记原片和来源摘要均保留。

源末段独立星点向外散得过远，直接归一化会裁切。专用脚本先做原坐标提取与HSV抠像，仅把人物保护区外的独立星点缩到60%，在8.4～9.4秒淡出；该阶段不改变角色像素和动作。之后按原版归一化、24fps编码，再固定调色、接共同站姿。完整重建星点处理的241帧解码校验与验收输入一致。

```powershell
python 'assets/sources/工作状态-清点归档-seko-processing.py' 'assets/sources/工作状态-清点归档-seko.mp4' 'work/video-edit/archive-prepared.webm'
npm run media:process -- '工作状态-清点归档' 'work/video-edit/archive-prepared.webm'
python scripts/match-colour.py '工作状态-清点归档' 'work/pipeline/工作状态-清点归档/video-24fps.webm' 'work/video-edit/archive-colour.webm' --calibrate
python scripts/finish-common-standing.py '工作状态-清点归档' --input 'work/video-edit/archive-colour.webm' --output 'work/video-edit/archive-candidate.webm'
```

`--calibrate`专用于新24fps候选，以当前待机1/2/4秒的实心浅色材质分位建立固定RGB曲线，保留暗部/高光锚点，不做逐帧自动曝光；输出`.colour.json`并要求人工复核。先调色再接共同站姿。旧120fps调色重建保留默认模式，仍按旧来源摘要验证输入。


## 2026-10-22：新增被吓一跳

豆包Mini每日免费生成完整十秒720p受惊片。保留瞪眼、胸前举手、呆毛弹起、僵直微颤、放松吐舌及空手复位；生成细部节拍为近似值。白色绒尾保持不变。带标记原片、实际提示词与来源JSON均保留。绿幕提取后固定匹配待机色彩，再接9帧共同站姿，无额外静止hold，输出640×360/24fps、241帧。

```powershell
python scripts/pipeline.py process '被吓一跳' 'assets/sources/被吓一跳-doubao.mp4' --green --region 256 0 768 720
python scripts/match-colour.py '被吓一跳' 'work/pipeline/被吓一跳/video-24fps.webm' 'work/video-edit/scared-colour.webm' --calibrate
python scripts/finish-common-standing.py '被吓一跳' --input 'work/video-edit/scared-colour.webm' --output 'work/video-edit/scared-candidate.webm'
```

12个全片、16个边界、6个放大吐舌样本及黑白背景已审查。原生完整播放后继续动作链，1.8秒实测23.9715fps、采样掉帧0。正式22/106，18段十秒、4段五秒，仍缺84段。

## 2026-10-22：十秒张望替换

即梦Seedance 2.0 Mini使用同一角色的首尾帧生成完整十秒720p张望，替换TapNow五秒版。保留轻微左右张望、交握双手、踮脚、沙漏和空手复位，阶段时间为近似值，沙漏比提示时间更早出现。原始带标记MP4、实际提示词及旧源片保留。

该源是241帧VFR视频：名义帧率60，平均约24.06，不是真正60fps。先将全部解码帧一对一放入CFR24时间轴，时长从10.016667延长约25ms，不插帧或丢帧。中心区域提取和HSV抠像后，仅缩小并移回头顶的独立沙漏与光点；最大前景连通域及所有未选中前景像素在该处理编码前保持不变。公开处理脚本可从原片重建同样的241帧RGBA解码结果。

```powershell
python 'assets/sources/工作状态-原地踱步张望-jimeng-processing.py' 'assets/sources/工作状态-原地踱步张望-jimeng.mp4' 'work/video-edit/waiting-prepared.webm'
npm run media:process -- '工作状态-原地踱步张望' 'work/video-edit/waiting-prepared.webm'
python scripts/match-colour.py '工作状态-原地踱步张望' 'work/pipeline/工作状态-原地踱步张望/video-24fps.webm' 'work/video-edit/waiting-colour.webm' --calibrate
python scripts/finish-common-standing.py '工作状态-原地踱步张望' --input 'work/video-edit/waiting-colour.webm' --output 'work/video-edit/waiting-candidate.webm'
```

先按待机校准固定RGB曲线，再接9帧共同站姿，无额外静止hold；中心动作没有光流补帧。12个全片样本、16个边界样本、黑白背景和调色前后对照已复核。仍有源片画风差异，不能保证任意时刻打断都无痕。此替换后22/106不变，为19段十秒、3段五秒，缺84段。
