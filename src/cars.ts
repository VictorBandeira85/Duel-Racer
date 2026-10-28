import { drawCrisp } from './crisp';
import { KMH, RES } from './config';
import { clamp, shade } from './util';
import { BR_CARS } from './carsbr';
import { PAINTS } from './paint';
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
  // pinturas com arte própria (decalques na cor certa): cor da paleta -> sprites
  variants?: Record<string, { img?: string; frontImg?: string }>;
  lamps?: LampDef;
}

// Faróis e piscas de cada modelo, em frações do sprite (lado esquerdo da tela; o direito é o
// espelho). Escamoteável: a tampa fechada desenhada no sprite [u0, f0, u1, f1]; aberto, o farol
// ocupa a tampa inteira e sobe a partir dela (sem um segundo farol ao lado). Fixo: u, f e raio.
// Piscas: [u0, f0, u1, f1] retangular ou [u, f, r] redondo, sobre a lanterna/farol de cada carro.
export interface LampDef {
  pop?: [number, number, number, number];
  head?: [number, number, number];
  sigRear: number[];
  sigFront: number[];
  sigRed?: boolean; // pisca vermelho atrás (carros americanos)
  podColor?: string; // cor da tampa do farol (senão a da carroceria)
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
  zeroTo100: number; // segundos, usado para calibrar a tração na largada
  zeroTo200?: number; // segundos (testes da época), usado para calibrar a potência efetiva acima de 100
  accel: number; // multiplicador da potência (melhorias de motor/câmbio)
  mass: number; // kg
  gears: number[]; // velocidade máxima de cada marcha, em fração da máxima do carro
  curve: PowerCurve; // como o motor entrega a potência ao longo do giro
  lateralG: number; // aderência em curva (g)
  brakeG: number; // força de frenagem (g)
  aero: number; // ganho de aderência a 300 km/h pela asa e o fundo (negativo: a frente flutua)
  traction?: number; // aderência na largada (em g), calibrada pelo 0-100
  drag?: number; // arrasto aerodinâmico (por m), calibrado pela velocidade máxima
  handling: number;
  arcadeOnly?: boolean; // fora da concessionária e dos pilotos da carreira
  automatic?: boolean; // câmbio automático de fábrica (só muda o que a ficha mostra)
  pendingArt?: boolean; // ficha pronta, esperando a arte (src/carsbr.ts)
  dash: string; // cabine: 'A'/'B' (desenhadas por código) ou a chave da arte em COCKPIT_ART
  hood: string;
  side: SideDef;
  rear: RearDef;
  svgSide?: string; // arte vetorial do perfil (viewBox com chão na base)
  imgSide?: string; // sprite do perfil (pixel art)
  sideMask?: string;
  sideVariants?: Record<string, string>; // pinturas com arte própria: cor da paleta -> lateral
  wheels?: number[][]; // rodas na lateral: [u, v, raio] (frações do sprite)
  art?: string; // prefixo dos sprites em assets/cars (<art>-side/-rear/-front.png e máscaras)
}

const kmh = (v: number) => v / KMH;
const G5 = [0.28, 0.45, 0.62, 0.8, 1]; // câmbio de 5 marchas típico

// turbo: fraco embaixo e "explode" no meio; seqturbo: turbos em sequência, mais linear;
// v12/flat12: aspirados que crescem até o alto; vtec: acorda no giro alto; torque: V8/V10
// grandes, com muita força desde baixo e fôlego menor no fim
export type PowerCurve = 'turbo' | 'seqturbo' | 'v12' | 'flat12' | 'vtec' | 'torque';

