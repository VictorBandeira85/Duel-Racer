import { drawCrisp } from './crisp';
import { KMH } from './config';
import { clamp, shade } from './util';
import { F40_REAR, F40_SIDE } from './svg/f40';
import { spriteAspect, svgSprite } from './svgsprites';
// sprites derivados de fotos (ver assets/cars/LEIA-ME.md)
import f40SidePng from './assets/cars/f40-side.png';
import f40RearPng from './assets/cars/f40-rear.png';
import s959SidePng from './assets/cars/959-side.png';
import s959RearPng from './assets/cars/959-rear.png';
import f40FrontPng from './assets/cars/f40-front.png';
import s959FrontPng from './assets/cars/959-front.png';

// ---------- definição visual ----------
type Fill = 'body' | 'shade' | 'dark' | 'glass' | 'chrome' | 'black' | 'red' | 'amber';
interface Part { fill: Fill; pts: number[] }

// Vista lateral: frente à esquerda; x de 0 (frente) a 1 (traseira), y = altura em comprimentos
export interface SideDef {
  body: number[];
  glass: number[];
  wheels: [number, number];
  wheelR?: number;
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
  custom?: 'f40' | '959'; // traseira desenhada com detalhes próprios
  svg?: string; // arte vetorial da traseira
  img?: string; // sprite da traseira (pixel art)
  frontImg?: string; // sprite da frente (retrovisor)
  glow?: { dots?: number[][]; bar?: number[] }; // onde acendem as luzes de freio (frações u, f)
  imgMask?: string; // máscaras da carroceria (onde a cor pode ser trocada)
  frontMask?: string;
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
  dash: string; // cabine: 'A'/'B' (desenhadas por código) ou a chave da arte em COCKPIT_ART
  hood: string;
  side: SideDef;
  rear: RearDef;
  svgSide?: string; // arte vetorial do perfil (viewBox com chão na base)
  imgSide?: string; // sprite do perfil (pixel art)
  sideMask?: string;
  art?: string; // prefixo dos sprites em assets/cars (<art>-side/-rear/-front.png e máscaras)
}

const kmh = (v: number) => v / KMH;

