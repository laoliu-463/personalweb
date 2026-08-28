---
title: 写作格式速查
description: 本站文章的 frontmatter 字段与写作约定。
pubDate: 2026-08-28
updatedDate: 2026-08-28
tags: [建站]
---

> 示例文章之二：展示全部 frontmatter 字段。同样可删。

每篇文章开头的 frontmatter 支持这些字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | 是 | 标题 |
| `description` | 是 | 一句话摘要，用于列表页和 RSS |
| `pubDate` | 是 | 发布日期，如 `2026-08-28` |
| `updatedDate` | 否 | 大改时更新 |
| `tags` | 否 | 标签数组，如 `[建站, 随笔]` |

正文就是普通 Markdown：标题、列表、表格、代码块都支持。字段写错的话构建会直接报错，这是刻意的——坏数据不该悄悄上线。
