// Modo foto (pausa > FOTO): a corrida congela, a cabine some e a câmera sai do carro. Vistas: atrás
// (perseguição), do alto, rasante e de lado (foto "em movimento": cenário arrastado e o carro nítido,
// com a arte da lateral). Gira em volta do carro e aproxima/afasta dentro de um limite; filtros
// (normal, revista sépia, preto e branco) e a moldura de capa da revista. SALVAR monta a imagem sem
// os botões e abre a camada de salvar/compartilhar (overlay.ts: galeria no Android, compartilhar no
// celular, baixar no PC, ou segurar na foto no artifact).
import { CRES, SAFE_W, view } from './config';
import { drawCarSide } from './cars';
import { INK, RED, YELLOW, barcode, ink, kicker, logo, tag } from './mag';
import { closeOverlay, openOverlay, showImage, type Overlay } from './overlay';
import { playerPose, renderOutside, type Cam, type Pose } from './outcam';
import type { Race } from './race';
import { focusRing, inside, text, type Rect } from './ui';
import { lastDevice } from './input';
import { myPlate } from './myplate';
import { clamp } from './util';

type ViewId = 'tras' | 'alto' | 'rasante' | 'lado';
const VIEWS: { id: ViewId; label: string; cam: Cam }[] = [
  { id: 'tras', label: 'TRÁS', cam: { dist: 1500, orbit: 0, height: 820, aim: 0.8 } },
  { id: 'alto', label: 'DO ALTO', cam: { dist: 2600, orbit: 0, height: 2900, aim: 0.74 } },
  { id: 'rasante', label: 'RASANTE', cam: { dist: 1250, orbit: 0, height: 260, aim: 0.86 } },
  { id: 'lado', label: 'DE LADO', cam: { dist: 1500, orbit: 0, height: 700, aim: 0.8 } },
];
export const FILTERS = ['NORMAL', 'SÉPIA', 'P&B'] as const;
export type FilterId = (typeof FILTERS)[number];

// filtro na imagem inteira (pixels): sépia de revista velha (tons quentes, contraste baixo) e P&B
export function applyFilter(cv: HTMLCanvasElement, f: FilterId) {
  if (f === 'NORMAL') return;
  const g = cv.getContext('2d')!;
  let img: ImageData;
  try {
    img = g.getImageData(0, 0, cv.width, cv.height);
  } catch {
    return; // imagem "suja" (não deveria acontecer: as artes vêm como data:)
  }
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (f === 'P&B') {
      const v = clamp((y - 128) * 1.12 + 128, 0, 255);
      d[i] = d[i + 1] = d[i + 2] = v;
    } else {
      const v = y * 0.86 + 18;
      d[i] = clamp(v * 1.07 + 12, 0, 255);
      d[i + 1] = clamp(v * 0.9 + 6, 0, 255);
      d[i + 2] = clamp(v * 0.68, 0, 255);
    }
  }
  g.putImageData(img, 0, 0);
}

// moldura de capa: cabeçalho vermelho com o logotipo, chamadas, o carro e o código de barras
export function coverFrame(c: CanvasRenderingContext2D, w: number, h: number, car: string, line: string) {
  c.fillStyle = RED;
  c.fillRect(0, 0, w, 26);
  c.fillStyle = INK;
  c.fillRect(0, 26, w, 2);
  logo(c, 'DUEL RACER', 6, 5, 16, YELLOW, INK);
  const x = w - 6;
  text(c, 'A REVISTA DO PÉ NA TÁBUA', x, 5, 5, '#fff', 'right', null);
  text(c, `Nº ${47 + (new Date().getMonth())} · ${new Date().getFullYear() - 32}`, x, 14, 5, YELLOW, 'right', null);
  // chamada de capa embaixo
  c.fillStyle = 'rgba(26,22,20,0.78)';
  c.fillRect(0, h - 30, w, 30);
  c.fillStyle = YELLOW;
  c.fillRect(0, h - 30, w, 2);
  kicker(c, 'FLAGRA!', 6, h - 25, RED, '#fff');
  text(c, car.toUpperCase(), 52, h - 25, 8, '#fff', 'left', INK);
  text(c, line, 6, h - 12, 5, '#e8dcc0', 'left', null);
  barcode(c, w - 40, h - 26);
}

