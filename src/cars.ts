import { KMH } from './config';
import { clamp, shade } from './util';

export type Profile = 'wedge' | 'round' | 'muscle';

export interface CarSpec {
  id: string;
  name: string;
  color: string;
  profile: Profile;
  wing: 0 | 1 | 2;
  price: string;
  position: string; // posição do motor
  drive: string; // tração
  engine: string;
  displacement: string;
  power: string;
  maxSpeed: number;
  accel: number;
  handling: number;
  dash: 'A' | 'B'; // estilo do painel
  hood: string; // cor vista pelo para-brisa
}

// Carros fictícios, inspirados nos superesportivos do começo dos anos 90.
export const CARS: CarSpec[] = [
  {
    id: 'furia', name: 'Furia F4', color: '#c81e1e', profile: 'wedge', wing: 2,
    price: '$255.000', position: 'central', drive: 'traseira', engine: 'V8 biturbo',
    displacement: '2.936 cc', power: '478 cv', maxSpeed: 13000, accel: 1.0, handling: 0.96, dash: 'B', hood: '#b01818',
  },
  {
    id: 'silber', name: 'Silber 95', color: '#b8bcc4', profile: 'round', wing: 1,
    price: '$228.000', position: 'traseira', drive: 'integral', engine: 'Boxer 6 biturbo',
    displacement: '2.849 cc', power: '450 cv', maxSpeed: 12600, accel: 1.08, handling: 1.06, dash: 'A', hood: '#9a9ea6',
  },
  {
    id: 'toro', name: 'Toro V12', color: '#f0c418', profile: 'wedge', wing: 1,
    price: '$240.000', position: 'central', drive: 'traseira', engine: 'V12 48v',
    displacement: '5.707 cc', power: '492 cv', maxSpeed: 13300, accel: 0.93, handling: 0.9, dash: 'B', hood: '#d8ac10',
  },
  {
    id: 'vortex', name: 'Vortex ZR', color: '#1f56c8', profile: 'muscle', wing: 0,
    price: '$72.000', position: 'dianteira', drive: 'traseira', engine: 'V8 32v',
    displacement: '5.733 cc', power: '380 cv', maxSpeed: 11800, accel: 1.12, handling: 1.0, dash: 'A', hood: '#1a48a8',
  },
];

export const RIVALS = [0, 1, 2]; // carros que podem ser adversários

// ---- física compartilhada (corrida e gráfico de aceleração) ----
export const GEARS = [0.22, 0.4, 0.58, 0.78, 1];
const TORQUE = [1, 0.82, 0.66, 0.52, 0.42];

export function engineAccel(car: CarSpec, gear: number, speed: number) {
  const gearMax = car.maxSpeed * GEARS[gear];
  if (speed >= gearMax) return 0;
  const rpm = speed / gearMax;
  const band = gear === 0 ? 1 : clamp(0.3 + rpm * 0.9, 0.3, 1);
  return car.accel * car.maxSpeed * 0.095 * TORQUE[gear] * band;
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
  let speed = 0, gear = 0, t = 0, t100 = 0;
  const dt = 1 / 60;
  for (let i = 0; i <= seconds * 60; i++) {
    if (i % 15 === 0) pts.push(speed * KMH);
    speed += engineAccel(car, gear, speed) * dt;
    gear = autoGear(car, gear, speed, true);
    t += dt;
    if (!t100 && speed * KMH >= 100) t100 = t;
  }
  return { pts, t100 };
}

// ---- desenho ----
export interface CarLook {
  color: string;
  front?: boolean; // vemos a frente (vem na nossa direção)
  truck?: boolean;
  police?: boolean;
  siren?: boolean;
  brake?: boolean;
  night?: boolean;
  wing?: number;
}

export function drawCar(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook) {
  if (w < 2) return;
  if (look.truck) return drawTruck(c, x, y, w, look);
  const h = w * 0.5;
  const L = x - w / 2;
  const body = look.police ? '#f2f2f2' : look.color;

  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(L - w * 0.03, y - h * 0.06, w * 1.06, h * 0.1);
  c.fillStyle = '#141414';
  c.fillRect(L + w * 0.03, y - h * 0.3, w * 0.18, h * 0.3);
  c.fillRect(x + w / 2 - w * 0.21, y - h * 0.3, w * 0.18, h * 0.3);
  c.fillStyle = body;
  c.fillRect(L, y - h * 0.66, w, h * 0.44);
  if (look.police) {
    c.fillStyle = '#151515';
    c.fillRect(L, y - h * 0.44, w, h * 0.22);
  }
  c.fillStyle = shade(look.police ? '#151515' : body, -0.2);
  c.fillRect(L, y - h * 0.3, w, h * 0.09);
  // cabine
  c.fillStyle = shade(body, -0.08);
  c.beginPath();
  c.moveTo(L + w * 0.1, y - h * 0.66);
  c.lineTo(x + w / 2 - w * 0.1, y - h * 0.66);
  c.lineTo(x + w * 0.28, y - h);
  c.lineTo(x - w * 0.28, y - h);
  c.closePath();
  c.fill();
  c.fillStyle = look.front ? '#2a3a50' : '#18222e';
  c.beginPath();
  c.moveTo(L + w * 0.17, y - h * 0.69);
  c.lineTo(x + w / 2 - w * 0.17, y - h * 0.69);
  c.lineTo(x + w * 0.24, y - h * 0.95);
  c.lineTo(x - w * 0.24, y - h * 0.95);
  c.closePath();
  c.fill();
  if (look.wing) {
    c.fillStyle = shade(body, -0.15);
    c.fillRect(L + w * 0.02, y - h * (look.wing > 1 ? 0.86 : 0.76), w * 0.96, h * 0.07);
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
  } else {
    c.fillStyle = look.brake || look.night ? '#ff3030' : '#a01414';
    c.fillRect(L + w * 0.03, y - h * 0.6, w * 0.22, h * 0.12);
    c.fillRect(x + w / 2 - w * 0.25, y - h * 0.6, w * 0.22, h * 0.12);
    c.fillStyle = '#e8e8e8';
    c.fillRect(x - w * 0.12, y - h * 0.44, w * 0.24, h * 0.08);
    if (look.night) glow(c, x, y - h * 0.54, w, '255,40,40');
  }
}

