import { getCollection, type CollectionEntry } from 'astro:content';
import fallbackRaw from '../data/repos-fallback.json';
import featuredRaw from '../data/featured.json';
import { fetchRepos, transformRepos, type RepoApiItem, type RepoInfo } from './github';
import { GITHUB_USERNAME } from './config.mjs';

export { GITHUB_USERNAME };

const fallbackItems = fallbackRaw as RepoApiItem[];
const featuredNames = (featuredRaw as string[]) ?? [];

/** 从本地 Content Collections 获取项目作品 */
export async function getLocalProjects(): Promise<CollectionEntry<'projects'>[]> {
  const projs = await getCollection('projects');
  return projs.sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99));
}

/** 从本地 Content Collections 获取精选项目 */
export async function getFeaturedLocalProjects(limit = 3): Promise<CollectionEntry<'projects'>[]> {
  const projs = await getLocalProjects();
  const featured = projs.filter((p) => p.data.featured);
  if (featured.length >= limit) return featured.slice(0, limit);
  return projs.slice(0, limit);
}

/** 兼容模式：获取 GitHub 仓库信息 */
export async function getProjects(): Promise<RepoInfo[]> {
  const live = await fetchRepos(GITHUB_USERNAME);
  return live ?? transformRepos(fallbackItems);
}

/** 兼容模式：获取精选 GitHub 仓库 */
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

  const taken = new Set(picked.map((r) => r.name));
  for (const repo of all) {
    if (picked.length >= limit) break;
    if (!taken.has(repo.name)) picked.push(repo);
  }
  return picked;
}

/** 将 GitHub RepoInfo 映射为 ProjectCard 所需的格式 */
export function mapRepoToCard(repo: RepoInfo, index: number) {
  return {
    index,
    title: repo.name,
    description: repo.description,
    tags: repo.language ? [repo.language] : [],
    github: repo.url,
    demo: repo.homepage || undefined,
    year: new Date(repo.updatedAt).getFullYear().toString(),
  };
}
