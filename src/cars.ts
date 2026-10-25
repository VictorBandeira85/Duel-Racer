import { KMH } from './config';
import { clamp, shade } from './util';

// ---------- definição visual ----------
type Fill = 'body' | 'shade' | 'dark' | 'glass' | 'chrome' | 'black' | 'red' | 'amber';
interface Part { fill: Fill; pts: number[] }

// Vista lateral: frente à esquerda; x de 0 (frente) a 1 (traseira), y = altura em comprimentos
export interface SideDef {
  body: number[];
  glass: number[];
  wheels: [number, number];
  shoulder: number; // altura do vinco de luz
  parts?: Part[];
  lines?: number[][]; // frisos [x1, y1, x2, y2]
}

export type Lights = 'quadRound' | 'bar' | 'slats' | 'quadSquare' | 'rect' | 'roundPair';
export interface RearDef {
  h: number; // altura / largura
  roof: number; // largura do teto / largura
  lights: Lights;
  wing: 0 | 1 | 2; // 1 = aerofólio baixo, 2 = asa alta
  roadster?: boolean;
  mesh?: boolean; // grade preta entre as lanternas
}

export interface CarSpec {
  id: string;
  name: string;
  basedOn: string; // referência interna, não aparece no jogo
  color: string;
  price: string;
  position: string;
  drive: string;
  engine: string;
  displacement: string;
  power: string;
  maxSpeed: number;
  zeroTo100: number; // segundos, usado para calibrar a aceleração
  accel: number;
  handling: number;
  dash: 'A' | 'B';
  hood: string;
  side: SideDef;
  rear: RearDef;
}

const kmh = (v: number) => v / KMH;

