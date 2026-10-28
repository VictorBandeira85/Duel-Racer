import { CAM_H, CAR_W, POLICE_W, RES, SEG_LEN, TRUCK_W } from './config';
import { drawCar } from './cars';
import type { Race } from './race';

// Retrovisor externo do lado do motorista, funcionando: o vidro das cabines desenhadas a partir
// da arte é encontrado pela cor (claro e azulado, à esquerda do painel) e, no lugar dele, entra
// a vista para trás pela esquerda: estrada com as faixas passando, o flanco do próprio carro na
// borda de dentro e quem vem atrás (rival, trânsito, polícia com o giroflex).

interface Glass {
  x: number; // canto do recorte, em pixels da arte (topo + painel empilhados)
  y: number;
  w: number;
  h: number;
  mask: HTMLCanvasElement; // vidro em branco, na resolução da tela (RES)
  edge: HTMLCanvasElement; // contorno interno do vidro (sombra da moldura)
}

const glasses = new Map<string, Glass | null>();
let view: HTMLCanvasElement | null = null;

// procura o vidro nas imagens do topo e do painel (as duas empilhadas: topo em cima)
export function findGlass(key: string, top: HTMLCanvasElement | null, dash: HTMLCanvasElement, maxX: number): Glass | null {
  if (glasses.has(key)) return glasses.get(key)!;
  const W = dash.width;
  const th = top ? top.height : 0;
  const H = th + dash.height;
  const all = document.createElement('canvas');
  all.width = W;
  all.height = H;
  const a = all.getContext('2d')!;
  if (top) a.drawImage(top, 0, 0);
  a.drawImage(dash, 0, th);
  const d = a.getImageData(0, 0, W, H).data;
  const isGlass = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < maxX; x++) {
      const i = (y * W + x) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (d[i + 3] > 0 && Math.min(r, g, b) > 140 && b >= r - 8) isGlass[y * W + x] = 1;
    }
  // maior mancha ligada (o vidro); pequenas manchas claras do painel ficam de fora
  const lab = new Int32Array(W * H);
  let best = 0, bestN = 0, id = 0;
  const stack: number[] = [];
  for (let p = 0; p < W * H; p++) {
    if (!isGlass[p] || lab[p]) continue;
    id++;
    let n = 0;
    stack.push(p);
    lab[p] = id;
    while (stack.length) {
      const q = stack.pop()!;
      n++;
      const qx = q % W, qy = (q - qx) / W;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx, ny = qy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nq = ny * W + nx;
          if (isGlass[nq] && !lab[nq]) {
            lab[nq] = id;
            stack.push(nq);
          }
        }
    }
    if (n > bestN) {
      bestN = n;
      best = id;
    }
  }
  if (bestN < 120) { // o do 959 é cortado pela borda: vidro pequeno
    glasses.set(key, null);
    return null;
  }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let p = 0; p < W * H; p++)
    if (lab[p] === best) {
      const x = p % W, y = (p - x) / W;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const mk = (edgeOnly: boolean) => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const m = cv.getContext('2d')!;
    const img = m.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = (y + y0) * W + x + x0;
        if (lab[p] !== best) continue;
        if (edgeOnly) {
          const nb = (dx: number, dy: number) => lab[(y + y0 + dy) * W + x + x0 + dx] === best;
          if (nb(-1, 0) && nb(1, 0) && nb(0, -1) && nb(0, 1)) continue;
        }
        img.data.set(edgeOnly ? [0, 0, 0, 120] : [255, 255, 255, 255], (y * w + x) * 4);
      }
    m.putImageData(img, 0, 0);
    return cv;
  };
  const g = { x: x0, y: y0 - th, w, h, mask: mk(false), edge: mk(true) };
  glasses.set(key, g);
  return g;
}