// Carros com marcas fictícias, baseados em modelos reais do começo dos anos 90.
export const CARS: CarSpec[] = [
  {
    id: 'furia-f4', name: 'Furia F4', basedOn: 'Ferrari F40', color: '#c8161a',
    price: '$400.000', position: 'central', drive: 'traseira', engine: 'V8 biturbo',
    displacement: '2.936 cc', power: '478 cv', maxSpeed: kmh(324), zeroTo100: 4.1, zeroTo200: 11.0, accel: 1, mass: 1100, gears: G5, curve: 'turbo', lateralG: 1.0, brakeG: 1.05, aero: 0.12, handling: 1.0,
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
    displacement: '2.849 cc', power: '450 cv', maxSpeed: kmh(317), zeroTo100: 3.7, zeroTo200: 13.3, accel: 1, mass: 1450, gears: [0.22, 0.36, 0.5, 0.65, 0.82, 1], curve: 'seqturbo', lateralG: 0.96, brakeG: 1.12, handling: 1.1, aero: 0.06,
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
    id: 'toro-v12', name: 'Toro V12', basedOn: 'Lamborghini Diablo SV', color: '#f2c200',
    // SV: versão leve e mais forte (sem tração integral), câmbio mais curto, asa regulável
    price: '$260.000', position: 'central', drive: 'traseira', engine: 'V12 48v',
    displacement: '5.707 cc', power: '517 cv', maxSpeed: kmh(300), zeroTo100: 4.0, zeroTo200: 14.0, accel: 1, mass: 1530, gears: [0.3, 0.47, 0.64, 0.82, 1], curve: 'v12', lateralG: 0.95, brakeG: 1.02, handling: 0.93, aero: 0.08,
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
    rear: { h: 0.56, roof: 0.5, lights: 'quadRound', wing: 1, glow: { dots: [[0.145, 0.357], [0.225, 0.357], [0.775, 0.357], [0.855, 0.357]] } },
  },
  {
    id: 'vortex-zr', name: 'Vortex ZR', basedOn: 'Corvette ZR-1 (C4)', color: '#d81a12',
    price: '$60.000', position: 'dianteira', drive: 'traseira', engine: 'V8 32v',
    displacement: '5.733 cc', power: '380 cv', maxSpeed: kmh(290), zeroTo100: 4.7, zeroTo200: 17.5, accel: 1, mass: 1590, gears: [0.25, 0.38, 0.52, 0.66, 0.82, 1], curve: 'torque', lateralG: 0.95, brakeG: 1.12, handling: 0.98, aero: 0.02,
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
    displacement: '4.943 cc', power: '390 cv', maxSpeed: kmh(290), zeroTo100: 5.3, zeroTo200: 19.5, accel: 1, mass: 1506, gears: G5, curve: 'flat12', lateralG: 0.88, brakeG: 0.98, aero: -0.03, handling: 0.92,
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
    displacement: '5.167 cc', power: '455 cv', maxSpeed: kmh(295), zeroTo100: 4.9, zeroTo200: 16.8, accel: 1, mass: 1490, gears: G5, curve: 'v12', lateralG: 0.92, brakeG: 1.0, handling: 0.88, aero: 0.08,
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
    displacement: '2.977 cc', power: '274 cv', maxSpeed: kmh(270), zeroTo100: 5.7, zeroTo200: 22.5, accel: 1, mass: 1370, gears: G5, curve: 'vtec', lateralG: 0.97, brakeG: 1.1, handling: 1.18, aero: 0.03,
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
    displacement: '7.990 cc', power: '400 cv', maxSpeed: kmh(266), zeroTo100: 4.6, zeroTo200: 17.8, accel: 1, mass: 1490, gears: [0.3, 0.45, 0.6, 0.74, 0.87, 1], curve: 'torque', lateralG: 0.96, brakeG: 1.0, handling: 0.92, aero: -0.02,
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
  {
    // a viatura que persegue o jogador; pilotável (e adversária) só no Arcade
    id: 'patrol', name: 'Patrulha 9C', basedOn: 'Chevrolet Caprice 9C1 (viatura)', color: '#141414', arcadeOnly: true, automatic: true,
    price: '$24.000', position: 'dianteira', drive: 'traseira', engine: 'V8 16v',
    displacement: '5.733 cc', power: '205 cv', maxSpeed: kmh(212), zeroTo100: 8.6, accel: 1, mass: 1840, gears: [0.36, 0.6, 0.82, 1], curve: 'torque', lateralG: 0.82, brakeG: 0.92, aero: -0.02, handling: 0.84,
    dash: 'patrol', hood: '#141414', art: 'patrol',
    side: {
      body: [0, 0.06, 0, 0.13, 0.12, 0.16, 0.3, 0.17, 0.4, 0.25, 0.68, 0.25, 0.8, 0.18, 1, 0.17, 1, 0.06],
      glass: [0.42, 0.24, 0.66, 0.24, 0.76, 0.18, 0.36, 0.18],
      wheels: [0.18, 0.76], shoulder: 0.15,
    },
    rear: { h: 0.78, roof: 0.6, lights: 'rect', wing: 0, glow: { dots: [[0.17, 0.6], [0.83, 0.6]] } },
  },
  {
    // Diablo SV da polícia: adversária nos eventos de classe S da carreira e pilotável no Arcade
    id: 'patrol-sv', name: 'Toro V12 Polícia', basedOn: 'Lamborghini Diablo SV (polícia)', color: '#f2f2f2', arcadeOnly: true,
    price: '$260.000', position: 'central', drive: 'traseira', engine: 'V12 48v',
    displacement: '5.707 cc', power: '517 cv', maxSpeed: kmh(300), zeroTo100: 4.0, zeroTo200: 14.0, accel: 1, mass: 1560, gears: [0.3, 0.47, 0.64, 0.82, 1], curve: 'v12', lateralG: 0.95, brakeG: 1.02, handling: 0.93, aero: 0.08,
    dash: 'diablo', hood: '#e8e8ea', art: 'patrolsv',
    side: {
      body: [0, 0.055, 0, 0.085, 0.03, 0.115, 0.2, 0.145, 0.3, 0.162, 0.47, 0.246, 0.58, 0.25, 0.64, 0.236, 0.85, 0.198, 0.96, 0.19, 1, 0.17, 1, 0.08, 0.985, 0.055],
      glass: [0.33, 0.168, 0.47, 0.24, 0.575, 0.243, 0.615, 0.2],
      wheels: [0.2, 0.8], shoulder: 0.15,
    },
    rear: { h: 0.585, roof: 0.5, lights: 'quadRound', wing: 1, glow: { dots: [[0.145, 0.384], [0.225, 0.384], [0.775, 0.384], [0.855, 0.384]] } },
  },
];

// carros nacionais: entram no jogo quando a arte deles existir (lateral e traseira)
const PNG0 = import.meta.glob('./assets/cars/*.png', { eager: true, import: 'default' }) as Record<string, string>;
for (const car of BR_CARS) {
  if (PNG0[`./assets/cars/${car.art}-side.png`] && PNG0[`./assets/cars/${car.art}-rear.png`]) {
    car.pendingArt = false;
    CARS.push(car);
  }
}

// carros à venda na carreira (a viatura fica de fora)
export const DEALER_CARS = CARS.filter((c) => !c.arcadeOnly);

// nome do arquivo da variante -> nome da cor na paleta
const VARIANT_PAINT: Record<string, string> = { nero: 'Deep Black', rosso: 'Rosso Lucido', blu: 'Blu Le Mans', verde: 'Verde Ithaca', giallo: 'Giallo' };

const LAMPS: Record<string, LampDef> = {
  diablo: { pop: [0.145, 0.473, 0.29, 0.58], sigRear: [0.145, 0.357, 0.036], sigFront: [0.125, 0.66, 0.165, 0.715] },
  patrolsv: { pop: [0.145, 0.473, 0.29, 0.58], podColor: '#1c1c1e', sigRear: [0.145, 0.384, 0.036], sigFront: [0.125, 0.66, 0.165, 0.715] },
  f40: { pop: [0.09, 0.41, 0.24, 0.47], sigRear: [0.155, 0.43, 0.04], sigFront: [0.1, 0.615, 0.17, 0.65] },
  zr1: { pop: [0.105, 0.385, 0.29, 0.505], sigRear: [0.135, 0.39, 0.045], sigRed: true, sigFront: [0.03, 0.66, 0.07, 0.73] },
  testarossa: { pop: [0.135, 0.52, 0.255, 0.565], sigRear: [0.05, 0.44, 0.13, 0.58], sigFront: [0.04, 0.67, 0.125, 0.72] },
  nsx: { pop: [0.06, 0.545, 0.26, 0.59], sigRear: [0.04, 0.53, 0.12, 0.62], sigFront: [0.07, 0.67, 0.17, 0.73] },
  countach: { pop: [0.09, 0.57, 0.26, 0.62], sigRear: [0.125, 0.55, 0.2, 0.69], sigFront: [0.05, 0.64, 0.14, 0.7] },
  viper: { head: [0.165, 0.54, 0.06], sigRear: [0.08, 0.46, 0.16, 0.5], sigRed: true, sigFront: [0.04, 0.6, 0.1, 0.65] },
  '959': { head: [0.17, 0.49, 0.05], sigRear: [0.083, 0.51, 0.183, 0.57], sigFront: [0.05, 0.65, 0.13, 0.68] },
  'br-golgti': { head: [0.18, 0.53, 0.05], sigRear: [0.03, 0.41, 0.2, 0.465], sigFront: [0.045, 0.47, 0.1, 0.58] },
  'br-vectra': { head: [0.2, 0.56, 0.05], sigRear: [0.065, 0.415, 0.14, 0.475], sigFront: [0.07, 0.515, 0.105, 0.605] },
  patrol: { head: [0.145, 0.53, 0.07], sigRear: [0.035, 0.503, 0.26, 0.568], sigRed: true, sigFront: [0.05, 0.6, 0.24, 0.645] },
};

// Rodas na lateral (u, v do centro e raio, em frações da largura/altura e da largura do
// sprite), medidas pelo aro claro acima do contato com o chão: giram na chegada ao posto
const WHEELS: Record<string, number[][]> = {
  '959': [[0.199, 0.739, 0.08], [0.754, 0.74, 0.08]],
  'br-golgti': [[0.197, 0.773, 0.086], [0.833, 0.773, 0.086]],
  'br-vectra': [[0.175, 0.788, 0.066], [0.777, 0.792, 0.064]],
  'countach': [[0.234, 0.733, 0.07], [0.827, 0.708, 0.077]],
  'diablo': [[0.204, 0.73, 0.072], [0.794, 0.72, 0.074]],
  'f40': [[0.22, 0.722, 0.081], [0.78, 0.726, 0.08]],
  'nsx': [[0.236, 0.726, 0.07], [0.813, 0.713, 0.073]],
  'patrol': [[0.188, 0.794, 0.07], [0.739, 0.798, 0.068]],
  'patrolsv': [[0.204, 0.747, 0.072], [0.794, 0.738, 0.074]],
  'testarossa': [[0.223, 0.706, 0.073], [0.793, 0.692, 0.076]],
  'viper': [[0.226, 0.638, 0.076], [0.773, 0.628, 0.078]],
  'zr1': [[0.21, 0.734, 0.076], [0.766, 0.734, 0.076]],
};

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
  car.rear.lamps = LAMPS[k];
  car.wheels = WHEELS[k];
  // <art>-side-<cor>.png: a arte daquela pintura (usada no lugar da repintura pela máscara)
  for (const [name, paintName] of Object.entries(VARIANT_PAINT)) {
    const side = png(`${k}-side-${name}`);
    if (!side) continue;
    const hex = PAINTS.find((p) => p.name === paintName)!.hex;
    (car.sideVariants ??= {})[hex] = side;
    (car.rear.variants ??= {})[hex] = { img: png(`${k}-rear-${name}`), frontImg: png(`${k}-front-${name}`) };
  }
}

