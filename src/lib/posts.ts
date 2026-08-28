import { getCollection, type CollectionEntry } from 'astro:content';

/** 获取全部博客文章并按发布时间倒序。 */
export async function getSortedPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog');
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}
