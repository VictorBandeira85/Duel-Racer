// Telas extras da oficina de preparação (carreira, Arcade e catálogo): DINAMÔMETRO e CÂMBIO.
// - Dinamômetro (dyno.ts): o carro "roda no rolo" com o ronco subindo; curva de potência e torque com as
//   peças instaladas (traço cheio), a de fábrica (tracejado) e a das peças em vista (pontilhado), em papel
//   milimetrado de revista, com os máximos marcados.
// - Câmbio (gearbox.ts): cada marcha e o diferencial mais curtos ou mais longos, com a velocidade de cada
//   marcha no corte, o gráfico giro x velocidade e o efeito medido na física (0-100, 0-160, máxima).
// A tela de preparação (careerScreens.ts) monta o ShopCtx e repassa desenho, toque, teclas e foco.
import { setEngine, setEngineProfile, starterSound } from './audio';
import type { CarSpec } from './cars';
import { KMH } from './config';
import { dynoRun, PULL_S, type DynoRun } from './dyno';
import { MAX_STEP, STEP, gearingKey, gearsWith, isStock, realTop, runOf, stepGearing, type Gearing } from './gearbox';
import { BLUE, GREY, INK, RED, YELLOW, arrow, box, headline, ink, kicker, tag } from './mag';
import type { MenuKey } from './screens';
import { ox } from './screens';
import { inside, type FocusSet, type Focusable, type Rect } from './ui';
import type { Build } from './tuning';

export interface ShopCtx {
  car: CarSpec; // carro de fábrica (o da lista)
  /** o carro com estas peças e este câmbio (com os ajustes e o desgaste do jogador) */
  tuned: (b: Build, g?: Gearing) => CarSpec;
  cur: Build; // peças instaladas
  view: Build; // peças em vista
  gearing: Gearing | undefined; // câmbio salvo
  /** guarda o câmbio (carreira/Arcade); devolve a mensagem (catálogo: só mostra) */
  save: (g: Gearing | undefined) => string;
  flash: (msg: string) => void;
  t: number; // relógio da tela (s)
  where: 'career' | 'arcade' | 'demo';
}
export const shop = { mode: '' as '' | 'dyno' | 'gears', t0: 0, draft: {} as Gearing, row: 0, fromGarage: false, sound: false };

// botões na tela de preparação (acima do quadro COMO FICA)
export const shopTags = () => ({ dyno: { x: ox() + 208, y: 31, w: 60, h: 10 } as Rect, gears: { x: ox() + 271, y: 31, w: 45, h: 10 } as Rect });
export function drawShopTags(c: CanvasRenderingContext2D, ctx: ShopCtx) {
  const b = shopTags();
  tag(c, b.dyno, 'DINAMÔMETRO', false, 4);
  tag(c, b.gears, isStock(ctx.gearing) ? 'CÂMBIO' : 'CÂMBIO •', !isStock(ctx.gearing), 4);
}
export function openDyno(ctx: ShopCtx) {
  shop.mode = 'dyno';
  shop.t0 = ctx.t;
  shop.sound = false;
}
export function openGears(ctx: ShopCtx, fromGarage = false) {
  shop.mode = 'gears';
  shop.draft = { gears: ctx.car.gears.map((_, i) => ctx.gearing?.gears?.[i] ?? 0), final: ctx.gearing?.final ?? 0 };
  shop.row = 0;
  shop.fromGarage = fromGarage;
}
/** fecha a tela extra; devolve true se era para voltar direto à garagem (câmbio aberto de lá) */
export function closeShop(): boolean {
  const g = shop.fromGarage && shop.mode === 'gears';
  if (shop.mode === 'dyno') setEngine(0, false, false);
  shop.mode = '';
  shop.fromGarage = false;
  return g;
}
const buttons = () => {
  const x = ox();
  return { back: { x: x + 4, y: 211, w: 100, h: 15 } as Rect, mid: { x: x + 110, y: 211, w: 100, h: 15 } as Rect, ok: { x: x + 216, y: 211, w: 100, h: 15 } as Rect };
};
const fmt = (v: number, d = 0) => v.toFixed(d).replace('.', ',');
const thousands = (v: number) => Math.round(v).toLocaleString('pt-BR');
const rpmFmt = (v: number) => (Math.round(v / 50) * 50).toLocaleString('pt-BR'); // giro de 50 em 50, como se lê no papel