// Carros com marcas fictícias, baseados em modelos reais do começo dos anos 90.
export const CARS: CarSpec[] = [
  {
    id: 'furia-f4', name: 'Furia F4', basedOn: 'Ferrari F40', color: '#c8161a',
    price: '$400.000', position: 'central', drive: 'traseira', engine: 'V8 biturbo',
    displacement: '2.936 cc', power: '478 cv', maxSpeed: kmh(324), zeroTo100: 4.1, accel: 1, handling: 1.0,
    dash: 'B', hood: '#b01014',
    side: {
      body: [0, 0.055, 0, 0.1, 0.02, 0.13, 0.12, 0.148, 0.25, 0.172, 0.36, 0.198, 0.48, 0.252, 0.6, 0.256, 0.65, 0.245, 0.86, 0.214, 0.97, 0.208, 1, 0.195, 1, 0.1, 0.985, 0.055],
      glass: [0.385, 0.2, 0.48, 0.244, 0.585, 0.247, 0.6, 0.212],
      wheels: [0.2, 0.8], shoulder: 0.165,
      parts: [
        { fill: 'body', pts: [0.87, 0.212, 0.91, 0.272, 1, 0.272, 1, 0.198] },
        { fill: 'shade', pts: [0.9, 0.262, 1, 0.262, 1, 0.272, 0.91, 0.272] },
        { fill: 'dark', pts: [0.42, 0.15, 0.5, 0.165, 0.5, 0.155] },
        { fill: 'dark', pts: [0.62, 0.135, 0.71, 0.14, 0.71, 0.175, 0.64, 0.172] },
        { fill: 'dark', pts: [0.03, 0.115, 0.09, 0.12, 0.09, 0.128, 0.03, 0.124] },
      ],
      lines: [[0.7, 0.236, 0.86, 0.218], [0.72, 0.226, 0.86, 0.21]],
    },
    rear: { h: 0.5, roof: 0.52, lights: 'quadRound', wing: 2, mesh: true },
  },
  {
    id: 'silber-95', name: 'Silber 95', basedOn: 'Porsche 959', color: '#c4c8cc',
    price: '$300.000', position: 'traseira', drive: 'integral', engine: 'Boxer 6 biturbo',
    displacement: '2.849 cc', power: '450 cv', maxSpeed: kmh(317), zeroTo100: 3.7, accel: 1, handling: 1.1,
    dash: 'A', hood: '#a8acb2',
    side: {
      body: [0, 0.065, 0, 0.12, 0.03, 0.15, 0.17, 0.168, 0.3, 0.188, 0.4, 0.268, 0.54, 0.3, 0.62, 0.296, 0.8, 0.222, 0.92, 0.205, 0.97, 0.2, 1, 0.16, 1, 0.075, 0.985, 0.06],
      glass: [0.42, 0.262, 0.54, 0.29, 0.62, 0.287, 0.72, 0.232, 0.43, 0.232],
      wheels: [0.2, 0.78], shoulder: 0.175,
      parts: [
        { fill: 'body', pts: [0.82, 0.215, 0.86, 0.238, 1, 0.236, 1, 0.2] },
        { fill: 'shade', pts: [0.86, 0.232, 1, 0.23, 1, 0.236, 0.86, 0.238] },
        { fill: 'dark', pts: [0.67, 0.13, 0.72, 0.13, 0.72, 0.17, 0.68, 0.168] },
        { fill: 'shade', pts: [0.555, 0.288, 0.565, 0.288, 0.565, 0.232, 0.555, 0.232] },
      ],
    },
    rear: { h: 0.55, roof: 0.56, lights: 'bar', wing: 1 },
  },
  {
    id: 'toro-v12', name: 'Toro V12', basedOn: 'Lamborghini Diablo', color: '#f0c010',
    price: '$240.000', position: 'central', drive: 'traseira', engine: 'V12 48v',
    displacement: '5.707 cc', power: '492 cv', maxSpeed: kmh(325), zeroTo100: 4.5, accel: 1, handling: 0.9,
    dash: 'B', hood: '#d8a808',
    side: {
      body: [0, 0.055, 0, 0.085, 0.03, 0.115, 0.2, 0.145, 0.3, 0.162, 0.47, 0.246, 0.58, 0.25, 0.64, 0.236, 0.85, 0.198, 0.96, 0.19, 1, 0.17, 1, 0.08, 0.985, 0.055],
      glass: [0.33, 0.168, 0.47, 0.24, 0.575, 0.243, 0.615, 0.2],
      wheels: [0.2, 0.8], shoulder: 0.15,
      parts: [
        { fill: 'dark', pts: [0.62, 0.205, 0.72, 0.21, 0.72, 0.222, 0.64, 0.226] },
        { fill: 'dark', pts: [0.48, 0.1, 0.58, 0.11, 0.58, 0.12] },
        { fill: 'shade', pts: [0.9, 0.193, 1, 0.188, 1, 0.198, 0.92, 0.2] },
      ],
    },
    rear: { h: 0.46, roof: 0.5, lights: 'rect', wing: 1, mesh: true },
  },
  {
    id: 'vortex-zr', name: 'Vortex ZR', basedOn: 'Corvette ZR-1 (C4)', color: '#1d4fbf',
    price: '$60.000', position: 'dianteira', drive: 'traseira', engine: 'V8 32v',
    displacement: '5.733 cc', power: '380 cv', maxSpeed: kmh(290), zeroTo100: 4.7, accel: 1, handling: 0.98,
    dash: 'A', hood: '#1a44a4',
    side: {
      body: [0, 0.065, 0, 0.11, 0.02, 0.13, 0.3, 0.165, 0.42, 0.176, 0.52, 0.252, 0.64, 0.258, 0.7, 0.25, 0.86, 0.205, 0.97, 0.19, 1, 0.17, 1, 0.07, 0.985, 0.06],
      glass: [0.53, 0.246, 0.64, 0.25, 0.7, 0.242, 0.82, 0.208, 0.54, 0.205],
      wheels: [0.2, 0.76], shoulder: 0.158,
      lines: [[0.3, 0.12, 0.35, 0.15], [0.32, 0.118, 0.37, 0.148], [0.34, 0.116, 0.39, 0.146]],
      parts: [{ fill: 'shade', pts: [0.64, 0.255, 0.66, 0.255, 0.66, 0.205, 0.64, 0.205] }],
    },
    rear: { h: 0.5, roof: 0.6, lights: 'quadSquare', wing: 0 },
  },
  {
    id: 'furia-tr', name: 'Furia TR', basedOn: 'Ferrari Testarossa', color: '#d01c1c',
    price: '$180.000', position: 'central', drive: 'traseira', engine: '12 cil. boxer',
    displacement: '4.943 cc', power: '390 cv', maxSpeed: kmh(290), zeroTo100: 5.3, accel: 1, handling: 0.92,
    dash: 'B', hood: '#b01818',
    side: {
      body: [0, 0.06, 0, 0.1, 0.02, 0.128, 0.2, 0.148, 0.34, 0.168, 0.46, 0.244, 0.58, 0.25, 0.65, 0.234, 0.84, 0.212, 0.98, 0.205, 1, 0.18, 1, 0.08, 0.985, 0.06],
      glass: [0.36, 0.172, 0.46, 0.238, 0.57, 0.242, 0.6, 0.182],
      wheels: [0.2, 0.8], shoulder: 0.19,
      lines: [[0.5, 0.165, 0.79, 0.17], [0.5, 0.152, 0.8, 0.156], [0.5, 0.139, 0.8, 0.142], [0.5, 0.126, 0.8, 0.128], [0.5, 0.113, 0.79, 0.114]],
    },
    rear: { h: 0.47, roof: 0.5, lights: 'slats', wing: 0 },
  },
  {
    id: 'toro-lp5', name: 'Toro LP5', basedOn: 'Lamborghini Countach', color: '#f4f4f0',
    price: '$150.000', position: 'central', drive: 'traseira', engine: 'V12 48v',
    displacement: '5.167 cc', power: '455 cv', maxSpeed: kmh(295), zeroTo100: 4.9, accel: 1, handling: 0.88,
    dash: 'B', hood: '#dcdcd6',
    side: {
      body: [0, 0.055, 0, 0.085, 0.03, 0.11, 0.35, 0.172, 0.48, 0.248, 0.6, 0.254, 0.64, 0.25, 0.67, 0.27, 0.75, 0.27, 0.77, 0.24, 0.92, 0.205, 1, 0.19, 1, 0.08, 0.985, 0.055],
      glass: [0.4, 0.18, 0.485, 0.242, 0.595, 0.246, 0.6, 0.182],
      wheels: [0.2, 0.8], shoulder: 0.15,
      parts: [
        { fill: 'dark', pts: [0.44, 0.115, 0.56, 0.13, 0.56, 0.155] },
        { fill: 'body', pts: [0.86, 0.212, 0.9, 0.29, 0.93, 0.29, 0.91, 0.205] },
        { fill: 'shade', pts: [0.82, 0.29, 1, 0.285, 1, 0.3, 0.83, 0.302] },
        { fill: 'dark', pts: [0.68, 0.258, 0.74, 0.258, 0.74, 0.266, 0.68, 0.266] },
      ],
    },
    rear: { h: 0.48, roof: 0.48, lights: 'rect', wing: 2 },
  },
  {
    id: 'kaze-nx', name: 'Kaze NX', basedOn: 'Honda NSX', color: '#1a1a1e',
    price: '$65.000', position: 'central', drive: 'traseira', engine: 'V6 24v',
    displacement: '2.977 cc', power: '274 cv', maxSpeed: kmh(270), zeroTo100: 5.7, accel: 1, handling: 1.18,
    dash: 'A', hood: '#2a2a30',
    side: {
      body: [0, 0.065, 0, 0.1, 0.03, 0.128, 0.22, 0.152, 0.33, 0.168, 0.45, 0.252, 0.58, 0.262, 0.66, 0.248, 0.8, 0.214, 0.92, 0.2, 0.975, 0.216, 1, 0.21, 1, 0.09, 0.985, 0.065],
      glass: [0.35, 0.172, 0.45, 0.246, 0.58, 0.255, 0.66, 0.238, 0.7, 0.205, 0.37, 0.172],
      wheels: [0.2, 0.78], shoulder: 0.158,
      parts: [
        { fill: 'dark', pts: [0.64, 0.135, 0.71, 0.14, 0.71, 0.172, 0.66, 0.17] },
        { fill: 'shade', pts: [0.92, 0.2, 0.975, 0.216, 1, 0.21, 0.94, 0.198] },
      ],
    },
    rear: { h: 0.5, roof: 0.56, lights: 'bar', wing: 1 },
  },
  {
    id: 'serpe-v10', name: 'Serpe V10', basedOn: 'Dodge Viper RT/10', color: '#c81e24',
    price: '$55.000', position: 'dianteira', drive: 'traseira', engine: 'V10 20v',
    displacement: '7.990 cc', power: '400 cv', maxSpeed: kmh(266), zeroTo100: 4.6, accel: 1, handling: 0.92,
    dash: 'A', hood: '#a8161a',
    side: {
      body: [0, 0.065, 0, 0.12, 0.03, 0.148, 0.2, 0.165, 0.38, 0.178, 0.46, 0.182, 0.56, 0.186, 0.7, 0.19, 0.92, 0.186, 1, 0.16, 1, 0.07, 0.985, 0.065],
      glass: [0.465, 0.182, 0.52, 0.248, 0.535, 0.248, 0.495, 0.182],
      wheels: [0.2, 0.76], shoulder: 0.16,
      parts: [
        { fill: 'black', pts: [0.52, 0.248, 0.54, 0.248, 0.5, 0.182, 0.48, 0.182] },
        { fill: 'black', pts: [0.63, 0.186, 0.645, 0.186, 0.66, 0.24, 0.645, 0.24] },
        { fill: 'black', pts: [0.645, 0.232, 0.7, 0.232, 0.7, 0.24, 0.645, 0.24] },
        { fill: 'black', pts: [0.56, 0.186, 0.6, 0.186, 0.6, 0.215, 0.57, 0.215] },
        { fill: 'chrome', pts: [0.34, 0.06, 0.6, 0.06, 0.6, 0.075, 0.34, 0.075] },
        { fill: 'dark', pts: [0.28, 0.13, 0.33, 0.13, 0.33, 0.16, 0.29, 0.158] },
      ],
    },
    rear: { h: 0.45, roof: 0.5, lights: 'roundPair', wing: 0, roadster: true },
  },
];

