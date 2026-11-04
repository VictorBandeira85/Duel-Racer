import { drawPerson } from './people';
import { drawSmoke } from './smoke';
import { drawCrisp } from './crisp';
import { CAM_DEPTH, CAM_H, CAR_W, DRAW_DIST, POLICE_W, SEG_LEN, TRUCK_W } from './config';
import { CARS, drawCar } from './cars';
import { lowFx, fxMode } from './perf';
import { adsReady } from './billboards';
import { beginLights, finishNight, pushCarBeam, pushOccluder, sirenGlow, sirenWash, setSkyLight, mirrorGlare, mirrorWash, pushFacade, pushReflector, pushStreetLight, setLightClip, type Pass, type RoadPt } from './nightlight';
import { trafficLook, type Officer, type Race, type TrafficCar } from './race';
import { SPRITES } from './sprites';
import { FOG_COLOR, type BgLayer } from './themes';
import type { Point, Segment } from './track';
import { dither } from './ui';
import { PANO_H, PANO_W, panorama, skyline } from './bgart';
import { lerp, shade } from './util';

export interface Viewport {
  dash?: number; // linha onde começa o painel (a pista visível acaba ali)
  x: number;
  y: number;
  w: number;
  h: number;
  horizon: number; // y do horizonte
  h0?: number; // horizonte sem a inclinação da câmera (a lua fica presa ao céu a partir dele)
  K: number; // escala da projeção em pixels
}

const OFFICER_H = 1050; // altura do policial (unidades do mundo)

// Policial visto de frente: quepe, óculos escuros, camisa azul. (x, y) = pés.
function drawOfficer(c: CanvasRenderingContext2D, x: number, y: number, h: number, paper: boolean) {
  drawPerson(c, 'cop', paper ? 'paper' : 'wave', x, y, h);
}

// yaw: carro atravessado, a câmera gira (desloca mais quanto mais longe)
function project(p: Point, camX: number, camY: number, camZ: number, roadW: number, vp: Viewport, yaw = 0) {
  p.camera.x = -camX - yaw * (p.world.z - camZ);
  p.camera.y = p.world.y - camY;
  p.camera.z = p.world.z - camZ;
  const s = CAM_DEPTH / p.camera.z;
  p.screen.scale = s;
  p.screen.x = Math.round(vp.x + vp.w / 2 + s * p.camera.x * vp.K);
  p.screen.y = Math.round(vp.horizon - s * p.camera.y * vp.K);
  p.screen.w = Math.round(s * roadW * vp.K);
}

function quad(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.lineTo(x3, y3);
  c.lineTo(x4, y4);
  c.closePath();
  c.fill();
}

// faixa central/divisórias: tracejado a cada 4 segmentos
function laneLine(c: CanvasRenderingContext2D, s: Segment, at: number, width: number, color: string) {
  const { x: x1, y: y1, w: w1 } = s.p1.screen;
  const { x: x2, y: y2, w: w2 } = s.p2.screen;
  const l1 = Math.max(0.5, w1 * width), l2 = Math.max(0.5, w2 * width);
  c.fillStyle = color;
  quad(c, x1 + at * w1 - l1, y1, x1 + at * w1 + l1, y1, x2 + at * w2 + l2, y2, x2 + at * w2 - l2, y2);
}

function drawSegment(c: CanvasRenderingContext2D, s: Segment, r: Race, vp: Viewport, ground: CanvasPattern, fogK: number) {
  const th = r.theme;
  const { x: x1, y: y1, w: w1 } = s.p1.screen;
  const { x: x2, y: y2, w: w2 } = s.p2.screen;
  // no túnel, o que fica além do acostamento é o pé da parede
  c.fillStyle = s.tunnel ? wallColor(s, 1) : ground;
  c.fillRect(vp.x, y2, vp.w, y1 - y2);
  const sh1 = w1 * 0.1, sh2 = w2 * 0.1;
  c.fillStyle = th.shoulder;
  quad(c, x1 - w1 - sh1, y1, x1 + w1 + sh1, y1, x2 + w2 + sh2, y2, x2 - w2 - sh2, y2);
  c.fillStyle = th.road;
  quad(c, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);
  const dash = (s.index >> 2) & 1;
  if (r.track.lanes === 2) {
    if (dash) laneLine(c, s, 0, 0.025, '#f2c81e');
  } else {
    laneLine(c, s, -0.018, 0.009, '#f2c81e');
    laneLine(c, s, 0.018, 0.009, '#f2c81e');
    if (dash) {
      laneLine(c, s, -0.5, 0.014, '#e8e8e8');
      laneLine(c, s, 0.5, 0.014, '#e8e8e8');
    }
  }
  if (s.tunnel) { // asfalto na penumbra (só as luzes do teto)
    c.fillStyle = 'rgba(8,6,4,0.38)';
    c.fillRect(vp.x, y2, vp.w, y1 - y2);
  }
  if (fogK > 0.01) {
    c.fillStyle = fogFill(fogK);
    c.fillRect(vp.x, y2, vp.w, y1 - y2);
  }
}

