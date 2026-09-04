---
title: 在静态世界中寻找秩序：内容与排版规范
description: 记录本站 Markdown 与 MDX 的书写约定、元数据字段与排版美学。
pubDate: 2026-08-29
updatedDate: 2026-08-30
category: 工程与架构
tags: [Astro, 规范, Markdown]
mood: "阴天 / 焦虑指数 30%"
---

在这座数字建筑里，所有文章都需要一份严谨的契约。坏数据绝不能悄悄上线。

## Frontmatter 元数据定义

每篇 Markdown 开头的 frontmatter 均受到 Zod Schema 的强类型约束：

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `title` | `string` | 标题（页面与社交分享） |
| `description` | `string` | 一句话摘要，用于卡片预览与 RSS |
| `pubDate` | `date` | 发布时间（如 2026-08-29） |
| `category` | `string` | 核心分类（如：工程与架构、思考与杂思） |
| `tags` | `string[]` | 标签数组 |
| `mood` | `string?` | 写作时刻的环境与心境印记 |

## 代码片段测试

```typescript
interface MelancholicSoul {
  readonly heartbeat: number; // 8s breathing
  anxietyLevel: number;      // 0 - 100%
  solitude: boolean;
}

function exhale(soul: MelancholicSoul): void {
  console.log(`[${soul.heartbeat}s] 缓慢释出不安与噪声...`);
}
```

## 引用与强调

> “世界是一座巨大的废弃工厂，敲击键盘的声音是管道深处滴落的水珠。”

保持克制，不要滥用加粗与高亮。让留白承担起表达重量的角色。
