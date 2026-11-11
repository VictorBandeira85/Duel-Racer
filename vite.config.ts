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
  // `--mode artifact`: código e estilo embutidos no HTML, imagens e fontes como arquivos à parte, com o
  // nome original (sem hash: nomes de arquivo não se repetem em src/assets), publicados ao lado da
  // página. O artifact limita cada arquivo a 16 MB; com as imagens fora o HTML fica com ~0,5 MB.
  // Arquivos até 32 KB continuam embutidos (menos arquivos para publicar: o artifact aceita 255 por vez).
  // Ver tools/to-artifact.mjs (modo arquivos)
  plugins: mode === 'single' ? [viteSingleFile()] : mode === 'artifact' ? [viteSingleFile({ useRecommendedBuildConfig: false })] : [],
  publicDir: mode === 'artifact' ? false : 'public',
  build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 1e8 } : mode === 'artifact' ? { outDir: 'dist-artifact', assetsInlineLimit: 32768, cssCodeSplit: false, assetsDir: 'a', rollupOptions: { output: { inlineDynamicImports: true, assetFileNames: 'a/[name][extname]' } } } : {},
}));
