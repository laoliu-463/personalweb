// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://laoliu-463.github.io/personalweb',
  vite: {
    plugins: [tailwindcss()],
  },
});

