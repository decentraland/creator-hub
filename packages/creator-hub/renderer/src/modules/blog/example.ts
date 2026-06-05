/**
 * Minimal usage of the blog client: fetch latest 7 posts and log titles.
 */
import { getLatestBlogPosts } from './blog.client';

async function main() {
  try {
    const { posts, total } = await getLatestBlogPosts();
    console.log(`Fetched ${posts.length} of ${total} posts`);
    posts.forEach((p, i) => {
      console.log(`${i + 1}. ${p.title} (${p.publishedDate}) - ${p.url}`);
    });
  } catch (err) {
    console.error('getLatestBlogPosts failed:', err);
  }
}

main();
