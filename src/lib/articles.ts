import { getCollection, type CollectionEntry } from 'astro:content';

/** 获取全部文章（含随笔）并按发布时间倒序。 */
export async function getSortedArticles(): Promise<CollectionEntry<'articles'>[]> {
  const articles = await getCollection('articles');
  return articles.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

/** 按分类获取文章并按发布时间倒序。 */
export async function getArticlesByCategory(category: string): Promise<CollectionEntry<'articles'>[]> {
  const articles = await getSortedArticles();
  return articles.filter((a) => a.data.category === category);
}
