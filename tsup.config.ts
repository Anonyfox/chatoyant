import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    schema: 'src/schema/index.ts',
    tokens: 'src/tokens/index.ts',
    'providers/openai': 'src/providers/openai/index.ts',
    'providers/anthropic': 'src/providers/anthropic/index.ts',
    'providers/xai': 'src/providers/xai/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
});