// ---------- física compartilhada (corrida e gráfico de aceleração) ----------
// Modelo por forças, em unidades reais (m/s, m/s²): potência do motor ÷ (peso × velocidade),
// limitada pela tração; menos arrasto do ar (cresce com v²) e resistência dos pneus.
// A velocidade máxima aparece onde o motor empata com o ar; a tração é calibrada pelo
// 0-100 real de cada carro e o arrasto pela máxima real.
export const G = 9.81;
const ROLL = 0.18; // resistência dos pneus e atritos (m/s²)
const EFFICIENCY = 0.85; // perdas na transmissão
export const toMs = (v: number) => (v * KMH) / 3.6;
export const toGame = (a: number) => (a * 3.6) / KMH;
const powerW = (car: CarSpec) => Number(car.power.replace(/\D/g, '')) * 735.5 * EFFICIENCY * car.accel;

// fração da potência máxima conforme a rotação, por tipo de motor
function powerShape(rpm: number, curve: PowerCurve = 'v12') {
  const r = clamp(rpm, 0.1, 1);
  switch (curve) {
    case 'turbo': return r < 0.35 ? 0.22 + 0.5 * r : r < 0.6 ? 0.4 + ((r - 0.35) / 0.25) * 0.58 : r < 0.88 ? 0.98 + (r - 0.6) * 0.07 : 1 - (r - 0.88) * 0.9;
    case 'seqturbo': return r < 0.75 ? 0.45 + (0.55 * r) / 0.75 : 1 - (r - 0.75) * 0.4;
    case 'v12': return r < 0.9 ? 0.3 + (0.7 * r) / 0.9 : 1 - (r - 0.9) * 0.6;
    case 'flat12': return r < 0.85 ? 0.38 + (0.62 * r) / 0.85 : 1 - (r - 0.85) * 0.7;
    case 'vtec': return r < 0.62 ? 0.32 + (0.43 * r) / 0.62 : r < 0.93 ? 0.75 + ((r - 0.62) / 0.31) * 0.25 : 1 - (r - 0.93) * 0.5;
    case 'torque': return r < 0.6 ? 0.58 + (0.42 * r) / 0.6 : r < 0.8 ? 1 : 1 - (r - 0.8) * 0.9;
  }
}

