// Dinamômetro de rolo: potência (cv) e torque (kgfm) ao longo do giro, tirados da física do jogo
// (cars.ts): forma do motor (powerShape, torque × giro), potência com as peças (accel / ficha) e, no
// turbo, a pressão de verdade numa puxada de rolo de alguns segundos: ela enche com a rapidez e no giro
// da turbina (spool: a .32 cedo, a .70 tarde) e o que falta de pressão tira força (TURBO.k), como na
// corrida. Supercharger: a curva já é a do carro com o compressor (sem atraso).
import { TURBO, powerShape, type CarSpec } from './cars';
import { engineSpec } from './enginesynth';

export interface DynoPt { r: number; rpm: number; cv: number; kgfm: number; boost: number }
export interface DynoRun { pts: DynoPt[]; redline: number; peakCv: DynoPt; peakT: DynoPt }
export const PULL_S = 5; // duração da puxada no rolo (s), do giro baixo ao corte
export const R0 = 0.16; // giro em que a puxada começa (fração do corte)

export const redlineOf = (car: CarSpec) => (car.engine ? engineSpec(car.engine.replace(/ (turbo|compressor)$/, ''), car.id).redline : 6500);

/** puxada no rolo: base = carro de fábrica (a potência de ficha); car = o carro medido */
export function dynoRun(base: CarSpec, car: CarSpec, n = 120): DynoRun {
  const cvMax = (parseInt(base.power) || 100) * (car.accel / base.accel);
  const redline = redlineOf(base);
  const tb = TURBO[car.curve];
  const sp = car.spool;
  let boost = tb ? 0.15 : 1;
  const dt = PULL_S / n;
  const pts: DynoPt[] = [];
  for (let i = 0; i <= n; i++) {
    const r = R0 + ((1 - R0) * i) / n;
    if (tb && i) {
      // como em Powertrain.step com o pé no fundo: enche conforme o giro; a turbina grande só no giro dela
      const rate = tb.rate * (sp ? sp[0] : 1) * (0.4 + r);
      const zone = sp ? 0.12 + 0.88 * Math.max(0, Math.min(1, (r - sp[1] + 0.12) / 0.24)) : 1;
      boost += (zone - boost) * Math.min(1, dt * rate);
    }
    const mult = tb ? 1 - tb.k * (1 - boost) : 1;
    const cv = cvMax * powerShape(r, car.curve) * mult;
    const rpm = r * redline;
    const kgfm = (cv * 735.5) / ((2 * Math.PI * rpm) / 60) / 9.80665;
    pts.push({ r, rpm, cv, kgfm, boost });
  }
  const peakCv = pts.reduce((a, p) => (p.cv > a.cv ? p : a), pts[0]);
  const peakT = pts.reduce((a, p) => (p.kgfm > a.kgfm ? p : a), pts[0]);
  return { pts, redline, peakCv, peakT };
}
