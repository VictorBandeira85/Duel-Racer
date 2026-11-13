// Controles: teclado (desenvolvimento) e botões de toque (celular)
export const input = { left: false, right: false, gas: false, brake: false };
// há tela de toque? (no computador os botões de toque somem e aparecem as dicas do teclado)
export const touch = { ui: navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches };
// último jeito de jogar usado (legenda de botões dos menus): controle, teclado (ou mouse) ou toque
export const lastDevice = { kind: (touch.ui ? 'touch' : 'key') as 'pad' | 'key' | 'touch' };
const queue = { shiftUp: 0, shiftDown: 0 };

export function takeShift(kind: 'shiftUp' | 'shiftDown') {
  const n = queue[kind];
  queue[kind] = 0;
  return n > 0;
}

export type Key = keyof typeof input | keyof typeof queue;

const press = (k: Key, down: boolean) => {
  if (k === 'shiftUp' || k === 'shiftDown') {
    if (down) queue[k]++;
  } else input[k] = down;
};

// teclas: as setas sempre valem; a outra de cada ação pode ser trocada na tela CONTROLES
export const ACTIONS: { id: Key; label: string }[] = [
  { id: 'gas', label: 'ACELERAR' }, { id: 'brake', label: 'FREAR' }, { id: 'left', label: 'ESQUERDA' },
  { id: 'right', label: 'DIREITA' }, { id: 'shiftUp', label: 'SOBE MARCHA' }, { id: 'shiftDown', label: 'REDUZ MARCHA' },
];
const FIXED: Record<string, Key> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'gas', ArrowDown: 'brake', KeyX: 'shiftUp', KeyZ: 'shiftDown' };
const DEFAULT_BIND: Record<Key, string> = { left: 'KeyA', right: 'KeyD', gas: 'KeyW', brake: 'KeyS', shiftUp: 'KeyE', shiftDown: 'KeyQ' };
const BIND_KEY = 'duel-racer:teclas';
export const binds: Record<Key, string> = (() => {
  try {
    return { ...DEFAULT_BIND, ...JSON.parse(localStorage.getItem(BIND_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_BIND };
  }
})();
let KEYMAP: Record<string, Key> = {};
function rebuild() {
  KEYMAP = { ...FIXED };
  for (const a of ACTIONS) KEYMAP[binds[a.id]] = a.id;
}
rebuild();
// troca a tecla de uma ação (a que já usava essa tecla fica com a antiga desta)
export function setBind(id: Key, code: string) {
  const other = ACTIONS.find((a) => a.id !== id && binds[a.id] === code);
  if (other) binds[other.id] = binds[id];
  binds[id] = code;
  try {
    localStorage.setItem(BIND_KEY, JSON.stringify(binds));
  } catch {
    /* sem armazenamento */
  }
  rebuild();
}
export function resetBinds() {
  Object.assign(binds, DEFAULT_BIND);
  try {
    localStorage.removeItem(BIND_KEY);
  } catch {
    /* sem armazenamento */
  }
  rebuild();
}
// nome curto da tecla para mostrar na tela
export const keyName = (code: string) =>
  code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow(.*)/, (_, d) => ({ Up: '↑', Down: '↓', Left: '←', Right: '→' } as Record<string, string>)[d]).replace('ShiftLeft', 'SHIFT').replace('ShiftRight', 'SHIFT D').replace('ControlLeft', 'CTRL').replace('ControlRight', 'CTRL D').replace('Space', 'ESPAÇO').replace(/^Numpad/, 'NUM ').toUpperCase();
// tecla esperando ser escolhida na tela CONTROLES (o jogo não reage a ela enquanto isso)
export const binding = { action: null as Key | null };

export function setupInput() {
  window.addEventListener('keydown', (e) => {
    lastDevice.kind = 'key';
    if (binding.action) return;
    const k = KEYMAP[e.code];
    if (k && !e.repeat) press(k, true);
    if (k) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) press(k, false);
  });

  document.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => {
    const k = el.dataset.key as Key;
    const up = () => {
      el.classList.remove('on');
      press(k, false);
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('on');
      press(k, true);
    });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  });

  window.addEventListener('pointerdown', (e) => {
    lastDevice.kind = e.pointerType === 'touch' ? 'touch' : 'key';
  }, { capture: true, passive: true });
  // evita zoom/rolagem no iOS
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