// ---------- física compartilhada (corrida e gráfico de aceleração) ----------
export const GEARS = [0.22, 0.4, 0.58, 0.78, 1];
const TORQUE = [1, 0.82, 0.66, 0.52, 0.42];

export function engineAccel(car: CarSpec, gear: number, speed: number) {
  const gearMax = car.maxSpeed * GEARS[gear];
  if (speed >= gearMax) return 0;
  const rpm = speed / gearMax;
  const band = gear === 0 ? 1 : clamp(0.3 + rpm * 0.9, 0.3, 1);
  return car.accel * 13000 * 0.095 * TORQUE[gear] * band;
}

export function autoGear(car: CarSpec, gear: number, speed: number, throttle: boolean) {
  const rpm = speed / (car.maxSpeed * GEARS[gear]);
  if (rpm >= 0.98 && throttle && gear < 4) return gear + 1;
  if (gear > 0 && speed < car.maxSpeed * GEARS[gear - 1] * 0.85) return gear - 1;
  return gear;
}

// Curva de aceleração (km/h a cada 0,25 s) e tempo de 0 a 100 km/h
export function accelCurve(car: CarSpec, seconds = 14) {
  const pts: number[] = [];
  let speed = 0, gear = 0, t100 = 0;
  const dt = 1 / 60;
  for (let i = 0; i <= seconds * 60; i++) {
    if (i % 15 === 0) pts.push(speed * KMH);
    speed += engineAccel(car, gear, speed) * dt;
    gear = autoGear(car, gear, speed, true);
    if (!t100 && speed * KMH >= 100) t100 = (i + 1) * dt;
  }
  return { pts, t100 };
}

