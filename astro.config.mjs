// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // 上线前换成真实域名；RSS 的绝对链接依赖它
  site: 'https://example.com',
});
