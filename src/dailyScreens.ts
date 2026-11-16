// Telas do desafio do dia: o selo na capa da revista, a página da prova (carro, mapa, hora,
// clima, regra, ofensiva e o tempo do amigo) e a página do resultado (tempo, comparação com o
// seu melhor do dia, regra cumprida e o botão de copiar o código para os amigos).
import { SAFE_W, view } from './config';
import { drawCarSide } from './cars';
import { toast as notify } from './challenges';
import { inside, type Focusable, type FocusSet, type Rect } from './ui';
import { BLUE, GREY, INK, RED, YELLOW, box, burst, headline, ink, kicker, masthead, paper, photo, rule, specRows, tag } from './mag';
import {
  TIME_NAME, WEATHER_NAME, acceptCode, dailyFor, dateLabel, dateShort, dayEntry, daysPlayed, fmtLap, friendResult, mapLabel,
  playerName, resultCode, resultCodeWithGhost, ruleShort, ruleText, setPlayerName, streak, todayKey,
} from './daily';
import type { Actions, AppState, MenuKey } from './screens';

const ox = () => Math.floor((view.w - SAFE_W) / 2);

// dia mostrado na página do desafio (hoje; ou o dia do código colado de um amigo) e o último resultado
export const dsel = { date: todayKey() };
export interface DailyOutcome { time: number | null; ok: boolean; prev?: number; best: boolean; crashes: number; avg: number; top: number; rival: number; gameOver: boolean }
export const dlast: { r: DailyOutcome | null; code: string } = { r: null, code: '' };

// ---------- selo na capa ----------
export const dailySealRect = (): Rect => ({ x: ox() + SAFE_W - 58, y: 40, w: 56, h: 46 });
export function drawDailySeal(c: CanvasRenderingContext2D, s: AppState, hot: boolean) {
  const d = dailyFor(todayKey());
  const r = dailySealRect();
  const cx = r.x + 28, cy = r.y + 22;
  const played = dayEntry(d.date)?.live;
  burst(c, cx, cy, 22, ['DESAFIO', 'DO DIA', dateShort(d.date)], hot ? RED : YELLOW, hot ? YELLOW : RED, s.t);
  // (carro e mapa do dia ficam na página do desafio: uma fita aqui cobria o quadro da capa)
  // já jogou hoje: carimbo da ofensiva no canto do selo
  if (played) {
    const n = streak();
    c.fillStyle = BLUE;
    c.fillRect(cx + 10, cy - 24, 18, 9);
    ink(c, `${n}d`, cx + 19, cy - 22, 5, '#fff', 'center');
  }
}

