import { describe, expect, it } from 'vitest';
import { fetchRepos, transformRepos } from '../src/lib/github';
import fixture from './fixtures/repos-api.json';
import type { RepoApiItem } from '../src/lib/github';

const items = fixture as RepoApiItem[];

describe('transformRepos', () => {
  it('排除 fork 仓库', () => {
    const names = transformRepos(items).map((r) => r.name);
    expect(names).not.toContain('fork-repo');
    expect(names).toHaveLength(4);
  });

  it('按 star 数降序排列，star 相同时按更新时间倒序', () => {
    const names = transformRepos(items).map((r) => r.name);
    // tie-with-top 与 top-stars-stale 同为 10 star，前者更新更晚，应排前面
    expect(names).toEqual([
      'tie-with-top',
      'top-stars-stale',
      'mid-stars',
      'low-stars-fresh',
    ]);
  });

  it('映射为展示字段：null 描述/语言转空串，homepage 空白串转空串', () => {
    const byName = new Map(transformRepos(items).map((r) => [r.name, r]));
    expect(byName.get('low-stars-fresh')).toMatchObject({
      description: '',
      language: '',
      homepage: '',
      url: 'https://github.com/laoliu-463/low-stars-fresh',
      stars: 0,
      updatedAt: '2026-08-20T00:00:00Z',
    });
    expect(byName.get('mid-stars')?.homepage).toBe('https://example.com/');
  });
});

describe('fetchRepos', () => {
  it('请求正确的 API 地址并返回转换结果', async () => {
    let requestedUrl = '';
    const fakeFetch = async (url: unknown) => {
      requestedUrl = String(url);
      return { ok: true, json: async () => items };
    };
    const repos = await fetchRepos('laoliu-463', fakeFetch as unknown as typeof fetch);
    expect(requestedUrl).toBe(
      'https://api.github.com/users/laoliu-463/repos?per_page=100&sort=updated',
    );
    expect(repos).not.toBeNull();
    expect(repos?.map((r) => r.name)).toHaveLength(4);
  });

  it('网络异常返回 null（触发调用方回退快照）', async () => {
    const failingFetch = async () => {
      throw new Error('network down');
    };
    expect(await fetchRepos('laoliu-463', failingFetch as unknown as typeof fetch)).toBeNull();
  });

  it('非 2xx 响应返回 null', async () => {
    const notOkFetch = async () => ({ ok: false, status: 403 });
    expect(await fetchRepos('laoliu-463', notOkFetch as unknown as typeof fetch)).toBeNull();
  });

  it('响应不是数组（如限流错误对象）返回 null', async () => {
    const weirdFetch = async () => ({
      ok: true,
      json: async () => ({ message: 'API rate limit exceeded' }),
    });
    expect(await fetchRepos('laoliu-463', weirdFetch as unknown as typeof fetch)).toBeNull();
  });
});
