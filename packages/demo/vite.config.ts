import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  return {
    plugins: [svelte()],
    base: isProd ? "/doit/" : "/",

    build: {
      outDir: "../../docs",
      emptyOutDir: true
    }
  };
});