// ================= DINAMÔMETRO =================
const runs = new Map<string, DynoRun>();
function runFor(ctx: ShopCtx, b: Build, key: string) {
  const k = `${ctx.car.id}|${key}`;
  let r = runs.get(k);
  if (!r) {
    if (runs.size > 40) runs.clear();
    runs.set(k, (r = dynoRun(ctx.car, ctx.tuned(b, ctx.gearing))));
  }
  return r;
}
const bkey = (b: Build) => Object.entries(b).filter(([, v]) => v).sort().map(([k, v]) => `${k}=${v}`).join(',');
const niceMax = (v: number, steps: number[]) => steps.find((s) => s >= v * 1.08) ?? Math.ceil((v * 1.08) / 100) * 100;
const chartRect = (): Rect => ({ x: ox() + 4, y: 33, w: 226, h: 172 });

/** papel milimetrado: quadradinhos de 2 px, linha mais forte a cada 10 */
function graphPaper(c: CanvasRenderingContext2D, r: Rect) {
  c.fillStyle = '#f7f1dc';
  c.fillRect(r.x, r.y, r.w, r.h);
  for (let gx = 0; gx <= r.w; gx += 2) {
    c.fillStyle = gx % 20 === 0 ? 'rgba(214,120,60,0.45)' : gx % 10 === 0 ? 'rgba(214,120,60,0.25)' : 'rgba(214,120,60,0.1)';
    c.fillRect(r.x + gx, r.y, 1, r.h);
  }
  for (let gy = 0; gy <= r.h; gy += 2) {
    c.fillStyle = gy % 20 === 0 ? 'rgba(214,120,60,0.45)' : gy % 10 === 0 ? 'rgba(214,120,60,0.25)' : 'rgba(214,120,60,0.1)';
    c.fillRect(r.x, r.y + r.h - gy, r.w, 1);
  }
}
function polyline(c: CanvasRenderingContext2D, pts: [number, number][], color: string, w: number, dash: number[] = []) {
  if (pts.length < 2) return;
  c.save();
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineJoin = 'round';
  c.setLineDash(dash);
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
  c.restore();
}
export function drawDyno(c: CanvasRenderingContext2D, ctx: ShopCtx) {
  const x = ox();
  const t = ctx.t - shop.t0;
  const mine = runFor(ctx, ctx.cur, bkey(ctx.cur));
  const stock = runFor(ctx, {}, '');
  const viewDiff = bkey(ctx.view) !== bkey(ctx.cur);
  const seen = viewDiff ? runFor(ctx, ctx.view, bkey(ctx.view)) : null;
  kicker(c, 'DINAMÔMETRO', x + 4, 20, RED, '#fff');
  headline(c, ctx.car.name.toUpperCase(), x + 70, 21, 6, INK);
  // eixos: giro embaixo (x1000 rpm); cv à esquerda, kgfm à direita
  const pr = chartRect();
  const pad = { l: 18, r: 18, t: 6, b: 12 };
  const plot: Rect = { x: pr.x + pad.l, y: pr.y + pad.t, w: pr.w - pad.l - pad.r, h: pr.h - pad.t - pad.b };
  c.fillStyle = INK;
  c.fillRect(pr.x - 1, pr.y - 1, pr.w + 2, pr.h + 2);
  graphPaper(c, pr);
  const all = [mine, stock, ...(seen ? [seen] : [])];
  const cvTop = niceMax(Math.max(...all.map((d) => d.peakCv.cv)), [50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 1000, 1200]);
  const tTop = niceMax(Math.max(...all.map((d) => d.peakT.kgfm)), [10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 150]);
  const red = mine.redline;
  const X = (rpm: number) => plot.x + (rpm / red) * plot.w;
  const Ycv = (v: number) => plot.y + plot.h - (v / cvTop) * plot.h;
  const Yt = (v: number) => plot.y + plot.h - (v / tTop) * plot.h;
  // marcas e números dos eixos
  for (let k = 0; k * 1000 <= red + 1; k++) {
    const gx = Math.round(X(k * 1000));
    c.fillStyle = 'rgba(26,22,20,0.5)';
    c.fillRect(gx, plot.y + plot.h, 1, 3);
    ink(c, String(k), gx, plot.y + plot.h + 4, 4, INK, 'center');
  }
  ink(c, 'x1000 rpm', plot.x + plot.w, pr.y + pr.h - 6, 4, GREY, 'right');
  for (let k = 0; k <= 5; k++) {
    const gy = Math.round(plot.y + plot.h - (k / 5) * plot.h);
    ink(c, thousands((cvTop * k) / 5), plot.x - 2, gy - 2, 4, RED, 'right');
    ink(c, fmt((tTop * k) / 5, tTop < 30 ? 0 : 0), plot.x + plot.w + 2, gy - 2, 4, BLUE);
  }
  ink(c, 'cv', pr.x + 2, pr.y + 1, 4, RED);
  ink(c, 'kgfm', pr.x + pr.w - 2, pr.y + 1, 4, BLUE, 'right');
  c.fillStyle = 'rgba(26,22,20,0.7)';
  c.fillRect(plot.x, plot.y, 1, plot.h + 1);
  c.fillRect(plot.x, plot.y + plot.h, plot.w, 1);
  c.fillRect(plot.x + plot.w, plot.y, 1, plot.h + 1);
  const curve = (d: DynoRun, upto: number, which: 'cv' | 'kgfm') => d.pts.slice(0, upto + 1).map((p): [number, number] => [X(p.rpm), which === 'cv' ? Ycv(p.cv) : Yt(p.kgfm)]);
  // fábrica tracejada, em vista pontilhada, a medida (instalada) em traço cheio, desenhando conforme roda
  polyline(c, curve(stock, stock.pts.length, 'cv'), 'rgba(208,31,38,0.55)', 1, [3, 2]);
  polyline(c, curve(stock, stock.pts.length, 'kgfm'), 'rgba(30,79,184,0.55)', 1, [3, 2]);
  if (seen) {
    polyline(c, curve(seen, seen.pts.length, 'cv'), '#e07010', 1.2, [1, 1.5]);
    polyline(c, curve(seen, seen.pts.length, 'kgfm'), '#1a9ab0', 1.2, [1, 1.5]);
  }
  const p = Math.max(0, Math.min(1, (t - 0.6) / PULL_S));
  const n = mine.pts.length - 1, upto = Math.round(p * n);
  polyline(c, curve(mine, upto, 'cv'), RED, 2);
  polyline(c, curve(mine, upto, 'kgfm'), BLUE, 2);
  const now = mine.pts[upto];
  // ronco: o giro do rolo subindo com o pé no fundo; no fim, tira o pé e volta à lenta
  const tuned = ctx.tuned(ctx.cur, ctx.gearing);
  if (!shop.sound) {
    shop.sound = true;
    setEngineProfile(tuned.engine, ctx.car.id, tuned.soundMods);
    starterSound();
  }
  if (t < 0.6) setEngine(0.1, false, true);
  else if (p < 1) setEngine(Math.max(0.1, now.r), 1, true, tuned.forced === 'turbo' || tuned.curve === 'turbo' || tuned.curve === 'seqturbo' ? now.boost : 0);
  else if (t < 0.6 + PULL_S + 1.6) setEngine(Math.max(0.1, 1 - (t - 0.6 - PULL_S) * 0.8), false, true);
  else setEngine(0.1, false, true);
  if (p > 0 && p < 1) {
    // cursor do giro e leitura ao vivo
    const gx = Math.round(X(now.rpm));
    c.fillStyle = 'rgba(26,22,20,0.55)';
    c.fillRect(gx, plot.y, 1, plot.h);
    c.fillStyle = INK;
    c.fillRect(plot.x + 3, plot.y + 3, 70, 24);
    ink(c, `${rpmFmt(now.rpm)} rpm`, plot.x + 6, plot.y + 5, 4, YELLOW);
    ink(c, `${thousands(now.cv)} cv`, plot.x + 6, plot.y + 12, 5, '#ff8a80');
    ink(c, `${fmt(now.kgfm, 1)} kgfm`, plot.x + 6, plot.y + 19, 4, '#9ec4ff');
    if (tuned.forced === 'turbo' && tuned.boostMax) ink(c, `${fmt(now.boost * tuned.boostMax, 1)} bar`, plot.x + 70, plot.y + 19, 4, '#fff', 'right');
  }
  if (p >= 1) {
    // máximos: bolinha no ponto e o número ao lado
    const mark = (q: { rpm: number; v: number; y: number }, color: string, label: string, below: boolean) => {
      const mx = X(q.rpm);
      c.fillStyle = INK;
      c.fillRect(Math.round(mx) - 2, Math.round(q.y) - 2, 5, 5);
      c.fillStyle = color;
      c.fillRect(Math.round(mx) - 1, Math.round(q.y) - 1, 3, 3);
      const right = mx < plot.x + plot.w * 0.6;
      ink(c, label, mx + (right ? 4 : -4), q.y + (below ? 3 : -8), 4, color, right ? 'left' : 'right');
    };
    mark({ rpm: mine.peakCv.rpm, v: mine.peakCv.cv, y: Ycv(mine.peakCv.cv) }, RED, `${thousands(mine.peakCv.cv)} cv`, false);
    mark({ rpm: mine.peakT.rpm, v: mine.peakT.kgfm, y: Yt(mine.peakT.kgfm) }, BLUE, `${fmt(mine.peakT.kgfm, 1)} kgfm`, true);
  }
  // quadro do resultado
  const fr: Rect = { x: x + 234, y: 33, w: 82, h: 172 };
  box(c, fr, 'RESULTADO');
  let yy = fr.y + 13;
  const block = (title: string, d: DynoRun, style: string, color: string) => {
    ink(c, title, fr.x + 3, yy, 4, color);
    ink(c, style, fr.x + fr.w - 3, yy, 4, GREY, 'right');
    ink(c, `${thousands(d.peakCv.cv)} cv`, fr.x + 3, yy + 7, 5, RED);
    ink(c, `a ${rpmFmt(d.peakCv.rpm)}`, fr.x + fr.w - 3, yy + 8, 4, GREY, 'right');
    ink(c, `${fmt(d.peakT.kgfm, 1)} kgfm`, fr.x + 3, yy + 15, 5, BLUE);
    ink(c, `a ${rpmFmt(d.peakT.rpm)}`, fr.x + fr.w - 3, yy + 16, 4, GREY, 'right');
    yy += 27;
  };
  const done = p >= 1;
  if (done) block('INSTALADAS', mine, '━━', INK);
  else {
    ink(c, 'NO ROLO...', fr.x + 3, yy, 5, RED);
    ink(c, `${Math.round(p * 100)}%`, fr.x + fr.w - 3, yy, 5, INK, 'right');
    yy += 27;
  }
  block('DE FÁBRICA', stock, '- -', GREY);
  if (seen) block('EM VISTA', seen, '···', '#c06008');
  if (done) {
    const gain = mine.peakCv.cv - stock.peakCv.cv;
    c.fillStyle = gain >= 0 ? '#1a6a2a' : RED;
    c.fillRect(fr.x + 3, yy, fr.w - 6, 11);
    ink(c, `${gain >= 0 ? 'GANHO +' : 'PERDA -'}${thousands(Math.abs(gain))} cv`, fr.x + fr.w / 2, yy + 3.5, 4, '#fff', 'center');
    yy += 15;
  }
  ink(c, 'Medido na física do jogo,', fr.x + 3, fr.y + fr.h - 16, 4, GREY);
  ink(c, 'puxada de 5 s no rolo.', fr.x + 3, fr.y + fr.h - 9, 4, GREY);
  const b = buttons();
  tag(c, b.back, '◀ VOLTAR');
  tag(c, b.ok, 'RODAR DE NOVO', done);
}

