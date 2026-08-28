import rss from '@astrojs/rss';
import { getSortedPosts } from '../lib/posts';

/** @param {import('astro').APIContext} context */
export async function GET(context) {
  const posts = await getSortedPosts();
  return rss({
    title: 'laoliu 的文章',
    description: 'Lao Liu 的个人网站：文章与项目',
    site: context.site ?? 'https://example.com',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
      categories: post.data.tags,
    })),
  });
}
