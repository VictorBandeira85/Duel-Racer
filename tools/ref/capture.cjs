// Captura o quadro da corrida em pixels nativos (256 de largura) para comparar com referências.
// Uso: node tools/ref/capture.cjs <saida.png> <carro> <percurso> <trecho>  (servidor em localhost:5173)
const { chromium } = require('playwright');
const [out, car = '0', course = '0', stage = '1'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 588, height: 450 } }); // 256 px de largura útil
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5173/');
  await p.waitForTimeout(1200);
  await p.evaluate(([car, course, stage]) => {
    const a = window.app;
    Object.assign(a.state, { carIdx: car, oppIdx: 2, courseIdx: course, results: Array(stage).fill({ time: 60, rival: 61, clean: true, crashes: 0, tickets: 0 }) });
    a.actions.nextStage();
    const r = a.race;
    r.state = 'drive'; r.update = () => {}; r.time = 5; r.speed = 0; r.gear = 0; r.rpm = 0.1;
    r.traffic.forEach((c) => (c.z += 1e7));
    r.rival.z += 1e7;
  }, [+car, +course, +stage]);
  await p.waitForTimeout(400);
  const data = await p.evaluate(() => document.getElementById('game').toDataURL('image/png'));
  require('fs').writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  const w = await p.evaluate(() => document.getElementById('game').width);
  console.log('largura do quadro:', w, 'erros:', JSON.stringify(errs));
  await b.close();
})();