// desenha a vista do retrovisor esquerdo sobre o vidro; (ox, oy) = canto da imagem do painel na tela
export function drawSideMirror(c: CanvasRenderingContext2D, r: Race, g: Glass, ox: number, oy: number, bodyColor: string) {
  const { w, h } = g;
  if (!view) view = document.createElement('canvas');
  if (view.width !== w * RES || view.height !== h * RES) {
    view.width = w * RES;
    view.height = h * RES;
  }
  const v = view.getContext('2d')!;
  v.setTransform(RES, 0, 0, RES, 0, 0);
  v.imageSmoothingEnabled = false;
  v.globalCompositeOperation = 'source-over';
  v.clearRect(0, 0, w, h);

  // câmera: no retrovisor, um pouco à esquerda do carro, olhando para trás; o espelho
  // está virado para fora, então o ponto de fuga fica à direita do centro
  // mesma escala na horizontal e na vertical (como uma câmera de verdade) e campo de visão
  // estreito de espelho plano: quem se aproxima cresce e sai pela borda de fora
  const hz = Math.round(h * 0.45);
  const vx = w * 0.8;
  const f = w * 1.25;
  const xm = r.x - 800;
  const sx = (X: number, dz: number) => vx + ((X - xm) * f) / dz;
  const sy = (dz: number) => hz + (CAM_H * f) / dz;
  const night = !!r.def.night;
  const th = r.theme;
  v.fillStyle = th.sky[1];
  v.fillRect(0, 0, w, hz);
  v.fillStyle = th.sky[0];
  v.fillRect(0, 0, w, Math.round(hz * 0.4));
  v.fillStyle = th.ground[1];
  v.fillRect(0, hz, w, h - hz);
  // estrada até o horizonte
  const roadW = r.track.roadW;
  const near = (CAM_H * f) / (h - hz + 2);
  const far = 60 * SEG_LEN;
  const quad = (xa: number, xb: number, color: string) => {
    v.fillStyle = color;
    v.beginPath();
    v.moveTo(sx(xa, near), sy(near));
    v.lineTo(sx(xb, near), sy(near));
    v.lineTo(sx(xb, far), sy(far));
    v.lineTo(sx(xa, far), sy(far));
    v.closePath();
    v.fill();
  };
  quad(-roadW * 1.15, roadW * 1.15, th.shoulder);
  quad(-roadW, roadW, th.road);
  // faixas: bordas contínuas e divisórias tracejadas que passam com a velocidade
  const lanes = r.track.lanes;
  const dashLen = SEG_LEN * 3;
  for (let i = 0; i <= lanes; i++) {
    const X = -roadW + (2 * roadW * i) / lanes;
    const edge = i === 0 || i === lanes;
    const center = lanes === 4 ? i === 2 : i === 1 && lanes === 2;
    v.fillStyle = center ? '#f2c81e' : '#e8e8e8';
    const step = SEG_LEN / 2;
    for (let dz = near; dz < far; dz += step) {
      const on = edge || center || Math.floor((dz + r.position) / dashLen) % 2 === 0;
      if (!on) continue;
      const x0 = sx(X, dz), y0 = sy(dz), x1 = sx(X, dz + step), y1 = sy(dz + step);
      const lw = Math.max(0.5, (90 * f) / dz);
      v.beginPath();
      v.moveTo(x0 - lw / 2, y0);
      v.lineTo(x0 + lw / 2, y0);
      v.lineTo(x1 + lw / 2, y1);
      v.lineTo(x1 - lw / 2, y1);
      v.closePath();
      v.fill();
    }
  }
  // quem vem atrás (do mais longe para o mais perto)
  const behind: { dz: number; x: number; w: number; look: Parameters<typeof drawCar>[4] }[] = [];
  const pz = r.position;
  for (const t of r.traffic) behind.push({ dz: pz - t.z, x: t.x, w: t.truck ? TRUCK_W : CAR_W, look: { color: t.color, front: t.speed > 0, truck: t.truck, night, model: t.model } });
  if (r.rival) behind.push({ dz: pz - r.rival.z, x: r.rival.x, w: CAR_W, look: { color: r.rivalCar!.color, rear: r.rivalCar!.rear, front: true, night, paint: r.rivalPaint, signal: r.rival.signal, lamps: r.rivalLamps() } });
  for (const p of r.police) if (p.state !== 'done') behind.push({ dz: pz - p.z, x: p.x, w: p.sv ? CAR_W * 1.08 : POLICE_W, look: { color: '#fff', police: true, sv: p.sv, siren: p.state === 'chase' || p.state === 'pull', front: true, night } });
  behind.sort((a, b) => b.dz - a.dz);
  for (const b of behind) {
    if (b.dz < near * 0.5 || b.dz > far * 2.2) continue;
    const bw = (b.w * f) / b.dz;
    if (bw < 2) { // bem longe: um pontinho
      v.fillStyle = night && b.look.front ? '#fff6c0' : b.look.color;
      v.fillRect(Math.round(sx(b.x, b.dz) - 0.5), Math.round(sy(b.dz) - 1), 1, 1);
      continue;
    }
    drawCar(v, sx(b.x, b.dz), sy(b.dz), bw, b.look);
  }
  // o espelho escurece um pouco a imagem (mais à noite)
  v.fillStyle = night ? 'rgba(0,0,24,0.5)' : 'rgba(10,20,40,0.12)';
  v.fillRect(0, 0, w, h);
  // flanco do próprio carro na borda de dentro do espelho
  const fw = Math.max(3, Math.round(w * 0.12));
  v.fillStyle = bodyColor;
  v.beginPath();
  v.moveTo(w - fw, h);
  v.lineTo(w - fw * 0.55, hz - h * 0.06);
  v.lineTo(w, hz - h * 0.12);
  v.lineTo(w, h);
  v.closePath();
  v.fill();
  v.fillStyle = 'rgba(255,255,255,0.35)';
  v.fillRect(w - fw * 0.5, hz, 0.5, h - hz);
  v.fillStyle = 'rgba(0,0,0,0.35)';
  v.fillRect(w - fw, Math.round(h * 0.8), fw, h);
  // reflexo diagonal do vidro e sombra da moldura
  v.fillStyle = 'rgba(255,255,255,0.12)';
  v.beginPath();
  v.moveTo(w * 0.15, 0);
  v.lineTo(w * 0.32, 0);
  v.lineTo(w * 0.08, h);
  v.lineTo(-w * 0.09, h);
  v.closePath();
  v.fill();
  v.setTransform(1, 0, 0, 1, 0, 0);
  v.drawImage(g.edge, 0, 0, w * RES, h * RES);
  v.globalCompositeOperation = 'destination-in';
  v.drawImage(g.mask, 0, 0, w * RES, h * RES);
  v.globalCompositeOperation = 'source-over';
  c.drawImage(view, ox + g.x, oy + g.y, w, h);
}