// aceleração do motor (m/s²) na marcha atual; zero no corte de giro
export function driveAcc(car: CarSpec, gear: number, speed: number) {
  const gearMax = car.maxSpeed * car.gears[gear];
  if (speed >= gearMax) return 0;
  const v = Math.max(toMs(speed), 1.5);
  const aPow = (powerW(car) * powerShape(speed / gearMax, car.curve)) / (car.mass * v);
  return Math.min(aPow, (car.traction ?? 1) * G);
}

// resistência: ar (v²) + pneus (m/s²)
export function resistAcc(car: CarSpec, speed: number, dragMul = 1) {
  const v = toMs(speed);
  return (car.drag ?? 0) * dragMul * v * v + ROLL;
}

export function autoGear(car: CarSpec, gear: number, speed: number, throttle: boolean) {
  const rpm = speed / (car.maxSpeed * car.gears[gear]);
  if (rpm >= 0.97 && throttle && gear < car.gears.length - 1) return gear + 1;
  if (gear > 0 && speed < car.maxSpeed * car.gears[gear - 1] * 0.85) return gear - 1;
  return gear;
}

// marcha que o câmbio automático usaria nesta velocidade (rival e gráficos)
export function gearFor(car: CarSpec, speed: number) {
  let g = 0;
  while (g < car.gears.length - 1 && speed >= car.maxSpeed * car.gears[g] * 0.97) g++;
  return g;
}

// ---------- trem de força: câmbio com tempo de troca, turbo com atraso e patinação ----------
export const SHIFT_T = 0.22; // corte de potência a cada marcha acima (s)
export const LAUNCH_BOOST = 0.6; // pressão do turbo na largada, segurando o giro na contagem
// k: parte da potência que depende da pressão do turbo; rate: rapidez com que ela enche (1/s)
const TURBO: Partial<Record<PowerCurve, { k: number; rate: number }>> = {
  turbo: { k: 0.45, rate: 1.3 },
  seqturbo: { k: 0.3, rate: 2.6 },
};

export class Powertrain {
  gear = 0;
  boost = 1; // pressão do turbo (0..1); aspirados ficam sempre em 1
  shiftT = 0;
  spin = 0; // rodas patinando (0..1): potência sobrando acima da aderência
  constructor(public car: CarSpec) {}

  shift(gear: number) {
    if (gear > this.gear) this.shiftT = SHIFT_T;
    this.gear = gear;
  }