// ================= CÂMBIO =================
const gearRows = (n: number) => Array.from({ length: n + 1 }, (_, i): Rect => ({ x: ox() + 182, y: 33 + i * Math.min(15, 104 / (n + 1)), w: 134, h: Math.min(15, 104 / (n + 1)) - 2 }));
const ordinal = (i: number) => `${i + 1}ª`;
export function drawGears(c: CanvasRenderingContext2D, ctx: ShopCtx) {
  const x = ox();
  const car = ctx.car;
  kicker(c, 'CÂMBIO', x + 4, 20, RED, '#fff');
  headline(c, car.name.toUpperCase(), x + 44, 21, 6, INK);
  const now = ctx.tuned(ctx.cur, undefined); // relações originais, com as peças instaladas
  const draft = ctx.tuned(ctx.cur, shop.draft);
  const vmax = now.maxSpeed * KMH;
  const base = gearsWith(car.gears, undefined), mine = gearsWith(car.gears, shop.draft);
  const n = base.length;
  // gráfico giro x velocidade: cada marcha sobe do giro em que entra até o corte (dente de serra)
  const pr: Rect = { x: x + 4, y: 33, w: 174, h: 106 };
  c.fillStyle = INK;
  c.fillRect(pr.x - 1, pr.y - 1, pr.w + 2, pr.h + 2);
  graphPaper(c, pr);
  const plot: Rect = { x: pr.x + 14, y: pr.y + 5, w: pr.w - 20, h: pr.h - 17 };
  const vTop = Math.ceil((Math.max(...mine, ...base) * vmax * 1.04) / 50) * 50;
  const X = (v: number) => plot.x + (v / vTop) * plot.w;
  const Y = (r: number) => plot.y + plot.h - r * plot.h;
  for (let v = 0; v <= vTop; v += 50) {
    c.fillStyle = 'rgba(26,22,20,0.5)';
    c.fillRect(Math.round(X(v)), plot.y + plot.h, 1, 3);
    if (v % 100 === 0) ink(c, String(v), X(v), plot.y + plot.h + 4, 4, INK, 'center');
  }
  ink(c, 'km/h', plot.x + plot.w, pr.y + 1, 4, GREY, 'right');
  ink(c, 'giro', pr.x + 2, pr.y + 1, 4, GREY);
  for (let k = 0; k <= 4; k++) c.fillRect(plot.x - 3, Math.round(Y(k / 4)), 3, 1);
  c.fillStyle = 'rgba(26,22,20,0.7)';
  c.fillRect(plot.x, plot.y, 1, plot.h + 1);
  c.fillRect(plot.x, plot.y + plot.h, plot.w, 1);
  // corte (linha vermelha) e a máxima de ficha (linha cinza)
  c.fillStyle = 'rgba(208,31,38,0.5)';
  c.fillRect(plot.x, Math.round(Y(1)), plot.w, 1);
  const saw = (g: number[], color: string, w: number, dash: number[]) => g.forEach((v, i) => {
    const from = i ? g[i - 1] / v : 0;
    polyline(c, [[X(i ? g[i - 1] * vmax : 0), Y(from)], [X(v * vmax), Y(1)]], color, w, dash);
    if (i < g.length - 1) polyline(c, [[X(v * vmax), Y(1)], [X(v * vmax), Y(v / g[i + 1])]], color, w * 0.6, dash);
  });
  saw(base, 'rgba(26,22,20,0.45)', 1, [3, 2]);
  saw(mine, RED, 1.6, []);
  mine.forEach((v, i) => ink(c, String(i + 1), X(v * vmax) - 2, Y(1) - 6, 4, i === shop.row ? RED : INK, 'right'));
  const topD = realTop(draft, now.gears);
  c.fillStyle = 'rgba(30,79,184,0.65)';
  c.fillRect(Math.round(X(topD)), plot.y, 1, plot.h);
  ink(c, `máx ${Math.round(topD)}`, X(topD) + (X(topD) > plot.x + plot.w - 30 ? -2 : 2), plot.y + plot.h - 8, 4, BLUE, X(topD) > plot.x + plot.w - 30 ? 'right' : 'left');
  // linhas das marchas e do diferencial: ◀ velocidade no corte ▶ e quanto mudou
  const rows = gearRows(n);
  rows.forEach((r, i) => {
    const fin = i === n;
    const hot = i === shop.row;
    const step = fin ? shop.draft.final ?? 0 : shop.draft.gears?.[i] ?? 0;
    c.fillStyle = hot ? INK : step ? '#fff1c8' : '#f6efdd';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = hot ? RED : 'rgba(26,22,20,0.35)';
    c.lineWidth = hot ? 2 : 1;
    c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    const ty = r.y + r.h / 2 - 2.5;
    ink(c, fin ? 'DIF.' : ordinal(i), r.x + 3, ty, 5, hot ? YELLOW : INK);
    arrow(c, { x: r.x + 24, y: r.y + 1, w: 11, h: r.h - 2 }, 'left', hot);
    arrow(c, { x: r.x + 90, y: r.y + 1, w: 11, h: r.h - 2 }, 'right', hot);
    const val = fin ? `${step > 0 ? '+' : step < 0 ? '-' : ''}${Math.abs(step) * STEP * 100 || 0}%` : `${Math.round(mine[i] * vmax)} km/h`;
    ink(c, val, r.x + 62.5, ty, fin ? 5 : val.length > 8 ? 4 : 5, hot ? '#fff' : INK, 'center');
    const lab = !step ? 'orig.' : step > 0 ? `long ${step}` : `curt ${-step}`;
    ink(c, lab, r.x + r.w - 3, ty + 0.5, 4, hot ? YELLOW : step ? RED : GREY, 'right');
  });
  ink(c, `passos de ${STEP * 100}% · até ${MAX_STEP}`, x + 316, 33 + rows.length * Math.min(15, 104 / (n + 1)) + 1, 4, GREY, 'right');
  // efeito medido na física: original x ajustado
  const a = runOf(now), d = runOf(draft);
  const fr: Rect = { x: x + 4, y: 145, w: 312, h: 60 };
  box(c, fr, 'NA PISTA (medido na física)');
  const col = (lab: string, v0: number, v1: number, unit: string, dec: number, better: 'low' | 'high', cx: number) => {
    const f = (v: number) => (unit === 'rpm' ? rpmFmt(v) : fmt(v, dec));
    ink(c, lab, cx, fr.y + 14, 4, GREY);
    ink(c, `orig. ${f(v0)} ${unit}`, cx, fr.y + 22, 4, GREY);
    ink(c, `${f(v1)} ${unit}`, cx, fr.y + 31, 6, INK);
    const dd = v1 - v0;
    if (Math.abs(dd) >= 10 ** -dec / 2) {
      const good = better === 'low' ? dd < 0 : dd > 0;
      ink(c, `${dd > 0 ? '+' : '-'}${unit === 'rpm' ? rpmFmt(Math.abs(dd)) : fmt(Math.abs(dd), dec)}`, cx, fr.y + 42, 5, good ? '#1a6a2a' : RED);
    } else ink(c, 'igual', cx, fr.y + 42, 4, GREY);
  };
  col('0-100 km/h', a.t100, d.t100, 's', 1, 'low', fr.x + 6);
  col('0-160 km/h', a.t160 || 99, d.t160 || 99, 's', 1, 'low', fr.x + 84);
  col('MÁXIMA', vmax, topD, 'km/h', 0, 'high', fr.x + 162);
  // giro na última marcha a 110 km/h (estrada): diferencial longo, motor mais calmo
  const rpmAt = (g: number[]) => (110 / (g[n - 1] * vmax)) * (redOf(ctx));
  col('GIRO A 110', rpmAt(base), rpmAt(mine), 'rpm', 0, 'low', fr.x + 240);
  const b = buttons();
  tag(c, b.back, '◀ VOLTAR');
  tag(c, b.mid, 'ORIGINAL', false);
  const changed = gearingKey(shop.draft) !== gearingKey(ctx.gearing);
  tag(c, b.ok, ctx.where === 'demo' ? 'SÓ NA OFICINA' : changed ? (ctx.where === 'arcade' ? 'INSTALAR' : 'SALVAR') : 'SALVO', changed && ctx.where !== 'demo');
}
let redCache: [string, number] = ['', 0];
function redOf(ctx: ShopCtx) {
  if (redCache[0] !== ctx.car.id) redCache = [ctx.car.id, dynoRun(ctx.car, ctx.car, 2).redline];
  return redCache[1];
}
function gearStep(ctx: ShopCtx, i: number, d: number) {
  const n = ctx.car.gears.length;
  const r = stepGearing(ctx.car, shop.draft, i >= n ? -1 : i, d);
  if (typeof r === 'string') ctx.flash(r);
  else shop.draft = r;
}
function gearSave(ctx: ShopCtx) {
  if (ctx.where === 'demo') return ctx.flash('Catálogo: ajuste o câmbio na oficina da carreira ou do Arcade');
  if (gearingKey(shop.draft) === gearingKey(ctx.gearing)) return ctx.flash('Câmbio já está assim');
  ctx.flash(ctx.save(isStock(shop.draft) ? undefined : shop.draft));
}