// ---------- página do desafio ----------
const dailyButtons = () => {
  const x = ox();
  return {
    go: { x: x + 196, y: 200, w: 120, h: 22 },
    paste: { x: x + 100, y: 204, w: 90, h: 15 },
    back: { x: x + 4, y: 204, w: 90, h: 15 },
    today: { x: x + SAFE_W - 70, y: 19, w: 66, h: 11 },
  };
};
export function drawDaily(c: CanvasRenderingContext2D, s: AppState, focus: number) {
  const x = ox();
  const d = dailyFor(dsel.date);
  const today = d.date === todayKey();
  paper(c);
  masthead(c, 'DESAFIO DO DIA');
  kicker(c, today ? `EDIÇÃO DE ${dateLabel(d.date)}` : `DESAFIO DE ${dateLabel(d.date)} (AMIGO)`, x + 4, 20, RED, '#fff');
  const b = dailyButtons();
  if (!today) tag(c, b.today, 'IR PARA HOJE', focus === 3, 4);
  headline(c, d.car.name.toUpperCase(), x + 4, 34, 8, INK);
  ink(c, `${mapLabel(d)} ${TIME_NAME[d.time].toLowerCase()}`, x + 4, 45, 5, GREY);
  // foto do carro do dia (lateral, com a cor de fábrica)
  const ph: Rect = { x: x + 7, y: 58, w: 140, h: 70 };
  photo(c, ph, () => drawCarSide(c, ph.x + 8, ph.y + ph.h - 8, 124, d.car, d.car.color));
  // ficha da prova
  const t: Rect = { x: x + 154, y: 55, w: SAFE_W - 158, h: 76 };
  box(c, t, 'A PROVA');
  specRows(c, t, [
    ['Roteiro', d.course.level],
    ['Hora', TIME_NAME[d.time].replace(/^(DE|NO|AO|À) /, '')],
    ['Clima', d.weather ? WEATHER_NAME[d.weather] : 'TEMPO BOM'],
    ['Rival', d.rival ? d.rival.name : 'NENHUM'],
    ['Pista', `${d.course.stages[0].lanes} faixas`],
  ], 11, 15);
  // regra extra em faixa amarela
  c.fillStyle = INK;
  c.fillRect(x + 4, 137, SAFE_W - 8, 13);
  c.fillStyle = YELLOW;
  c.fillRect(x + 4, 137, 3, 13);
  ink(c, `REGRA: ${ruleText(d)}`, x + 12, 141, 5, YELLOW);
  // seu dia e o do amigo
  const e = dayEntry(d.date);
  const n = streak();
  ink(c, `Seu melhor ${today ? 'hoje' : 'no dia'}: ${e?.best !== undefined ? fmtLap(e.best) : '--'}`, x + 4, 158, 5, INK);
  ink(c, `Tentativas: ${e?.tries ?? 0}`, x + 4, 168, 5, GREY);
  ink(c, `OFENSIVA: ${n} DIA${n === 1 ? '' : 'S'}`, x + SAFE_W - 4, 158, 5, n ? RED : GREY, 'right');
  ink(c, `${daysPlayed()} desafios jogados`, x + SAFE_W - 4, 168, 5, GREY, 'right');
  const f = friendResult(d.date);
  if (f) {
    rule(c, x + 4, 178, SAFE_W - 8, 'rgba(26,22,20,0.2)');
    ink(c, `${f.name} fez ${fmtLap(f.time)}${f.ghost ? ' · fantasma na pista' : ''}`, x + 4, 183, 5, BLUE);
  } else ink(c, 'Cole o código de um amigo para disputar o tempo dele.', x + 4, 183, 4, GREY);
  tag(c, b.back, '◀ CAPA', focus === 0, 5);
  tag(c, b.paste, 'COLAR CÓDIGO', focus === 1, 5);
  tag(c, b.go, 'CORRER ▶', true, 8);
  if (focus === 2 && Math.floor(s.t * 3) % 2 === 0) {
    c.strokeStyle = YELLOW;
    c.strokeRect(b.go.x - 1.5, b.go.y - 1.5, b.go.w + 3, b.go.h + 3);
  }
}
async function pasteCode() {
  const raw = window.prompt('Cole o código do desafio do seu amigo:');
  if (!raw) return;
  const r = await acceptCode(raw);
  if (!r) return notify('CÓDIGO INVÁLIDO', 'Confira se copiou o código inteiro', '#ff8060');
  dsel.date = r.date;
  notify(`${r.name} FEZ ${fmtLap(r.time)}`, r.ghost ? 'Fantasma dele carregado: vá pra pista!' : `Desafio de ${dateLabel(r.date)}`, '#30e060');
}
export function tapDaily(s: AppState, a: Actions, x: number, y: number) {
  const b = dailyButtons();
  if (inside(x, y, b.go)) a.startDaily(dsel.date);
  else if (inside(x, y, b.paste)) void pasteCode();
  else if (inside(x, y, b.back)) a.go('title');
  else if (dsel.date !== todayKey() && inside(x, y, b.today)) dsel.date = todayKey();
}
export function dailyFocusables(s: AppState, a: Actions): FocusSet {
  const b = dailyButtons();
  const items: Focusable[] = [{ r: b.back }, { r: b.paste }, { r: b.go, act: () => a.startDaily(dsel.date) }];
  if (dsel.date !== todayKey()) items.push({ r: b.today });
  return { key: `daily${dsel.date}`, items, def: 2 };
}