  // aceleração do motor (m/s²), já limitada pela tração; tracMul = piso / lombada
  step(speed: number, throttle: boolean, dt: number, tracMul = 1, auto = true) {
    const car = this.car;
    if (auto) this.shift(autoGear(car, this.gear, speed, throttle));
    if (this.shiftT > 0) this.shiftT -= dt;
    const gearMax = car.maxSpeed * car.gears[this.gear];
    const rpm = speed / gearMax;
    const on = throttle && this.shiftT <= 0;
    const tb = TURBO[car.curve];
    if (tb) {
      // enche mais devagar em giro baixo; alivia (válvula de alívio) ao tirar o pé ou trocar marcha
      const rate = on ? tb.rate * (0.4 + clamp(rpm, 0, 1)) : 2;
      this.boost += ((on ? 1 : 0) - this.boost) * Math.min(1, dt * rate);
    }
    this.spin = 0;
    if (!on || speed >= gearMax) return 0;
    const v = Math.max(toMs(speed), 1.5);
    const mult = tb ? 1 - tb.k * (1 - this.boost) : 1;
    const aPow = (powerW(car) * powerShape(rpm, car.curve) * mult) / (car.mass * v);
    const cap = (car.traction ?? 1) * G * tracMul;
    // a tração calibrada já é a arrancada "no limite"; as rodas só giram em falso quando
    // sobra bem mais potência do que isso (integral quase nunca, motor central menos que dianteiro)
    const loose = cap * (car.drive === 'integral' ? 2.5 : car.position === 'dianteira' ? 1.6 : 1.8);
    this.spin = clamp((aPow / loose - 1) * 0.6, 0, 1);
    return Math.min(aPow, cap);
  }
}

// aderência extra (ou a menos) pela aerodinâmica, nesta velocidade
export const aeroMul = (car: CarSpec, speed: number) => 1 + car.aero * (toMs(speed) / 83.3) ** 2;

// arrasto que faz a máxima acontecer exatamente na velocidade de ficha do carro
export function prepareCar(car: CarSpec) {
  const vmax = toMs(car.maxSpeed) * 0.995;
  const aPow = (powerW(car) * powerShape(0.995, car.curve)) / (car.mass * vmax);
  car.drag = Math.max(0.00002, (aPow - ROLL) / (vmax * vmax));
  return car;
}

// ---------- classe de desempenho (D, C, B, A, S) ----------
// Índice de 0 a ~1000 medido na própria física: tempo de 0 a 200 km/h (aceleração), velocidade
// máxima, aderência em curva e freio. Cada classe cobre uma faixa do índice.
export type PerfClass = 'D' | 'C' | 'B' | 'A' | 'S';
export const PERF_CLASSES: PerfClass[] = ['D', 'C', 'B', 'A', 'S'];
export const CLASS_COLOR: Record<PerfClass, string> = { D: '#3a9ad8', C: '#30b050', B: '#e0b020', A: '#e8641a', S: '#d02a8a' };
const CLASS_MIN: Record<PerfClass, number> = { D: 0, C: 230, B: 560, A: 645, S: 720 };
const piCache = new WeakMap<CarSpec, number>();
export function perfIndex(car: CarSpec) {
  let pi = piCache.get(car);
  if (pi !== undefined) return pi;
  const pt = new Powertrain(car);
  pt.boost = LAUNCH_BOOST;
  let v = 0, t = 0, t200 = 60;
  const dt = 1 / 60;
  while (t < 60) {
    v += toGame(pt.step(v, true, dt) - resistAcc(car, v)) * dt;
    t += dt;
    if (v * KMH >= 200) { t200 = t; break; }
  }
  const acc = Math.min(1, 9 / t200); // 0-200 em 9 s = nota máxima
  const top = Math.min(1, (car.maxSpeed * KMH - 150) / 180);
  const grip = Math.min(1, (car.lateralG - 0.7) / 0.32);
  const brake = Math.min(1, (car.brakeG - 0.8) / 0.34);
  pi = Math.round(1000 * (0.4 * acc + 0.3 * top + 0.18 * grip + 0.12 * brake));
  piCache.set(car, pi);
  return pi;
}
export function perfClass(car: CarSpec): PerfClass {
  const pi = perfIndex(car);
  return [...PERF_CLASSES].reverse().find((k) => pi >= CLASS_MIN[k])!;
}

// posição do motor / tração, abreviados para caber na ficha técnica
export const gearbox = (car: CarSpec) => `${car.gears.length} ${car.automatic ? 'autom.' : 'marchas'}`;
export const layout = (car: CarSpec) => `${car.position.slice(0, 4)}. / ${car.drive.slice(0, 4)}.`;

// Curva de aceleração (km/h a cada 0,25 s) e tempo de 0 a 100 km/h

export function accelCurve(car: CarSpec, seconds = 14) {
  const pts: number[] = [];
  let speed = 0, t100 = 0;
  const dt = 1 / 60;
  const pt = new Powertrain(car);
  pt.boost = LAUNCH_BOOST;
  for (let i = 0; i <= seconds * 60; i++) {
    if (i % 15 === 0) pts.push(speed * KMH);
    speed += toGame(pt.step(speed, true, dt) - resistAcc(car, speed)) * dt;
    if (!t100 && speed * KMH >= 100) t100 = (i + 1) * dt;
  }
  return { pts, t100 };
}

