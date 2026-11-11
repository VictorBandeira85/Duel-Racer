// Conferência do rebaixamento: cada carro com rodas medidas, na oficina, com a suspensão original,
// esportiva e de corrida (recorte da metade de baixo da foto). Os pneus têm de continuar redondos e no
// chão. Uso (vite rodando): node tools/qa/lowered_shots.cjs <pasta> [id ...]  -> <pasta>/<id>.png
const { chromium } = require('playwright');
const only = process.argv.slice(3);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 3 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(2500);
  const ids = await p.evaluate(() => window.app.cars.filter((c) => c.wheels && !c.arcadeOnly).map((c) => c.id));
  for (const id of ids) {
    if (only.length && !only.includes(id)) continue;
    for (const s of ['', 'esportiva', 'corrida']) {
      await p.evaluate(([id, s]) => { const a = window.app; a.state.career = { money: 1, owned: [id], car: id, upgrades: {}, done: [], wins: 0, races: 0, earned: 0, builds: { [id]: { suspensao: s } } }; a.actions.go('title'); a.actions.go('garage'); }, [id, s]);
      await p.waitForTimeout(2300);
      await p.screenshot({ path: `${process.argv[2]}/${id}_${s || 'original'}.png`, clip: { x: 185, y: 150, width: 300, height: 62 } });
    }
  }
  console.log(errs, ids.length); await b.close();
})();