// ---- neblina e túnel ----
const FOG_D = 34; // segmentos: a ~40 m quase tudo já some
export const fogAt = (dist: number) => 1 - Math.exp(-dist / FOG_D);
// cor da neblina: cinza-claro de dia; à noite um cinza-azulado escuro (a neblina não brilha no
// escuro — só onde o farol bate). Misturada pela intensidade da noite a cada quadro.
const FOG_DAY = [1, 3, 5].map((i) => parseInt(FOG_COLOR.slice(i, i + 2), 16));
const FOG_NIGHT = [34, 38, 48];
let fogRgb = FOG_DAY.join(',');
function setFogNight(k: number) {
  fogRgb = FOG_DAY.map((v, i) => Math.round(v + (FOG_NIGHT[i] - v) * k)).join(',');
}
const fogFill = (k: number) => `rgba(${fogRgb},${Math.min(0.96, k).toFixed(3)})`;
const TUN_W = 1300; // além da meia largura da pista, até a parede
const TUN_H = 2300; // altura do teto (a profundidade do jogo é comprimida: medido no olho)
// concreto em faixas (a cada 4 segmentos), mais escuro com a distância e no teto
function wallColor(s: Segment, k: number) {
  const band = (s.index >> 2) & 1 ? 0 : 10;
  const v = Math.round((70 + band) * k);
  return `rgb(${v + 6},${v + 2},${v - 4 > 0 ? v - 4 : 0})`;
}
// fatia de túnel entre p1 (perto) e p2 (longe): paredes, teto e as luminárias
function tunnelSlice(c: CanvasRenderingContext2D, s: Segment, vp: Viewport, roadW: number, dist: number) {
  const pts = [s.p1.screen, s.p2.screen].map((p) => {
    const tw = p.w * ((roadW + TUN_W) / roadW), h = p.scale * TUN_H * vp.K;
    return { x: p.x, y: p.y, tw, h };
  });
  const [a, b] = pts;
  const light = Math.max(0.35, 1 - dist / 140);
  c.fillStyle = wallColor(s, light);
  quad(c, a.x - a.tw, a.y, a.x - a.tw, a.y - a.h, b.x - b.tw, b.y - b.h, b.x - b.tw, b.y);
  quad(c, a.x + a.tw, a.y, a.x + a.tw, a.y - a.h, b.x + b.tw, b.y - b.h, b.x + b.tw, b.y);
  c.fillStyle = wallColor(s, light * 0.7);
  quad(c, a.x - a.tw, a.y - a.h, a.x + a.tw, a.y - a.h, b.x + b.tw, b.y - b.h, b.x - b.tw, b.y - b.h);
  // faixa refletiva na base das paredes
  c.fillStyle = (s.index >> 1) & 1 ? '#d8c020' : '#202020';
  const fy = (p: typeof a) => p.y - p.h * 0.06;
  quad(c, a.x - a.tw, fy(a), a.x - a.tw, fy(a) - Math.max(1, a.h * 0.03), b.x - b.tw, fy(b) - Math.max(1, b.h * 0.03), b.x - b.tw, fy(b));
  quad(c, a.x + a.tw, fy(a), a.x + a.tw, fy(a) - Math.max(1, a.h * 0.03), b.x + b.tw, fy(b) - Math.max(1, b.h * 0.03), b.x + b.tw, fy(b));
  // luminárias de sódio no alto das paredes, a cada 6 segmentos
  if (s.index % 6 === 0) {
    const lw = Math.max(1, a.tw * 0.07), lh = Math.max(1, a.h * 0.025);
    c.fillStyle = '#ffd27a';
    for (const side of [-1, 1]) c.fillRect(Math.round(a.x + side * a.tw * 0.9 - lw / 2), Math.round(a.y - a.h * 0.93), Math.round(lw), Math.round(lh));
    if (a.tw > 30) {
      c.fillStyle = 'rgba(255,200,110,0.12)';
      for (const side of [-1, 1]) c.fillRect(Math.round(a.x + side * a.tw * 0.9 - lw * 1.5), Math.round(a.y - a.h * 0.97), Math.round(lw * 3), Math.round(lh * 4));
    }
  }
}
// boca do túnel na encosta: a pedra em volta da abertura e a moldura de concreto
function tunnelPortal(c: CanvasRenderingContext2D, s: Segment, vp: Viewport, roadW: number) {
  const p = s.p1.screen;
  const tw = p.w * ((roadW + TUN_W) / roadW), h = p.scale * TUN_H * vp.K;
  const x0 = p.x - tw, x1 = p.x + tw, top = p.y - h;
  // encosta: um morro largo em volta (para não tapar o céu inteiro de longe)
  c.fillStyle = dither(c, '#5a5046', '#4a4038');
  c.beginPath();
  c.moveTo(p.x - tw * 6, p.y);
  c.lineTo(p.x - tw * 3.2, top - h * 1.1);
  c.lineTo(p.x - tw * 1.2, top - h * 1.6);
  c.lineTo(p.x + tw * 1.4, top - h * 1.5);
  c.lineTo(p.x + tw * 3.4, top - h * 1.0);
  c.lineTo(p.x + tw * 6, p.y);
  c.lineTo(x1, p.y);
  c.lineTo(x1, top);
  c.lineTo(x0, top);
  c.lineTo(x0, p.y);
  c.closePath();
  c.fill();
  // moldura de concreto da boca
  const fw = Math.max(1, tw * 0.12);
  c.fillStyle = '#9a968e';
  c.fillRect(Math.round(x0 - fw), Math.round(top - fw), Math.round(x1 - x0 + 2 * fw), Math.round(fw));
  c.fillRect(Math.round(x0 - fw), Math.round(top), Math.round(fw), Math.round(p.y - top));
  c.fillRect(Math.round(x1), Math.round(top), Math.round(fw), Math.round(p.y - top));
  c.fillStyle = '#6a665e';
  c.fillRect(Math.round(x0 - fw), Math.round(top - fw), Math.round(x1 - x0 + 2 * fw), Math.max(1, Math.round(fw * 0.25)));
}
// dentro do túnel: do para-brisa até a primeira fatia desenhada também é parede e teto (abaixo
// da base dela as laterais já saem cor de parede, drawSegment)
function tunnelFrame(c: CanvasRenderingContext2D, s: Segment, vp: Viewport, roadW: number) {
  const a = s.p1.screen;
  const ta = a.w * ((roadW + TUN_W) / roadW), ha = a.scale * TUN_H * vp.K;
  const l = Math.max(vp.x, Math.round(a.x - ta)), r = Math.min(vp.x + vp.w, Math.round(a.x + ta));
  const top = Math.max(vp.y, Math.round(a.y - ha)), base = Math.min(vp.y + vp.h, Math.round(a.y));
  c.fillStyle = wallColor(s, 0.85);
  c.fillRect(vp.x, vp.y, l - vp.x, base - vp.y);
  c.fillRect(r, vp.y, vp.x + vp.w - r, base - vp.y);
  c.fillStyle = wallColor(s, 0.6);
  c.fillRect(l, vp.y, r - l, top - vp.y);
}