// Carros com marcas fictícias, baseados em modelos reais do começo dos anos 90.
export const CARS: CarSpec[] = [
  {
    id: 'furia-f4', name: 'Furia F4', basedOn: 'Ferrari F40', color: '#c8161a',
    price: '$400.000', position: 'central', drive: 'traseira', engine: 'V8 biturbo',
    displacement: '2.936 cc', power: '478 cv', maxSpeed: kmh(324), zeroTo100: 4.1, accel: 1, handling: 1.0,
    dash: 'f40', hood: '#b01014', art: 'f40',
    // proporções tiradas de fotos de perfil do modelo real
    side: {
      body: [0.003, 0.03, 0, 0.05, 0.012, 0.09, 0.03, 0.11, 0.1, 0.147, 0.2, 0.175, 0.27, 0.188, 0.32, 0.196, 0.45, 0.266, 0.55, 0.274, 0.65, 0.266, 0.7, 0.254, 0.8, 0.221, 0.86, 0.213, 0.875, 0.268, 0.975, 0.27, 0.985, 0.255, 0.99, 0.22, 1, 0.2, 1, 0.06, 0.99, 0.03],
      glass: [0.36, 0.195, 0.45, 0.258, 0.594, 0.266, 0.594, 0.186, 0.4, 0.186],
      wheels: [0.204, 0.8], wheelR: 0.074, shoulder: 0.142,
      parts: [
        { fill: 'glass', pts: [0.605, 0.265, 0.67, 0.258, 0.706, 0.225, 0.68, 0.19, 0.605, 0.19] },
        { fill: 'dark', pts: [0.59, 0.186, 0.632, 0.183, 0.632, 0.15, 0.6, 0.155] },
        { fill: 'dark', pts: [0.6, 0.1, 0.67, 0.1, 0.67, 0.072, 0.62, 0.075] },
        { fill: 'dark', pts: [0.03, 0.07, 0.1, 0.09, 0.1, 0.098, 0.03, 0.078] },
        { fill: 'shade', pts: [0.875, 0.26, 0.975, 0.262, 0.975, 0.27, 0.875, 0.268] },
        { fill: 'black', pts: [0.33, 0.2, 0.355, 0.2, 0.355, 0.212, 0.335, 0.212] },
      ],
      lines: [
        [0.314, 0.17, 0.314, 0.03], [0.588, 0.186, 0.588, 0.03],
        [0.935, 0.13, 0.935, 0.18], [0.947, 0.13, 0.947, 0.18], [0.959, 0.13, 0.959, 0.18], [0.971, 0.13, 0.971, 0.18],
        [0.72, 0.248, 0.84, 0.222], [0.73, 0.242, 0.84, 0.216],
      ],
    },
    rear: { h: 0.57, roof: 0.52, lights: 'quadRound', wing: 2, mesh: true, custom: 'f40', svg: F40_REAR, img: f40RearPng, frontImg: f40FrontPng, glow: { dots: [[0.155, 0.43], [0.25, 0.43], [0.75, 0.43], [0.845, 0.43]] } },
    svgSide: F40_SIDE,
    imgSide: f40SidePng,
  },
  {
    id: 'silber-95', name: 'Silber 95', basedOn: 'Porsche 959', color: '#f0b400',
    price: '$300.000', position: 'traseira', drive: 'integral', engine: 'Boxer 6 biturbo',
    displacement: '2.849 cc', power: '450 cv', maxSpeed: kmh(317), zeroTo100: 3.7, accel: 1, handling: 1.1,
    dash: '959', hood: '#d89c00', art: '959',
    // proporções tiradas da foto de perfil do modelo real
    side: {
      body: [0.01, 0.025, 0, 0.085, 0.03, 0.12, 0.196, 0.165, 0.348, 0.2, 0.465, 0.29, 0.587, 0.296, 0.683, 0.278, 0.804, 0.209, 0.83, 0.22, 0.9, 0.206, 0.957, 0.2, 1, 0.19, 1, 0.15, 0.995, 0.035, 0.97, 0.018, 0.03, 0.018],
      glass: [0.38, 0.205, 0.465, 0.282, 0.6, 0.288, 0.6, 0.205],
      wheels: [0.204, 0.761], wheelR: 0.075, shoulder: 0.16,
      parts: [
        { fill: 'glass', pts: [0.625, 0.287, 0.68, 0.272, 0.76, 0.212, 0.625, 0.205] },
        { fill: 'shade', pts: [0.6, 0.29, 0.625, 0.29, 0.625, 0.205, 0.6, 0.205] },
        { fill: 'dark', pts: [0.625, 0.18, 0.665, 0.175, 0.67, 0.1, 0.64, 0.12] },
        { fill: 'shade', pts: [0.83, 0.214, 0.957, 0.195, 1, 0.186, 1, 0.19, 0.957, 0.2, 0.83, 0.22] },
        { fill: 'amber', pts: [0.94, 0.14, 0.995, 0.14, 0.995, 0.155, 0.94, 0.155] },
        { fill: 'amber', pts: [0.01, 0.088, 0.03, 0.088, 0.03, 0.098, 0.01, 0.098] },
        { fill: 'black', pts: [0.395, 0.222, 0.42, 0.222, 0.42, 0.236, 0.4, 0.236] },
        { fill: 'black', pts: [0.57, 0.163, 0.6, 0.163, 0.6, 0.168, 0.57, 0.168] },
      ],
      lines: [
        [0.335, 0.2, 0.335, 0.03], [0.62, 0.2, 0.635, 0.05],
        [0.03, 0.05, 0.1, 0.05], [0.03, 0.06, 0.1, 0.06], [0.03, 0.07, 0.1, 0.07],
        [0.93, 0.07, 0.99, 0.07], [0.93, 0.085, 0.99, 0.085], [0.93, 0.1, 0.99, 0.1], [0.93, 0.115, 0.99, 0.115],
      ],
    },
    rear: { h: 0.59, roof: 0.56, lights: 'bar', wing: 1, custom: '959', img: s959RearPng, frontImg: s959FrontPng, glow: { bar: [0.1, 0.51, 0.9, 0.58] } },
    imgSide: s959SidePng,
  },
  {
    id: 'toro-v12', name: 'Toro V12', basedOn: 'Lamborghini Diablo', color: '#f0c010',
    price: '$240.000', position: 'central', drive: 'traseira', engine: 'V12 48v',
    displacement: '5.707 cc', power: '492 cv', maxSpeed: kmh(325), zeroTo100: 4.5, accel: 1, handling: 0.9,
    dash: 'diablo', hood: '#d8a808', art: 'diablo',
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
    rear: { h: 0.52, roof: 0.5, lights: 'rect', wing: 1, mesh: true, glow: { dots: [[0.14, 0.587], [0.86, 0.587]] } },
  },
  {
    id: 'vortex-zr', name: 'Vortex ZR', basedOn: 'Corvette ZR-1 (C4)', color: '#d81a12',
    price: '$60.000', position: 'dianteira', drive: 'traseira', engine: 'V8 32v',
    displacement: '5.733 cc', power: '380 cv', maxSpeed: kmh(290), zeroTo100: 4.7, accel: 1, handling: 0.98,
    dash: 'zr1', hood: '#b01410', art: 'zr1',
    side: {
      body: [0, 0.065, 0, 0.11, 0.02, 0.13, 0.3, 0.165, 0.42, 0.176, 0.52, 0.252, 0.64, 0.258, 0.7, 0.25, 0.86, 0.205, 0.97, 0.19, 1, 0.17, 1, 0.07, 0.985, 0.06],
      glass: [0.53, 0.246, 0.64, 0.25, 0.7, 0.242, 0.82, 0.208, 0.54, 0.205],
      wheels: [0.2, 0.76], shoulder: 0.158,
      lines: [[0.3, 0.12, 0.35, 0.15], [0.32, 0.118, 0.37, 0.148], [0.34, 0.116, 0.39, 0.146]],
      parts: [{ fill: 'shade', pts: [0.64, 0.255, 0.66, 0.255, 0.66, 0.205, 0.64, 0.205] }],
    },
    rear: { h: 0.62, roof: 0.6, lights: 'quadSquare', wing: 0, glow: { dots: [[0.14, 0.392], [0.265, 0.392], [0.73, 0.392], [0.86, 0.392]] } },
  },
  {
    id: 'furia-tr', name: 'Furia TR', basedOn: 'Ferrari Testarossa', color: '#d01c1c',
    price: '$180.000', position: 'central', drive: 'traseira', engine: '12 cil. boxer',
    displacement: '4.943 cc', power: '390 cv', maxSpeed: kmh(290), zeroTo100: 5.3, accel: 1, handling: 0.92,
    dash: 'testarossa', hood: '#b01818', art: 'testarossa',
    side: {
      body: [0, 0.06, 0, 0.1, 0.02, 0.128, 0.2, 0.148, 0.34, 0.168, 0.46, 0.244, 0.58, 0.25, 0.65, 0.234, 0.84, 0.212, 0.98, 0.205, 1, 0.18, 1, 0.08, 0.985, 0.06],
      glass: [0.36, 0.172, 0.46, 0.238, 0.57, 0.242, 0.6, 0.182],
      wheels: [0.2, 0.8], shoulder: 0.19,
      lines: [[0.5, 0.165, 0.79, 0.17], [0.5, 0.152, 0.8, 0.156], [0.5, 0.139, 0.8, 0.142], [0.5, 0.126, 0.8, 0.128], [0.5, 0.113, 0.79, 0.114]],
    },
    rear: { h: 0.52, roof: 0.5, lights: 'slats', wing: 0, glow: { dots: [[0.155, 0.587], [0.845, 0.587]] } },
  },
  {
    id: 'toro-lp5', name: 'Toro LP5', basedOn: 'Lamborghini Countach', color: '#e8e8e2',
    price: '$150.000', position: 'central', drive: 'traseira', engine: 'V12 48v',
    displacement: '5.167 cc', power: '455 cv', maxSpeed: kmh(295), zeroTo100: 4.9, accel: 1, handling: 0.88,
    dash: 'countach', hood: '#dcdcd6', art: 'countach',
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
    rear: { h: 0.59, roof: 0.48, lights: 'rect', wing: 2, glow: { dots: [[0.085, 0.627], [0.235, 0.627], [0.765, 0.627], [0.915, 0.627]] } },
  },
  {
    id: 'kaze-nx', name: 'Kaze NX', basedOn: 'Honda NSX', color: '#1a1a1e',
    price: '$65.000', position: 'central', drive: 'traseira', engine: 'V6 24v',
    displacement: '2.977 cc', power: '274 cv', maxSpeed: kmh(270), zeroTo100: 5.7, accel: 1, handling: 1.18,
    dash: 'nsx', hood: '#2a2a30', art: 'nsx',
    side: {
      body: [0, 0.065, 0, 0.1, 0.03, 0.128, 0.22, 0.152, 0.33, 0.168, 0.45, 0.252, 0.58, 0.262, 0.66, 0.248, 0.8, 0.214, 0.92, 0.2, 0.975, 0.216, 1, 0.21, 1, 0.09, 0.985, 0.065],
      glass: [0.35, 0.172, 0.45, 0.246, 0.58, 0.255, 0.66, 0.238, 0.7, 0.205, 0.37, 0.172],
      wheels: [0.2, 0.78], shoulder: 0.158,
      parts: [
        { fill: 'dark', pts: [0.64, 0.135, 0.71, 0.14, 0.71, 0.172, 0.66, 0.17] },
        { fill: 'shade', pts: [0.92, 0.2, 0.975, 0.216, 1, 0.21, 0.94, 0.198] },
      ],
    },
    rear: { h: 0.56, roof: 0.56, lights: 'bar', wing: 1, glow: { bar: [0.04, 0.536, 0.96, 0.625] } },
  },
  {
    id: 'serpe-v10', name: 'Serpe V10', basedOn: 'Dodge Viper RT/10', color: '#c81e24',
    price: '$55.000', position: 'dianteira', drive: 'traseira', engine: 'V10 20v',
    displacement: '7.990 cc', power: '400 cv', maxSpeed: kmh(266), zeroTo100: 4.6, accel: 1, handling: 0.92,
    dash: 'viper', hood: '#a8161a', art: 'viper',
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
    rear: { h: 0.48, roof: 0.5, lights: 'roundPair', wing: 0, roadster: true, glow: { dots: [[0.17, 0.5625], [0.83, 0.5625]] } },
  },
];

