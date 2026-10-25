import { shade } from './util';

export interface CarSpec {
  id: string;
  name: string;
  color: string;
  accent: string;
  maxSpeed: number;
  accel: number;
  handling: number;
  gears: number[]; // fração da velocidade máxima no limite de cada marcha
}

// Carros fictícios (inspirados nos superesportivos dos anos 90, sem marcas reais)
export const CARS: CarSpec[] = [
  { id: 'vespra', name: 'Vespra GT', color: '#d42020', accent: '#ffd400', maxSpeed: 11600, accel: 1.15, handling: 1.15, gears: [0.24, 0.42, 0.6, 0.8, 1] },
  { id: 'falco', name: 'Falco RS', color: '#f2c200', accent: '#111111', maxSpeed: 12400, accel: 1.0, handling: 1.0, gears: [0.24, 0.42, 0.6, 0.8, 1] },
  { id: 'lamina', name: 'Lâmina V12', color: '#f4f4f4', accent: '#1d4fd8', maxSpeed: 13200, accel: 0.88, handling: 0.88, gears: [0.24, 0.42, 0.6, 0.8, 1] },
];

export const RIVAL = { name: 'Sombra X', color: '#1e1e26', accent: '#9b30ff' };

export const TRAFFIC_COLORS = ['#2a6fdb', '#e8e8e8', '#3d9b47', '#c9a227', '#7a3db8', '#d9542b', '#555566', '#80c0e0'];

export interface CarLook {
  color: string;
  accent?: string;
  front?: boolean; // vindo na contramão (vemos a frente)
  truck?: boolean;
  lean?: number; // -1..1 inclinação ao virar
  brake?: boolean;
}

// Desenha um carro visto de trás (ou de frente) com base em (x, y) e largura w.
export function drawCar(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook) {
  if (w < 2) return;
  if (look.truck) return drawTruck(c, x, y, w, look);
  const h = w * 0.55;
  const lean = (look.lean ?? 0) * w * 0.06;
  const L = x - w / 2;

  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(L - w * 0.03, y - h * 0.06, w * 1.06, h * 0.1);
  // pneus
  c.fillStyle = '#111';
  c.fillRect(L + w * 0.02, y - h * 0.3, w * 0.2, h * 0.3);
  c.fillRect(x + w / 2 - w * 0.22, y - h * 0.3, w * 0.2, h * 0.3);
  // carroceria
  c.fillStyle = look.color;
  c.fillRect(L, y - h * 0.64, w, h * 0.44);
  c.fillStyle = shade(look.color, -0.18);
  c.fillRect(L, y - h * 0.3, w, h * 0.1);
  // cabine
  c.fillStyle = shade(look.color, -0.08);
  c.beginPath();
  c.moveTo(L + w * 0.08, y - h * 0.64);
  c.lineTo(x + w / 2 - w * 0.08, y - h * 0.64);
  c.lineTo(x + w * 0.3 + lean, y - h);
  c.lineTo(x - w * 0.3 + lean, y - h);
  c.closePath();
  c.fill();
  c.fillStyle = look.front ? '#2a3b52' : '#16202e';
  c.beginPath();
  c.moveTo(L + w * 0.16, y - h * 0.67);
  c.lineTo(x + w / 2 - w * 0.16, y - h * 0.67);
  c.lineTo(x + w * 0.25 + lean, y - h * 0.94);
  c.lineTo(x - w * 0.25 + lean, y - h * 0.94);
  c.closePath();
  c.fill();
  // faixa de destaque
  if (look.accent) {
    c.fillStyle = look.accent;
    c.fillRect(x - w * 0.07, y - h * 0.64, w * 0.14, h * 0.34);
  }
  // luzes
  if (look.front) {
    c.fillStyle = '#fff7c0';
    c.fillRect(L + w * 0.04, y - h * 0.56, w * 0.18, h * 0.1);
    c.fillRect(x + w / 2 - w * 0.22, y - h * 0.56, w * 0.18, h * 0.1);
    c.fillStyle = '#222';
    c.fillRect(x - w * 0.2, y - h * 0.5, w * 0.4, h * 0.12);
  } else {
    c.fillStyle = look.brake ? '#ff3a3a' : '#9e1414';
    c.fillRect(L + w * 0.03, y - h * 0.58, w * 0.22, h * 0.11);
    c.fillRect(x + w / 2 - w * 0.25, y - h * 0.58, w * 0.22, h * 0.11);
    c.fillStyle = '#e8e8e8';
    c.fillRect(x - w * 0.12, y - h * 0.42, w * 0.24, h * 0.08);
  }
}

function drawTruck(c: CanvasRenderingContext2D, x: number, y: number, w: number, look: CarLook) {
  const h = w * 1.05;
  const L = x - w / 2;
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(L - w * 0.03, y - h * 0.04, w * 1.06, h * 0.06);
  c.fillStyle = '#111';
  c.fillRect(L + w * 0.04, y - h * 0.16, w * 0.22, h * 0.16);
  c.fillRect(x + w / 2 - w * 0.26, y - h * 0.16, w * 0.22, h * 0.16);
  if (look.front) {
    c.fillStyle = look.color;
    c.fillRect(L, y - h, w, h * 0.86);
    c.fillStyle = '#1c2a3a';
    c.fillRect(L + w * 0.08, y - h * 0.9, w * 0.84, h * 0.3);
    c.fillStyle = '#333';
    c.fillRect(L + w * 0.15, y - h * 0.45, w * 0.7, h * 0.22);
    c.fillStyle = '#fff7c0';
    c.fillRect(L + w * 0.05, y - h * 0.3, w * 0.12, h * 0.07);
    c.fillRect(x + w / 2 - w * 0.17, y - h * 0.3, w * 0.12, h * 0.07);
  } else {
    c.fillStyle = '#d8d8d8';
    c.fillRect(L, y - h, w, h * 0.86);
    c.fillStyle = look.color;
    c.fillRect(L, y - h * 0.72, w, h * 0.12);
    c.fillStyle = '#9a9a9a';
    c.fillRect(x - w * 0.01, y - h * 0.98, w * 0.02, h * 0.8);
    c.fillStyle = '#9e1414';
    c.fillRect(L + w * 0.04, y - h * 0.25, w * 0.12, h * 0.07);
    c.fillRect(x + w / 2 - w * 0.16, y - h * 0.25, w * 0.12, h * 0.07);
  }
}
