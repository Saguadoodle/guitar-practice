# Saguadlib

基于 React + TypeScript + Vite 的吉他练习工具。当前已完成七板块应用结构，并实现指板与音准、A1 听音挑战、和弦探索、C1 音阶探索等核心功能；完整规划见 [ROADMAP.md](ROADMAP.md)。

## 页面与功能概览

| 板块 | 当前状态 |
| --- | --- |
| 指板与音准 | 自由探索：0—24 品指板、调弦、点击拨弦与详情揭晓；听音挑战：5／10／20 题计分 |
| 音阶 | 13 种音阶、完整指板高亮、三种标签显示、单音／上下行试听 |
| 和弦 | 44 种类型、实际指型候选与小图、根音锁定、参考音阶、短音／持续音／琶音 |
| Jam Session | 筹备中 |
| 扒谱 | 仅预留入口，需求待定 |
| 设置 | 主题、音名显示、声音开关、当前调弦、恢复默认 |
| 简介 | 占位，项目理念待提供 |

桌面使用导航栏，窄屏使用“板块导航”下拉框。地址使用 `#/fretboard`、`#/settings` 等 hash 路由，可直接访问并支持刷新与前进/后退；未识别地址回到指板页。

## 本地启动

在仓库根目录执行：

```sh
npm ci
npm run dev
```

打开终端提供的地址下的 `/guitar-practice/`（通常 `http://localhost:5173/guitar-practice/`）。停止服务使用 `Ctrl+C`。

生产构建预览：

```sh
npm run build
npm run preview
```

## 最基本检查命令

```sh
npm run lint
npm run build
```

更多自动检查脚本与浏览器验收步骤见 [docs/testing.md](docs/testing.md)。

## 仓库与部署说明

- GitHub 仓库：`Saguadoodle/guitar-practice`
- GitHub Pages 部署子路径：`/guitar-practice/`
- 现有 Pages workflow 保持不变

## 文档

- [功能与开发说明](docs/features-development.md)
- [测试与验收](docs/testing.md)
- [变更账本](docs/ledger.md)
- [详细功能说明](docs/details.md)

sagua is cool -dfs
