// Desgaste do carro da carreira: pneus e motor (0..1, 1 = novo). Pneus gastam com os km e muito mais
// com patinadas, derrapagens e escorregões; o motor perde um pouco com os km, com o corte de giro e
// sobretudo com superaquecimento. A revisão da oficina (upkeep.ts) devolve os 100%.
// Aqui só a parte pura (a corrida soma o uso; a ficha aplica o efeito), sem depender da carreira.
import type { CarSpec } from './cars';

export interface Health { tires: number; engine: number; km?: number /* km rodados desde a última revisão */ }
export const NEW_HEALTH: Health = { tires: 1, engine: 1, km: 0 };
/** uso acumulado num trecho (a corrida soma; no fim do trecho vai para o save) */
export interface Use { km: number; tire: number; engine: number }
export const newUse = (): Use => ({ km: 0, tire: 0, engine: 0 });

// taxas: um evento puxado (~15 km, patinadas e escorregões) gasta ~5% dos pneus e ~2% do motor
export const TIRE_KM = 0.0012; // por km
export const TIRE_SPIN = 0.005; // por segundo de roda patinando (1 = patinando forte)
export const TIRE_SLIP = 0.003; // por segundo de carro escorregando na curva / atravessado
export const ENGINE_KM = 0.0006; // por km
export const ENGINE_CUT = 0.0012; // por segundo no corte de giro
export const ENGINE_HOT = 0.006; // por segundo superaquecido (temperatura acima de 80%)

/** um quadro da corrida: kmh = velocidade, spin/slip/drift como em Race, heat 0..1, cut = no corte */
export function wearTick(u: Use, dt: number, kmh: number, spin: number, slip: number, drift: number, heat: number, cut: boolean) {
  const dkm = (Math.max(0, kmh) * dt) / 3600;
  u.km += dkm;
  const slide = Math.max(slip, Math.min(1, Math.abs(drift) / 0.3));
  u.tire += dkm * TIRE_KM + dt * (TIRE_SPIN * Math.max(0, spin) + (kmh > 20 ? TIRE_SLIP * slide : 0));
  u.engine += dkm * ENGINE_KM + dt * ((cut ? ENGINE_CUT : 0) + (heat > 0.8 ? ENGINE_HOT * (heat - 0.8) / 0.2 : 0));
}

/** efeito na ficha: pneu gasto perde aderência (até -12% em curva, -15% na largada, -8% no freio);
 * motor gasto perde até 10% de potência. Com o defeito de usado equivalente (pneus carecas, motor
 * cansado) quem manda é o defeito (não soma duas vezes). */
export function healthCar(car: CarSpec, h: Health | undefined, defects: string[] = []): CarSpec {
  if (!h) return car;
  const t = defects.includes('pneus') ? 1 : Math.max(0, Math.min(1, h.tires));
  const e = defects.includes('fumaca') ? 1 : Math.max(0, Math.min(1, h.engine));
  if (t >= 0.999 && e >= 0.999) return car;
  const power = 0.9 + 0.1 * e;
  return {
    ...car,
    accel: car.accel * power,
    maxSpeed: car.maxSpeed * Math.cbrt(power),
    lateralG: car.lateralG * (0.88 + 0.12 * t),
    brakeG: car.brakeG * (0.92 + 0.08 * t),
    traction: (car.traction ?? 1) * (0.85 + 0.15 * t),
  };
}
export const healthKey = (h: Health | undefined) => (h ? `${Math.round(h.tires * 100)}.${Math.round(h.engine * 100)}` : '');