export function releaseAll() {
  input.left = input.right = input.gas = input.brake = false;
  pad.gas = pad.brake = pad.steer = 0;
  queue.shiftUp = queue.shiftDown = 0;
}

// ---------- controle (gamepad Bluetooth/USB: PlayStation, Xbox, MFi, genéricos) ----------
// Gatilhos e alavanca são proporcionais: gatilho direito acelera, esquerdo freia (quanto mais
// fundo, mais forte) e a alavanca esquerda esterça na medida em que é empurrada. A/X acelera e
// B/O freia por inteiro (como as teclas), o direcional esterça tudo, ombros trocam marcha, Start
// pausa. Nos menus: direcional ou alavanca andam (segurando, repete), A escolhe, B volta.
// prevTab/nextTab: LB/RB (nos menus trocam a classe; na corrida são as marchas)
export type PadKey = 'left' | 'right' | 'up' | 'down' | 'ok' | 'back' | 'start' | 'prevTab' | 'nextTab';
// comandos proporcionais do controle (0..1 nos pedais, -1..1 na direção); o teclado e o toque
// continuam em input (liga/desliga) e valem por inteiro por cima destes
export const pad = { gas: 0, brake: 0, steer: 0, connected: false, id: '', mapping: '' };
const padPrev: Record<string, boolean> = {};
const padHeld = { left: false, right: false, gas: false, brake: false };
const repeatAt: Record<string, number> = {};
// alavanca nos menus: entra em 0,5 e só solta abaixo de 0,3 (não pisca no meio do caminho)
const stickOn: Record<string, boolean> = {};
const DEAD_STICK = 0.08, DEAD_TRIG = 0.04;
// pedal: zona morta curtinha no começo e no fim (gatilho no fundo = 100%)
const trig = (v: number) => clamp01((v - DEAD_TRIG) / (0.96 - DEAD_TRIG));
// direção: zona morta pequena e curva suave (meio curso esterça menos que a metade, para
// corrigir de leve em reta; no fim do curso chega a 100%)
function steerCurve(v: number) {
  const a = Math.abs(v);
  if (a < DEAD_STICK) return 0;
  const u = Math.min(1, (a - DEAD_STICK) / (0.95 - DEAD_STICK));
  return Math.sign(v) * u ** 1.35;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// pedais e direção da corrida: o maior entre teclado/toque (inteiro) e o controle (proporcional)
export const gasAmt = () => (input.gas ? 1 : pad.gas);
export const brakeAmt = () => (input.brake ? 1 : pad.brake);
export function steerAmt() {
  const d = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  return d !== 0 ? d : pad.steer;
}

// direcional de controles sem o mapa padrão: chapéu num eixo só (DirectInput, -1 = cima, girando
// no sentido horário em passos de 2/7; parado fica fora de -1..1) ou dois eixos (Firefox/Linux)
function hat(gp: Gamepad) {
  const r = { up: false, down: false, left: false, right: false };
  if (gp.mapping === 'standard') return r;
  const h = gp.axes[9];
  if (h !== undefined && h >= -1.05 && h <= 1.05) {
    const k = Math.round(((h + 1) * 7) / 2); // 0 cima, 1 cima-dir, 2 dir, 3 baixo-dir, 4 baixo, 5 baixo-esq, 6 esq, 7 cima-esq
    r.up = k === 0 || k === 1 || k === 7;
    r.right = k >= 1 && k <= 3;
    r.down = k >= 3 && k <= 5;
    r.left = k >= 5 && k <= 7;
  }
  if (gp.axes.length >= 8 && gp.axes.length < 10) {
    r.left ||= gp.axes[6] < -0.5;
    r.right ||= gp.axes[6] > 0.5;
    r.up ||= gp.axes[7] < -0.5;
    r.down ||= gp.axes[7] > 0.5;
  }
  return r;
}

// lê todos os controles ligados (o Windows às vezes mostra um controle "fantasma" antes do de
// verdade, ou o mesmo controle duas vezes): junta tudo, o que estiver apertado em qualquer um vale
export function pollGamepad(): PadKey[] {
  const pads = Array.from((navigator.getGamepads ? navigator.getGamepads() : []) || []).filter((p): p is Gamepad => !!p && p.connected);
  pad.connected = pads.length > 0;
  if (!pads.length) {
    if (pad.gas || pad.brake || pad.steer) pad.gas = pad.brake = pad.steer = 0;
    for (const k of ['left', 'right', 'gas', 'brake'] as const) if (padHeld[k]) input[k] = padHeld[k] = false;
    return [];
  }
  pad.id = pads[0].id;
  pad.mapping = pads[0].mapping;
  const now: Record<string, boolean> = { left: false, right: false, up: false, down: false, gas: false, brake: false, ok: false, back: false, shiftUp: false, shiftDown: false, start: false };
  const nav = { left: false, right: false, up: false, down: false };
  let gas = 0, brake = 0, steer = 0;
  for (const gp of pads) {
    const b = (i: number) => gp.buttons[i];
    const btn = (i: number) => !!b(i) && (b(i).pressed || b(i).value > 0.5);
    const h = hat(gp);
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
    const dl = btn(14) || h.left, dr = btn(15) || h.right, du = btn(12) || h.up, dd = btn(13) || h.down;
    // pedais: gatilhos (valor contínuo); A/X e B/O valem como pedal no fundo
    const rt = b(7) ? b(7).value || (b(7).pressed ? 1 : 0) : 0;
    const lt = b(6) ? b(6).value || (b(6).pressed ? 1 : 0) : 0;
    gas = Math.max(gas, trig(rt));
    brake = Math.max(brake, trig(lt));
    if (Math.abs(steerCurve(ax)) > Math.abs(steer)) steer = steerCurve(ax);
    now.left ||= dl;
    now.right ||= dr;
    now.gas ||= btn(0);
    now.brake ||= btn(1);
    now.ok ||= btn(0);
    now.back ||= btn(1);
    now.shiftUp ||= btn(5);
    now.shiftDown ||= btn(4);
    now.start ||= btn(9);
    nav.left ||= dl;
    nav.right ||= dr;
    nav.up ||= du;
    nav.down ||= dd;
    // alavanca nos menus, com folga para não ficar entrando e saindo no limite
    const st = (k: string, v: number) => (stickOn[k] = v > (stickOn[k] ? 0.3 : 0.5));
    const sl = st(`l${gp.index}`, -ax), sr = st(`r${gp.index}`, ax), su = st(`u${gp.index}`, -ay), sd = st(`d${gp.index}`, ay);
    nav.left ||= sl;
    nav.right ||= sr;
    nav.up ||= su;
    nav.down ||= sd;
  }
  pad.gas = gas;
  pad.brake = brake;
  pad.steer = steer;
  if (gas > 0.1 || brake > 0.1 || Math.abs(steer) > 0.2 || Object.values(now).some(Boolean) || nav.up || nav.down || nav.left || nav.right) lastDevice.kind = 'pad';
  Object.assign(now, { up: nav.up, down: nav.down, navLeft: nav.left, navRight: nav.right });
  // botões digitais seguem o botão enquanto ele estiver apertado (como as teclas)
  for (const k of ['left', 'right', 'gas', 'brake'] as const) {
    if (now[k] !== padHeld[k]) {
      padHeld[k] = now[k];
      input[k] = now[k];
    }
  }
  const edges: PadKey[] = [];
  const t = performance.now();
  const edge = (k: string) => now[k] && !padPrev[k];
  if (edge('shiftUp')) {
    queue.shiftUp++;
    edges.push('nextTab');
  }
  if (edge('shiftDown')) {
    queue.shiftDown++;
    edges.push('prevTab');
  }
  // navegação: aperto vale uma vez; segurando, repete (depois de 0,4 s, a cada 0,13 s)
  for (const [k, key] of [['up', 'up'], ['down', 'down'], ['navLeft', 'left'], ['navRight', 'right']] as const) {
    if (edge(k)) {
      edges.push(key);
      repeatAt[k] = t + 400;
    } else if (now[k] && t >= (repeatAt[k] ?? Infinity)) {
      edges.push(key);
      repeatAt[k] = t + 130;
    }
  }
  if (edge('start')) edges.push('start');
  if (edge('ok')) edges.push('ok');
  if (edge('back')) edges.push('back');
  Object.assign(padPrev, now);
  return edges;
}
