// megapixels por quadro por função que chama (drawImage/fillRect/clearRect). Uso: node mp.cjs <porta> <pista> <day|night> [WxHxD]
const { chromium } = require('playwright');
(async () => {
  const [W, H, D] = (process.argv[5] || '932x430x3').split('x').map(Number);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: D });
  await p.addInitScript(() => { try { localStorage.setItem('duel-racer:efeitos', 'alto'); } catch {} });
  await p.goto(`http://localhost:${process.argv[2]}/`); await p.waitForTimeout(3000);
  await p.evaluate(([course, t]) => { const a = window.app; const ci = a.courses.findIndex((c) => c.id === course);
    Object.assign(a.state, { carIdx: a.cars.findIndex((c) => c.id === 'br-golgti'), oppIdx: 0, courseIdx: ci, arcadeTime: t, results: [] }); a.actions.startCourse(); }, [process.argv[3], process.argv[4]]);
  await p.waitForFunction(() => window.app.state.screen === 'race', null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { window.app.race.state = 'drive'; window.input.gas = true; });
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => new Promise((ok) => {
    const P = CanvasRenderingContext2D.prototype, S = {}, N = {};
    const area = (c, w, h) => { const t = c.getTransform(); return Math.min(c.canvas.width * c.canvas.height, Math.abs(w * t.a * h * t.d)) / 1e6; };
    const who = () => { const l = new Error().stack.split('\n').slice(3, 7).map((x) => (x.match(/at (\S+) .*\/([\w.]+)\?/) || x.match(/at (\S+)/) || [])[1] || '?'); return l.slice(0, 3).join('<'); };
    const wrap = (name, ar) => { const o = P[name]; P[name] = function (...a) { const k = who(); S[k] = (S[k] || 0) + ar(this, a); N[k] = (N[k] || 0) + 1; return o.apply(this, a); }; };
    wrap('drawImage', (c, a) => (a.length >= 9 ? area(c, a[7], a[8]) : a.length >= 5 ? area(c, a[3], a[4]) : area(c, a[0].width, a[0].height)));
    wrap('fillRect', (c, a) => area(c, a[2], a[3]));
    wrap('clearRect', (c, a) => area(c, a[2], a[3]));
    let n = 0; const f = () => { if (++n < 30) requestAnimationFrame(f); else ok({ S, N, n, cw: document.querySelector('canvas').width, ch: document.querySelector('canvas').height }); }; requestAnimationFrame(f);
  }));
  console.log('canvas', r.cw, 'x', r.ch);
  const rows = Object.entries(r.S).sort((a, b) => b[1] - a[1]).slice(0, 18);
  for (const [k, v] of rows) console.log((v / r.n).toFixed(2).padStart(6), 'MP', String(Math.round(r.N[k] / r.n)).padStart(5), 'x', k);
  const byN = Object.entries(r.N).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log('mais chamadas:'); for (const [k, v] of byN) console.log(String(Math.round(v / r.n)).padStart(6), 'x', k);
  await b.close();
})();