// tempo até uma velocidade (km/h), com a física do jogo
function timeTo(car: CarSpec, kmhTarget: number, limit: number) {
  const pt = new Powertrain(car);
  pt.boost = LAUNCH_BOOST;
  let v = 0;
  const dt = 1 / 60;
  for (let i = 1; i <= limit * 60; i++) {
    v += toGame(pt.step(v, true, dt) - resistAcc(car, v)) * dt;
    if (v * KMH >= kmhTarget) return i * dt;
  }
  return 99;
}

// calibra um carro: arrasto pela máxima, tração pelo 0-100 real e (quando a ficha traz) a
// potência efetiva pelo 0-200 real — perdas, inércia das rodas e trocas de marcha que a ficha
// não mostra. A máxima continua a da ficha (o arrasto é recalculado junto).
export function calibrate(car: CarSpec) {
  const fitTraction = () => {
    prepareCar(car);
    let lo = 0.2, hi = 1.6;
    const secs = Math.ceil(car.zeroTo100 + 6);
    for (let i = 0; i < 18; i++) {
      car.traction = (lo + hi) / 2;
      const t = accelCurve(car, secs).t100 || 99;
      if (t > car.zeroTo100) lo = car.traction;
      else hi = car.traction;
    }
  };
  fitTraction();
  if (car.zeroTo200) {
    for (let round = 0; round < 3; round++) {
      let lo = 0.4, hi = 1.4;
      for (let i = 0; i < 14; i++) {
        car.accel = (lo + hi) / 2;
        prepareCar(car);
        if (timeTo(car, 200, car.zeroTo200 * 2) > car.zeroTo200) lo = car.accel;
        else hi = car.accel;
      }
      fitTraction();
    }
  }
  return car;
}
for (const car of CARS) calibrate(car);

// ---------- desenho ----------
export interface CarLook {
  color: string;
  rear?: RearDef; // modelo específico (rival); sem isso, carro genérico de trânsito
  front?: boolean;
  truck?: boolean;
  police?: boolean;
  siren?: boolean;
  sv?: boolean; // polícia: a Diablo SV em vez do sedã
  brake?: boolean;
  night?: boolean;
  paint?: string; // cor escolhida (troca a carroceria do sprite pela máscara)
  model?: string; // trânsito: sedan, hatch, pickup, van, truck (sprites de assets/traffic)
  signal?: number; // seta ligada: -1 lado esquerdo da tela, 1 direito
  flash?: boolean; // trânsito de frente piscando o farol alto (assustado)
  tilt?: number; // batido: o desenho fica inclinado (rad), girando em torno da base
  lamps?: { up: number; on: boolean; high?: boolean }; // faróis: quanto subiram (escamoteáveis), acesos, farol alto
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

// carros grandes na tela são rasterizados na resolução real (RES pixels por pixel do jogo);
// os pequenos e distantes, na do jogo (economiza memória e tempo na corrida)
const hiRes = (w: number) => (w >= 40 ? RES : 1);

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
  const q = hiRes(w);
  const spr = svgSprite(img, w * q, h * q, !model.startsWith('police') && mask ? { mask, color: look.color } : undefined);
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
  if (look.front && look.flash) { // farol alto piscando
    glow(c, x, y - h * 0.4, w, '255,250,220');
    glow(c, x, y - h * 0.4, w * 1.3, '255,250,220');
  }
  // seta piscando do lado para onde o carro vai
  if (look.signal && Math.floor(performance.now() / 250) % 2 === 0) {
    const u = look.signal < 0 ? 0.04 : 0.84;
    const f = look.front ? 0.62 : (TRAFFIC_GLOW[model]?.dots?.[0]?.[1] ?? 0.6) - 0.04;
    c.fillStyle = '#ffb020';
    c.fillRect(Math.round(L + u * w), Math.round(T + f * h), Math.max(1, Math.round(w * 0.12)), Math.max(1, Math.round(h * 0.08)));
  }
  const tg = TRAFFIC_GLOW[model];
  if (look.siren && tg?.siren) {
    const on = Math.floor(performance.now() / 120) % 2 === 0;
    const bar = (look.front && tg.sirenFront) || tg.siren;
    // cores de cada lâmpada (esquerda, direita) nesta vista; a da esquerda acende primeiro
    const cols = (look.front ? tg.sirenColorsFront : tg.sirenColors) ?? ['blue', 'red'];
    const lit: Record<string, [string, string]> = { blue: ['#4a7aff', '#10184a'], red: ['#ff3a3a', '#4a1010'] };
    const lamp = (i: number, col: string) => {
      const [u0, f0, u1, f1] = bar[i];
      c.fillStyle = col;
      c.fillRect(Math.round(L + u0 * w), Math.round(T + f0 * h), Math.max(1, Math.round((u1 - u0) * w)), Math.max(1, Math.round((f1 - f0) * h)));
    };
    lamp(0, lit[cols[0]][on ? 0 : 1]);
    lamp(1, lit[cols[1]][on ? 1 : 0]);
  }
  return true;
}
const TRAFFIC_GLOW: Record<string, { dots?: number[][]; siren?: number[][]; sirenFront?: number[][]; sirenColors?: string[]; sirenColorsFront?: string[] }> = {
  sedan: { dots: [[0.15, 0.6], [0.85, 0.6]] }, hatch: { dots: [[0.11, 0.62], [0.89, 0.62]] },
  pickup: { dots: [[0.06, 0.6], [0.94, 0.6]] }, van: { dots: [[0.06, 0.71], [0.94, 0.71]] },
  truck: { dots: [[0.08, 0.79], [0.92, 0.79]] },
  // giroflex da arte: azul à esquerda, vermelho à direita (u0, f0, u1, f1 em fração do sprite)
  police: { dots: [[0.17, 0.6], [0.83, 0.6]], siren: [[0.23, 0.0, 0.42, 0.075], [0.52, 0.0, 0.77, 0.075]] },
  // Diablo SV: barra baixa no teto; de trás azul|vermelho, de frente vermelho|azul
  policesv: {
    dots: [[0.185, 0.384], [0.815, 0.384]],
    siren: [[0.325, 0.009, 0.49, 0.034], [0.51, 0.009, 0.675, 0.034]], sirenColors: ['blue', 'red'],
    sirenFront: [[0.325, 0.045, 0.49, 0.071], [0.51, 0.045, 0.675, 0.071]], sirenColorsFront: ['red', 'blue'],
  },
};

