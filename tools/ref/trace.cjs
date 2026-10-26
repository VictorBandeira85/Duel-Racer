// Vetoriza uma máscara (preto = forma) em caminho SVG com curvas (Potrace).
// Uso: node tools/ref/trace.cjs <mascara.png> <saida.svg>
const potrace = require('potrace');
const [src, out] = process.argv.slice(2);
potrace.trace(src, { turdSize: 40, optTolerance: 0.6, alphaMax: 1.0, threshold: 128 }, (err, svg) => {
  if (err) throw err;
  require('fs').writeFileSync(out, svg);
  const d = svg.match(/ d="([^"]+)"/)[1];
  console.log('caminho com', d.length, 'caracteres;', (d.match(/C/g) || []).length, 'curvas');
});