// Sprites de cada carro pela chave `art`: <art>-side/-rear/-front.png e as máscaras
const PNG = import.meta.glob('./assets/cars/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const png = (n: string) => PNG[`./assets/cars/${n}.png`];
for (const car of CARS) {
  const k = car.art;
  if (!k) continue;
  car.imgSide = png(`${k}-side`) ?? car.imgSide;
  car.sideMask = png(`${k}-side-mask`);
  car.rear.img = png(`${k}-rear`) ?? car.rear.img;
  car.rear.imgMask = png(`${k}-rear-mask`);
  car.rear.frontImg = png(`${k}-front`) ?? car.rear.frontImg;
  car.rear.frontMask = png(`${k}-front-mask`);
}

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
  paint?: string; // cor escolhida (troca a carroceria do sprite pela máscara)
  model?: string; // trânsito: sedan, hatch, pickup, van, truck (sprites de assets/traffic)
  signal?: number; // seta ligada: -1 lado esquerdo da tela, 1 direito
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
// Trânsito e viatura em pixel art (tools/art/traffic.py); a cor de cada carro vem da máscara
const TPNG = import.meta.glob('./assets/traffic/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const tpng = (n: string) => TPNG[`./assets/traffic/${n}.png`];
export const TRAFFIC_IMAGES = Object.values(TPNG);

function drawTrafficSprite(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook, model: string): boolean {
  const view = look.front ? 'front' : 'rear';
  const img = tpng(`${model}-${view}`);
  const aspect = img && spriteAspect(img);
  if (!img || !aspect) return false;
  const h = w * aspect;
  const mask = tpng(`${model}-${view}-mask`);
  const spr = svgSprite(img, w, h, model !== 'police' && mask ? { mask, color: look.color } : undefined);
  if (!spr) return false;
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(Math.round(x - w * 0.53), Math.round(y - h * 0.04), Math.round(w * 1.06), Math.max(1, Math.round(h * 0.06)));
  const L = Math.round(x - w / 2), T = Math.round(y - h);
  c.drawImage(spr, L, T, Math.round(w), Math.round(h));
  // luzes acesas: lanternas (noite/freio) e giroflex piscando
  if (!look.front && (look.night || look.brake)) {
    c.fillStyle = 'rgba(255,60,40,0.55)';
    for (const [u, f] of TRAFFIC_GLOW[model]?.dots ?? []) c.fillRect(Math.round(L + u * w - w * 0.07), Math.round(T + f * h - h * 0.05), Math.max(1, Math.round(w * 0.14)), Math.max(1, Math.round(h * 0.1)));
  }
  if (look.front && look.night) glow(c, x, y - h * 0.4, w, '255,246,192');
  // seta piscando do lado para onde o carro vai
  if (look.signal && Math.floor(performance.now() / 250) % 2 === 0) {
    const u = look.signal < 0 ? 0.04 : 0.84;
    const f = look.front ? 0.62 : (TRAFFIC_GLOW[model]?.dots?.[0]?.[1] ?? 0.6) - 0.04;
    c.fillStyle = '#ffb020';
    c.fillRect(Math.round(L + u * w), Math.round(T + f * h), Math.max(1, Math.round(w * 0.12)), Math.max(1, Math.round(h * 0.08)));
  }
  if (model === 'police' && look.siren) {
    const on = Math.floor(performance.now() / 120) % 2 === 0;
    const bar = TRAFFIC_GLOW.police.siren!;
    const lamp = (i: number, col: string) => {
      const [u0, f0, u1, f1] = bar[i];
      c.fillStyle = col;
      c.fillRect(Math.round(L + u0 * w), Math.round(T + f0 * h), Math.max(1, Math.round((u1 - u0) * w)), Math.max(1, Math.round((f1 - f0) * h)));
    };
    lamp(0, on ? '#ff3a3a' : '#6a1414');
    lamp(1, on ? '#18287a' : '#4a7aff');
  }
  return true;
}
const TRAFFIC_GLOW: Record<string, { dots?: number[][]; siren?: number[][] }> = {
  sedan: { dots: [[0.15, 0.6], [0.85, 0.6]] }, hatch: { dots: [[0.11, 0.62], [0.89, 0.62]] },
  pickup: { dots: [[0.06, 0.6], [0.94, 0.6]] }, van: { dots: [[0.06, 0.71], [0.94, 0.71]] },
  truck: { dots: [[0.08, 0.79], [0.92, 0.79]] },
  police: { dots: [[0.15, 0.6], [0.85, 0.6]], siren: [[0.34, 0.07, 0.49, 0.11], [0.51, 0.07, 0.66, 0.11]] },
};

export function drawCar(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook) {
  if (w < 2) return;
  // trânsito e polícia: sprites em pixel art (o desenho por código fica de reserva)
  if (!look.rear && (look.police || look.model) && drawTrafficSprite(c, x, y, w, look, look.police ? 'police' : look.model!)) return;
  const tint = (mask?: string) => (look.paint && mask ? { mask, color: look.paint } : undefined);
  if (look.front && look.rear?.frontImg) {
    const h = w * (spriteAspect(look.rear.frontImg) ?? look.rear.h);
    const spr = svgSprite(look.rear.frontImg, w, h, tint(look.rear.frontMask));
    if (spr) {
      c.drawImage(spr, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
      return;
    }
  }
  const art = look.rear?.img ?? look.rear?.svg;
  if (art && look.rear && !look.front) {
    const h = w * ((look.rear.img && spriteAspect(look.rear.img)) || look.rear.h);
    const spr = svgSprite(art, w, h, tint(look.rear.img ? look.rear.imgMask : undefined)) ?? (look.rear.svg ? svgSprite(look.rear.svg, w, h) : null);
    if (spr) {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(x - w * 0.53, y - h * 0.05, w * 1.06, h * 0.08);
      c.drawImage(spr, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
      const gl = look.rear.glow;
      if ((look.brake || look.night) && gl) {
        c.fillStyle = 'rgba(255,50,30,0.5)';
        for (const [u, f] of gl.dots ?? []) {
          c.beginPath();
          c.arc(x - w / 2 + u * w, y - h + f * h, w * 0.06, 0, Math.PI * 2);
          c.fill();
        }
        if (gl.bar) c.fillRect(x - w / 2 + gl.bar[0] * w, y - h + gl.bar[1] * h, (gl.bar[2] - gl.bar[0]) * w, (gl.bar[3] - gl.bar[1]) * h);
      }
      return;
    }
  }
  if (look.rear?.custom === 'f40' && !look.front) return drawRearF40(c, x, y, w, look);
  if (look.rear?.custom === '959' && !look.front) return drawRear959(c, x, y, w, look);
  drawCarCrisp(c, x, y, w, look);
}

// Trânsito, polícia e rivais sem sprite: desenho vetorial convertido em pixel art nítida
const rearIds = new WeakMap<RearDef, number>();
let nextRearId = 1;
function drawCarCrisp(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook) {
  const R = look.rear ?? GENERIC;
  if (!rearIds.has(R)) rearIds.set(R, nextRearId++);
  const h = w * (look.truck ? 1.05 : R.h);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(Math.round(x - w * 0.53), Math.round(y - h * 0.05), Math.round(w * 1.06), Math.max(1, Math.round(h * 0.08)));
  const on = !!look.siren && Math.floor(performance.now() / 120) % 2 === 1;
  const lit = look.brake || look.night;
  const key = `car${rearIds.get(R)}${look.truck ? 'T' : ''}${look.front ? 'F' : ''}${look.police ? 'P' : ''}${on ? 'S' : ''}${lit ? 'L' : ''}${look.color}`;
  const BW = 1.08, BH = 1.16;
  drawCrisp(c, key, x, y, w * BW, h * BH, (o, bw, bh) => {
    const ww = bw / BW;
    const f = { ...look, siren: on, brake: lit, night: false };
    if (look.truck) drawTruck(o, bw / 2, bh, ww, f);
    else drawCarRaw(o, bw / 2, bh, ww, f);
  }, 64);
  if (look.night && look.front) glow(c, x, y - h * (look.truck ? 0.27 : 0.53), w, '255,246,192');
}

function drawCarRaw(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook) {
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
    const on = look.siren;
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

// Traseira detalhada inspirada no F40 (medidas tiradas de foto traseira).
// f = fração da altura a partir do topo da asa; u = fração da largura a partir da esquerda.
function drawRearF40(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook) {
  const h = w * (look.rear?.h ?? 0.53);
  const L = x - w / 2, T = y - h;
  const X = (u: number) => L + u * w;
  const Y = (f: number) => T + f * h;
  const box = (u1: number, f1: number, u2: number, f2: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(X(u1), Y(f1), (u2 - u1) * w, Math.max(1, (f2 - f1) * h));
  };
  const poly = (color: string, ...pts: number[]) => {
    c.fillStyle = color;
    c.beginPath();
    for (let i = 0; i < pts.length; i += 2) c.lineTo(X(pts[i]), Y(pts[i + 1]));
    c.closePath();
    c.fill();
  };
  const body = look.color;
  const lit = look.brake || look.night;

  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(L - w * 0.03, y - h * 0.05, w * 1.06, h * 0.08);
  box(0.05, 0.86, 0.2, 1, '#111');
  box(0.8, 0.86, 0.95, 1, '#111');
  // vão escuro sob a asa (vidro traseiro e céu)
  box(0.06, 0.03, 0.94, 0.27, '#0c0c10');
  // tampa do motor com venezianas
  poly('#c9ced3', 0.24, 0.08, 0.76, 0.08, 0.82, 0.25, 0.18, 0.25);
  if (w > 24) {
    for (let i = 0; i < 6; i++) {
      const f = 0.1 + i * 0.024;
      box(0.3 + i * 0.006, f, 0.485, f + 0.012, '#141414');
      box(0.515, f, 0.7 - i * 0.006, f + 0.012, '#141414');
    }
  }
  // carroceria: faixa superior, para-choque e saia
  poly(body, 0.02, 0.25, 0.98, 0.25, 0.98, 0.88, 0.95, 0.9, 0.05, 0.9, 0.02, 0.88);
  box(0.02, 0.25, 0.98, 0.27, shade(body, 0.12));
  box(0.08, 0.86, 0.92, 0.9, '#1a1a1a');
  // painel preto em tela com as lanternas
  box(0.04, 0.33, 0.96, 0.6, '#141414');
  if (w > 30) {
    c.fillStyle = '#242424';
    for (let yy = Y(0.34); yy < Y(0.6); yy += 2) for (let xx = X(0.05) + ((yy | 0) % 4 ? 0 : 1); xx < X(0.95); xx += 2) c.fillRect(xx, yy, 1, 1);
  }
  box(0.38, 0.4, 0.62, 0.53, '#0a0a0a');
  const rr = Math.max(0.8, w * 0.046);
  for (const [u, outer] of [[0.1, true], [0.2, false], [0.8, false], [0.9, true]] as [number, boolean][]) {
    c.fillStyle = lit ? (outer ? '#ff7a30' : '#ff3a2a') : outer ? '#d8681c' : '#c01818';
    c.beginPath();
    c.arc(X(u), Y(0.465), rr, 0, Math.PI * 2);
    c.fill();
    if (w > 40) {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.arc(X(u) - rr * 0.3, Y(0.465) - rr * 0.3, rr * 0.3, 0, Math.PI * 2);
      c.fill();
    }
  }
  // refletores e escape triplo
  box(0.08, 0.7, 0.17, 0.75, lit ? '#e04020' : '#9a2a14');
  box(0.83, 0.7, 0.92, 0.75, lit ? '#e04020' : '#9a2a14');
  box(0.42, 0.77, 0.58, 0.84, '#161616');
  if (w > 20) for (const u of [0.455, 0.5, 0.545]) {
    c.fillStyle = '#8a8a8e';
    c.beginPath();
    c.ellipse(X(u), Y(0.805), w * 0.018, h * 0.025, 0, 0, Math.PI * 2);
    c.fill();
  }
  // asa de ponta a ponta com as laterais descendo
  poly(body, 0, 0, 0.07, 0, 0.11, 0.3, 0.04, 0.3);
  poly(body, 1, 0, 0.93, 0, 0.89, 0.3, 0.96, 0.3);
  box(0, 0, 1, 0.045, body);
  box(0, 0.035, 1, 0.045, shade(body, -0.3));
  if (look.night) glow(c, x, Y(0.465), w, '255,40,40');
}

// Traseira detalhada inspirada no 959 (medidas tiradas de foto traseira).
function drawRear959(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook) {
  const h = w * (look.rear?.h ?? 0.7);
  const L = x - w / 2, T = y - h;
  const X = (u: number) => L + u * w;
  const Y = (f: number) => T + f * h;
  const box = (u1: number, f1: number, u2: number, f2: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(X(u1), Y(f1), (u2 - u1) * w, Math.max(1, (f2 - f1) * h));
  };
  const poly = (color: string, ...pts: number[]) => {
    c.fillStyle = color;
    c.beginPath();
    for (let i = 0; i < pts.length; i += 2) c.lineTo(X(pts[i]), Y(pts[i + 1]));
    c.closePath();
    c.fill();
  };
  const body = look.color;
  const lit = look.brake || look.night;
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(L - w * 0.03, y - h * 0.04, w * 1.06, h * 0.06);
  box(0.04, 0.84, 0.2, 1, '#101010');
  box(0.8, 0.84, 0.96, 1, '#101010');
  // cabine (teto estreito do 911) e vidro traseiro
  poly(shade(body, -0.06), 0.24, 0, 0.76, 0, 0.9, 0.3, 0.1, 0.3);
  poly('#1c2632', 0.28, 0.04, 0.72, 0.04, 0.8, 0.24, 0.2, 0.24);
  if (w > 30) poly('#2c3a48', 0.34, 0.06, 0.5, 0.06, 0.46, 0.22, 0.26, 0.22);
  // aerofólio em arco com fenda escura
  poly(body, 0.07, 0.43, 0.06, 0.32, 0.14, 0.27, 0.86, 0.27, 0.94, 0.32, 0.93, 0.43);
  box(0.12, 0.28, 0.88, 0.3, shade(body, 0.14));
  box(0.23, 0.31, 0.77, 0.35, '#202024');
  box(0.07, 0.42, 0.93, 0.44, shade(body, -0.3));
  // carroceria, faixa de lanterna contínua (âmbar nas pontas)
  poly(body, 0.02, 0.44, 0.98, 0.44, 1, 0.56, 1, 0.84, 0, 0.84, 0, 0.56);
  box(0.03, 0.47, 0.97, 0.56, '#3a0a0a');
  box(0.12, 0.48, 0.88, 0.55, lit ? '#ff2a20' : '#b01410');
  if (w > 40) for (const u of [0.2, 0.4, 0.6, 0.8]) box(u, 0.49, u + 0.08, 0.54, lit ? '#ff6a50' : '#d02a20');
  box(0.03, 0.48, 0.12, 0.55, '#e08a14');
  box(0.88, 0.48, 0.97, 0.55, '#e08a14');
  // grelhas laterais, placa, grade inferior com escapes e saia preta
  for (const f of [0.6, 0.64, 0.68, 0.72]) {
    box(0.01, f, 0.05, f + 0.02, '#141414');
    box(0.95, f, 0.99, f + 0.02, '#141414');
  }
  box(0.4, 0.58, 0.6, 0.76, '#121214');
  if (w > 40) box(0.43, 0.65, 0.57, 0.68, '#c8c8c8');
  box(0.06, 0.77, 0.94, 0.84, '#161618');
  if (w > 20) for (const u of [0.3, 0.7]) {
    c.fillStyle = '#5a5a5e';
    c.beginPath();
    c.ellipse(X(u), Y(0.805), w * 0.035, h * 0.03, 0, 0, Math.PI * 2);
    c.fill();
  }
  box(0.04, 0.84, 0.96, 0.92, '#0c0c0e');
  if (look.night) glow(c, x, Y(0.515), w, '255,40,40');
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
    c.fillStyle = look.night || look.brake ? '#ff3030' : '#a01414';
    c.fillRect(L + w * 0.04, y - h * 0.25, w * 0.12, h * 0.07);
    c.fillRect(x + w / 2 - w * 0.16, y - h * 0.25, w * 0.12, h * 0.07);
  }
}

// Vista lateral (escolha do carro e posto). x = frente do carro, y = chão.
export function drawCarSide(c: CanvasRenderingContext2D, x: number, y: number, len: number, car: CarSpec, paint?: string) {
  if (car.imgSide) {
    const aspect = spriteAspect(car.imgSide);
    const tint = paint && car.sideMask ? { mask: car.sideMask, color: paint } : undefined;
    const spr = aspect ? svgSprite(car.imgSide, len, len * aspect, tint) : null;
    if (spr && aspect) {
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.beginPath();
      c.ellipse(x + len / 2, y, len * 0.5, len * 0.022, 0, 0, Math.PI * 2);
      c.fill();
      c.drawImage(spr, Math.round(x), Math.round(y - len * aspect), Math.round(len), Math.round(len * aspect));
      return;
    }
  }
  if (car.svgSide) {
    // viewBox 1071 x 300 com o chão em y = 294
    const h = (len * 300) / 1071;
    const spr = svgSprite(car.svgSide, len, h);
    if (spr) {
      c.drawImage(spr, Math.round(x), Math.round(y - (h * 294) / 300), Math.round(len), Math.round(h));
      return;
    }
  }
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

  // carroceria com volume: superfícies de cima claras, laterais mais escuras embaixo
  const topV = Math.max(...S.body.filter((_, i) => i % 2 === 1));
  const g = c.createLinearGradient(0, y - topV * len, 0, y);
  g.addColorStop(0, shade(car.color, 0.2));
  g.addColorStop(0.35, shade(car.color, 0.05));
  g.addColorStop(0.6, car.color);
  g.addColorStop(0.85, shade(car.color, -0.14));
  g.addColorStop(1, shade(car.color, -0.32));
  c.fillStyle = g;
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

  const gg = c.createLinearGradient(0, y - topV * len, 0, y - 0.18 * len);
  gg.addColorStop(0, '#5a6a7c');
  gg.addColorStop(0.5, '#2a3644');
  gg.addColorStop(1, '#141c26');
  c.fillStyle = gg;
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

  const wr = S.wheelR ?? 0.07;
  for (const wx of S.wheels) {
    const cx = x + wx * len, cy = y - len * wr, r = len * wr;
    c.fillStyle = '#0c0c0c';
    c.beginPath();
    c.arc(cx, cy, r * 1.12, Math.PI, 0);
    c.fill();
    c.fillStyle = '#141414';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    // roda em estrela de 5 raios largos com porca central
    const rg = c.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r * 0.68);
    rg.addColorStop(0, '#f0f0f2');
    rg.addColorStop(1, '#9a9ca2');
    c.fillStyle = rg;
    c.beginPath();
    c.arc(cx, cy, r * 0.68, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2a2c30';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2 + Math.PI / 5;
      const a1 = a - 0.38, a2 = a + 0.38;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r * 0.24, cy + Math.sin(a) * r * 0.24);
      c.lineTo(cx + Math.cos(a1) * r * 0.58, cy + Math.sin(a1) * r * 0.58);
      c.arc(cx, cy, r * 0.58, a1, a2);
      c.closePath();
      c.fill();
    }
    c.strokeStyle = '#d8dade';
    c.lineWidth = Math.max(1, r * 0.06);
    c.beginPath();
    c.arc(cx, cy, r * 0.66, Math.PI * 1.1, Math.PI * 1.7);
    c.stroke();
    c.fillStyle = '#5a5c62';
    c.beginPath();
    c.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#c8cacf';
    c.beginPath();
    c.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
    c.fill();
  }
}
