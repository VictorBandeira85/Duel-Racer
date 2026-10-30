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

type Key = keyof typeof input | keyof typeof queue;

const press = (k: Key, down: boolean) => {
  if (k === 'shiftUp' || k === 'shiftDown') {
    if (down) queue[k]++;
  } else input[k] = down;
};

const KEYMAP: Record<string, Key> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'gas', KeyW: 'gas',
  ArrowDown: 'brake', KeyS: 'brake',
  KeyE: 'shiftUp', KeyX: 'shiftUp',
  KeyQ: 'shiftDown', KeyZ: 'shiftDown',
};

export function setupInput() {
  window.addEventListener('keydown', (e) => {
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