function hash(n: number) {
  return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
}

function drawBackground(c: CanvasRenderingContext2D, r: Race, vp: Viewport) {
  const th = r.theme;
  const night = !!r.def.night;
  const yawPx = CAM_DEPTH * r.yaw * vp.K; // carro atravessado: o fundo gira junto com a pista
  // céu em faixas, do tom de cima até o do horizonte (com uma linha pontilhada em cada emenda)
  const top = vp.y, hz = vp.horizon + 2, bands = 6;
  for (let i = 0; i < bands; i++) {
    const y0 = Math.round(top + ((hz - top) * i) / bands), y1 = Math.round(top + ((hz - top) * (i + 1)) / bands);
    const col = mix(th.sky[0], th.sky[1], i / (bands - 1));
    c.fillStyle = col;
    c.fillRect(vp.x, y0, vp.w, y1 - y0);
    if (i > 0) {
      c.fillStyle = dither(c, col, mix(th.sky[0], th.sky[1], (i - 1) / (bands - 1)));
      c.fillRect(vp.x, y0, vp.w, 1);
    }
  }
  // estrelas e lua aparecem aos poucos com a noite (pôr do sol) e somem no amanhecer
  const nk = r.nightK;
  // com neblina ou chuva o céu fica encoberto: sem estrelas e sem lua
  if (nk > 0.02 && r.def.weather !== 'fog' && r.def.weather !== 'rain') {
    const ga0 = c.globalAlpha;
    c.globalAlpha = ga0 * nk;
    c.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) {
      const sx = ((hash(i) * 900 - r.bgOffset * 0.1 - yawPx) % vp.w + vp.w) % vp.w;
      c.fillRect(vp.x + Math.floor(sx), vp.y + Math.floor(hash(i + 50) * (vp.horizon - vp.y) * 0.7), 1, 1);
    }
    // lua cheia brilhando: halo largo, disco claro com manchas; a escuridão da noite não a apaga
    // (setSkyLight abre um furo de luz na camada escura)
    // presa ao céu (acompanha o horizonte nas subidas e descidas) e recortada acima dele: o
    // brilho nunca cai sobre o chão
    const mxp = vp.x + vp.w * 0.78 - yawPx * 0.2, myp = vp.y + 14 + (vp.horizon - (vp.h0 ?? vp.horizon));
    if (myp < vp.horizon - 10) {
      c.save();
      c.beginPath();
      c.rect(vp.x, vp.y, vp.w, Math.max(0, vp.horizon - 2 - vp.y));
      c.clip();
      glow(c, mxp, myp, 30, '255,244,210', 0.32);
      glow(c, mxp, myp, 13, '255,248,225', 0.5);
      c.fillStyle = '#fffbea';
      c.beginPath();
      c.arc(mxp, myp, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#e6dcc0';
      c.fillRect(Math.round(mxp - 3), Math.round(myp - 2), 2, 2);
      c.fillRect(Math.round(mxp + 1), Math.round(myp + 1), 2, 1);
      c.fillRect(Math.round(mxp - 1), Math.round(myp + 3), 1, 1);
      c.restore();
      if (nk > 0.5) setSkyLight(mxp, myp, 26, vp.horizon - 2);
    }
    c.globalAlpha = ga0;
  }
  // pôr do sol: o disco descendo atrás dos morros
  if (r.def.dusk && r.sun > 0) {
    const sy = vp.horizon - 4 - r.sun * 46, sx = vp.x + vp.w * 0.32 - yawPx * 0.5;
    const ga1 = c.globalAlpha;
    c.globalAlpha = ga1 * Math.min(1, r.sun * 4); // some de leve ao encostar no horizonte
    sunDisc(c, vp, sx, sy, 8, r.sun > 0.5 ? '#fff4c0' : '#ffc060', 1 - r.sun);
    c.globalAlpha = ga1;
  }
  // entardecer / amanhecer: o sol pela metade no horizonte (os morros cobrem a parte de baixo)
  if (r.def.tod && !r.def.dusk && nk < 0.98) {
    const ga2 = c.globalAlpha;
    c.globalAlpha = ga2 * (1 - nk);
    // longe do quadro de desafios (no alto à esquerda); o centro do disco fica na linha dos morros
    // naquele ponto (a mais alta das duas camadas), então metade aparece acima dela
    const span = ((r.def.tod === 'sunset' ? 0.62 : 0.66) * vp.w - yawPx * 0.5) % (vp.w * 1.6);
    const sx = vp.x + (span < 0 ? span + vp.w * 1.6 : span);
    const seed0 = r.course.id.length * 31 + r.stageIdx;
    let ridge = PANO_H;
    th.bg.forEach((kind, k) => {
      const img = panorama(kind, k === 1, false, seed0);
      const top = skyline(img);
      if (!top) return;
      const off = ((Math.floor(r.bgOffset * (k ? 0.6 : 0.3) + yawPx) % PANO_W) + PANO_W) % PANO_W;
      for (let dx = -8; dx <= 8; dx += 4) ridge = Math.min(ridge, top[(((Math.round(sx - vp.x + off + dx)) % PANO_W) + PANO_W) % PANO_W]);
    });
    const sy = Math.min(vp.horizon - 4, vp.horizon - PANO_H + 1 + ridge + 2);
    sunDisc(c, vp, sx, sy, 15, r.def.tod === 'sunset' ? '#ffd860' : '#fff2a8', 1);
    c.globalAlpha = ga2;
  }
  const seed = r.course.id.length * 31 + r.stageIdx;
  const [far, near] = th.bg;
  const layer = (kind: BgLayer, isNear: boolean, speed: number) => {
    const off = ((Math.floor(r.bgOffset * speed + yawPx) % PANO_W) + PANO_W) % PANO_W;
    const y = vp.horizon - PANO_H + 1;
    // morros e prédios de dia e de noite misturados pela hora (luzes das janelas acendendo aos poucos)
    const put = (nightArt: boolean, a: number) => {
      if (a <= 0.01) return;
      const img = panorama(kind, isNear, nightArt, seed);
      const ga = c.globalAlpha;
      c.globalAlpha = ga * a;
      c.drawImage(img, vp.x - off, y);
      if (PANO_W - off < vp.w) c.drawImage(img, vp.x - off + PANO_W, y);
      c.globalAlpha = ga;
    };
    if (nk < 0.99) put(false, 1);
    put(true, nk >= 0.99 ? 1 : nk);
  };
  layer(far, false, 0.3);
  layer(near, true, 0.6);
  // hora dourada: luz quente (entardecer) ou rosada (amanhecer) por cima dos morros
  if (r.def.tod && !r.def.dusk && nk < 0.98) {
    c.fillStyle = r.def.tod === 'sunset' ? `rgba(255,140,40,${(0.2 * (1 - nk)).toFixed(3)})` : `rgba(255,170,150,${(0.14 * (1 - nk)).toFixed(3)})`;
    c.fillRect(vp.x, vp.y, vp.w, vp.horizon + 2 - vp.y);
  }
  // luz alaranjada do fim de tarde por cima dos morros; neblina apaga o fundo quase todo
  if (r.def.dusk && nk < 0.98) {
    const k = Math.max(0, 1 - Math.abs(r.progress - 0.5) / 0.45) * (1 - nk);
    c.fillStyle = `rgba(255,110,40,${(k * 0.22).toFixed(3)})`;
    c.fillRect(vp.x, vp.y, vp.w, vp.horizon + 2 - vp.y);
  }
  if (r.def.weather === 'fog') {
    c.fillStyle = fogFill(0.86);
    c.fillRect(vp.x, vp.y, vp.w, vp.horizon + 2 - vp.y);
  }
}

