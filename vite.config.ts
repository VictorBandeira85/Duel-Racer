import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base relativa para funcionar dentro do app iOS (Capacitor).
// `--mode single` gera um único HTML com tudo embutido (para testes no navegador/artifact).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 1e8 } : {},
}));
