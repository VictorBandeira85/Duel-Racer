// Print de todas as capas de foto do menu (uma por foto). Uso: node tools/covers_check.cjs <pasta> [url do vite]
// SLIDES tem 17 edições (screens.ts): o índice de cada conjunto é a posição dele em SLIDES.
// Ao adicionar um conjunto novo, incluir em sets: [índice em SLIDES, quantidade de fotos].
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.argv[3] || 'http://localhost:5173/'); await p.waitForTimeout(2500);
  const sets = { pc: [16, 13], p9: [15, 7], sn: [14, 3], vs: [13, 2], vg: [12, 4], mz: [11, 4], gol: [10, 4], lp5: [1, 4], tr: [3, 6], f4: [5, 2], nx: [6, 6], dia: [8, 5], vp: [9, 6] };
  let i = 0;
  for (const [k, [idx, n]] of Object.entries(sets)) for (let j = 0; j < n; j++) {
    await p.evaluate((t) => { window.app.state.t = t; }, (idx + 20 * j) * 8 + 7.5);
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${process.argv[2] || '.'}/c${String(i++).padStart(2, '0')}.png`, clip: { x: 150, y: 80, width: 544, height: 200 } });
  }
  console.log(errs, i); await b.close();
})();
