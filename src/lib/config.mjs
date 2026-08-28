// 跨脚本共享的常量与小型工具函数：纯 ESM .mjs，
// 供 Astro 应用（src/lib/*.ts）和 sync 脚本（scripts/*.mjs）共同引用。
// 改用户名或 API 查询参数只需改这里。

export const GITHUB_USERNAME = 'laoliu-463';

export function buildReposUrl(username = GITHUB_USERNAME) {
  return `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`;
}
