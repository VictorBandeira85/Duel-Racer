// REPLAY dos melhores momentos (resultado do trecho > REPLAY): os lances marcados na corrida
// (recorder.ts) passam um depois do outro com a câmera de fora (atrás, do lado, do alto, rasante),
// o carro do jogador, o rival e o trânsito nos lugares gravados. Salto e quase batida em câmera
// lenta. ◀◀/▶▶ pulam de lance, II pausa, CÂMERA troca a vista, SAIR volta ao resultado.
import { SAFE_W, view } from './config';
import { INK, RED, YELLOW, kicker, tag } from './mag';
import { closeOverlay, openOverlay, type Overlay } from './overlay';
import { renderOutside, type Cam, type Pose } from './outcam';
import { clips, frameAt, lookAt, recording, type Clip, type Recording } from './recorder';
import { focusRing, inside, text, type Rect } from './ui';
import { lastDevice } from './input';
import { lerp } from './util';
import { SEG_LEN } from './config';

const CAMS = ['AUTO', 'TRÁS', 'LADO', 'DO ALTO', 'RASANTE'] as const;

// câmera de cada lance (AUTO) ou a escolhida; k = 0..1 dentro do lance
function camFor(mode: (typeof CAMS)[number], clip: Clip, k: number, n: number): Cam {
  const side = n % 2 ? -1 : 1;
  if (mode === 'TRÁS') return { dist: 1500, orbit: 0, height: 820, aim: 0.8 };
  if (mode === 'LADO') return { dist: 1600, orbit: 0.42 * side, height: 700, aim: 0.8 };
  if (mode === 'DO ALTO') return { dist: 2500, orbit: 0, height: 2700, aim: 0.74 };
  if (mode === 'RASANTE') return { dist: 1000, orbit: 0.15 * side, height: 250, aim: 0.88 };
  switch (clip.kind) {
    case 'pass': case 'lost': return { dist: 1700 - 300 * k, orbit: side * (0.45 - 0.3 * k), height: 780, aim: 0.8 };
    case 'jump': return { dist: 1300, orbit: side * 0.3, height: 280, aim: 0.86 };
    case 'near': return { dist: 2100, orbit: side * 0.12, height: 1700, aim: 0.76 };
    case 'crash': return { dist: 2300, orbit: side * 0.25, height: 1500, aim: 0.76 };
    case 'finish': return { dist: 1500 + 500 * k, orbit: lerp(-0.45, 0.45, k), height: 700 + 600 * k, aim: 0.8 };
    default: return { dist: 1800, orbit: side * 0.2, height: 1000, aim: 0.78 };
  }
}