export function drawCar(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook) {
  if (w < 2) return;
  if (look.tilt && Math.abs(look.tilt) > 0.01) {
    c.save();
    c.translate(x, y);
    c.rotate(look.tilt);
    c.translate(-x, -y);
    drawCar(c, x, y, w, { ...look, tilt: 0 });
    c.restore();
    return;
  }
  // trânsito e polícia: sprites em pixel art (o desenho por código fica de reserva)
  if (!look.rear && (look.police || look.model) && drawTrafficSprite(c, x, y, w, look, look.police ? (look.sv ? 'policesv' : 'police') : look.model!)) return;
  const variant = look.paint ? look.rear?.variants?.[look.paint] : undefined;
  const tint = (mask?: string) => (look.paint && mask && !variant ? { mask, color: look.paint } : undefined);
  const frontImg = variant?.frontImg ?? look.rear?.frontImg;
  if (look.front && look.rear && frontImg) {
    const h = w * (spriteAspect(frontImg) ?? look.rear.h);
    const spr = svgSprite(frontImg, w * hiRes(w), h * hiRes(w), tint(look.rear.frontMask));
    if (spr) {
      c.drawImage(spr, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
      if (look.rear.lamps) drawLamps(c, x - w / 2, y - h, w, h, look, look.rear.lamps, true);
      return;
    }
  }
  const art = variant?.img ?? look.rear?.img ?? look.rear?.svg;
  if (art && look.rear && !look.front) {
    const h = w * ((look.rear.img && spriteAspect(art)) || look.rear.h);
    const q = look.rear.img ? hiRes(w) : 1;
    const spr = svgSprite(art, w * q, h * q, tint(look.rear.img ? look.rear.imgMask : undefined)) ?? (look.rear.svg ? svgSprite(look.rear.svg, w, h) : null);
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
      if (look.rear.lamps) drawLamps(c, x - w / 2, y - h, w, h, look, look.rear.lamps, false);
      return;
    }
  }
  if (look.rear?.custom === 'f40' && !look.front) return drawRearF40(c, x, y, w, look);
  if (look.rear?.custom === '959' && !look.front) return drawRear959(c, x, y, w, look);
  drawCarCrisp(c, x, y, w, look);
}

// pisca: ~1,4 Hz, como o relé de verdade
export const blinkOn = () => Math.floor(performance.now() / 350) % 2 === 0;

