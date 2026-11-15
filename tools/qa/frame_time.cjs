// Perfil de tempo por quadro com CPU limitada. Uso: node prof.cjs <porta> <W>x<H>x<dpr> <throttle> [cenário ...] ; TOP=1 lista funções
const { chromium } = require('playwright');
const port = process.argv[2], [W, H, D] = process.argv[3].split('x').map(Number), thr = Number(process.argv[4]);
const SC = { dia: ['deserto', 'day', ''], noite: ['deserto', 'night', ''], chuva: ['tempestade', 'night', ''], cidade: ['metropole', 'night', 'traffic'], tunel: ['tuneis', 'day', 'tunnel'], dano: ['metropole', 'night', 'damage'] };
const which = process.argv.slice(5).length ? process.argv.slice(5) : Object.keys(SC);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: D });
  await ctx.addInitScript(() => { try { if (new URLSearchParams(location.search).get('view')) { const k = 'duel-racer:ajustes'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.view = Number(new URLSearchParams(location.search).get('view')); localStorage.setItem(k, JSON.stringify(o)); } localStorage.setItem('duel-racer:efeitos', window.__fx || (new URLSearchParams(location.search).get('fx') || 'alto')); } catch {} });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  p.on('pageerror', (e) => console.log('ERRO', e.message.slice(0, 160)));
  await p.goto(`http://localhost:${port}/?fx=${process.env.FX || 'alto'}${process.env.VIEW ? '&view=' + process.env.VIEW : ''}`); await p.waitForTimeout(3000);
  for (const name of which) {
    const [course, t, extra] = SC[name];
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await p.waitForFunction(() => window.app && window.app.actions, null, { timeout: 30000 });
    await p.evaluate(([course, t]) => { const a = window.app; const ci = a.courses.findIndex((c) => c.id === course);
      Object.assign(a.state, { carIdx: a.cars.findIndex((c) => c.id === 'br-golgti'), oppIdx: 0, courseIdx: ci, arcadeTime: t, results: [] }); a.actions.startCourse(); }, [course, t]);
    await p.waitForFunction(() => window.app.state.screen === 'race', null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    const info = await p.evaluate((extra) => {
      const r = window.app.race; r.state = 'drive'; window.input.gas = true;
      const segs = r.track.segments, SL = segs[1].p1.world.z - segs[0].p1.world.z;
      if (extra === 'tunnel') { const i = segs.findIndex((s) => s.tunnel); if (i > 0) r.position = Math.max(0, (i - 30) * SL); }
      if (extra === 'damage') { r.damage = 1; r.crashes = 6; if (r.hits) for (let k = 0; k < 6; k++) r.hits.push({ x: 0.2 + 0.12 * k, y: 0.3 + 0.05 * (k % 3), big: k % 2 === 0, seed: k * 7 + 1 }); }
      return [r.def && r.def.weather, Object.keys(r).filter((k) => /dam|crack|hit|mark|smoke/i.test(k)).join(',')].join(' | ');
    }, extra);
    await p.waitForTimeout(2500);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: thr });
    if (process.env.WARM) await p.waitForTimeout(Number(process.env.WARM) * 1000);
    const lvl = await p.evaluate(() => { const c = document.querySelector('canvas'); return c.width + 'x' + c.height; });
    if (process.env.TOP) await cdp.send('Profiler.enable'), await cdp.send('Profiler.setSamplingInterval', { interval: 500 }), await cdp.send('Profiler.start');
    const res = await p.evaluate(() => new Promise((done) => {
      const iv = [], cb = []; let last = 0, n = 0;
      const o = window.requestAnimationFrame;
      const t0 = performance.now();
      const tick = (now) => { if (last) iv.push(now - last); last = now; if (performance.now() - t0 < 5000) o(tick); else { const s = iv.slice(10).sort((a, b) => a - b); const q = (f) => s[Math.min(s.length - 1, Math.floor(s.length * f))]; done({ n: s.length, avg: s.reduce((a, b) => a + b, 0) / s.length, p50: q(0.5), p95: q(0.95), max: s[s.length - 1] }); } };
      o(tick);
    }));
    let top = '';
    if (process.env.TOP) {
      const { profile } = await cdp.send('Profiler.stop');
      const self = new Map(); const dts = profile.timeDeltas, ids = profile.samples; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      const par = new Map(); for (const n of profile.nodes) for (const c of n.children || []) par.set(c, n.id);
      let tot = 0;
      ids.forEach((id, i) => { let n = byId.get(id); const leaf = n.callFrame.functionName; while (n && !n.callFrame.url && par.has(n.id)) n = byId.get(par.get(n.id));
        const k = (n.callFrame.url ? (n.callFrame.functionName || '(anon)') + ' ' + n.callFrame.url.split('/').pop().split('?')[0] + ':' + n.callFrame.lineNumber : leaf); self.set(k, (self.get(k) || 0) + dts[i]); tot += dts[i]; });
      top = '\n   ' + [...self].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, v]) => `${(v / tot * 100).toFixed(1)}% ${k}`).join('\n   ');
    }
    console.log(`${name.padEnd(7)} ${W}x${H}@${D} cpu/${thr}: média ${res.avg.toFixed(1)} ms  p95 ${res.p95.toFixed(1)}  pior ${res.max.toFixed(0)}  (${(1000 / res.avg).toFixed(0)} qps) [canvas ${lvl}]${top}`);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await p.evaluate(() => { window.input.gas = false; window.app.actions.go('title'); }); await p.waitForTimeout(400);
  }
  await b.close();
})();
