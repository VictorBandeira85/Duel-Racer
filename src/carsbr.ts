import { KMH } from './config';
import type { CarSpec, PowerCurve } from './cars';

// Esportivos nacionais (anos 70 a 90), classes D e C. Ficam fora do jogo até a arte chegar:
// cada um entra sozinho quando existirem os sprites assets/cars/<art>-side.png e -rear.png
// (frente, máscaras e cabine são opcionais). Nomes fictícios, como nos outros carros.

const kmh = (v: number) => v / KMH;
const G4 = [0.33, 0.56, 0.8, 1];
const G5 = [0.27, 0.45, 0.63, 0.82, 1];

interface Br {
  id: string; name: string; basedOn: string; color: string; price: number;
  position: 'dianteira' | 'traseira' | 'central'; engine: string; cc: number; cv: number;
  kmh: number; z100: number; kg: number; gears?: number[]; curve: PowerCurve; lat: number; brake: number; handling: number;
}

// silhueta provisória (só é usada se faltar um sprite)
const SIDE = {
  body: [0, 0.07, 0, 0.13, 0.12, 0.16, 0.3, 0.17, 0.4, 0.25, 0.68, 0.25, 0.8, 0.18, 1, 0.17, 1, 0.07],
  glass: [0.42, 0.24, 0.66, 0.24, 0.76, 0.18, 0.36, 0.18], wheels: [0.18, 0.78] as [number, number], shoulder: 0.15,
};

const spec = (b: Br): CarSpec => ({
  id: b.id, name: b.name, basedOn: b.basedOn, color: b.color, price: `$${b.price.toLocaleString('pt-BR')}`,
  position: b.position, drive: 'traseira', engine: b.engine, displacement: `${b.cc.toLocaleString('pt-BR')} cc`, power: `${b.cv} cv`,
  maxSpeed: kmh(b.kmh), zeroTo100: b.z100, accel: 1, mass: b.kg, gears: b.gears ?? G5, curve: b.curve,
  lateralG: b.lat, brakeG: b.brake, aero: 0, handling: b.handling,
  dash: 'A', hood: b.color, art: b.id, side: SIDE,
  rear: { h: 0.62, roof: 0.6, lights: 'rect', wing: 0, glow: { dots: [[0.16, 0.6], [0.84, 0.6]] } },
  pendingArt: true,
});
// tração dianteira na maioria (Gol, Escort, Kadett, Uno, Tempra, Tipo, Vectra, Corsa, Monza)
const fwd = (c: CarSpec): CarSpec => ({ ...c, drive: 'dianteira' });

