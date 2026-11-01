// Controles: teclado (desenvolvimento) e botões de toque (celular)
export const input = { left: false, right: false, gas: false, brake: false };
// há tela de toque? (no computador os botões de toque somem e aparecem as dicas do teclado)
export const touch = { ui: navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches };
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

  // evita zoom/rolagem no iOS
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

export function releaseAll() {
  input.left = input.right = input.gas = input.brake = false;
  queue.shiftUp = queue.shiftDown = 0;
}

// ---------- controle (gamepad Bluetooth: PlayStation, Xbox, MFi) ----------
// Direcional ou alavanca: direção; A/X ou gatilho direito: acelerar; B/O ou gatilho
// esquerdo: frear; ombros: trocar marcha; Start: pausa. Nos menus, o direcional navega.
export type PadKey = 'left' | 'right' | 'up' | 'down' | 'ok' | 'back' | 'start';
const padPrev: Record<string, boolean> = {};
const padHeld = { left: false, right: false, gas: false, brake: false };

export function pollGamepad(): PadKey[] {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = Array.from(pads).find((p) => p && p.connected);
  if (!gp) return [];
  const btn = (i: number) => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4);
  const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
  const now: Record<string, boolean> = {
    left: btn(14) || ax < -0.45, right: btn(15) || ax > 0.45, up: btn(12) || ay < -0.6, down: btn(13) || ay > 0.6,
    gas: btn(0) || btn(7), brake: btn(1) || btn(6), shiftUp: btn(5), shiftDown: btn(4), start: btn(9),
  };
  // direção/pedais seguem o botão enquanto ele estiver apertado
  for (const k of ['left', 'right', 'gas', 'brake'] as const) {
    if (now[k] !== padHeld[k]) {
      padHeld[k] = now[k];
      input[k] = now[k];
    }
  }
  const edges: PadKey[] = [];
  const edge = (k: string) => now[k] && !padPrev[k];
  if (edge('shiftUp')) queue.shiftUp++;
  if (edge('shiftDown')) queue.shiftDown++;
  for (const k of ['left', 'right', 'up', 'down', 'start'] as const) if (edge(k)) edges.push(k);
  if (edge('gas')) edges.push('ok');
  if (edge('brake')) edges.push('back');
  Object.assign(padPrev, now);
  return edges;
}