// põe a corrida no instante t da gravação, desenha e devolve tudo como estava
function atTime(R: Recording, t: number, draw: (pose: Pose, kmh: number) => void) {
  const r = R.race;
  const { a, b, u } = frameAt(R, t);
  const L = (p: number, q: number) => p + (q - p) * u;
  const pose: Pose = { z: L(a.z, b.z), x: L(a.x, b.x), lift: L(a.lift, b.lift), brake: a.brake, car: R.car, paint: R.paint };
  const keep = {
    nightK: r.nightK, rainK: r.rainK, bgOffset: r.bgOffset, inTunnel: r.inTunnel, officer: r.officer,
    rival: r.rival ? { z: r.rival.z, x: r.rival.x } : null,
    extras: r.extras.map((e) => ({ z: e.r.z, x: e.r.x })),
    traffic: r.traffic.map((c) => ({ z: c.z, x: c.x, tilt: c.tilt, model: c.model, color: c.color, truck: c.truck, car: c.car, plate: c.plate, base: c.base, fall: c.fall, panic: c.panic, signal: c.signal })),
    police: r.police.map((p) => p.z),
  };
  try {
    r.nightK = L(a.nightK, b.nightK);
    r.rainK = L(a.rainK, b.rainK);
    r.bgOffset = L(a.bg, b.bg);
    r.inTunnel = L(a.tunnel, b.tunnel);
    r.officer = null;
    if (r.rival && Number.isFinite(a.rz)) {
      r.rival.z = Number.isFinite(b.rz) ? L(a.rz, b.rz) : a.rz;
      r.rival.x = Number.isFinite(b.rx) ? L(a.rx, b.rx) : a.rx;
    }
    r.extras.forEach((e, k) => {
      if (a.ex.length > k * 2 + 1) {
        e.r.z = L(a.ex[k * 2], b.ex[k * 2] ?? a.ex[k * 2]);
        e.r.x = L(a.ex[k * 2 + 1], b.ex[k * 2 + 1] ?? a.ex[k * 2 + 1]);
      }
    });
    for (const c of r.traffic) c.z = -1e9;
    const bm = new Map<number, number>();
    for (let k = 0; k < b.tr.length; k += 4) bm.set(b.tr[k], k);
    for (let k = 0; k < a.tr.length; k += 4) {
      const i = a.tr[k], c = r.traffic[i];
      if (!c) continue;
      const kb = bm.get(i);
      const near = kb !== undefined && Math.abs(b.tr[kb + 1] - a.tr[k + 1]) < 20 * SEG_LEN;
      c.z = near ? L(a.tr[k + 1], b.tr[kb! + 1]) : a.tr[k + 1];
      c.x = near ? L(a.tr[k + 2], b.tr[kb! + 2]) : a.tr[k + 2];
      c.tilt = a.tr[k + 3];
      c.fall = undefined;
      c.panic = 0;
      const lk = lookAt(R, i, a.t);
      if (lk) Object.assign(c, { model: lk.model, color: lk.color, truck: lk.truck, car: lk.car, plate: lk.plate, base: lk.base });
    }
    for (const p of r.police) p.z = -1e9;
    draw(pose, L(a.kmh, b.kmh));
  } finally {
    r.nightK = keep.nightK;
    r.rainK = keep.rainK;
    r.bgOffset = keep.bgOffset;
    r.inTunnel = keep.inTunnel;
    r.officer = keep.officer;
    if (r.rival && keep.rival) Object.assign(r.rival, keep.rival);
    r.extras.forEach((e, k) => Object.assign(e.r, keep.extras[k]));
    r.traffic.forEach((c, k) => Object.assign(c, keep.traffic[k]));
    r.police.forEach((p, k) => { p.z = keep.police[k]; });
  }
}