export const BR_CARS: CarSpec[] = [
  // ---- classe C (os mais fortes) ----
  // Vectra GSi: arte completa (lateral, traseira, frente, máscaras e cabine com o quadro de verdade)
  { ...fwd(spec({ id: 'br-vectra', name: 'Vetor GSi', basedOn: 'Chevrolet Vectra GSi 2.0 16v (1994)', color: '#c81810', price: 27000, position: 'dianteira', engine: '4 cil. 16v', cc: 1998, cv: 150, kmh: 213, z100: 8.9, kg: 1200, curve: 'vtec', lat: 0.86, brake: 0.95, handling: 0.95 })), dash: 'br-vectra', rear: { h: 0.7, roof: 0.6, lights: 'rect', wing: 1, glow: { dots: [[0.12, 0.5], [0.88, 0.5]], bar: [0.44, 0.24, 0.58, 0.275] } } },
  fwd(spec({ id: 'br-tempra', name: 'Tempo Turbo', basedOn: 'Fiat Tempra Turbo 2.0 (1994)', color: '#c81818', price: 25000, position: 'dianteira', engine: '4 cil. turbo', cc: 1995, cv: 165, kmh: 216, z100: 8.2, kg: 1240, curve: 'turbo', lat: 0.83, brake: 0.92, handling: 0.9 })),
  fwd(spec({ id: 'br-gol16v', name: 'Gaúcho GTi 16V', basedOn: 'VW Gol GTi 2.0 16v (1995)', color: '#ececec', price: 22000, position: 'dianteira', engine: '4 cil. 16v', cc: 1984, cv: 145, kmh: 205, z100: 8.0, kg: 1030, curve: 'vtec', lat: 0.88, brake: 0.95, handling: 1.02 })),
  fwd(spec({ id: 'br-tipo16v', name: 'Tiplo 16V', basedOn: 'Fiat Tipo Sedicivalvole 2.0 16v (1995)', color: '#1a3aa8', price: 21000, position: 'dianteira', engine: '4 cil. 16v', cc: 1995, cv: 137, kmh: 205, z100: 8.9, kg: 1170, curve: 'vtec', lat: 0.86, brake: 0.93, handling: 0.97 })),
  spec({ id: 'br-omega', name: 'Ômaga CD', basedOn: 'Chevrolet Omega CD 3.0 (1993)', color: '#2a2a3a', price: 30000, position: 'dianteira', engine: '6 cil. em linha', cc: 2969, cv: 165, kmh: 215, z100: 9.2, kg: 1380, curve: 'torque', lat: 0.84, brake: 0.95, handling: 0.88 }),
  fwd(spec({ id: 'br-uno', name: 'Unão Turbo', basedOn: 'Fiat Uno Turbo i.e. 1.4 (1994)', color: '#c81818', price: 15000, position: 'dianteira', engine: '4 cil. turbo', cc: 1372, cv: 118, kmh: 195, z100: 8.8, kg: 950, curve: 'turbo', lat: 0.86, brake: 0.92, handling: 1.02 })),
  spec({ id: 'br-charger', name: 'Carregador R/T', basedOn: 'Dodge Charger R/T 318 V8 (1971)', color: '#e8a018', price: 24000, position: 'dianteira', engine: 'V8', cc: 5212, cv: 215, kmh: 190, z100: 11.0, kg: 1500, gears: G4, curve: 'torque', lat: 0.72, brake: 0.8, handling: 0.78 }),
  spec({ id: 'br-maverick', name: 'Mavério GT', basedOn: 'Ford Maverick GT V8 302 (1974)', color: '#1a7a3a', price: 23000, position: 'dianteira', engine: 'V8', cc: 4950, cv: 197, kmh: 185, z100: 10.5, kg: 1350, gears: G4, curve: 'torque', lat: 0.74, brake: 0.8, handling: 0.8 }),
  // ---- classe D ----
  { ...fwd(spec({ id: 'br-golgti', name: 'Gaúcho GTI', basedOn: 'VW Gol GTI 2.0 (1994)', color: '#d81a12', price: 16000, position: 'dianteira', engine: '4 cil. 8v', cc: 1984, cv: 120, kmh: 185, z100: 9.2, kg: 970, curve: 'torque', lat: 0.86, brake: 0.92, handling: 1.0 })), dash: 'br-golgti', rear: { h: 0.75, roof: 0.62, lights: 'rect', wing: 1, glow: { dots: [[0.1, 0.5], [0.28, 0.5], [0.72, 0.5], [0.9, 0.5]] } } },
  fwd(spec({ id: 'br-kadett', name: 'Cadete GSi', basedOn: 'Chevrolet Kadett GSi 2.0 (1989)', color: '#f0c000', price: 17000, position: 'dianteira', engine: '4 cil. 8v', cc: 1998, cv: 121, kmh: 190, z100: 9.6, kg: 1030, curve: 'torque', lat: 0.85, brake: 0.9, handling: 0.97 })),
  fwd(spec({ id: 'br-xr3', name: 'Escoltar XR3', basedOn: 'Ford Escort XR3 2.0i (1993)', color: '#1a3aa8', price: 16500, position: 'dianteira', engine: '4 cil. 8v', cc: 1984, cv: 115, kmh: 185, z100: 9.8, kg: 1050, curve: 'torque', lat: 0.85, brake: 0.9, handling: 0.97 })),
  fwd(spec({ id: 'br-corsa', name: 'Corsário GSi', basedOn: 'Chevrolet Corsa GSi 1.6 16v (1995)', color: '#d81a12', price: 14000, position: 'dianteira', engine: '4 cil. 16v', cc: 1598, cv: 108, kmh: 190, z100: 9.5, kg: 950, curve: 'vtec', lat: 0.85, brake: 0.92, handling: 1.03 })),
  fwd(spec({ id: 'br-monza', name: 'Monção S/R', basedOn: 'Chevrolet Monza S/R 2.0 (1986)', color: '#ececec', price: 13000, position: 'dianteira', engine: '4 cil. 8v', cc: 1998, cv: 110, kmh: 180, z100: 10.5, kg: 1060, curve: 'torque', lat: 0.8, brake: 0.86, handling: 0.9 })),
  spec({ id: 'br-opala', name: 'Opalino SS', basedOn: 'Chevrolet Opala SS 4.1 (1976)', color: '#1c1c20', price: 15000, position: 'dianteira', engine: '6 cil. 12v', cc: 4093, cv: 148, kmh: 180, z100: 10.5, kg: 1180, gears: G4, curve: 'torque', lat: 0.74, brake: 0.8, handling: 0.82 }),
  { ...spec({ id: 'br-pumagtb', name: 'Onça GTB', basedOn: 'Puma GTB S2 4.1 (1979)', color: '#c8ccd0', price: 19000, position: 'dianteira', engine: '6 cil. 12v', cc: 4093, cv: 140, kmh: 180, z100: 10.0, kg: 1150, gears: G4, curve: 'torque', lat: 0.78, brake: 0.82, handling: 0.86 }), dash: 'br-pumagtb', rear: { h: 0.62, roof: 0.62, lights: 'rect', wing: 0, glow: { dots: [[0.18, 0.6], [0.3, 0.6], [0.7, 0.6], [0.82, 0.6]] } } },
  fwd(spec({ id: 'br-passat', name: 'Passeio GTS', basedOn: 'VW Passat GTS Pointer 1.8 (1985)', color: '#c8c8cc', price: 11000, position: 'dianteira', engine: '4 cil. 8v', cc: 1781, cv: 99, kmh: 175, z100: 10.8, kg: 940, gears: G4, curve: 'torque', lat: 0.82, brake: 0.86, handling: 0.95 })),
  spec({ id: 'br-pumagte', name: 'Onça GTE', basedOn: 'Puma GTE 1.6 (1976)', color: '#d81a12', price: 12000, position: 'traseira', engine: 'Boxer 4 a ar', cc: 1584, cv: 90, kmh: 170, z100: 11.0, kg: 680, gears: G4, curve: 'flat12', lat: 0.84, brake: 0.84, handling: 1.05 }),
  spec({ id: 'br-chevette', name: 'Chevete SR', basedOn: 'Chevrolet Chevette SR 1.6 (1983)', color: '#f0c000', price: 8000, position: 'dianteira', engine: '4 cil. 8v', cc: 1599, cv: 82, kmh: 160, z100: 13.0, kg: 900, gears: G4, curve: 'torque', lat: 0.8, brake: 0.84, handling: 0.95 }),
  fwd(spec({ id: 'br-147', name: 'Fiato Rallye', basedOn: 'Fiat 147 Rallye 1.3 (1979)', color: '#ececec', price: 7000, position: 'dianteira', engine: '4 cil. 8v', cc: 1297, cv: 72, kmh: 155, z100: 14.0, kg: 820, gears: G4, curve: 'torque', lat: 0.8, brake: 0.84, handling: 1.0 })),
  spec({ id: 'br-sp2', name: 'Ponto SP2', basedOn: 'VW SP2 1.7 (1973)', color: '#e8641a', price: 10000, position: 'traseira', engine: 'Boxer 4 a ar', cc: 1678, cv: 75, kmh: 160, z100: 16.0, kg: 890, gears: G4, curve: 'flat12', lat: 0.8, brake: 0.82, handling: 0.98 }),
];
