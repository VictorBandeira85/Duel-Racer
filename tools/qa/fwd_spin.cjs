// Patinação por marcha de um tração dianteira (Gaúcho GTI) original e preparado: giro em falso máximo
// em cada marcha, até que km/h patina e o 0-100. Uso (vite rodando): node tools/qa/fwd_spin.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(2000);
  const out = await p.evaluate(async () => {
    const C = await import('/src/cars.ts'), T = await import('/src/tuning.ts');
    const base = window.app.cars.find((c) => c.id === 'br-golgti');
    const res = {};
    for (const [name, build] of [['original', {}], ['comando+chip', { comando: 'esportivo', alimentacao: 'chip' }], ['turbo .32', { inducao: 'turbo' }], ['turbo .50 completo', { inducao: 'turbo', turbina: 't50', comando: 'corrida', alimentacao: 'programavel', pistoes: 'forjados', escape: 'corrida' }], ['turbo .32 + esportivo', { inducao: 'turbo', pneus: 'esportivo' }], ['turbo .32 + semi slick', { inducao: 'turbo', pneus: 'semislick' }], ['turbo .70 completo + semi slick', { pneus: 'semislick', inducao: 'turbo', turbina: 't70', intercooler: 'corrida', downpipe: 'd5', comando: 'corrida', alimentacao: 'programavel', pistoes: 'forjados', escape: 'corrida' }], ['turbo .70 completo', { inducao: 'turbo', turbina: 't70', intercooler: 'corrida', downpipe: 'd5', comando: 'corrida', alimentacao: 'programavel', pistoes: 'forjados', escape: 'corrida' }]]) {
      const car = C.prepareCar({ ...T.applyBuild(base, build) });
      const pt = new C.Powertrain(car); let v = 0, t = 0, t100 = 0; const g = {}, top = {};
      while (t < 40 && pt.gear < 4) { const a = pt.step(v, true, 1 / 60, 1, true); v += (a - C.resistAcc(car, v, 1)) / C.toMs(1) / 60; const kmh = C.toMs(v) * 3.6; t += 1 / 60; g[pt.gear + 1] = Math.max(g[pt.gear + 1] ?? 0, pt.spin); if (!t100 && kmh >= 100) t100 = t; if (pt.spin > 0.25) top[pt.gear + 1] = Math.round(kmh); }
      res[name] = { prep: +(car.prep ?? 1).toFixed(2), t100: +t100.toFixed(1), patinaAteKmh: top, spinMaxPorMarcha: Object.fromEntries(Object.entries(g).map(([k, x]) => [k, +x.toFixed(2)])) };
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
