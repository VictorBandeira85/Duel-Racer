// Converte dist-single/index.html no formato de página publicada no claude.ai
// (sem <html>/<head>/<body>: o publicador adiciona o esqueleto).
// Uso: node tools/to-artifact.mjs <arquivo-de-saida>            (tudo num HTML: npm run build:single)
//      node tools/to-artifact.mjs <arquivo-de-saida> --files    (npm run build:artifact: o HTML só com o
//        código e as imagens/fontes como arquivos de apoio, publicados ao lado da página com o mesmo
//        nome). Copia os arquivos para <pasta da saída>/files/ e grava <pasta>/changed.json com os que
//        mudaram desde a última vez (<pasta>/published.json): só esses precisam ir em `files` na
//        publicação (os outros continuam no artifact). O artifact aceita 255 arquivos por publicação.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const out = process.argv[2];
if (!out) throw new Error('informe o arquivo de saída');
if (process.argv.includes('--done')) { // publicação feita: o que estava pendente passa a ser o publicado
  copyFileSync(join(dirname(out), 'pending.json'), join(dirname(out), 'published.json'));
  console.log('publicado registrado');
  process.exit(0);
}
const files = process.argv.includes('--files');
const html = readFileSync(new URL(files ? '../dist-artifact/index.html' : '../dist-single/index.html', import.meta.url), 'utf8');

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
// arquivos de apoio: o Vite resolve cada imagem com `new URL(nome, import.meta.url)`; dentro do artifact
// vale o endereço-base do documento (como as músicas, `music/...`).
const fix = (t) => (files ? t.replaceAll(',import.meta.url).href', ',document.baseURI).href') : t);
// A página do artifact roda isolada (origem própria): imagem carregada direto de arquivo "suja" o canvas
// e o getImageData (pintura, máscaras, sombras) falha -> o jogo caía no desenho de reserva. Por isso toda
// imagem de arquivo é baixada com fetch e entregue como data: (nunca suja o canvas). Se o fetch falhar,
// carrega direto, como antes.
// Fila com prioridade (src/imgprio.ts): no máximo 6 downloads ao mesmo tempo; primeiro o que a tela atual
// precisa (__imgNeed: o pedido mais recente na frente), depois os pedidos normais e por último o
// pré-carregamento geral (__imgLow > 0), na ordem em que foi pedido. Com window.__baseline (medidas) vale o
// comportamento antigo: tudo baixado de uma vez, sem ordem.
const shim = files ? `<script>(function(){
var d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
var Q=[],run=0,MAX=6;
function load(im,v,done){var get=function(n){return fetch(v).then(function(r){if(!r.ok)throw 0;return r.blob()}).catch(function(e){if(n<=0||im.__w!==v)throw e;return new Promise(function(w){setTimeout(w,800)}).then(function(){return get(n-1)})})};get(2).then(function(b){return new Promise(function(ok,no){var f=new FileReader();f.onload=function(){ok(f.result)};f.onerror=no;f.readAsDataURL(b)})})
.then(function(u){if(im.__w===v)d.set.call(im,u)},function(){if(im.__w===v)d.set.call(im,v)}).then(done,done)}
function pump(){while(run<MAX&&Q.length){var bi=0,bp=-1;for(var i=0;i<Q.length;i++){var p=Q[i].p;if(p>bp||(p===bp&&p>0)){bp=p;bi=i}}var e=Q.splice(bi,1)[0];e.im.__q=null;if(e.im.__w!==e.v)continue;run++;load(e.im,e.v,function(){run--;pump()})}}
window.__imgLow=0;
window.__imgNeed=function(im){var e=im.__q;if(e&&e.p<2){e.p=2;Q.splice(Q.indexOf(e),1);Q.push(e)}};
Object.defineProperty(HTMLImageElement.prototype,'src',{configurable:true,enumerable:true,get:function(){return d.get.call(this)},
set:function(v){var im=this;v=String(v);if(/^(data|blob):/i.test(v)){d.set.call(im,v);return}
im.__w=v;if(window.__baseline){load(im,v,function(){});return}
var e={im:im,v:v,p:window.__imgLow>0?0:1};im.__q=e;Q.push(e);pump()}});
})();</script>\n` : '';
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const scripts = shim + fix([...head.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n'));

// visual único escuro (tela de jogo), com fundo explícito
const theme = `<style>
:root { --bg: #000; --fg: #fff; color-scheme: dark; }
html, body { height: 100%; background: var(--bg); color: var(--fg); }
</style>`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${title}\n${theme}\n${styles}\n${body.trim()}\n${scripts}\n`);
console.log(`ok: ${out} (${Math.round(Buffer.byteLength(readFileSync(out)) / 1024)} KB)`);
if (files) {
  const src = new URL('../dist-artifact/a/', import.meta.url);
  const dst = join(dirname(out), 'files');
  mkdirSync(dst, { recursive: true });
  const pubFile = join(dirname(out), 'published.json');
  const old = existsSync(pubFile) ? JSON.parse(readFileSync(pubFile, 'utf8')) : {};
  const now = {}, changed = [];
  let total = 0;
  for (const f of readdirSync(src).sort()) {
    const buf = readFileSync(new URL(f, src));
    total += buf.length;
    now[f] = createHash('sha1').update(buf).digest('hex');
    copyFileSync(new URL(f, src), join(dst, f));
    if (old[f] !== now[f]) changed.push(f);
  }
  const gone = Object.keys(old).filter((f) => !(f in now));
  writeFileSync(join(dirname(out), 'changed.json'), JSON.stringify({ changed, gone }));
  writeFileSync(join(dirname(out), 'pending.json'), JSON.stringify(now)); // vira published.json depois de publicar (--done)
  console.log(`arquivos: ${Object.keys(now).length} (${Math.round(total / 1024)} KB), mudaram ${changed.length}, saíram ${gone.length} -> ${join(dirname(out), 'changed.json')}`);
}
