// 项目数据入口：优先构建时拉 GitHub API，失败回退本地快照
// 「精选项目」机制：src/data/featured.json 里写仓库名列表，按列表顺序取；
// 不足 limit 时按 star 数补齐；空数组则退化为 top-N。
import fallbackRaw from '../data/repos-fallback.json';
import featuredRaw from '../data/featured.json';
import { fetchRepos, transformRepos, type RepoApiItem, type RepoInfo } from './github';
import { GITHUB_USERNAME } from './config.mjs';

export { GITHUB_USERNAME };

const fallbackItems = fallbackRaw as RepoApiItem[];
const featuredNames = (featuredRaw as string[]) ?? [];

/** 获取项目列表。API 不可达时使用 src/data/repos-fallback.json，保证离线也能构建。 */
export async function getProjects(): Promise<RepoInfo[]> {
  const live = await fetchRepos(GITHUB_USERNAME);
  return live ?? transformRepos(fallbackItems);
}

/** 获取首页精选项目。默认 4 个。 */
export async function getFeaturedProjects(limit = 4): Promise<RepoInfo[]> {
  const all = await getProjects();
  if (featuredNames.length === 0) return all.slice(0, limit);

  const byName = new Map(all.map((r) => [r.name, r]));
  const picked: RepoInfo[] = [];
  for (const name of featuredNames) {
    const repo = byName.get(name);
    if (repo) picked.push(repo);
    if (picked.length >= limit) break;
  }
  if (picked.length >= limit) return picked;

  // 不足 limit 时用 top-star 补齐
  const taken = new Set(picked.map((r) => r.name));
  for (const repo of all) {
    if (picked.length >= limit) break;
    if (!taken.has(repo.name)) picked.push(repo);
  }
  return picked;
}
