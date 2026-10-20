# 按 dsh-pet 原项目制作完整动作

本项目直接复用 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的 106 个逐动作配方与素材制作脚本，固定提交 cc623c7e78aaab7e708f5aede783c3de01b11964，与运行包 dsh-pet@0.3.7 一致。原作者用豆包生成动作视频，再做透明后期。这里将角色设定换成 Q 版 GPT 白龙娘，动作时序、构图和首尾站姿沿用原配方。

当前制作流程已接通，**16/106 个 GPT 动作已有透明视频**。九段为豆包生成的待机、拖拽悬空、五种点击回应和两种步行，各约 10.04 秒、1205 帧；另有即梦与 TapNow 生成的六种工作状态和哈欠，采用约 5.04 秒、605 帧的完整短版。全部输出为 640×360、120 fps，已用于预览。短版不代表完成原配方的十秒时序。两段基础动画独立计数，其余 90 个动作尚无素材；未取得成片或未通过检查的请求不计入数量。

## 1. 角色与动作配方

assets/gpt-video-reference.png 是完整龙角、翅膀和尾巴的 Q 版站姿参考。prompts/character.md 定义角色身份；vendor/dsh-pet/action-prompts.md 保留原版全部配方，scripts/recipes.mjs 按 assets/actions.json 的映射替换角色描述，保留各阶段动作安排。

~~~powershell
npm run media:prompt -- '待机呼吸休闲'
npm run media:recipes
~~~

后一条把全部 106 份可直接使用的 GPT 娘提示词导出到项目 work/recipes/，不联网。每份都包含角色定义、原版通用构图要求和该动作的按秒安排。sourceName 保留原动作名称，可对照原视频检查。

先制作待机，再制作拖拽悬空反馈、五种点击回应、移动和工作状态，最后补生活、玩耍与时节动作。每段约 10 秒，16:9，绿幕统一为 #00FF00，机位固定，人物不横向漂移，首尾回到同一正面站姿，道具按原配方出现并收回。

生成视频需要所选服务的账号和可用额度。上传参考图前须确认具体服务、素材范围和费用上限；本地脚本不会自动调用任何视频服务。此前为 Runway 准备的 3 秒换角试做文件仅留在 work/retarget/，不作为当前原版流程的依赖。

### 免费服务的短版素材

部分免费试用只开放 5 秒，不能直接完成原配方的十秒时序。这类素材保留动作的准备、主体、收势与无道具站姿四个阶段，逐段注明为五秒短版；不通过重复播放、减速或补帧冒充十秒原片。源片的实际尺寸、帧率、时长与调整记录保存在对应来源 JSON 中。

TapNow 的当前 Seedance 2.0 Mini 免费规格输出 836×480。后期只在左右各补九个绿色像素，得到接近 16:9 的 854×480 画布，再进入原版流程，避免拉伸人物。角色外的高处小特效若超出归一化画布，只调整与人物分离的特效区域；原始下载视频保留。源片中已经出画的道具无法靠此修复，须重做。

若动作末尾已经没有道具，但站姿与开头偏差明显，可将最后半秒替换为从第 108 帧回到首帧的缓入缓出双向光流过渡，再补到 120 fps。该修正须记录并复查，不能替代缺失的主体动作。生成片和后期片均检查首尾、动作中段与全片透明边界；快速跳跃仍可能有短暂补帧柔化。

## 2. 准备本地工具

使用已有 Python 与 FFmpeg，当前终端设置可执行文件路径，不修改系统 PATH：

~~~powershell
$env:GPT_PET_PYTHON = '你的已有Python目录\python.exe'
$env:GPT_PET_FFMPEG = '你的已有FFmpeg目录\ffmpeg.exe'
& $env:GPT_PET_PYTHON -m pip install --target work/tools/python --cache-dir work/pip-cache -r scripts/requirements-motion.txt
& $env:GPT_PET_PYTHON scripts/pipeline.py reference
~~~

参考图命令生成 work/generation/gpt-source-reference.png：1280×720，头顶约 20%、脚底约 85%，与原项目的生成构图一致。源参考图保留。