function glow(c: CanvasRenderingContext2D, x: number, y: number, w: number, rgb: string) {
  for (const sx of [-0.36, 0.36]) {
    c.fillStyle = `rgba(${rgb},0.25)`;
    c.beginPath();
    c.arc(x + sx * w, y, w * 0.18, 0, Math.PI * 2);
    c.fill();
  }
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

// Vista lateral (tela de escolha e posto de gasolina). x = frente do carro à esquerda, y = chão.
const PROFILES: Record<Profile, { body: number[]; win: number[] }> = {
  wedge: {
    body: [0, 0.1, 0.02, 0.15, 0.26, 0.19, 0.4, 0.225, 0.52, 0.29, 0.66, 0.29, 0.8, 0.245, 0.98, 0.23, 1, 0.15, 0.99, 0.055, 0, 0.055],
    win: [0.42, 0.226, 0.53, 0.28, 0.65, 0.28, 0.71, 0.238],
  },
  round: {
    body: [0, 0.095, 0.03, 0.16, 0.2, 0.195, 0.34, 0.225, 0.47, 0.3, 0.61, 0.315, 0.77, 0.27, 0.94, 0.215, 1, 0.14, 0.99, 0.055, 0, 0.055],
    win: [0.37, 0.228, 0.48, 0.292, 0.61, 0.302, 0.72, 0.25],
  },
  muscle: {
    body: [0, 0.11, 0.02, 0.165, 0.36, 0.2, 0.5, 0.28, 0.68, 0.285, 0.78, 0.215, 0.99, 0.205, 1, 0.12, 0.99, 0.055, 0, 0.055],
    win: [0.52, 0.205, 0.54, 0.272, 0.67, 0.276, 0.75, 0.215],
  },
};

export function drawCarSide(c: CanvasRenderingContext2D, x: number, y: number, len: number, car: CarSpec) {
  const p = PROFILES[car.profile];
  const pt = (arr: number[]) => {
    c.beginPath();
    for (let i = 0; i < arr.length; i += 2) c.lineTo(x + arr[i] * len, y - arr[i + 1] * len);
    c.closePath();
  };
  c.fillStyle = 'rgba(0,0,0,0.5)';
  c.beginPath();
  c.ellipse(x + len / 2, y, len * 0.52, len * 0.025, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = car.color;
  pt(p.body);
  c.fill();
  // luz e sombra na lataria
  c.fillStyle = shade(car.color, 0.18);
  c.fillRect(x + len * 0.04, y - len * 0.17, len * 0.92, len * 0.015);
  c.fillStyle = shade(car.color, -0.22);
  c.fillRect(x + len * 0.02, y - len * 0.09, len * 0.96, len * 0.035);
  c.fillStyle = '#24303e';
  pt(p.win);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fillRect(x + p.win[2] * len + len * 0.01, y - p.win[3] * len + len * 0.008, len * 0.06, len * 0.012);
  if (car.profile !== 'muscle') {
    c.fillStyle = shade(car.color, -0.35);
    c.fillRect(x + len * 0.62, y - len * 0.185, len * 0.1, len * 0.04);
  }
  if (car.wing) {
    const top = car.wing > 1 ? 0.3 : 0.265;
    c.fillStyle = shade(car.color, -0.1);
    c.fillRect(x + len * 0.86, y - len * top, len * 0.14, len * 0.025);
    c.fillStyle = shade(car.color, -0.3);
    c.fillRect(x + len * 0.92, y - len * top, len * 0.02, len * (top - 0.22));
  }
  c.fillStyle = '#ff3030';
  c.fillRect(x + len * 0.975, y - len * 0.15, len * 0.02, len * 0.03);
  for (const wx of [0.19, 0.81]) {
    const cx = x + wx * len, cy = y - len * 0.07, r = len * 0.07;
    c.fillStyle = '#111';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#b8b8b8';
    c.beginPath();
    c.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#6a6a6a';
    c.lineWidth = Math.max(1, r * 0.12);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
      c.stroke();
    }
  }
}
