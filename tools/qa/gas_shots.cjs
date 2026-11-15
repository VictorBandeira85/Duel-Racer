// Conferência dos faróis no posto (dia e noite): cada carro parado na bomba, em 932x430, e uma folha
// com todos (dia em cima, noite embaixo, recorte ampliado do carro). Olhar: lente acesa no farol de
// verdade (escamoteáveis LEVANTADOS), poça de luz começando no para-choque, lanterna vermelha atrás.
// Uso (vite rodando): PORT=5173 node tools/qa/gas_shots.cjs <pasta> [id ...]
//   -> <pasta>/<id>_dia.png, <id>_noite.png e <pasta>/gas_sheet.png
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2];
const only = process.argv.slice(3);
const PORT = process.env.PORT || 5173;
const W = 932, H = 430;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1) });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForTimeout(2500);
  const ids = await p.evaluate(() => window.app.cars.map((c) => c.id));
  const shots = [];
  for (const id of ids) {
    if (only.length && !only.includes(id)) continue;
    for (const night of [false, true]) {
      // (o vite pode recarregar a página no meio: espera o jogo de novo)
      await p.waitForFunction(() => window.app && window.app.state, null, { timeout: 30000 });
      // espera a arte do carro antes de abrir a tela (o relógio da chegada começa no primeiro quadro)
      await p.waitForFunction((id) => window.app.artReady.car(id), id, { timeout: 15000 }).catch(() => {});
      await p.evaluate(([id, night]) => {
        const a = window.app, s = a.state;
        const car = a.cars.find((c) => c.id === id);
        s.carIdx = a.cars.indexOf(car);
        s.playerCar = car;
        s.results = [...(s.results || []), { time: 60, rival: 70, crashes: 0, tickets: 0, clean: false, top: 200, fines: 0 }];
        s.gasPage = 0;
        s.gasNight = night;
        a.actions.go('gas');
      }, [id, night]);
      // adianta o relógio da tela até o carro parar na bomba (antes de o frentista chegar à traseira)
      await p.waitForTimeout(300);
      await p.evaluate(() => { window.app.state.t += 2.3; });
      await p.waitForTimeout(350);
      const f = path.join(out, `${id}_${night ? 'noite' : 'dia'}.png`);
      await p.screenshot({ path: f });
      shots.push({ id, night, f });
    }
  }
  // folha: por carro, o recorte da bomba (dia | noite) ampliado 2x, em 3 colunas
  const fs = require('fs');
  const data = shots.map((s) => ({ ...s, src: 'data:image/png;base64,' + fs.readFileSync(s.f).toString('base64') }));
  const sheet = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await sheet.setContent('<body style="margin:0;background:#222"><canvas id=c></canvas></body>');
  const clip = [...JSON.parse(process.env.CLIP || '[220,180,450,116]'), Number(process.env.ZOOM || 1.25)]; // x, y, w, h da tela (carro na bomba), ampliação
  await sheet.evaluate(async ([data, clip]) => {
    const Z = clip[4], cw = clip[2] * Z, ch = clip[3] * Z, lab = 16, cols = 2;
    const cars = [...new Set(data.map((d) => d.id))];
    const cellW = cw * 2 + 6, cellH = ch + lab;
    const cv = document.getElementById('c');
    cv.width = cols * (cellW + 10);
    cv.height = Math.ceil(cars.length / cols) * (cellH + 10);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#222'; g.fillRect(0, 0, cv.width, cv.height);
    for (const [i, id] of cars.entries()) {
      const x0 = (i % cols) * (cellW + 10), y0 = Math.floor(i / cols) * (cellH + 10);
      g.fillStyle = '#fff'; g.font = '13px monospace'; g.fillText(id, x0 + 4, y0 + 12);
      for (const d of data.filter((d) => d.id === id)) {
        const im = new Image(); im.src = d.src; await im.decode();
        g.drawImage(im, clip[0], clip[1], clip[2], clip[3], x0 + (d.night ? cw + 6 : 0), y0 + lab, cw, ch);
      }
    }
  }, [data, clip]);
  const cv = await sheet.$('#c');
  await cv.screenshot({ path: path.join(out, 'gas_sheet.png') });
  console.log(errs.slice(0, 5), shots.length);
  await b.close();
})();
