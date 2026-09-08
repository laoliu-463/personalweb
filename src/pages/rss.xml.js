import rss from '@astrojs/rss';
import { getSortedArticles } from '../lib/articles';

/** @param {import('astro').APIContext} context */
export async function GET(context) {
  const articles = await getSortedArticles();
  return rss({
    title: 'laoliu 的文章',
    description: 'Lao Liu 的个人网站：文章与项目',
    site: context.site ?? 'https://example.com',
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.pubDate,
      link: `/articles/${article.id}/`,
      categories: article.data.tags,
    })),
  });
}
