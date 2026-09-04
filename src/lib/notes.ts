import { getCollection, type CollectionEntry } from 'astro:content';

/** 获取全部随笔并按发布时间倒序排列 */
export async function getSortedNotes(): Promise<CollectionEntry<'notes'>[]> {
  const notes = await getCollection('notes');
  return notes.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}