// Ajusta a aceleração de cada carro para bater o 0-100 km/h real.
// O jogo é um pouco mais rápido que a realidade (fator 0,85) para ficar divertido.
for (const car of CARS) {
  let lo = 0.3, hi = 3;
  for (let i = 0; i < 18; i++) {
    car.accel = (lo + hi) / 2;
    const t = accelCurve(car, 10).t100 || 99;
    if (t > car.zeroTo100 * 0.85) lo = car.accel;
    else hi = car.accel;
  }
}

// ---------- desenho ----------
export interface CarLook {
  color: string;
  rear?: RearDef; // modelo específico (rival); sem isso, carro genérico de trânsito
  front?: boolean;
  truck?: boolean;
  police?: boolean;
  siren?: boolean;
  brake?: boolean;
  night?: boolean;
}

const GENERIC: RearDef = { h: 0.5, roof: 0.56, lights: 'rect', wing: 0 };

function glow(c: CanvasRenderingContext2D, x: number, y: number, w: number, rgb: string) {
  for (const sx of [-0.36, 0.36]) {
    c.fillStyle = `rgba(${rgb},0.25)`;
    c.beginPath();
    c.arc(x + sx * w, y, w * 0.18, 0, Math.PI * 2);
    c.fill();
  }
}

// Carro visto de trás (ou de frente, se vier na contramão). (x, y) = centro da base.
export function drawCar(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook) {
  if (w < 2) return;
  if (look.truck) return drawTruck(c, x, y, w, look);
  const R = look.rear ?? GENERIC;
  const h = w * R.h;
  const L = x - w / 2;
  const body = look.police ? '#f2f2f2' : look.color;
  const lit = look.brake || look.night;

  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(L - w * 0.03, y - h * 0.06, w * 1.06, h * 0.1);
  c.fillStyle = '#141414';
  c.fillRect(L + w * 0.03, y - h * 0.3, w * 0.19, h * 0.3);
  c.fillRect(x + w / 2 - w * 0.22, y - h * 0.3, w * 0.19, h * 0.3);
  // carroceria
  c.fillStyle = body;
  c.fillRect(L, y - h * 0.66, w, h * 0.46);
  if (look.police) {
    c.fillStyle = '#151515';
    c.fillRect(L, y - h * 0.44, w, h * 0.22);
  }
  c.fillStyle = shade(look.police ? '#151515' : body, -0.22);
  c.fillRect(L, y - h * 0.3, w, h * 0.1);
  c.fillStyle = shade(body, 0.12);
  c.fillRect(L + w * 0.02, y - h * 0.66, w * 0.96, Math.max(1, h * 0.04));

  // cabine
  const rw = w * R.roof;
  if (R.roadster) {
    c.fillStyle = '#1a1a1a';
    c.fillRect(x - rw / 2, y - h * 0.74, rw, h * 0.08);
    c.fillRect(x - rw / 2, y - h, w * 0.04, h * 0.3);
    c.fillRect(x + rw / 2 - w * 0.04, y - h, w * 0.04, h * 0.3);
    c.fillRect(x - rw / 2, y - h, rw, h * 0.07);
    c.fillStyle = '#2a2a2a';
    c.fillRect(x - rw * 0.32, y - h * 0.86, rw * 0.18, h * 0.14);
    c.fillRect(x + rw * 0.14, y - h * 0.86, rw * 0.18, h * 0.14);
  } else {
    c.fillStyle = shade(body, -0.1);
    c.beginPath();
    c.moveTo(L + w * 0.1, y - h * 0.66);
    c.lineTo(x + w / 2 - w * 0.1, y - h * 0.66);
    c.lineTo(x + rw / 2, y - h);
    c.lineTo(x - rw / 2, y - h);
    c.closePath();
    c.fill();
    c.fillStyle = look.front ? '#2a3a50' : '#18222e';
    c.beginPath();
    c.moveTo(L + w * 0.17, y - h * 0.69);
    c.lineTo(x + w / 2 - w * 0.17, y - h * 0.69);
    c.lineTo(x + rw / 2 - w * 0.04, y - h * 0.95);
    c.lineTo(x - rw / 2 + w * 0.04, y - h * 0.95);
    c.closePath();
    c.fill();
  }

  if (look.police) {
    const on = look.siren && Math.floor(performance.now() / 120) % 2;
    c.fillStyle = on ? '#ff2020' : '#801010';
    c.fillRect(x - w * 0.22, y - h * 1.1, w * 0.2, h * 0.11);
    c.fillStyle = on ? '#3030a0' : '#4060ff';
    c.fillRect(x + w * 0.02, y - h * 1.1, w * 0.2, h * 0.11);
  }

  if (look.front) {
    c.fillStyle = '#fff6c0';
    c.fillRect(L + w * 0.05, y - h * 0.58, w * 0.18, h * 0.1);
    c.fillRect(x + w / 2 - w * 0.23, y - h * 0.58, w * 0.18, h * 0.1);
    c.fillStyle = '#202020';
    c.fillRect(x - w * 0.2, y - h * 0.52, w * 0.4, h * 0.12);
    if (look.night) glow(c, x, y - h * 0.53, w, '255,246,192');
    return;
  }

  // traseira característica de cada modelo
  const red = lit ? '#ff3030' : '#b01818';
  const ly = y - h * 0.5;
  if (R.mesh) {
    c.fillStyle = '#121212';
    c.fillRect(L + w * 0.12, y - h * 0.6, w * 0.76, h * 0.22);
  }
  switch (R.lights) {
    case 'quadRound':
      for (const lx of [0.09, 0.2, 0.8, 0.91]) {
        c.fillStyle = red;
        c.beginPath();
        c.arc(L + w * lx, ly, Math.max(0.8, w * 0.05), 0, Math.PI * 2);
        c.fill();
      }
      break;
    case 'bar':
      c.fillStyle = red;
      c.fillRect(L + w * 0.03, ly - h * 0.06, w * 0.94, h * 0.12);
      c.fillStyle = shade(body, -0.35);
      c.fillRect(x - w * 0.14, ly - h * 0.04, w * 0.28, h * 0.08);
      break;
    case 'slats':
      c.fillStyle = '#101010';
      c.fillRect(L + w * 0.03, y - h * 0.6, w * 0.94, h * 0.26);
      c.fillStyle = lit ? '#a02020' : '#3a1010';
      c.fillRect(L + w * 0.05, y - h * 0.57, w * 0.2, h * 0.2);
      c.fillRect(x + w / 2 - w * 0.25, y - h * 0.57, w * 0.2, h * 0.2);
      c.fillStyle = body;
      for (let i = 1; i < 5; i++) c.fillRect(L + w * 0.03, y - h * 0.6 + (h * 0.26 * i) / 5, w * 0.94, Math.max(1, h * 0.025));
      break;
    case 'quadSquare':
      c.fillStyle = red;
      for (const lx of [0.05, 0.18, 0.7, 0.83]) c.fillRect(L + w * lx, ly - h * 0.07, w * 0.11, h * 0.14);
      break;
    case 'rect':
      c.fillStyle = red;
      c.fillRect(L + w * 0.03, ly - h * 0.07, w * 0.2, h * 0.14);
      c.fillRect(x + w / 2 - w * 0.23, ly - h * 0.07, w * 0.2, h * 0.14);
      c.fillStyle = '#e09020';
      c.fillRect(L + w * 0.03, ly + h * 0.04, w * 0.2, h * 0.04);
      c.fillRect(x + w / 2 - w * 0.23, ly + h * 0.04, w * 0.2, h * 0.04);
      break;
    case 'roundPair':
      for (const lx of [0.1, 0.22, 0.78, 0.9]) {
        c.fillStyle = red;
        c.beginPath();
        c.ellipse(L + w * lx, ly, Math.max(0.8, w * 0.055), Math.max(0.6, h * 0.07), 0, 0, Math.PI * 2);
        c.fill();
      }
      break;
  }
  c.fillStyle = '#e8e8e8';
  c.fillRect(x - w * 0.1, y - h * 0.4, w * 0.2, h * 0.07);
  c.fillStyle = '#8a8a8a';
  c.fillRect(x - w * 0.12, y - h * 0.24, w * 0.08, h * 0.06);
  c.fillRect(x + w * 0.04, y - h * 0.24, w * 0.08, h * 0.06);

  if (R.wing === 1) {
    c.fillStyle = shade(body, -0.18);
    c.fillRect(L + w * 0.04, y - h * 0.72, w * 0.92, h * 0.06);
  } else if (R.wing === 2) {
    c.fillStyle = shade(body, -0.25);
    c.fillRect(L + w * 0.14, y - h * 0.86, w * 0.05, h * 0.2);
    c.fillRect(x + w / 2 - w * 0.19, y - h * 0.86, w * 0.05, h * 0.2);
    c.fillStyle = body;
    c.fillRect(L - w * 0.01, y - h * 0.92, w * 1.02, h * 0.08);
    c.fillStyle = shade(body, -0.3);
    c.fillRect(L - w * 0.01, y - h * 0.86, w * 1.02, h * 0.02);
  }
  if (look.night) glow(c, x, ly, w, '255,40,40');
}

