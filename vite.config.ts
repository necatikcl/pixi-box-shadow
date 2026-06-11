import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PixiBoxShadow',
      formats: ['es', 'cjs'],
      fileName: (format) => `pixi-box-shadow.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['pixi.js'],
      output: {
        globals: {
          'pixi.js': 'PIXI',
        },
      },
    },
  },
  // For shader imports
  assetsInclude: ['**/*.frag', '**/*.vert', '**/*.wgsl'],
});
