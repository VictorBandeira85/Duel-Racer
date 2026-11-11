// Troca de carro na garagem, no showroom e na escolha do Arcade: o carro que está na foto dá a partida,
// acelera e sai (para a esquerda, que é a frente); o outro entra pela direita, freia, fica um instante
// em marcha lenta e desliga. Cada um com o próprio ronco (o perfil do motor daquele carro).
import type { CarSpec } from './cars';
import { setEngine, setEngineProfile, starterSound, shiftSound } from './audio';

const T_START = 0.42; // s de motor de arranque antes de pegar
const T_REV = 0.5; // acelerada parado
const T_OUT = 0.6; // saindo
const T_IN = 0.85; // o outro chegando
const T_IDLE = 0.7; // marcha lenta antes de desligar
interface Slot { shown?: CarSpec; next?: CarSpec; t0: number; seen: number; phase: 'idle' | 'out' | 'in'; prof?: string; off?: boolean }
const slots = new Map<string, Slot>();
let active: Slot | null = null;

const profile = (sl: Slot, car: CarSpec) => {
  const key = car.id + JSON.stringify(car.soundMods ?? 0);
  if (sl.prof === key) return;
  sl.prof = key;
  setEngineProfile(car.engine, car.id, car.soundMods);
};

/** Carro a desenhar agora neste quadro (slot = uma foto da tela) e o deslocamento dele, em frações da
 * largura da foto (0 = no lugar; negativo = saindo pela esquerda; positivo = vindo da direita). `roll` é
 * o quanto ele andou (mesma unidade), para girar as rodas. */
export function carSwap(slot: string, car: CarSpec, t: number): { car: CarSpec; dx: number; roll: number } {
  let sl = slots.get(slot);
  if (!sl) slots.set(slot, sl = { t0: 0, seen: -9, phase: 'idle' });
  const fresh = t - sl.seen > 0.4; // a tela acabou de abrir: o carro só chega (sem ninguém saindo)
  sl.seen = t;
  if (fresh) {
    sl.shown = undefined;
    sl.next = car;
    sl.phase = 'in';
    sl.t0 = t;
    sl.prof = undefined;
    sl.off = false;
  } else if (sl.phase === 'idle' && sl.shown && sl.shown.id !== car.id) {
    sl.next = car;
    sl.phase = 'out';
    sl.t0 = t;
    sl.prof = undefined;
    starterSound();
  } else if (sl.phase !== 'idle' && sl.next && sl.next.id !== car.id) {
    // pediu outro no meio da troca: o que estava chegando vira o que sai
    if (sl.phase === 'in') {
      sl.shown = sl.next;
      sl.phase = 'out';
      sl.t0 = t - T_START - T_REV * 0.5;
      sl.prof = undefined;
    }
    sl.next = car;
  }
  active = sl;
  const u = t - sl.t0;
  if (sl.phase === 'out' && sl.shown) {
    profile(sl, sl.shown);
    if (u < T_START) return { car: sl.shown, dx: 0, roll: 0 };
    if (u < T_START + T_REV) {
      const k = (u - T_START) / T_REV;
      setEngine(0.12 + 0.6 * Math.sin(Math.PI * Math.min(1, k * 1.15)), k < 0.6, true); // pegou: uma acelerada
      return { car: sl.shown, dx: 0, roll: 0 };
    }
    const k = (u - T_START - T_REV) / T_OUT;
    if (k < 1) {
      setEngine(0.3 + 0.55 * k, true, true);
      const d = -1.25 * k * k;
      return { car: sl.shown, dx: d, roll: d };
    }
    sl.phase = 'in';
    sl.t0 = t;
    sl.prof = undefined;
    sl.off = false;
  }
  if (sl.phase === 'in' && sl.next) {
    const u2 = t - sl.t0;
    profile(sl, sl.next);
    if (u2 < T_IN) {
      const k = u2 / T_IN;
      setEngine(0.5 * (1 - k) + 0.06, false, true);
      const d = 1.25 * (1 - k) ** 2.2;
      return { car: sl.next, dx: d, roll: d };
    }
    if (u2 < T_IN + T_IDLE) {
      setEngine(0.03, false, true);
      const st = u2 - T_IN;
      return { car: sl.next, dx: 0, roll: Math.sin(st * 16) * Math.exp(-st * 7) * 0.004 }; // balanço ao parar
    }
    if (!sl.off) {
      sl.off = true;
      setEngine(0, false, false);
      shiftSound(); // chave desligando
    }
    sl.shown = sl.next;
    sl.phase = 'idle';
  }
  sl.shown = car;
  return { car, dx: 0, roll: 0 };
}

/** chamado a cada quadro pelo laço principal: se a foto saiu da tela no meio da troca, o motor desliga */
export function carSwapWatch(t: number) {
  if (active && active.phase !== 'idle' && t - active.seen > 0.25) {
    active.phase = 'idle';
    active.shown = undefined;
    setEngine(0, false, false);
    active = null;
  }
}