function drawTruck(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook) {
  const h = w * 1.05;
  const L = x - w / 2;
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(L - w * 0.03, y - h * 0.04, w * 1.06, h * 0.06);
  c.fillStyle = '#121212';
  c.fillRect(L + w * 0.04, y - h * 0.16, w * 0.22, h * 0.16);
  c.fillRect(x + w / 2 - w * 0.26, y - h * 0.16, w * 0.22, h * 0.16);
  if (look.front) {
    c.fillStyle = look.color;
    c.fillRect(L, y - h, w, h * 0.86);
    c.fillStyle = '#1c2a3a';
    c.fillRect(L + w * 0.08, y - h * 0.9, w * 0.84, h * 0.3);
    c.fillStyle = '#333';
    c.fillRect(L + w * 0.15, y - h * 0.45, w * 0.7, h * 0.22);
    c.fillStyle = '#fff6c0';
    c.fillRect(L + w * 0.05, y - h * 0.3, w * 0.12, h * 0.07);
    c.fillRect(x + w / 2 - w * 0.17, y - h * 0.3, w * 0.12, h * 0.07);
    if (look.night) glow(c, x, y - h * 0.27, w, '255,246,192');
  } else {
    c.fillStyle = '#d8d8d8';
    c.fillRect(L, y - h, w, h * 0.86);
    c.fillStyle = look.color;
    c.fillRect(L, y - h * 0.72, w, h * 0.12);
    c.fillStyle = '#9a9a9a';
    c.fillRect(x - w * 0.01, y - h * 0.98, w * 0.02, h * 0.8);
    c.fillStyle = look.night ? '#ff3030' : '#a01414';
    c.fillRect(L + w * 0.04, y - h * 0.25, w * 0.12, h * 0.07);
    c.fillRect(x + w / 2 - w * 0.16, y - h * 0.25, w * 0.12, h * 0.07);
  }
}

