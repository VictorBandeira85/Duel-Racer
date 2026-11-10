// Folha de conferência das cabines: para cada carro, prints em dois formatos de tela (larga 1000x400
// e de celular 932x430, densidade de iPhone) de dia, à noite e virando o volante, com recortes
// ampliados do retrovisor esquerdo, da coluna e do quadro. Uso (com o vite rodando):
//   node tools/qa/cockpit_shots.cjs <pasta> [id do carro ...]
// Abre as folhas <pasta>/<carro>.png e confere antes de publicar (procurar furos, restos de arte,
// bordas esticadas, ponteiros fora do lugar).
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
const only = process.argv.slice(3);
(async () => {
  const b = await chromium.launch();
  const sizes = process.env.WIDE ? [[Number(process.env.WIDE) > 1 ? Number(process.env.WIDE) : 1200, 400]] : [[1000, 400], [932, 430]];
  for (const [vw, vh] of sizes) {
    const p = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 3 });
    await p.goto('http://localhost:5173/'); await p.waitForTimeout(2500);
    const ids = await p.evaluate(() => window.app.cars.map((c) => c.id));
    for (const id of ids) {
      if (only.length && !only.includes(id)) continue;
      for (const [t, steer] of (process.env.DAYONLY ? [['day', 0]] : [['day', 0], ['night', 0], ['day', -1]])) {
        await p.evaluate(([id, t]) => { const a = window.app; const ci = a.cars.findIndex((c) => c.id === id); Object.assign(a.state, { carIdx: ci, oppIdx: ci ? 0 : 1, courseIdx: 0, arcadeTime: t, results: [] }); a.actions.startCourse(); }, [id, t]);
        await p.waitForTimeout(5200);
        await p.evaluate((s) => { const r = window.app.race; r.state = 'drive'; r.rival.z = r.playerZ + 6 * 200; r.rival.x = r.x; window.input.gas = true; window.input.left = s < 0; }, steer);
        await p.waitForTimeout(1300);
        await p.screenshot({ path: `${out}/${id}_${vw}_${t}${steer ? '_turn' : ''}.png` });
        await p.evaluate(() => { window.input.gas = false; window.input.left = false; });
      }
    }
    await p.close();
  }
  await b.close();
})();
