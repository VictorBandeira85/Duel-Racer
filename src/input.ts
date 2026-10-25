// Controles: teclado (desenvolvimento) e botões de toque (celular)
export const input = { left: false, right: false, gas: false, brake: false };
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
