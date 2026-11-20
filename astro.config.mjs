// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // 60s: o passo que importa a lista de animais do portal SGQ grava centenas de linhas
  adapter: vercel({ maxDuration: 60 }),
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});