// ---------- resultado ----------
const endButtons = () => {
  const x = ox();
  return {
    copy: { x: x + 4, y: 204, w: 100, h: 15 },
    ghost: { x: x + 108, y: 204, w: 100, h: 15 },
    again: { x: x + 212, y: 186, w: 104, h: 15 },
    back: { x: x + 212, y: 204, w: 104, h: 15 },
  };
};
export function drawDailyEnd(c: CanvasRenderingContext2D, s: AppState) {
  const x = ox();
  const d = dailyFor(dsel.date);
  const r = dlast.r;
  paper(c);
  masthead(c, 'DESAFIO DO DIA');
  kicker(c, `${dateLabel(d.date)} · ${d.car.name.toUpperCase()}`, x + 4, 20, RED, '#fff');
  if (!r) return;
  const e = dayEntry(d.date);
  const title = r.gameOver ? 'SEUS CARROS ACABARAM' : !r.ok ? 'REGRA NÃO CUMPRIDA' : r.best ? (r.prev === undefined ? 'TEMPO NA PRAÇA!' : 'NOVO RECORDE DO DIA!') : 'SEM MELHORA DESTA VEZ';
  headline(c, title, x + 4, 33, 8, r.gameOver || !r.ok ? RED : r.best ? '#1a6a2a' : INK);
  // tempo grande, como manchete de teste
  c.fillStyle = INK;
  c.fillRect(x + 4, 47, 150, 30);
  ink(c, 'SEU TEMPO', x + 9, 50, 4, YELLOW);
  headline(c, r.time !== null ? fmtLap(r.time) : 'SEM TEMPO', x + 9, 59, r.time !== null ? 16 : 8, r.time !== null ? '#fff' : '#ff8060');
  // posição em relação ao seu melhor do dia
  let pos = r.time === null ? 'Os carros acabaram antes do posto.' : '';
  if (r.time !== null) {
    if (r.prev === undefined) pos = r.ok ? 'Primeiro tempo do dia.' : 'Ainda sem tempo válido neste dia.';
    else {
      const dt = r.time - r.prev;
      pos = dt < 0 ? `${Math.abs(dt).toFixed(2).replace('.', ',')}s mais rápido que o seu melhor` : `${dt.toFixed(2).replace('.', ',')}s atrás do seu melhor (${fmtLap(r.prev)})`;
    }
  }
  ink(c, pos, x + 4, 84, 5, r.best ? '#1a6a2a' : GREY);
  // medições
  const t: Rect = { x: x + 4, y: 96, w: 200, h: 70 };
  box(c, t, 'MEDIÇÕES');
  specRows(c, t, [
    [ruleShort(d), d.rule === 'none' ? '-' : r.ok ? 'CUMPRIDA' : 'NÃO CUMPRIDA'],
    ['Batidas', `${r.crashes}`],
    ['Vel. média', `${Math.round(r.avg)} km/h`],
    ['Vel. máxima', `${Math.round(r.top)} km/h`],
    ['Rival', d.rival ? (r.rival >= 0 ? fmtLap(r.rival) : 'NÃO CHEGOU') : '-'],
  ], 11, 13);
  // seu melhor, o do amigo e a ofensiva
  const n = streak();
  const f = friendResult(d.date);
  const cx = x + 212;
  ink(c, 'MELHOR DO DIA', cx, 50, 4, GREY);
  ink(c, e?.best !== undefined ? fmtLap(e.best) : '--', cx, 58, 8, INK);
  ink(c, 'OFENSIVA', cx, 74, 4, GREY);
  ink(c, `${n} DIA${n === 1 ? '' : 'S'}`, cx, 82, 8, n ? RED : GREY);
  if (f) {
    ink(c, `${f.name.slice(0, 10)} FEZ`, cx, 100, 4, BLUE);
    ink(c, fmtLap(f.time), cx, 108, 8, BLUE);
    if (e?.best !== undefined) {
      const dd = e.best - f.time;
      ink(c, dd <= 0 ? `Você ganha por ${Math.abs(dd).toFixed(2).replace('.', ',')}s` : `Faltam ${dd.toFixed(2).replace('.', ',')}s`, cx, 120, 4, dd <= 0 ? '#1a6a2a' : RED);
    }
  }
  if (r.best && r.prev !== undefined) burst(c, x + SAFE_W - 30, 150, 24, ['NOVO', 'RECORDE', 'DO DIA'], YELLOW, RED, s.t);
  if (dlast.code) ink(c, dlast.code.split(' ')[0], x + 4, 174, 5, INK);
  else ink(c, e?.best !== undefined ? 'Copie o código e desafie um amigo.' : 'Cumpra a regra para ter um código.', x + 4, 174, 4, GREY);
  const b = endButtons();
  tag(c, b.copy, 'COPIAR CÓDIGO', endFocus === 0, 5);
  tag(c, b.ghost, 'COM FANTASMA', endFocus === 1, 5);
  tag(c, b.again, 'DE NOVO', endFocus === 2, 5);
  tag(c, b.back, '◀ CAPA', endFocus === 3, 5);
}
let endFocus = 0;
export const setEndFocus = (i: number) => { endFocus = i; };
// nome no código: perguntado na primeira vez
function askName(): string {
  let n = playerName();
  if (!n) {
    n = window.prompt('Seu nome no código (até 10 letras):', 'PILOTO') || 'PILOTO';
    setPlayerName(n);
    n = playerName() ?? 'PILOTO';
  }
  return n;
}
async function copyCode(withGhost: boolean) {
  const d = dailyFor(dsel.date);
  const best = dayEntry(d.date)?.best;
  if (best === undefined) return notify('SEM TEMPO VÁLIDO', 'Cumpra a regra do dia primeiro', '#ff8060');
  const name = askName();
  const code = withGhost ? await resultCodeWithGhost(name, d, best) : resultCode(name, d.date, best);
  if (!code) return notify('SEM FANTASMA AINDA', 'Termine o trecho para gravar um', '#ff8060');
  dlast.code = code;
  const msg = `Duel Racer · Desafio do dia ${dateLabel(d.date)}: fiz ${fmtLap(best)} de ${d.car.name}. Me supera? Cole no DESAFIO DO DIA > COLAR CÓDIGO\n${code}`;
  try {
    await navigator.clipboard.writeText(msg);
    notify('CÓDIGO COPIADO!', withGhost ? 'Com o seu fantasma: mande para um amigo' : 'Mande para um amigo', '#30e060');
  } catch {
    window.prompt('Copie o código e mande para um amigo:', code);
  }
}
export function tapDailyEnd(s: AppState, a: Actions, x: number, y: number) {
  const b = endButtons();
  if (inside(x, y, b.copy)) void copyCode(false);
  else if (inside(x, y, b.ghost)) void copyCode(true);
  else if (inside(x, y, b.again)) a.startDaily(dsel.date);
  else if (inside(x, y, b.back)) a.go('title');
}
export function dailyEndFocusables(s: AppState, a: Actions): FocusSet {
  const b = endButtons();
  const rs = [b.copy, b.ghost, b.again, b.back];
  return { key: 'dailyEnd', items: rs.map((r, i) => ({ r, is: () => endFocus === i, pick: () => { endFocus = i; } })), def: 0 };
}
export function keyDaily(s: AppState, a: Actions, k: MenuKey) {
  if (k === 'back') a.go('title');
}