// Vista lateral (escolha do carro e posto). x = frente do carro, y = chão.
export function drawCarSide(c: CanvasRenderingContext2D, x: number, y: number, len: number, car: CarSpec) {
  const S = car.side;
  const path = (arr: number[]) => {
    c.beginPath();
    for (let i = 0; i < arr.length; i += 2) c.lineTo(x + arr[i] * len, y - arr[i + 1] * len);
    c.closePath();
  };
  const fills: Record<Fill, string> = {
    body: car.color, shade: shade(car.color, -0.25), dark: '#141418', glass: '#24303e',
    chrome: '#c8c8cc', black: '#1a1a1a', red: '#d02020', amber: '#e89020',
  };

  c.fillStyle = 'rgba(0,0,0,0.5)';
  c.beginPath();
  c.ellipse(x + len / 2, y, len * 0.52, len * 0.025, 0, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = car.color;
  path(S.body);
  c.fill();
  // faixas de luz e sombra dentro da carroceria
  c.save();
  path(S.body);
  c.clip();
  c.fillStyle = shade(car.color, 0.16);
  c.fillRect(x, y - S.shoulder * len - len * 0.006, len, len * 0.012);
  c.fillStyle = shade(car.color, -0.2);
  c.fillRect(x, y - len * 0.1, len, len * 0.045);
  c.fillStyle = shade(car.color, -0.35);
  c.fillRect(x, y - len * 0.065, len, len * 0.012);
  c.restore();

  c.fillStyle = fills.glass;
  path(S.glass);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.3)';
  c.fillRect(x + S.glass[2] * len + len * 0.008, y - S.glass[3] * len + len * 0.008, len * 0.05, len * 0.01);

  for (const p of S.parts ?? []) {
    c.fillStyle = fills[p.fill];
    path(p.pts);
    c.fill();
  }
  c.strokeStyle = '#141418';
  c.lineWidth = Math.max(1, len * 0.006);
  for (const [x1, y1, x2, y2] of S.lines ?? []) {
    c.beginPath();
    c.moveTo(x + x1 * len, y - y1 * len);
    c.lineTo(x + x2 * len, y - y2 * len);
    c.stroke();
  }
  // lanternas e piscas
  c.fillStyle = '#ff3030';
  c.fillRect(x + len * 0.978, y - len * 0.15, len * 0.02, len * 0.03);
  c.fillStyle = '#e89020';
  c.fillRect(x + len * 0.005, y - len * 0.1, len * 0.02, len * 0.015);

  for (const wx of S.wheels) {
    const cx = x + wx * len, cy = y - len * 0.07, r = len * 0.07;
    c.fillStyle = '#0c0c0c';
    c.beginPath();
    c.arc(cx, cy, r * 1.12, Math.PI, 0);
    c.fill();
    c.fillStyle = '#141414';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#b8b8bc';
    c.beginPath();
    c.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#6a6a6e';
    c.lineWidth = Math.max(1, r * 0.12);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
      c.stroke();
    }
    c.fillStyle = '#4a4a4e';
    c.beginPath();
    c.arc(cx, cy, r * 0.14, 0, Math.PI * 2);
    c.fill();
  }
}
