# 测试与验收

本文档只描述如何运行检查与人工验收，不代表已执行结果。

## 1. 基础命令

在仓库根目录执行：

```sh
npm ci
npm run lint
npm run build
npm run dev
npm run preview
```

## 2. 自动检查脚本（check-*.mjs）

按需在项目根目录执行以下脚本：

```sh
node scripts/check-ui.mjs light
node scripts/check-ui.mjs dark
node scripts/check-audio.mjs
node scripts/check-theme.mjs
node scripts/check-settings.mjs
node scripts/check-challenge.mjs
node scripts/check-challenge-ui.mjs
node scripts/check-chords.mjs
node scripts/check-fingerings.mjs
node scripts/check-chord-audio.mjs
node scripts/check-hold-gesture.mjs
node scripts/check-fingering-diagrams.mjs
node scripts/check-scales.mjs
node scripts/check-scale-audio.mjs
```

建议补充执行：

```sh
git diff --check
```

## 3. 通用浏览器验收

### 页面与路由

1. 逐一打开七个板块，确认已实现页可用、占位页仅显示筹备信息。
2. 验证 hash 地址直达、刷新、浏览器前进/后退。
3. 访问未知地址，确认回到默认页。

### 桌面与窄屏

1. 在桌面宽度检查导航栏布局、标题与控件无重叠。
2. 在约 375px 宽度检查“板块导航”下拉可切换。
3. 检查横向内容（完整指板）在容器内滚动，页面整体不出现异常横向溢出。

### 主题、调弦与设置持久化

1. 在设置页切换浅/深色主题、调弦、声音开关。
2. 跨页往返后确认设置一致。
3. 刷新页面后确认设置从本地存储恢复。
4. 执行“恢复默认”后确认状态复位。

### 音频通用检查

1. 开启声音后测试单音/和弦/音阶试听触发与停止。
2. 静音后确认播放入口受控，重新启用声音后可恢复。
3. 切页、失焦、切换参数后确认旧播放停止，不出现卡音。

## 4. 专项验收

### 指板与音准（自由探索）

1. 检查 0—24 品点击与详情揭晓。
2. 隐藏模式下先选位置再揭晓，重新选点后答案应重置。
3. 切换调弦后检查空弦、12 品、24 品音高对应关系。

### A1 听音挑战

1. 验证 5/10/20 题题量与流程（开始、提交、下一题、结算）。
2. 提交前不暴露答案；提交后锁定答案并显示判分。
3. 辅助点击只试听不提交，并正确记录辅助标记。
4. 切换调弦、退出挑战、切页、刷新后，会话应结束并需重新开始。

### 和弦探索

1. 检查和弦分类、理论组成音与类型切换。
2. 检查根音单击选择、双击锁定/解锁、锁定后单音演奏。
3. 检查小图候选分页/筛选与大指板高亮联动。
4. 检查播放按钮短按、长按、琶音与中断释放。

### C1 音阶探索

1. 检查 13 种音阶在不同主音下的拼写与指板高亮。
2. 检查音名/级数/双标签三种显示模式。
3. 检查上行、下行、往返播放的起止与终点主音。
4. 检查单音点击试听不改变当前主音。

### 随机试听与 BPM

1. 检查 BPM 输入范围与非法值反馈。
2. 检查随机节奏组持续播放、改速生效时机、停止行为。
3. 检查随机与其他播放任务互斥（新任务替换旧任务）。

## 5. 回归建议

当和弦、音阶、音频或设置逻辑发生改动时，建议至少执行：

- `npm run lint`
- `npm run build`
- 对应 `check-*.mjs`
- 1 轮桌面 + 1 轮窄屏人工验收
