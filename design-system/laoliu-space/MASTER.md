# laoliu.space — Design System Master

锁定日期：2026-09-04。本文件只记录已确认合同，不发明新风格。

## 身份

- 共享壳：《雾隐·陈墨》深色水墨（墨底 `#14151a`、陈墨字 `#e5e3dc`、酒色 `#5c2b3a`）。
- 长文（博客 / 随笔 / 自述）：衬线文学。本轮不改内容页结构。
- 禁止第三套写死色板。壳层使用 CSS 变量，不用 `#08090c` 等旧主题残留。

## 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` / `--bg-primary` | `#14151a` | 页面底 |
| `--bg-soft` / `--bg-card` | `#191a20` | 卡片 |
| `--ink` / `--text-primary` | `#e5e3dc` | 主文字 |
| `--ink-dim` / `--text-secondary` | `#8c8d93` | 次级文字 |
| `--text-muted` | `#7e8088` | 弱化文字，正文对比 ≥ 4.5:1 |
| `--wine` | `#5c2b3a` | 点缀 / 选区 |
| `--line` / `--border-color` | `rgba(229, 227, 220, 0.12)` | 分割线 |

风光模式只改 `--accent-glow`，不另开色板。

## 字体与尺度

- 壳：Inter + Noto Sans SC，字重 300–400，正文 16px / 行高 1.6。
- 品牌与长文标题：Fraunces + Noto Serif SC（内容页下一轮收口）。
- 等宽：JetBrains Mono。
- 圆角：`--radius-sm` 4px · `--radius-md` 12px · `--radius-lg` 16px · `--radius-pill` 全圆。
- 间距：4 / 8 / 12 / 16 / 24 / 32。

## 导航

- ≥640px：顶栏品牌 + 四个链接（作品 / 博客 / 随笔 / 自述）。
- &lt;640px：品牌 + 菜单按钮；菜单从同一顶栏向下展开。Esc / 点外部关闭。
- 无 JS：链接保持在文档中可点。
- 品牌回首页；不另做底部导航。

## 风光与黑胶

- 解析：`localStorage.preferred-scenery`（合法四态）否则按时段：6–17 迷雾、17–20 黄昏、20–23 雨、其余星。
- 必须写入 `html[data-scenery]`。本轮不加手动切换 UI。
- 黑胶只播放 / 暂停环境声；图标为内联 SVG，由 `data-scenery` 驱动。
- 切页用 `transition:persist`，避免播放状态被重置。

## 无障碍（硬约束）

- 跳过导航链接到 `#main-content`。
- `:focus-visible`：2px 描边 + 2px offset。
- `prefers-reduced-motion`：停月影 / 雾层 / 雨丝 / 唱片旋转 / 入场动画，Canvas 停止 rAF。
- 小屏导航热区 ≥ 44px。

## 本轮明确不做

- `BlogPost` 旧色板、`handwriting-accent`、内容页排版重做。
- 风光手动切换器。
- 新增图标库依赖。