// faróis escamoteáveis subindo/acesos, faróis fixos acesos e piscas, sobre o sprite (L, T, w, h)
function drawLamps(c: CanvasRenderingContext2D, L: number, T: number, w: number, h: number, look: CarLook, d: LampDef, front: boolean) {
  const st = look.lamps ?? { up: look.night ? 1 : 0, on: !!look.night };
  const halo = (hx: number, hy: number, r: number, a: number) => {
    const g = c.createRadialGradient(hx, hy, 0, hx, hy, r);
    g.addColorStop(0, `rgba(255,248,215,${a})`);
    g.addColorStop(1, 'rgba(255,248,215,0)');
    c.fillStyle = g;
    c.fillRect(hx - r, hy - r, r * 2, r * 2);
  };
  if (front && d.pop && st.up > 0) {
    // o farol ocupa a tampa (mesma largura e lugar) e sobe a partir da borda da frente dela
    const [u0, f0, u1, f1] = d.pop;
    const bw = Math.max(1, Math.round((u1 - u0) * w));
    const yb = Math.round(T + f1 * h);
    const rise = Math.max(1, Math.round(w * 0.035)) * st.up;
    const bh = Math.max(1, Math.round((f1 - f0) * h + rise));
    for (const lu of [u0, 1 - u1]) {
      const x0 = Math.round(L + lu * w);
      c.fillStyle = '#0a0a0c'; // contorno (e o vão da tampa aberta)
      c.fillRect(x0, yb - bh, bw, bh);
      c.fillStyle = d.podColor ?? look.paint ?? look.color; // tampa, agora em pé
      c.fillRect(x0 + 0.5, yb - bh + 0.5, bw - 1, Math.max(0.5, Math.round(bh * 0.35 * 2) / 2));
      const ly = yb - bh + 0.5 + Math.max(0.5, Math.round(bh * 0.35 * 2) / 2) + 0.5;
      const lh = yb - 0.5 - ly;
      if (lh > 0) { // lente
        c.fillStyle = st.on ? '#fff8d8' : '#a8b0bc';
        c.fillRect(x0 + 0.5, ly, bw - 1, lh);
        c.fillStyle = st.on ? '#ffffff' : '#d8dee6';
        c.fillRect(x0 + 0.5, ly, Math.max(0.5, Math.round(bw * 0.3)), 0.5);
      }
      if (st.on && st.up >= 1) halo(x0 + bw / 2, ly + lh / 2, w * (st.high ? 0.2 : 0.13), st.high ? 0.6 : 0.38);
    }
  }
  if (front && d.head && st.on) {
    const [u, f, r] = d.head;
    for (const cu of [u, 1 - u]) {
      const hx = L + cu * w, hy = T + f * h;
      halo(hx, hy, w * (st.high ? 0.2 : 0.13), st.high ? 0.65 : 0.4);
      c.fillStyle = '#fffbe8';
      c.beginPath();
      c.arc(hx, hy, Math.max(0.6, r * w * 0.8), 0, Math.PI * 2);
      c.fill();
    }
  }
  if (look.signal && blinkOn()) {
    const q = front ? d.sigFront : d.sigRear;
    // de frente, o lado esquerdo do carro fica à direita do sprite; no retrovisor (espelho)
    // volta para a esquerda: nos dois casos o lado na tela é o sinal da seta
    const right = look.signal > 0;
    c.fillStyle = !front && d.sigRed ? '#ff7058' : '#ffa018';
    if (q.length === 3) { // lanterna redonda: acende a própria lâmpada, do tamanho dela
      const cx = L + (right ? 1 - q[0] : q[0]) * w;
      c.beginPath();
      c.arc(cx, T + q[1] * h, Math.max(0.7, q[2] * w), 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffe0a0';
      c.fillRect(Math.round(cx - q[2] * w * 0.4), Math.round(T + q[1] * h - q[2] * w * 0.4), Math.max(0.5, Math.round(q[2] * w * 0.5)), Math.max(0.5, Math.round(q[2] * w * 0.5)));
    } else {
      // retangular: a própria lente da lanterna acende (luz somada, mantém o desenho dela)
      const u0 = right ? 1 - q[2] : q[0], u1 = right ? 1 - q[0] : q[2];
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = !front && d.sigRed ? 'rgba(255,110,60,0.75)' : 'rgba(255,150,30,0.8)';
      c.fillRect(Math.round(L + u0 * w), Math.round(T + q[1] * h), Math.max(1, Math.round((u1 - u0) * w)), Math.max(1, Math.round((q[3] - q[1]) * h)));
      c.restore();
    }
    c.fillStyle = 'rgba(255,170,40,0.2)';
    // brilho no centro da lâmpada (redonda: o próprio centro; retangular: o meio do retângulo)
    const qu = q.length === 3 ? q[0] : (q[0] + q[2]) / 2, qf = q.length === 3 ? q[1] : (q[1] + q[3]) / 2;
    const sx = L + (right ? 1 - qu : qu) * w, sy = T + qf * h;
    c.beginPath();
    c.arc(sx, sy, w * 0.045, 0, Math.PI * 2);
    c.fill();
  }
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
// spin: ângulo das rodas (rad); com ele, cada roda é redesenhada girando no lugar
export function drawCarSide(c: CanvasRenderingContext2D, x: number, y: number, len: number, car: CarSpec, paint?: string, spin?: number) {
  if (car.imgSide) {
    const img = (paint && car.sideVariants?.[paint]) || car.imgSide;
    const aspect = spriteAspect(img);
    const tint = paint && car.sideMask && img === car.imgSide ? { mask: car.sideMask, color: paint } : undefined;
    // na resolução real da tela (o canvas tem RES pixels por pixel do jogo): reduzir a arte
    // na resolução do jogo e depois ampliar apagava linhas e colunas de pixels (traço quebrado)
    const spr = aspect ? svgSprite(img, len * RES, len * aspect * RES, tint) : null;
    if (spr && aspect) {
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.beginPath();
      c.ellipse(x + len / 2, y, len * 0.5, len * 0.022, 0, 0, Math.PI * 2);
      c.fill();
      const L = Math.round(x), T = Math.round(y - len * aspect), W = Math.round(len), H = Math.round(len * aspect);
      c.drawImage(spr, L, T, W, H);
      if (spin !== undefined && car.wheels) {
        const sw = spr.width / W, sh = spr.height / H;
        for (const [u, v, rr] of car.wheels) {
          const cx = L + u * W, cy = T + v * H, R = rr * W - 0.5;
          c.save();
          c.beginPath();
          c.arc(cx, cy, R, 0, Math.PI * 2);
          c.clip();
          c.translate(cx, cy);
          c.rotate(spin);
          c.drawImage(spr, (cx - L - R) * sw, (cy - T - R) * sh, 2 * R * sw, 2 * R * sh, -R, -R, 2 * R, 2 * R);
          c.restore();
        }
      }
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