export function openPhotoMode(r: Race, onClose: () => void) {
  let vi = 0;
  const cam: Cam = { ...VIEWS[0].cam };
  let filter = 0;
  let frame = false;
  let hideUi = false;
  let focus = 7; // SALVAR
  let dirty = true;
  let t = 0;
  const pose: Pose = playerPose(r);
  const scene = document.createElement('canvas');
  const H = () => view.h, W = () => view.w;

  const setView = (i: number) => {
    vi = (i + VIEWS.length) % VIEWS.length;
    Object.assign(cam, VIEWS[vi].cam);
    dirty = true;
  };
  const turn = (d: number) => {
    if (VIEWS[vi].id === 'lado') return;
    cam.orbit = clamp(cam.orbit + d * 0.12, -0.6, 0.6);
    dirty = true;
  };
  const zoom = (d: number) => {
    const v = VIEWS[vi].cam;
    const k = clamp(cam.dist / v.dist * (d > 0 ? 1 / 1.12 : 1.12), 0.6, 2.2);
    cam.dist = v.dist * k;
    cam.height = v.height * (0.6 + 0.4 * k);
    dirty = true;
  };

  // cena na resolução da tela (ou maior, para salvar): estrada + carro, filtro e moldura
  function paint(cv: HTMLCanvasElement, scale: number) {
    const w = W(), h = H();
    cv.width = Math.round(w * scale);
    cv.height = Math.round(h * scale);
    const g = cv.getContext('2d')!;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.imageSmoothingEnabled = false;
    const vp = { x: 0, y: 0, w, h, horizon: 80, K: 190 };
    if (VIEWS[vi].id === 'lado') sideShot(g, w, h, scale);
    else renderOutside(g, r, vp, cam, pose);
    g.setTransform(1, 0, 0, 1, 0, 0);
    applyFilter(cv, FILTERS[filter]);
    if (frame) {
      g.setTransform(scale, 0, 0, scale, 0, 0);
      const p = myPlate();
      coverFrame(g, w, h, r.car.name, `Placa ${p.text}${p.city ? ' · ' + p.city : ''} · ${Math.round(r.speed * 0.025)} km/h no flagra`);
    }
  }
  // de lado: o cenário da estrada arrastado (câmera acompanhando o carro) e a lateral nítida
  function sideShot(g: CanvasRenderingContext2D, w: number, h: number, scale: number) {
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(w * scale);
    tmp.height = Math.round(h * scale);
    const tg = tmp.getContext('2d')!;
    tg.setTransform(scale, 0, 0, scale, 0, 0);
    renderOutside(tg, r, { x: 0, y: 0, w, h, horizon: 80, K: 190 }, { dist: 1200, orbit: 0, height: 650, aim: 0.9 }, pose, true);
    // arrasto: a mesma imagem várias vezes deslocada na horizontal
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(tmp, 0, 0);
    g.globalAlpha = 0.16;
    for (let k = 1; k <= 7; k++) {
      g.drawImage(tmp, k * 3 * scale, 0);
      g.drawImage(tmp, -k * 3 * scale, 0);
    }
    g.restore();
    // asfalto em primeiro plano, com riscos de velocidade
    const top = Math.round(h * 0.6);
    g.fillStyle = r.theme.road;
    g.fillRect(0, top, w, h - top);
    g.fillStyle = r.theme.shoulder;
    g.fillRect(0, top, w, 3);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 14; i++) g.fillRect(((i * 97) % w), top + 6 + ((i * 37) % (h - top - 8)), 30 + ((i * 53) % 60), 1);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let x = -((t * 0) % 60); x < w; x += 60) g.fillRect(x, Math.round(h * 0.86), 36, 2);
    const len = Math.min(w * 0.62, 300);
    const lit = !!r.def.night || r.nightK > 0.4;
    drawCarSide(g, w / 2 - len / 2, Math.round(h * 0.79), len, r.car, pose.paint, 0.5, lit, 'man');
  }

  // botões (na tela de corrida, 224 linhas)
  const items = (): { r: Rect; label: string; act: () => void }[] => {
    const y1 = H() - 30, y2 = H() - 15, x0 = Math.floor((W() - SAFE_W) / 2) + 2;
    return [
      { r: { x: x0, y: y1, w: 16, h: 13 }, label: '◀', act: () => turn(-1) },
      { r: { x: x0 + 18, y: y1, w: 16, h: 13 }, label: '▶', act: () => turn(1) },
      { r: { x: x0 + 38, y: y1, w: 16, h: 13 }, label: '−', act: () => zoom(-1) },
      { r: { x: x0 + 56, y: y1, w: 16, h: 13 }, label: '+', act: () => zoom(1) },
      { r: { x: x0 + 76, y: y1, w: 96, h: 13 }, label: `VISTA: ${VIEWS[vi].label}`, act: () => setView(vi + 1) },
      { r: { x: x0 + 176, y: y1, w: 96, h: 13 }, label: `FILTRO: ${FILTERS[filter]}`, act: () => { filter = (filter + 1) % FILTERS.length; dirty = true; } },
      { r: { x: x0, y: y2, w: 78, h: 13 }, label: frame ? 'CAPA: SIM' : 'CAPA: NÃO', act: () => { frame = !frame; dirty = true; } },
      { r: { x: x0 + 82, y: y2, w: 90, h: 13 }, label: 'SALVAR FOTO', act: save },
      { r: { x: x0 + 176, y: y2, w: 52, h: 13 }, label: 'OCULTAR', act: () => { hideUi = true; } },
      { r: { x: x0 + 232, y: y2, w: 52, h: 13 }, label: 'VOLTAR', act: () => closeOverlay(o) },
    ];
  };
  let saving = false;
  function save() {
    if (saving) return;
    saving = true;
    // imagem final: 3x a tela de jogo e com o pixel de corrida (8:7) já esticado
    const big = document.createElement('canvas');
    paint(big, 3);
    const out = document.createElement('canvas');
    out.width = Math.round(big.width * view.aspect);
    out.height = big.height;
    const og = out.getContext('2d')!;
    og.imageSmoothingEnabled = false;
    og.drawImage(big, 0, 0, out.width, out.height);
    showImage(out, `duel-racer-foto-${Date.now().toString(36)}`, () => { saving = false; });
  }

  const o: Overlay = {
    draw(c, dt) {
      t += dt;
      const sc = CRES;
      if (dirty || scene.width !== Math.round(W() * sc) || scene.height !== Math.round(H() * sc)) {
        paint(scene, sc);
        dirty = false;
      }
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.imageSmoothingEnabled = false;
      c.drawImage(scene, 0, 0, c.canvas.width, c.canvas.height);
      c.restore();
      if (hideUi) return;
      const x0 = Math.floor((W() - SAFE_W) / 2) + 2;
      if (!frame) {
        kicker(c, 'MODO FOTO', x0, 4, RED, '#fff');
        const kb = lastDevice.kind;
        if (kb !== 'touch') ink(c, kb === 'pad' ? '▲▼ distância · LB/RB gira · A aperta · B volta' : '▲▼ distância · Q/E gira · Enter aperta · Esc volta', x0 + 60, 6, 4, '#fff');
      }
      c.fillStyle = 'rgba(26,22,20,0.55)';
      c.fillRect(0, H() - 33, W(), 33);
      const its = items();
      its.forEach((it, i) => tag(c, it.r, it.label, i === focus && lastDevice.kind !== 'touch', 5));
      if (lastDevice.kind !== 'touch' && its[focus]) focusRing(c, its[focus].r);
    },
    key(k) {
      if (hideUi) { hideUi = false; if (k !== 'back') return; }
      const its = items();
      if (k === 'back' || k === 'start') return closeOverlay(o);
      if (k === 'left') focus = (focus + its.length - 1) % its.length;
      else if (k === 'right') focus = (focus + 1) % its.length;
      else if (k === 'up') zoom(1);
      else if (k === 'down') zoom(-1);
      else if (k === 'prevTab') turn(-1);
      else if (k === 'nextTab') turn(1);
      else if (k === 'ok') its[focus]?.act();
    },
    tap(x, y) {
      if (hideUi) { hideUi = false; return; }
      const its = items();
      const i = its.findIndex((it) => inside(x, y, it.r));
      if (i >= 0) {
        focus = i;
        its[i].act();
      }
    },
    onClose,
  };
  openOverlay(o);
}
