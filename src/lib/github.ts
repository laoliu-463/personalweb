// GitHub 仓库拉取与转换：纯函数 + 注入 fetch，便于测试与缓存回退
// API 文档：https://docs.github.com/rest/repos/repos（未认证限 60 次/小时）

import { buildReposUrl } from './config.mjs';

/** GitHub REST API 的仓库原始条目（只声明用到的字段） */
export interface RepoApiItem {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  pushed_at: string;
  fork: boolean;
  language: string | null;
  homepage: string | null;
}

/** 页面展示用的仓库信息 */
export interface RepoInfo {
  name: string;
  description: string;
  url: string;
  stars: number;
  /** ISO 8601 时间戳 */
  updatedAt: string;
  language: string;
  homepage: string;
}

/** 过滤 fork、映射字段、按 star 数降序（同 star 按更新时间倒序） */
export function transformRepos(items: RepoApiItem[]): RepoInfo[] {
  return items
    .filter((item) => !item.fork)
    .map((item) => ({
      name: item.name,
      description: item.description ?? '',
      url: item.html_url,
      stars: item.stargazers_count,
      updatedAt: item.pushed_at,
      language: item.language ?? '',
      homepage: item.homepage?.trim() ?? '',
    }))
    .sort((a, b) => b.stars - a.stars || b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * 拉取某用户的公开仓库。失败（网络异常、非 2xx、响应畸形）一律返回 null，
 * 由调用方决定回退策略。
 */
export async function fetchRepos(
  username: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RepoInfo[] | null> {
  try {
    const res = await fetchImpl(buildReposUrl(username));
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return null;
    return transformRepos(data as RepoApiItem[]);
  } catch {
    return null;
  }
}