## 3. 原版后期处理与 120 fps

绿幕源视频：

~~~powershell
npm run media:process -- '待机呼吸休闲' 'D:\已有视频\idle.mp4' --chroma 0x00FF00
~~~

若画面边缘含生成服务标记，可在确认完整角色、道具与特效始终位于指定区域内后，限定角色提取区域：

~~~powershell
npm run media:process -- '点击回应-害羞惊讶' 'assets/sources/点击回应-害羞惊讶-doubao.mp4' --chroma 0x00FF00 --region 256,0,768,720
~~~

区域参数依次为原始画面的 x、y、宽、高。处理时用绿色补回原画布，保持角色坐标与比例；带 AI 标记的原片继续保存在来源目录。源视频本身已裁掉的头发或特效不能靠补边、补帧恢复，须重新生成。

已手工抠像、含 Alpha 的 MOV 或 WebM：

~~~powershell
npm run media:process -- '待机呼吸休闲' 'D:\已有视频\idle.mov'
~~~

流程在项目内依次执行：

1. 绿幕视频预处理为原脚本所需的 1280×720、24 fps，运行原版 chroma_step02.py 的 HSV 抠像；手工抠像 MOV 则走原版 pr_import_step02.py。原作者现有动作使用手工抠像路线；自动抠像仍须检查白发和半透明边缘。
2. 运行原版 normalize_step03.py：按首尾站姿测量人物高度，归一化到 2160×1215 母版、角色高 900、脚底线 1115；扫描全片，拒绝对齐后会裁掉动作的构图。包装器将输入时间戳对齐到 24 fps 网格，避免末帧因毫秒取整丢失。
3. 运行原版 encode_thumbs.py：640×360、24 fps 的透明 VP9 WebM。本项目将质量设为 CRF 18。
4. 绿幕路线先清除白紫角色边缘的绿色染色，再在预乘 Alpha 空间用双向光流生成 120 fps 运动中间帧，保留动作时长，输出透明 WebM。手工 Alpha 输入保留原有颜色，不做绿色抑制。补帧不能补出源视频里没有的动作，仍需逐段检查人物和遮挡变化。

原脚本原样保存在 vendor/dsh-pet/，包装器仅在当前进程指定路径、尺寸、编码参数和线程限制。每次只处理一个动作，编解码和滤镜各限两个线程。原始输入不修改，中间文件均在 work/pipeline/<动作名>/：

- step02.webm：抠像结果。
- step03.webm：统一站姿的母版。
- step04-24fps.webm：原项目格式的播放视频。
- video-120fps.webm：120 fps 成品。
- review.png、report.json：六帧检查图与格式、对齐参数记录。

## 4. 检查后导入

逐段看完整视频与检查图，确认人物、表情、手脚、龙角、翼和尾巴一致，首尾站姿衔接，透明边缘无绿边、残影或裁切。格式检查不能替代动作质量检查。

~~~powershell
npm run media:import -- '待机呼吸休闲' 'work/pipeline/待机呼吸休闲/video-120fps.webm'
npm run media:list
npm run check
~~~

导入只接受 640×360、120 fps、无音轨、含透明背景且不超过 10.2 秒的 WebM；按字节复制，避免把 120 fps 再降成 30 fps，也不会覆盖已存在的动作。成品在 assets/webm/。重新启动 npm start 即可在预览中接入已完成的待机、点击、拖拽、移动及分类动作；缺少待机或点击素材时使用对应基础动画。保留固定状态顺序的事件池须该池素材齐全后才接入。全部 106 段齐全后执行 npm run start:full。

## 验证与运行逻辑

~~~powershell
npm test
& $env:GPT_PET_PYTHON scripts/test-pipeline.py
~~~

测试验证 106 个配方均对应原版动作、上游源文件摘要未变化，并用隔离的几何测试片验证绿幕抠像、居中、脚底、透明通道、时长和 120 fps。测试片不导入正式动作库。

菜单、双缓冲切换、随机权重、弹簧跟手、甩抛、落地和多屏几何继续来自原版运行底座；这些逻辑与生成视频中的人物肢体动作共同构成最终效果。
