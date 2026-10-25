// Converte dist-single/index.html no formato de página publicada no claude.ai
// (sem <html>/<head>/<body>: o publicador adiciona o esqueleto).
// Uso: node tools/to-artifact.mjs <arquivo-de-saida>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('informe o arquivo de saída');
const html = readFileSync(new URL('../dist-single/index.html', import.meta.url), 'utf8');

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const scripts = [...head.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n');

// visual único escuro (tela de jogo), com fundo explícito
const theme = `<style>
:root { --bg: #000; --fg: #fff; color-scheme: dark; }
html, body { height: 100%; background: var(--bg); color: var(--fg); }
</style>`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${title}\n${theme}\n${styles}\n${body.trim()}\n${scripts}\n`);
console.log(`ok: ${out} (${Math.round(Buffer.byteLength(readFileSync(out)) / 1024)} KB)`);
