# Spec 001：个人网站（本地开发版）

标签：ready-for-agent
日期：2026-08-28
状态：已对齐（用户砍掉部署分支，先做本地可跑版本）

## Problem Statement

用户（GitHub: laoliu-463）想要一个个人网站：首页名片 + 博客文章 + GitHub 项目展示，最终目标是 0 成本上线（仅域名约 ¥30–60/年）。当前仓库为空（仅残留 `.astro` 缓存），文章内容为 0，希望先把本地可运行的站点做出来，部署与域名后续再定。

## Solution

用 Astro 搭纯静态站点，本地 `npm run dev` 即可预览：

- **首页**：个人名片（我是谁、怎么联系）+ 精选 GitHub 项目 + 最新文章列表
- **博客**：Markdown 文件驱动（content collections），列表页 + 文章页，从 0 篇起步
- **项目区**：构建时从 GitHub REST API 拉取 laoliu-463 的仓库列表并渲染（仍是纯静态产物）
- 视觉：极简排版流（黑白灰、排版为主），中文界面文案

部署（Cloudflare Pages + 自购域名，大陆访客稳定可达）**延后**，本 spec 不含。

## User Stories

1. As a 访客, I want 在首页一眼看到站长是谁、做什么、怎么联系, so that 我能判断是否继续浏览
2. As a 访客, I want 在首页看到精选的 GitHub 项目, so that 我能快速了解站长的技术水平
3. As a 访客, I want 点击项目跳转到对应 GitHub 仓库, so that 我能查看源码
4. As a 访客, I want 浏览文章列表按时间倒序, so that 我能找到最新内容
5. As a 访客, I want 阅读单篇文章时有良好的排版, so that 阅读体验不输主流博客
6. As a 访客, I want 通过 RSS 订阅文章更新, so that 不用反复访问网站
7. As a 站长, I want 用本地 Markdown 文件写文章并即时预览, so that 写作流程无摩擦
8. As a 站长, I want 新文章只需新建一个 .md 文件, so that 不需要懂代码也能发内容
9. As a 站长, I want 项目区在构建时自动同步 GitHub 仓库, so that 不用手动维护项目列表
10. As a 站长, I want GitHub API 拉取失败时构建不挂, so that 本地开发和构建永远可用
11. As a 站长, I want 在手机上正常浏览, so that 分享到微信也能看
12. As a 站长, I want 以后能无痛迁移到任何静态托管, so that 不被平台锁定

## Implementation Decisions

- 框架：Astro 7.2.9，静态输出，保持零客户端 JS 默认
- 博客内容：`src/content.config.ts` + `glob()` loader（base `./src/content/blog`），Zod schema 校验 `title` / `description` / `pubDate` / `updatedDate?` / `tags?`
- 路由：`/`（名片+精选项目+最新文章）、`/blog`（列表）、`/blog/[id]`（文章）、`/projects`（项目列表）
- GitHub 项目获取：构建/开发时调 `GET https://api.github.com/users/laoliu-463/repos`，过滤 fork，按 star 与更新时间排序；结果落本地缓存文件，API 失败时回退缓存——保证离线可构建
- RSS：@astrojs/rss 4.0.19，输出 `/rss.xml`
- 视觉：极简黑白灰排版，单一字体栈，无框架 CSS（手写全局样式即可）
- 界面语言：中文（代码、项目名保留英文）
- 部署（挂起，后续 spec）：Cloudflare Pages + 自购域名（推荐 Cloudflare Registrar 或阿里云买 .com、DNS 托管 Cloudflare）；更新流程为 git push 自动构建

## Testing Decisions

- 最高缝即构建产物：`astro build` 成功 + `astro check` 类型通过是主验收
- 内容正确性由 content collections 的 Zod schema 在构建时强制（坏 frontmatter 直接构建失败，测试即报错）
- GitHub 拉取逻辑：把「请求 → 过滤/排序」拆成接收注入 fetch 的纯函数，用本地 fixture JSON 做断言（不测网络本身）
- 无浏览器端逻辑，无需浏览器测试

## Out of Scope

- 域名购买、Cloudflare Pages 部署、CI/CD（后续单独 spec）
- 评论、访问统计、联系表单（用户明确不要）
- 中英双语
- CMS 网页后台
- 旧内容迁移（无旧内容）

## Further Notes

- 用户 0 篇文章起步：脚手架需带 1–2 篇示例文章演示格式，标注可删
- 仓库当前 git 未初始化，实现时需 `git init`（首次 commit 等用户点头）
- `D:\personalweb\.astro` 残留缓存可在初始化脚手架时清理

## Sources

- https://docs.astro.build/en/guides/content-collections/ | docs.astro.build | 日期未标明 | 文档对应 Astro 当前版（v7） | 仓库新建将用 Astro 7.2.9，一致 | 采信：content collections 配置位于 `src/content.config.ts`，`glob()` loader + Zod schema，`getCollection` 查询
- https://docs.astro.build/en/reference/content-loader-reference/ | docs.astro.build | 日期未标明 | 同上 | 一致 | 采信：`glob()` loader 支持 md/mdx 等文件类型
- https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api | docs.github.com | 日期未标明 | 版本未标明 | 一致 | 采信：未认证 REST 请求限 60 次/小时/IP——本地开发与构建场景足够，缓存回退策略覆盖失败情况
- https://docs.github.com/rest/repos/repos | docs.github.com | 日期未标明 | 版本未标明 | 一致 | 采信：`GET /users/{username}/repos` 列出用户仓库
- https://www.npmjs.com/package/astro | npmjs.com | 2026-08（查询时点） | astro@7.2.9 | 仓库尚无依赖，将采用此版本 | 采信：当前最新版本号
- https://www.npmjs.com/package/@astrojs/rss | npmjs.com | 2026-08（查询时点） | @astrojs/rss@4.0.19 | 同上 | 采信：当前最新版本号
