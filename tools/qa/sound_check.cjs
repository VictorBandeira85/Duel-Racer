// Medida dos roncos e das buzinas sem ouvir: renderiza fora do tempo real (OfflineAudioContext) cada carro em
// marcha lenta, 3000 rpm em carga, giro máximo, alívio e num roteiro (rampa, troca de marcha, corte, alívio), e
// cada buzina; grava os áudios em <pasta>/<id>.f32 (mono 44,1 kHz) e <pasta>/index.json. A análise (tabela e
// espectrogramas) é do tools/qa/sound_report.py. Uso (vite rodando): node tools/qa/sound_check.cjs <pasta> [porta]
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2] || '.';
const port = process.argv[3] || '5173';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${port}/`);
  await p.waitForTimeout(2500);
  const cars = await p.evaluate(() => window.app.cars.map((c) => [c.id, c.engine, c.name]));
  const index = { sr: 44100, cars: [], horns: [] };
  for (const [id, engine, name] of cars) {
    const r = await p.evaluate(async ([id, engine]) => {
      const m = await import('/src/enginesynth.ts');
      const spec = m.engineSpec(engine, id, true);
      const sr = 44100;
      const url = URL.createObjectURL(new Blob([m.WORKLET], { type: 'application/javascript' }));
      const render = async (secs, opts) => {
        const ctx = new OfflineAudioContext(1, sr * secs, sr);
        await ctx.audioWorklet.addModule(url);
        const node = new AudioWorkletNode(ctx, 'engine-synth', { numberOfInputs: 0, outputChannelCount: [1], processorOptions: { spec, on: 1, snap: true, ...opts } });
        const g = ctx.createGain();
        g.gain.value = 0.1; // o mesmo ganho do jogo (synthGain)
        node.connect(g).connect(ctx.destination);
        return (await ctx.startRendering()).getChannelData(0);
      };
      const rl = (rpm) => Math.sqrt(Math.max(0, rpm * rpm - spec.idle * spec.idle)) / spec.redline; // rpm real -> comando
      const parts = [
        await render(2, { rpm: 0, load: 0 }),
        await render(2, { rpm: rl(3000), load: 1 }),
        await render(2, { rpm: 0.98, load: 1 }),
        await render(2, { rpm: 0.6, load: 0 }),
        await render(5, { sweep: [[0, 0, 0], [0.5, 0.1, 1], [2.5, 1.0, 1], [2.5, 0.62, 1], [3.5, 1.05, 1], [4.2, 1.05, 0], [5, 0.45, 0], [6, 0.45, 0]] }),
      ];
      const all = new Float32Array(parts.reduce((a, x) => a + x.length, 0));
      let o = 0;
      for (const x of parts) { all.set(x, o); o += x.length; }
      const u8 = new Uint8Array(all.buffer);
      let bin = '';
      for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
      return { spec: { name: spec.name, cyl: spec.cyl, idle: spec.idle, redline: spec.redline, turbo: spec.turbo, cabin: spec.cabin, horn: spec.horn }, b64: btoa(bin) };
    }, [id, engine]);
    fs.writeFileSync(`${out}/${id}.f32`, Buffer.from(r.b64, 'base64'));
    index.cars.push({ id, name, engine, ...r.spec });
    process.stdout.write('.');
  }
  // buzinas: 1,2 s de cada tipo (as do jogador e as do trânsito)
  const horns = await p.evaluate(async () => {
    const h = await import('/src/horn.ts');
    const sr = 44100, res = [];
    for (const [k, def] of Object.entries(h.HORNS)) {
      const ctx = new OfflineAudioContext(1, sr * 1.2, sr);
      const v = h.hornVoice(ctx, def, ctx.destination);
      v.on(0.05, 1);
      v.off(0.9);
      const d = (await ctx.startRendering()).getChannelData(0);
      const u8 = new Uint8Array(d.buffer);
      let bin = '';
      for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
      res.push({ id: k, notes: def.notes, b64: btoa(bin) });
    }
    return res;
  });
  for (const h of horns) {
    fs.writeFileSync(`${out}/horn-${h.id}.f32`, Buffer.from(h.b64, 'base64'));
    index.horns.push({ id: h.id, notes: h.notes });
  }
  fs.writeFileSync(`${out}/index.json`, JSON.stringify(index, null, 1));
  console.log('\n', cars.length, 'carros,', horns.length, 'buzinas', errs.slice(0, 3));
  await b.close();
})();
