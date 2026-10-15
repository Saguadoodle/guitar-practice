# 交接：调内级数、循环控制和随机旋律

2026-10-15。代码实现和自动检查已完成；剩余的人耳主观试听当前工具无法执行，明确未作为通过项。未提交或推送，现有文件保存在本地。不要重新引入已撤回的自定义音程大小写或随机多节奏。

## 已完成

七声音阶逐音叠三度，按实际大／小／减／增三和弦显示级数；五声映射母音阶，蓝调附加音与音阶外音不硬套性质。和弦参考视图共用规则，未选参考时仍可查看明确标注的常规相对音程。四试听按钮均循环、再次点击当前按钮停止、切换互斥；删除音阶独立停止按钮，和弦按钮保留。连续十六分旋律考虑方向、级进、有限跳进、大跳恢复、边界与稳定音轻权重；音频时钟、BPM、停止取消、正圆和主题保留。

## 修改文件

- `src/scales.ts`、`src/referenceScales.ts`、`src/intervals.ts`：三和弦性质及共享标记，移除旧自定义标签。
- `src/melody.ts`（新增）：有状态旋律生成。
- `src/scaleAudio.ts`、`src/scaleRhythm.ts`：十六分循环音频调度、改速／取消／短释放，删除旧多节奏。
- `src/pages/ScalesPage.tsx`、`src/pages/ChordsPage.tsx`、`src/App.css`：循环交互、说明与活动状态。
- `scripts/check-melody.mjs`（新增）、`check-intervals.mjs`、`check-scale-audio.mjs`、`check-scales.mjs`、`check-chords.mjs`、`check-ui.mjs`：新规则与回归。
- `scripts/render-melody-samples.mjs`（新增）：可复现 WAV 渲染；README、ROADMAP 与本交接。

## 实际检查

lint、build、全部15个检查脚本及 UI dark 通过。104000次转移，级进75.4%；四音阶例子与母映射、四模式跨周期、60/120/300BPM、三分钟时钟、100次启停／替换与错误取消均通过。浏览器四例、启动／重按停止／切换、无效BPM停音、和弦参考共享、桌面浅色／375px深色、48×48圆形通过，无控制台错误。未真人测试扬声器听感、真机触屏和其他浏览器。

## 剩余与下一步

1. 播放 `/private/tmp/saguadlib-melody-samples/C-major-120.wav`、`A-harmonic-minor-100.wav`、`D-dorian-120.wav`，关注方向、级进／跳进、边界、句尾是否自然；不要仅依据 MIDI 合法性宣称听感通过。
2. 文件如被临时目录清理，在项目中运行 `node scripts/render-melody-samples.mjs` 重建，附 `notes.json`。
3. 根据真实听感反馈小幅调整 `src/melody.ts` 权重，保持限跳与停止规则，然后重新运行检查和 build。
4. 用户验收后自行通过 GitHub Desktop 提交／推送；代理不自动操作。
