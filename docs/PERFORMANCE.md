# 120 fps 播放验证

当前两段基础动画为 640×360、120 fps 的 VP9 Alpha。待机 4.5 秒、540 帧；招手 2.4 秒、288 帧。原始绘制关键帧之间使用双向光流补帧，呼吸使用连续亚像素形变。视频采用 CRF 18 编码，降低无损视频在切换和解码时的负担；上游 Windows 软件合成、透明窗口和拖拽实现保持原样。

2026-10-19 本地 Windows x64、Electron 43.3.0、165 Hz 显示器上的一次原生窗口采样：

| 动画 | 采样时长 | 合成器呈现帧率 | 解码器报告掉帧 |
| --- | ---: | ---: | ---: |
| 升级前待机 | 3 秒 | 29.99 fps | 0 |
| 120 fps 待机 | 3 秒 | 120.09 fps | 0 |
| 120 fps 招手 | 1.8 秒 | 119.88 fps | 0 |

这组结果覆盖短时待机和点击播放，不代表完整 106 段动作已制作。显示效果受显示器刷新率和机器负载影响；60 Hz 显示器不会呈现每秒 120 个独立画面。

同日接入豆包生成的正式待机后，在原生窗口验证：正式待机 3 秒采样为 **119.95 fps**，基础点击招手 1.8 秒采样为 **120.13 fps**，两段解码器报告掉帧均为 0。正式待机文件约 10.04 秒、1205 帧。

接入正式“点击回应-害羞惊讶”后，最新短时采样为：待机 **119.61 fps**，正式点击 **119.47 fps**。点击样本解码器报告 217 帧中掉 1 帧，约 **0.46%**；待机样本的解码计数在切换后重置，无法据此判断掉帧数。菜单、拖动放手位置、透明区穿透、正式点击及播放完返回待机均通过。当前正式动作进度为 2/106；这些短时结果不代表长时间负载表现。

## 测量方法

`npm run test:native` 启动本项目 Electron 窗口，通过仅绑定 localhost 的临时调试端口检查原版菜单、拖拽、点击与动画恢复，并分别测量当前点击回应和待机：

- 帧率使用 `requestVideoFrameCallback` 元数据的 `presentedFrames` 增量除以 `presentationTime` 增量。JavaScript 回调可能合并，回调调用次数不能直接代表呈现帧数。
- 掉帧使用当前前台视频的 `getVideoPlaybackQuality()` 增量，排除被暂停的后台视频丢弃预解码队列产生的计数。
- `requestAnimationFrame` 仅记录页面刷新间隔，不用于声称视频帧率。

原始报告与窗口截图保存在忽略提交的 `work/` 中。测量接口参见 [HTMLVideoElement.requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)。

```powershell
npm test
npm run check
$env:GPT_PET_MIN_FPS = '115'
npm run test:native
```

最低帧率检查为可选设置，适合刷新率至少 120 Hz 的设备。素材测试还会解码完整视频，核对 120 fps 时间基、540/288 帧总数、透明通道和不同帧数量，防止用重复四次的 30 fps 帧充数。

`assets/basic-preview.gif` 固定为 10 fps，供仓库页面缩略浏览；桌面播放使用 WebM 文件。
