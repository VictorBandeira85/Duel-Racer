import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// versão mostrada no jogo (testes): número do package.json e a data da compilação
const VERSION = `v${pkg.version} (${new Date().toISOString().slice(0, 10)})`;

// base relativa para funcionar dentro do app iOS (Capacitor).
// `--mode single` gera um único HTML com tudo embutido (para testes no navegador/artifact).
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 1e8 } : {},
}));