// brilho redondo (halo) em volta do sol ou da lua
function glow(c: CanvasRenderingContext2D, x: number, y: number, rad: number, rgb: string, a: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.45, `rgba(${rgb},${(a * 0.35).toFixed(3)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
// sol com halo e, perto do horizonte, a faixa de luz espalhada ao longo dele
function sunDisc(c: CanvasRenderingContext2D, vp: Viewport, x: number, y: number, R: number, color: string, low: number) {
  glow(c, x, y, R * 6, '255,200,110', 0.42);
  glow(c, x, y, R * 2.4, '255,236,170', 0.65);
  if (low > 0.2) {
    const g = c.createLinearGradient(0, vp.horizon - 14, 0, vp.horizon + 2);
    g.addColorStop(0, 'rgba(255,214,120,0)');
    g.addColorStop(1, `rgba(255,214,120,${(0.45 * low).toFixed(3)})`);
    c.fillStyle = g;
    c.fillRect(vp.x, vp.horizon - 14, vp.w, 16);
  }
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, R, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,240,0.85)';
  c.beginPath();
  c.arc(x, y, R * 0.6, 0, Math.PI * 2);
  c.fill();
}

// neblina num objeto: ele continua sólido e ganha a cor da neblina conforme a distância (antes
// ficava semitransparente e a estrada aparecia através de pontes e carros). Desenhado numa
// camada do tamanho da tela, tingido só na silhueta e copiado de volta.
const fogCv = document.createElement('canvas');
function fogged(c: CanvasRenderingContext2D, fk: number, x: number, y: number, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  if (fk < 0.02) return draw(c);
  const W = c.canvas.width, H = c.canvas.height;
  if (fogCv.width !== W || fogCv.height !== H) {
    fogCv.width = W;
    fogCv.height = H;
  }
  const g = fogCv.getContext('2d')!;
  const tf = c.getTransform();
  const X0 = Math.max(0, Math.floor(tf.a * x + tf.e)), Y0 = Math.max(0, Math.floor(tf.d * y + tf.f));
  const X1 = Math.min(W, Math.ceil(tf.a * (x + w) + tf.e)), Y1 = Math.min(H, Math.ceil(tf.d * (y + h) + tf.f));
  if (X1 <= X0 || Y1 <= Y0) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(X0, Y0, X1 - X0, Y1 - Y0);
  g.imageSmoothingEnabled = c.imageSmoothingEnabled;
  g.setTransform(tf);
  draw(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = fogFill(fk);
  g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
  g.globalCompositeOperation = 'source-over';
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.drawImage(fogCv, X0, Y0, X1 - X0, Y1 - Y0, X0, Y0, X1 - X0, Y1 - Y0);
  c.restore();
}

// mistura de duas cores #rrggbb
function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// objetos grandes, que aparecem de longe
// placas e outdoors que refletem o farol à noite
const REFLECT = new Set(['signL', 'signR', 'warnL', 'warnR', 'sharpL', 'sharpR', 'billboard', 'gasSign', 'gasKm', 'stop']);
const FAR_KINDS = ['building', 'station', 'bridge', 'billboard', 'barn', 'factory', 'silo', 'spire', 'lighthouse'];

export function renderRoad(c: CanvasRenderingContext2D, r: Race, view0: Viewport) {
  // câmera inclinada junto com o carro: na subida o horizonte desce, na descida sobe
  const vp = { ...view0, h0: view0.horizon, horizon: view0.horizon + Math.round(Math.max(-110, Math.min(60, r.pitch * CAM_DEPTH * view0.K))) };
  const segs = r.track.segments;
  const roadW = r.track.roadW;
  const night = !!r.def.night;
  const fog = r.def.weather === 'fog';
  c.save();
  c.beginPath();
  c.rect(vp.x, vp.y, vp.w, vp.h);
  c.clip();
  if (r.shake) c.translate(Math.round((Math.random() - 0.5) * 2 * r.shake), Math.round((Math.random() - 0.5) * 2 * r.shake));
  // sensação de velocidade: perto da máxima a imagem trepida de leve (1 px, de vez em quando)
  else if (r.speed > r.car.maxSpeed * 0.8 && Math.random() < (r.speed / r.car.maxSpeed - 0.8) * 2.5) c.translate(0, Math.random() < 0.5 ? 1 : -1);
  setFogNight(r.def.weather === 'fog' ? r.nightK : 0);
  drawBackground(c, r, vp);
  beginLights();
  // escuro: noite ou dentro do túnel (faróis acesos, ofuscam no retrovisor)
  const lit = night || r.nightK > 0.15 || r.inTunnel > 0.5; // postes e faróis acendem já no lusco-fusco

  const base = r.findSegment(r.position);
  const basePct = (r.position % SEG_LEN) / SEG_LEN;
  // altura da câmera: o chão logo abaixo do motorista
  // (no salto, o chão fica lá embaixo: a câmera sobe com o carro)
  const playerY = lerp(base.p1.world.y, base.p2.world.y, basePct) + r.lift;
  // distância de desenho: menor no econômico, bem maior no MÁXIMO
  const far = fxMode() === 'alto' ? 1.4 : lowFx() ? 0.65 : 1;
  const far0 = far; // (o facho dos carros à frente usa `far` para outra coisa)
  const end = Math.min(segs.length, base.index + Math.round(DRAW_DIST * far));
  const ground = dither(c, r.theme.ground[0], r.theme.ground[1]);
  // chão por baixo de tudo: em vales, parte da tela não é coberta por nenhum segmento
  c.fillStyle = ground;
  c.fillRect(vp.x, vp.horizon, vp.w, vp.y + vp.h - vp.horizon);

  for (let i = base.index; i < end; i++) segs[i].cars.length = 0;
  const entities: { z: number; x: number }[] = [...r.traffic, ...r.police.filter((p) => p.state !== 'done' || Math.abs(p.z - r.playerZ) < 100 * SEG_LEN)];
  if (r.rival) entities.push(r.rival);
  if (r.officer) entities.push(r.officer);
  if (r.ghostPos) entities.push(r.ghostPos);
  for (const e of entities) {
    const idx = Math.floor(e.z / SEG_LEN);
    if (idx >= base.index && idx < end) segs[idx].cars.push(e);
  }

  let maxy = vp.y + vp.h;
  const road: RoadPt[] = [];
  let x = 0;
  let dx = -(base.curve * basePct);
  for (let i = base.index; i < end; i++) {
    const s = segs[i];
    s.clip = maxy;
    project(s.p1, r.x - x, playerY + CAM_H, r.position, roadW, vp, r.yaw);
    project(s.p2, r.x - x - dx, playerY + CAM_H, r.position, roadW, vp, r.yaw);
    x += dx;
    dx += s.curve;
    if (s.p1.camera.z <= CAM_DEPTH || s.p2.screen.y >= s.p1.screen.y || s.p2.screen.y >= maxy) continue;
    drawSegment(c, s, r, vp, ground, fog ? fogAt(i - base.index) : 0);
    maxy = s.p1.screen.y;
    // chão visível à frente, para o facho dos faróis seguir subidas e descidas
    if (i - base.index <= 120) road.push({ d: i - base.index, x: s.p1.screen.x, y: s.p1.screen.y, w: s.p1.screen.w });
  }

  let nearTunnel: Segment | null = null;
  for (let i = end - 1; i > base.index; i--) {
    const s = segs[i];
    if (s.p1.camera.z <= CAM_DEPTH * 4) continue;
    if (!s.tunnel && !s.sprites.length && !s.cars.length) continue; // nada a desenhar: poupa o recorte
    c.save();
    c.beginPath();
    c.rect(vp.x, vp.y, vp.w, s.clip - vp.y);
    c.clip();
    setLightClip(s.clip);
    const dist = i - base.index;
    if (s.tunnel) {
      tunnelSlice(c, s, vp, roadW, dist);
      if (!segs[i - 1]?.tunnel) tunnelPortal(c, s, vp, roadW);
      nearTunnel = s;
    }
    // neblina: o que está longe vai sumindo no cinza
    const fk = fog ? fogAt(dist) : 0;
    if (fk > 0.97) {
      c.restore();
      continue;
    }
    for (const sp of s.sprites) {
      // objetos pequenos e distantes só poluem o horizonte
      if (dist > (sp.kind === 'post' || sp.kind === 'rail' ? 90 : FAR_KINDS.includes(sp.kind) ? 400 : 170) * Math.max(1, far * 0.85)) continue;
      const def = SPRITES[sp.kind];
      const sc = s.p1.screen.scale;
      const sw = def.w * sc * vp.K;
      const sh = def.h * sc * vp.K;
      const sx = s.p1.screen.x + sc * sp.x * vp.K;
      if (sx + sw / 2 < vp.x || sx - sw / 2 > vp.x + vp.w || sw < 1.2) continue;
      // desenhado como pixel art nítida (sem antialias, com contorno); a caixa é um pouco
      // mais larga que o objeto para caber o que passa da largura (braço do poste etc.)
      const seed = sp.kind === 'building' ? sp.seed % 45 : sp.kind === 'billboard' ? sp.seed % 100 : sp.kind === 'gasKm' ? sp.seed : sp.kind === 'house' ? sp.seed % 6 : sp.kind === 'autumn' || sp.kind === 'umbrella' ? sp.seed % 3 : 0;
      const bw = sw * (sp.kind === 'lamp' ? 3.4 : 1.1);
      let drawn = null as ReturnType<typeof drawCrisp>;
      fogged(c, fk, sx - bw / 2 - 3, s.p1.screen.y - sh - 3, bw + 6, sh + 6, (g) => {
        drawn = drawCrisp(g, `${sp.kind}${seed}${sp.kind === 'billboard' && !adsReady(seed) ? 'w' : ''}`, sx, s.p1.screen.y, bw, sh, (o, w, h) => def.draw(o, w / 2, h, (w * sw) / bw, h, seed));
      });
      // tapa o farol dos carros que estão atrás deste objeto
      // (mureta, postes e balizas são baixos e finos: não escondem o clarão do farol)
      const dr = drawn as ReturnType<typeof drawCrisp>;
      if (lit && dr && sp.kind !== 'rail' && sp.kind !== 'post') pushOccluder({ ...dr, idx: i, clip: s.clip });
      // poste aceso à noite: a lâmpada fica na ponta do braço, sobre o acostamento
      if (lit && (sp.kind === 'station' || sp.kind === 'gasSign')) pushFacade(sp.kind, sx, s.p1.screen.y, sw, sh);
      if (lit && REFLECT.has(sp.kind)) pushReflector(sp.kind, sx, s.p1.screen.y, sw, sh, dist);
      if (lit && sp.kind === 'lamp') pushStreetLight(sx - sw * 1.3, s.p1.screen.y - sh + sw * 0.5, sw * 9, dist, (sx - sw * 1.3 - s.p1.screen.x) / Math.max(1, s.p1.screen.w), s.p1.screen.y, i);
    }
    // farol de quem vai na mesma mão, à nossa frente: luz no asfalto adiante dele. Posições
    // calculadas pelo z contínuo do carro (interpolando dentro do segmento): o facho acompanha o
    // carro suavemente, sem pular de segmento em segmento nem piscar.
    // len: em segmentos, da traseira desenhada até onde a luz começa (logo à frente do carro)
    const proj = (z: number) => {
      const idx = Math.max(base.index, Math.min(end - 2, Math.floor(z / SEG_LEN)));
      const sg = segs[idx], t = Math.max(0, Math.min(1, z / SEG_LEN - idx));
      return { x: lerp(sg.p1.screen.x, sg.p2.screen.x, t), y: lerp(sg.p1.screen.y, sg.p2.screen.y, t), sc: lerp(sg.p1.screen.scale, sg.p2.screen.scale, t), idx };
    };
    const beamAhead = (ez: number, ex: number, w: number, len = 4) => {
      if (!lit) return;
      const z0 = ez + len * SEG_LEN;
      const a = proj(z0);
      // túnel: com a boca do túnel entre nós e o carro a luz não aparece; o facho para na boca
      const inT = !!segs[i].tunnel;
      for (let k = base.index; k < a.idx; k++) if (!!segs[k].tunnel !== inT) return;
      let zEnd = z0 + 40 * SEG_LEN;
      for (let k = a.idx + 1; k <= Math.min(end - 2, Math.floor(zEnd / SEG_LEN)); k++) if (!!segs[k].tunnel !== inT) { zEnd = k * SEG_LEN; break; }
      zEnd = Math.min(zEnd, (end - 2) * SEG_LEN);
      if (zEnd <= z0 + SEG_LEN) return;
      const f = proj(zEnd);
      const xa = a.x + a.sc * ex * vp.K;
      // de longe o facho tem só 1 ou 2 pixels: ganha um tamanho mínimo (como as lanternas)
      const far = Math.max(0, Math.min(1, (16 - w) / 13)); // 1 = bem longe
      const ha = Math.max(CAR_W * a.sc * vp.K * 0.38, 2.5 * far);
      const lift = Math.max(2.5, 8 * far);
      let xf = xa, yf = a.y - lift, hf = Math.max(ha * 1.6, 5 * far);
      if (f.y < a.y - lift) {
        xf = f.x + f.sc * ex * vp.K;
        yf = f.y;
        hf = Math.max(1, CAR_W * 2.3 * f.sc * vp.K, 5 * far);
      }
      // longe: o facho acende aos poucos conforme o carro se aproxima (sem surgir de repente)
      const dist = (ez - r.position) / SEG_LEN, lim = DRAW_DIST * far0;
      const fade = Math.max(0, Math.min(1, (lim - dist) / (lim * 0.8)));
      pushCarBeam([xa - ha, a.y, xa + ha, a.y, xf + hf, yf, xf - hf, yf], s.clip, Math.floor(zEnd / SEG_LEN), fade * fade);
    };
    for (const e of s.cars) {
      if (e.z - r.position < 450) continue; // colado no para-brisa: some sob o painel
      const pct = (e.z % SEG_LEN) / SEG_LEN;
      const sc = lerp(s.p1.screen.scale, s.p2.screen.scale, pct);
      const cy = lerp(s.p1.screen.y, s.p2.screen.y, pct);
      const baseX = lerp(s.p1.screen.x, s.p2.screen.x, pct);
      const ex = e.x;
      const cx = baseX + sc * ex * vp.K;
      if (e === r.ghostPos) {
        // fantasma: o carro da melhor passagem, transparente (não bate em nada)
        const gc = ghostCar(r);
        if (gc) {
          c.save();
          c.globalAlpha *= 0.42;
          drawCar(c, cx, cy, CAR_W * sc * vp.K, { color: gc.color, rear: gc.rear, night, paint: r.ghostRun!.paint });
          c.restore();
        }
      } else if (e === r.rival) {
        const rw = CAR_W * sc * vp.K, rv = r.rival;
        fogged(c, fk, cx - rw, cy - rw * 1.3, rw * 2, rw * 1.3 + 4, (g) => drawCar(g, cx, cy, rw, { color: r.rivalCar!.color, rear: r.rivalCar!.rear, brake: rv.recover > 0 || rv.mistake > 0, night: lit, paint: r.rivalPaint, signal: rv.signal, plate: r.rivalPlate }));
        beamAhead(e.z, ex, CAR_W * sc * vp.K);
      } else if ('phase' in e) {
        drawOfficer(c, cx, cy, OFFICER_H * sc * vp.K, (e as Officer).phase === 'show');
      } else if ('spotZ' in e) {
        const p = e as Race['police'][number];
        const siren = p.state === 'chase' || p.state === 'pull' || p.state === 'stopped';
        const pw = (p.sv ? CAR_W * 1.08 : POLICE_W) * sc * vp.K;
        fogged(c, fk, cx - pw, cy - pw * 1.3, pw * 2, pw * 1.3 + 4, (g) => drawCar(g, cx, cy, pw, { color: '#fff', police: true, sv: p.sv, siren, night: lit }));
        beamAhead(e.z, ex, POLICE_W * sc * vp.K, 5);
      } else {
        const t = e as TrafficCar;
        const tw = (t.truck ? TRUCK_W : CAR_W) * sc * vp.K;
        fogged(c, fk, cx - tw, cy - tw * 1.6, tw * 2, tw * 1.6 + 4, (g) => drawCar(g, cx, cy, tw, trafficLook(t, t.base < 0, night || fog || !!s.tunnel, t.panic > 0.4 && Math.floor(performance.now() / 160) % 2 === 0)));
        if (t.base > 0) beamAhead(e.z, ex, tw, t.truck ? 12 : 4);
        // batido: fumaça saindo do motor (frente: em cima do capô; de trás: por cima do carro)
        if (t.smoke > 0) drawSmoke(c, cx, cy - tw * (t.base < 0 ? 0.35 : 0.55), tw, t.smoke, Math.round(t.base));
      }
    }
    c.restore();
  }
  // dentro do túnel: parede e teto entre o para-brisa e a fatia mais próxima
  if (nearTunnel && (base.tunnel || segs[base.index + 1]?.tunnel)) tunnelFrame(c, nearTunnel, vp, roadW);

  // escuridão (noite; no túnel, mais leve): o facho dos faróis do jogador recortado nela, as
  // luzes dos outros carros somadas por cima e a claridade de quem emparelha vindo de trás
  const passers: Pass[] = [];
  if (lit) {
    for (const t of r.traffic) if (t.base > 0) passers.push({ x: t.x - r.x, dz: r.playerZ - t.z });
    if (r.rival) passers.push({ x: r.rival.x - r.x, dz: r.playerZ - r.rival.z });
    for (const p of r.police) if (p.state === 'chase' || p.state === 'pull') passers.push({ x: p.x - r.x, dz: r.playerZ - p.z });
  }
  setLightClip(Infinity);
  // escuridão pela intensidade da noite (entra e sai aos poucos no pôr do sol e no amanhecer)
  finishNight(c, vp, Math.max(r.nightK, r.inTunnel > 0.5 ? 0.45 * r.inTunnel : 0), passers, SEG_LEN, road);
  c.restore();
}

const ghostCar = (r: Race) => CARS.find((c) => c.id === r.ghostRun?.car);

// Retrovisor: visão simplificada da estrada atrás (rival, polícia, trânsito)
export function renderMirror(c: CanvasRenderingContext2D, r: Race, x: number, y: number, w: number, h: number) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  const hz = y + h * 0.42;
  c.fillStyle = r.theme.sky[1];
  c.fillRect(x, y, w, hz - y);
  c.fillStyle = dither(c, r.theme.ground[0], r.theme.ground[1]);
  c.fillRect(x, hz, w, y + h - hz);
  const cx = x + w / 2;
  const bottom = y + h;
  const sb = (w * 0.42) / r.track.roadW;
  const at = (wx: number) => cx + (wx - r.x) * sb;
  c.fillStyle = r.theme.road;
  quad(c, at(-r.track.roadW), bottom, at(r.track.roadW), bottom, cx + 1, hz, cx - 1, hz);
  c.strokeStyle = '#f2c81e';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(at(0), bottom);
  c.lineTo(cx, hz);
  c.stroke();

  // espelho plano, campo estreito: quem fica para trás continua visível por mais tempo
  const D = 3600;
  const behind: { z: number; x: number; w: number; look: Parameters<typeof drawCar>[4] }[] = [];
  const night = !!r.def.night || r.inTunnel > 0.5;
  const glareK = r.def.night ? 1 : night ? 0.7 : 0;
  let nearest = 0;
  for (const t of r.traffic) behind.push({ z: t.z, x: t.x, w: t.truck ? TRUCK_W : CAR_W, look: trafficLook(t, t.base > 0, night) });
  if (r.rival) behind.push({ z: r.rival.z, x: r.rival.x, w: CAR_W, look: { color: r.rivalCar!.color, rear: r.rivalCar!.rear, front: true, night, paint: r.rivalPaint, signal: r.rival.signal, lamps: r.rivalLamps() } });
  for (const p of r.police) if (p.state === 'chase' || p.state === 'pull') behind.push({ z: p.z, x: p.x, w: p.sv ? CAR_W * 1.08 : POLICE_W, look: { color: '#fff', police: true, sv: p.sv, siren: true, front: true, night } });
  behind.sort((a, b) => a.z - b.z);
  let sirenNear = 0;
  for (const b of behind) {
    const dz = r.position - b.z;
    if (dz < 300 || dz > 200 * SEG_LEN) continue;
    const k = D / dz;
    const yy = hz + (bottom - hz) * Math.min(1, k);
    const bw = b.w * sb * k;
    if (bw < 2) { // bem longe: um pontinho (os faróis, à noite)
      c.fillStyle = night && b.look.front ? '#fff6c0' : b.look.color;
      c.fillRect(Math.round(cx + (b.x - r.x) * sb * k - 0.5), Math.round(yy - 1), 1, 1);
      continue;
    }
    drawCar(c, cx + (b.x - r.x) * sb * k, yy, bw, b.look);
    if (glareK && b.look.front) {
      const near = Math.max(0, 1 - dz / (SEG_LEN * 14));
      nearest = Math.max(nearest, near);
      mirrorGlare(c, cx + (b.x - r.x) * sb * k, yy, bw, near, glareK);
      if (b.look.siren) {
        const sn = Math.max(0, 1 - dz / (SEG_LEN * 25));
        sirenNear = Math.max(sirenNear, sn);
        sirenGlow(c, cx + (b.x - r.x) * sb * k, yy, bw, sn, glareK * 1.3, y + 4);
      }
    }
  }
  mirrorWash(c, x, y, w, h, nearest, glareK);
  sirenWash(c, x, y, w, h, sirenNear, glareK, 1.8);
  c.restore();
}
