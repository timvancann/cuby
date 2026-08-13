/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  server: { host: true }, // expose on the local network for phone review
  test: { include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
});