// ================= toque, teclas e foco =================
/** toque com a tela extra aberta; devolve 'close' quando ela fechou (para a tela de preparação decidir) */
export function tapShop(ctx: ShopCtx, x: number, y: number): 'close' | 'garage' | '' {
  const b = buttons();
  if (inside(x, y, b.back)) return closeShop() ? 'garage' : 'close';
  if (shop.mode === 'dyno') {
    if (inside(x, y, b.ok) && ctx.t - shop.t0 > 0.6 + PULL_S) openDyno(ctx);
    return '';
  }
  if (inside(x, y, b.mid)) {
    shop.draft = { gears: ctx.car.gears.map(() => 0), final: 0 };
    return '';
  }
  if (inside(x, y, b.ok)) {
    gearSave(ctx);
    return '';
  }
  gearRows(ctx.car.gears.length).forEach((r, i) => {
    if (!inside(x, y, r)) return;
    shop.row = i;
    if (x < r.x + 37) gearStep(ctx, i, -1);
    else if (x > r.x + 88 && x < r.x + 103) gearStep(ctx, i, 1);
  });
  return '';
}
export function shopFocus(ctx: ShopCtx): FocusSet {
  const b = buttons();
  if (shop.mode === 'dyno') return { key: 'shop:dyno', items: [{ r: b.back }, { r: b.ok }], def: 1 };
  const rows = gearRows(ctx.car.gears.length).map((r, i): Focusable => ({ r, is: () => shop.row === i, pick: () => { shop.row = i; }, lr: (d) => gearStep(ctx, i, d), act: () => gearStep(ctx, i, 1) }));
  return { key: `shop:gears:${ctx.car.id}`, items: [...rows, { r: b.back }, { r: b.mid }, { r: b.ok }], def: 0 };
}
/** tecla 'back' (as outras ficam com o foco); devolve como em tapShop */
export function keyShop(k: MenuKey): 'close' | 'garage' | '' {
  if (k === 'back') return closeShop() ? 'garage' : 'close';
  return '';
}
