import { KMH } from './config';
import type { Race } from './race';
import type { StageResult } from './screens';

// Pontuação no estilo do Test Drive II: anda rápido (média × distância), chega limpo e na
// frente do rival; batidas e multas descontam. O rival não bate nem toma multa.
export function stageResult(r: Race): StageResult {
  const km = ((r.track.finishZ - r.track.startZ) * KMH) / 3600;
  const avg = km / (r.time / 3600);
  const hasRival = r.rivalTime >= 0;
  const won = !hasRival || r.time <= r.rivalTime;
  const score = Math.max(0, Math.round(avg * km * 10) + (r.clean ? 2000 : 0) - r.crashes * 1000 - r.tickets * 500 + (hasRival && won ? 1500 : 0));
  const rivalAvg = hasRival ? km / (r.rivalTime / 3600) : 0;
  return {
    time: r.time, rival: r.rivalTime, clean: r.clean, crashes: r.crashes, tickets: r.tickets, fines: r.fines,
    km, top: r.top * KMH, avg, score,
    rivalTop: r.rivalTop * KMH, rivalAvg, rivalScore: hasRival ? Math.round(rivalAvg * km * 10) + 2000 + (won ? 0 : 1500) : 0,
  };
}

// Frase do frentista na chegada ao posto, conforme o trecho (sempre a mesma para o mesmo trecho)
export function gasQuip(r: StageResult, stage: number) {
  const behind = r.rival >= 0 && r.time > r.rival;
  const pool = r.crashes > 1 ? CRASHES
    : r.tickets > 0 ? TICKETS
    : behind ? BEHIND
    : r.clean && r.rival >= 0 ? AHEAD_CLEAN
    : r.top >= 280 ? FAST
    : r.clean ? CLEAN
    : CRASHES;
  return pool[(stage * 7 + Math.round(r.time)) % pool.length];
}

const AHEAD_CLEAN = [
  'Pode vender o retrovisor, não vai precisar dele!',
  'O rival ainda está procurando a segunda marcha.',
  'Chegou tão rápido que a gasolina nem esfriou.',
];
const BEHIND = [
  'Seu rival passou aqui, tomou um café e foi embora.',
  'Ele mandou dizer que te espera na próxima.',
  'Pelo retrovisor dele você era só um pontinho.',
];
const CRASHES = [
  'A funilaria do posto agradece a preferência.',
  'Esse para-choque já viu dias melhores.',
  'Quer que eu chame o guincho de vez?',
];
const TICKETS = [
  'O guarda já sabe seu nome de cor.',
  'Com essas multas dava para comprar outro carro.',
  'Na próxima, cumprimenta o radar.',
];
const FAST = [
  'Abaixo de 280 você nem acorda, né?',
  'Os pneus estão pedindo férias.',
];
const CLEAN = [
  'Trecho limpo! Nem um arranhão.',
  'Dirigiu como quem vai devolver o carro.',
];
