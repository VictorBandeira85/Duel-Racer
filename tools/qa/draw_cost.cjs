// Custo de desenho por quadro, de dia e de noite: conta as chamadas de canvas (drawImage, fill, fillRect,
// clearRect), a área em megapixels que elas tocam e quantas vezes o desenho troca de canvas (cada troca
// obriga a placa de vídeo a descarregar). Serve para comparar dia x noite sem depender da máquina.
// Uso (vite rodando): node tools/qa/draw_cost.cjs [carro] [pista ...]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(2500);
  const car = process.argv[2] || 'br-golgti', courses = process.argv.slice(3).map(Number); if (!courses.length) courses.push(0);
  await p.evaluate((who) => {
    window.__dcWho = who;
    const P = CanvasRenderingContext2D.prototype, S = (window.__dc = { n: {}, mp: {}, sw: 0, last: null, big: {} });
    const area = (c, w, h) => { const t = c.getTransform(); return Math.min(c.canvas.width * c.canvas.height, Math.abs(w * t.a * h * t.d)) / 1e6; };
    const wrap = (name, ar) => { const o = P[name]; P[name] = function (...a) { if (S.last !== this.canvas) { S.sw++; S.last = this.canvas; if (window.__dcWho) { const k = 'troca ' + new Error().stack.split('\n').slice(2, 4).map((l) => l.trim().replace(/^at /, '').replace(/\(?http.*\/src\//, '').replace(/\?t=\d+/, '').replace(/\)$/, '')).join(' < '); S.big[k] = (S.big[k] || 0) + 1; } } S.n[name] = (S.n[name] || 0) + 1; const m = ar(this, a); S.mp[name] = (S.mp[name] || 0) + m; if (m > 0.3 && !window.__dcWho) { const k = name + ' ' + new Error().stack.split('\n').slice(2, 4).map((l) => l.trim().replace(/^at /, '').replace(/\(?http.*\/src\//, '').replace(/\?t=\d+/, '').replace(/\)$/, '')).join(' < '); S.big[k] = (S.big[k] || 0) + m; } return o.apply(this, a); }; };
    wrap('drawImage', (c, a) => (a.length >= 9 ? area(c, a[7], a[8]) : a.length >= 5 ? area(c, a[3], a[4]) : area(c, a[0].width, a[0].height)));
    wrap('fillRect', (c, a) => area(c, a[2], a[3]));
    wrap('clearRect', (c, a) => area(c, a[2], a[3]));
    wrap('fill', () => 0);
  }, !!process.env.WHO); // WHO=1: lista quem troca de canvas (em vez das áreas grandes)
  p.on('pageerror', (e) => console.log('ERRO', e.message.slice(0, 200)));
  for (const ci of courses) for (const t of (process.env.ONLY ? [process.env.ONLY] : ['day', 'night'])) {
    await p.evaluate(([id, t, ci]) => { const a = window.app; const k = a.cars.findIndex((c) => c.id === id); Object.assign(a.state, { carIdx: k, oppIdx: k ? 0 : 1, courseIdx: ci, arcadeTime: t, results: [] }); a.actions.startCourse(); }, [car, t, ci]);
    await p.waitForTimeout(5200);
    await p.evaluate(() => { window.app.race.state = 'drive'; window.input.gas = true; });
    await p.waitForTimeout(2500);
    const r = await p.evaluate((TOP) => new Promise((ok) => { const S = window.__dc; S.n = {}; S.mp = {}; S.sw = 0; S.big = {}; let n = 0; const f = () => { if (++n < 30) requestAnimationFrame(f); else { const per = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +(v / n).toFixed(1)])); ok({ chamadas: per(S.n), megapixels: per(S.mp), trocasDeCanvas: +(S.sw / n).toFixed(0), grandes: Object.entries(S.big).sort((a, b) => b[1] - a[1]).slice(0, TOP).map(([k, v]) => (v / n).toFixed(2) + ' ' + k) }); } }; requestAnimationFrame(f); }), Number(process.env.TOP || 0));
    const tot = Object.values(r.megapixels).reduce((a, b) => a + b, 0);
    console.log(`${car} pista ${ci} ${t}: ${tot.toFixed(1)} MP/quadro, ${r.trocasDeCanvas} trocas`, JSON.stringify(r.chamadas), JSON.stringify(r.megapixels)); r.grandes.forEach((l) => console.log('   ' + l));
    await p.evaluate(() => { window.input.gas = false; });
  }
  await b.close();
})();