export function openReplay(onClose?: () => void) {
  const R = recording();
  const list = clips(R);
  if (!R || !list.length) return false;
  let ci = 0;
  let tc = list[0].t0;
  let playing = true;
  let camI = 0;
  let flash = 0.35;
  let ended = false;
  let focus = 1;
  let blink = 0;
  const goClip = (i: number) => {
    ci = Math.max(0, Math.min(list.length - 1, i));
    tc = list[ci].t0;
    flash = 0.3;
    ended = false;
    playing = true;
  };
  const btns = (): { r: Rect; label: string; act: () => void }[] => {
    const y = view.h - 16, x0 = Math.floor((view.w - SAFE_W) / 2) + 4;
    return [
      { r: { x: x0, y, w: 28, h: 13 }, label: '◀◀', act: () => goClip(tc - list[ci].t0 > 1.2 ? ci : ci - 1) },
      { r: { x: x0 + 32, y, w: 44, h: 13 }, label: ended ? 'REVER' : playing ? 'II' : '▶', act: () => (ended ? goClip(0) : (playing = !playing)) },
      { r: { x: x0 + 80, y, w: 28, h: 13 }, label: '▶▶', act: () => (ci < list.length - 1 ? goClip(ci + 1) : ((ended = true), (playing = false))) },
      { r: { x: x0 + 112, y, w: 108, h: 13 }, label: `CÂMERA: ${CAMS[camI]}`, act: () => { camI = (camI + 1) % CAMS.length; } },
      { r: { x: x0 + 224, y, w: 88, h: 13 }, label: 'SAIR ▶', act: () => closeOverlay(o) },
    ];
  };
  const o: Overlay = {
    draw(c, dt) {
      blink += dt;
      const clip = list[ci];
      if (playing && !ended) {
        tc += dt * (clip.slow ? 0.5 : 1);
        if (tc >= clip.t1) {
          if (ci < list.length - 1) goClip(ci + 1);
          else { tc = clip.t1; ended = true; playing = false; }
        }
      }
      const w = view.w, h = view.h;
      const k = (tc - clip.t0) / Math.max(0.01, clip.t1 - clip.t0);
      let kmh = 0;
      atTime(R, tc, (pose, v) => {
        kmh = v;
        renderOutside(c, R.race, { x: 0, y: 0, w, h, horizon: 80, K: 190 }, camFor(CAMS[camI], clip, k, ci), pose);
      });
      // faixas de cinema e o letreiro da revista
      c.fillStyle = 'rgba(10,8,6,0.82)';
      c.fillRect(0, 0, w, 20);
      c.fillRect(0, h - 34, w, 34);
      const x0 = Math.floor((w - SAFE_W) / 2) + 4;
      kicker(c, 'REPLAY', x0, 5, RED, '#fff');
      if (Math.floor(blink * 2) % 2 === 0) {
        c.fillStyle = RED;
        c.beginPath();
        c.arc(x0 + 46, 9, 3, 0, Math.PI * 2);
        c.fill();
      }
      const cap = `LANCE ${ci + 1}/${list.length} · ${clip.label}${clip.slow && !ended ? ' · CÂMERA LENTA' : ''}`;
      text(c, cap, x0 + 54, cap.length > 34 ? 8 : 7, cap.length > 34 ? 4 : 5, YELLOW, 'left', INK);
      text(c, `${Math.round(kmh)} km/h`, x0 + SAFE_W - 8, 7, 5, '#fff', 'right', null);
      // linha do tempo: um trecho por lance
      const bw = SAFE_W - 8;
      list.forEach((q, i) => {
        const sx = x0 + (bw * i) / list.length, sw = bw / list.length - 2;
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(sx, h - 30, sw, 3);
        const f = i < ci ? 1 : i > ci ? 0 : Math.max(0, Math.min(1, (tc - q.t0) / (q.t1 - q.t0)));
        c.fillStyle = YELLOW;
        c.fillRect(sx, h - 30, sw * f, 3);
      });
      if (ended) {
        c.fillStyle = 'rgba(10,8,6,0.55)';
        c.fillRect(0, h / 2 - 16, w, 30);
        text(c, 'FIM DO REPLAY', w / 2, h / 2 - 10, 8, YELLOW, 'center', INK);
        text(c, 'REVER ou SAIR', w / 2, h / 2 + 3, 5, '#fff', 'center', null);
      }
      if (flash > 0) {
        c.fillStyle = `rgba(255,255,255,${Math.min(0.8, flash * 2.5)})`;
        c.fillRect(0, 0, w, h);
        flash -= dt;
      }
      const bs = btns();
      const kb = lastDevice.kind !== 'touch';
      bs.forEach((b, i) => tag(c, b.r, b.label, kb && i === focus, 5));
      if (kb) focusRing(c, bs[focus].r);
    },
    key(k) {
      const bs = btns();
      if (k === 'back' || k === 'start') return closeOverlay(o);
      if (k === 'left') focus = (focus + bs.length - 1) % bs.length;
      else if (k === 'right') focus = (focus + 1) % bs.length;
      else if (k === 'prevTab') bs[0].act();
      else if (k === 'nextTab') bs[2].act();
      else if (k === 'up' || k === 'down') bs[3].act();
      else if (k === 'ok') bs[focus].act();
    },
    tap(x, y) {
      const bs = btns();
      const i = bs.findIndex((b) => inside(x, y, b.r));
      if (i >= 0) {
        focus = i;
        bs[i].act();
      } else if (y > 20 && y < view.h - 34) playing = ended ? playing : !playing; // tocar na imagem pausa/continua
    },
    onClose,
  };
  openOverlay(o);
  return true;
}
