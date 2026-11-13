// Relevo de todas as pistas (todos os trechos dos roteiros do Arcade e dos eventos da carreira):
// para cada crista, com o carro na borda dela e logo depois, mede quanto da pista à frente fica
// escondido — atrás do relevo ("escondido pela crista") e também abaixo do painel, com a câmera
// inclinada como em race.ts ("fora da tela"). Lista do pior trecho para o melhor.
// Uso (vite rodando): node tools/qa/relief_check.cjs   (PORT=5189 para outra porta)
// Depois de mexer no relevo (relief/hill em track.ts), nenhum trecho pode passar de ~20 segmentos.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 5173;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); p.on('crash', () => console.log('CRASH')); p.on('pageerror', (e) => console.log('ERRO', e.message));
  await p.goto(`http://localhost:${PORT}/src/style.css`); // página sem o jogo: não recarrega quando alguém salva um arquivo
  const res = await p.evaluate(async () => {
    const T = await import('/src/track.ts'), C = await import('/src/courses.ts'), K = await import('/src/career.ts'), TH = await import('/src/themes.ts');
    const list = [];
    for (const co of C.COURSES) co.stages.forEach((st, k) => list.push({ name: `${co.id}#${k + 1}`, st, seed: (co.seed ?? co.id.length * 1000) + k * 97 + 11 }));
    for (const rg of K.REGIONS) for (const ev of rg.events) { const co = K.eventCourse(ev, 0); co.stages.forEach((st, k) => list.push({ name: `${ev.id}#${k + 1}`, st, seed: co.seed + k * 97 + 11 })); }
    const out = [];
    for (const it of list) {
      const tr = T.buildTrack({ ...it.st }, TH.THEMES[it.st.theme], it.seed);
      const S = tr.segments, N = S.length, a = tr.startZ / 200, z = tr.finishZ / 200;
      let worst = 0, at = -1, maxSlope = 0, sum = 0, cnt = 0;
      for (let i = 0; i + 1 < N; i++) maxSlope = Math.max(maxSlope, Math.abs(S[i].p2.world.y - S[i].p1.world.y) / 200);
      const Y = (i) => S[Math.max(0, Math.min(N - 1, i))].p1.world.y;
      const crests = [];
      for (let c = a + 2; c < z; c++) {
        let top = true;
        for (let d = 1; d <= 20 && top; d++) if (Y(c - d) > Y(c) || Y(c + d) > Y(c)) top = false;
        let lo = Infinity; for (let d = 0; d <= 60; d++) lo = Math.min(lo, Y(c + d));
        if (top && Y(c) - lo > 100) { while (c < N - 2 && Y(c + 1) >= Y(c) - 2) c++; crests.push(c); c += 10; } // c: a borda (onde a pista começa a cair)
      }
      // na tela: a câmera inclina como em race.ts (inclinação embaixo do carro e uns segmentos à
      // frente) e o painel cobre o que fica abaixo da linha dele (~linha 100 dos 240, horizonte em
      // 65, K 190)
      const sl = (k) => (S[Math.max(0, Math.min(N - 1, k))].p2.world.y - S[Math.max(0, Math.min(N - 1, k))].p1.world.y) / 200;
      const cl = (v, a, b) => Math.max(a, Math.min(b, v));
      const pitchAt = (i, nA) => {
        let ah = 0, ws = 0, far = 0;
        for (let k = 1; k <= nA; k++) { const sk = sl(i + k); const wk = 1.25 - k / nA; ah += sk * wk; ws += wk; if (k >= 2 && k <= 5) far += sk / 4; }
        ah = cl(ah / ws, -0.8, 0.6);
        let g = cl(sl(i + 2), -0.6, 0.6) * 0.2 + cl(sl(i), -0.6, 0.6) * 0.35 + ah * 0.45;
        if (far < g) g = g + (cl(far, -0.8, 0) - g) * 0.35;
        return Math.max(g, -110 / (190 * 0.839));
      };
      const D = (100 - 65) / (190 * 0.839);
      let screenWorst = 0, screenAt = -1;
      for (const c of crests) for (let i = c + 3; i <= Math.min(c + 6, z); i++) for (const nA of [6, 10]) {
        const yc = S[i].p1.world.y + 600, pc = pitchAt(i, nA);
        // maior trecho seguido de pista fora da tela (atrás do relevo ou abaixo do painel), começando
        // da crista em diante e a até 60 segmentos; os primeiros 15 ficam sempre sob o capô/painel
        let maxS = -Infinity, run = 0, first = -1;
        for (let j = i + 1; j < Math.min(N, i + 200); j++) {
          const r = (S[j].p1.world.y - yc) / ((j - i) * 200);
          const vis = r > maxS; if (vis) maxS = r;
          if (j < Math.max(c, i + 15)) continue;
          if (vis && r > pc - D) { if (first >= 0) break; } else { if (first < 0) { if (j - i > 60) break; first = j; } run++; }
        }
        if (run > screenWorst) { screenWorst = run; screenAt = i; }
      }
      const cams = new Set(); for (const c of crests) for (let i = c; i <= c + 3; i++) cams.add(i);
      for (const i of cams) { if (i >= z) continue;
        const yc = S[i].p1.world.y + 600;
        let maxS = -Infinity, run = 0, first = -1;
        for (let j = i + 2; j < Math.min(N, i + 200); j++) {
          const sl = (S[j].p1.world.y - yc) / ((j - i) * 200);
          if (sl > maxS) { maxS = sl; if (first >= 0) break; } else { if (first < 0) { if (j - i > 60) break; first = j; } run++; }
        }
        if (run > 0) { sum += run; cnt++; }
        if (run > worst) { worst = run; at = i; }
      }
      out.push({ name: it.name, worst, at, screenWorst, screenAt, crests: crests.length, maxSlope: +maxSlope.toFixed(2), hills: it.st.hilliness });
    }
    return out;
  });
  res.sort((x, y) => y.screenWorst - x.screenWorst || y.worst - x.worst);
  for (const r of res) console.log(`${r.name.padEnd(16)} escondido pela crista ${String(r.worst).padStart(3)} seg (seg ${r.at}); fora da tela (relevo ou painel) ${String(r.screenWorst).padStart(3)} seg (seg ${r.screenAt}); ${r.crests} cristas;  inclinação máx ${r.maxSlope}  hilliness ${r.hills}`);
  const w = res.map((r) => r.worst);
  console.log(`trechos: ${res.length}; escondido pela crista: acima de 25: ${w.filter((x) => x > 25).length}, pior ${Math.max(...w)}`);
  const v = res.map((r) => r.screenWorst);
  console.log(`fora da tela: acima de 30: ${v.filter((x) => x > 30).length}, acima de 50: ${v.filter((x) => x > 50).length}, pior ${Math.max(...v)}`);
  await b.close();
})();
