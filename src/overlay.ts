// Camada por cima das telas (modo foto, replay, placa do jogador, ranking da semana): enquanto uma
// está aberta, ela recebe o teclado, o controle e o toque e desenha por cima da tela de baixo (que
// continua parada). main.ts só pergunta overlayOn() e repassa as teclas, os toques e o desenho.
// Também aqui: a janela de texto em HTML (colar/copiar códigos; o window.prompt não abre na WebView
// do Android nem no artifact) e a camada da imagem pronta (salvar/compartilhar a foto).
import type { MenuKey } from './screens';

export interface Overlay {
  draw(c: CanvasRenderingContext2D, dt: number): void;
  key(k: MenuKey | 'start'): void;
  tap(x: number, y: number): void;
  // tecla do teclado (letras e números: a placa aceita digitação direta); true = usada
  type?(e: KeyboardEvent): boolean;
  onClose?(): void;
}

let cur: Overlay | null = null;
let busy = false; // janela de HTML aberta (texto ou imagem): ela é que recebe as teclas

export const overlayOn = () => !!cur;
export function openOverlay(o: Overlay) {
  cur?.onClose?.();
  cur = o;
  style();
  document.body.classList.add('ovl');
}
export function closeOverlay(o?: Overlay) {
  if (o && cur !== o) return;
  const was = cur;
  cur = null;
  document.body.classList.remove('ovl');
  was?.onClose?.();
}
export function overlayKey(k: MenuKey | 'start') {
  if (!cur || busy) return;
  cur.key(k);
}
export function overlayType(e: KeyboardEvent) {
  if (!cur || busy) return false;
  return !!cur.type?.(e);
}
export function overlayTap(x: number, y: number) {
  if (!cur || busy) return;
  cur.tap(x, y);
}
export function overlayDraw(c: CanvasRenderingContext2D, dt: number) {
  if (cur) cur.draw(c, dt);
}
export const domBusy = () => busy;

// ---------- estilo das janelas em HTML (papel da revista) ----------
let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
body.ovl #controls, body.ovl #pauseBtn, body.ovl #radioBtn, body.ovl #radioTag { display: none !important; }
.drdlg { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; background: rgba(10,8,6,.72); font-family: "Press Start 2P", monospace; }
.drdlg .card { background: #efe6d2; color: #1a1614; border: 3px solid #1a1614; box-shadow: 6px 6px 0 rgba(0,0,0,.45); width: min(92vw, 640px); max-height: 92vh; display: flex; flex-direction: column; gap: 10px; padding: 0 0 12px; box-sizing: border-box; }
.drdlg .head { background: #d01f26; color: #ffd21a; padding: 8px 12px; font-size: 12px; border-bottom: 3px solid #1a1614; }
.drdlg p { margin: 0 12px; font-size: 9px; line-height: 1.6; color: #4a4238; }
.drdlg textarea { margin: 0 12px; height: 7.5em; resize: none; font: 11px/1.4 monospace; background: #fbf6e8; border: 2px solid #1a1614; padding: 6px; color: #1a1614; user-select: text; -webkit-user-select: text; }
.drdlg .row { display: flex; gap: 8px; margin: 0 12px; flex-wrap: wrap; }
.drdlg button { flex: 1; min-width: 110px; font: 10px "Press Start 2P", monospace; padding: 10px 6px; background: #fbf6e8; color: #1a1614; border: 2px solid #1a1614; box-shadow: 3px 3px 0 #1a1614; cursor: pointer; }
.drdlg button.main { background: #d01f26; color: #fff; }
.drdlg button:focus-visible, .drdlg button.kf { outline: 3px solid #ffd21a; }
.drdlg .err { color: #d01f26; min-height: 1em; }
.drdlg img { margin: 0 12px; max-width: calc(100% - 24px); max-height: 52vh; object-fit: contain; align-self: center; border: 2px solid #1a1614; image-rendering: pixelated; -webkit-touch-callout: default; user-select: auto; -webkit-user-select: auto; }
@media (max-height: 460px) { .drdlg .card { gap: 6px; } .drdlg img { max-height: 46vh; } .drdlg textarea { height: 5em; } }
`;
  document.head.appendChild(s);
}

// monta a janela; Esc fecha, setas andam entre os botões; as teclas não vazam para o jogo
function dialog(title: string, build: (card: HTMLElement, close: () => void) => void, onEsc: () => void) {
  style();
  busy = true;
  const root = document.createElement('div');
  root.className = 'drdlg';
  const card = document.createElement('div');
  card.className = 'card';
  const head = document.createElement('div');
  head.className = 'head';
  head.textContent = title;
  card.appendChild(head);
  root.appendChild(card);
  const close = () => {
    root.remove();
    busy = false;
    window.removeEventListener('keydown', onKey, true);
    clearInterval(padT);
  };
  const buttons = () => Array.from(card.querySelectorAll('button'));
  const step = (d: number) => {
    const bs = buttons();
    const i = bs.indexOf(document.activeElement as HTMLButtonElement);
    bs[(i + d + bs.length) % bs.length]?.focus();
  };
  // teclas: capturadas antes do jogo (que previne letras e setas para dirigir)
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    const inText = (e.target as HTMLElement)?.tagName === 'TEXTAREA';
    if (e.code === 'Escape') {
      e.preventDefault();
      close();
      onEsc();
    } else if (!inText && (e.code === 'ArrowRight' || e.code === 'ArrowDown')) { e.preventDefault(); step(1); }
    else if (!inText && (e.code === 'ArrowLeft' || e.code === 'ArrowUp')) { e.preventDefault(); step(-1); }
  };
  window.addEventListener('keydown', onKey, true);
  // controle: direcional anda nos botões, A aperta, B fecha
  let prev: boolean[] = [];
  const padT = window.setInterval(() => {
    const gp = navigator.getGamepads?.().find((g) => g && g.connected);
    if (!gp) return;
    const b = gp.buttons.map((x) => x.pressed);
    const hit = (i: number) => b[i] && !prev[i];
    if (hit(0)) (document.activeElement as HTMLElement)?.click?.();
    if (hit(1)) { close(); onEsc(); }
    if (hit(15) || hit(13)) step(1);
    if (hit(14) || hit(12)) step(-1);
    prev = b;
  }, 50);
  build(card, close);
  document.body.appendChild(root);
  setTimeout(() => (card.querySelector('textarea:not([readonly])') as HTMLElement ?? buttons()[0])?.focus(), 30);
}
function btn(row: HTMLElement, label: string, fn: () => void, main = false) {
  const b = document.createElement('button');
  b.textContent = label;
  if (main) b.className = 'main';
  b.addEventListener('click', (e) => { e.preventDefault(); fn(); });
  row.appendChild(b);
  return b;
}
function para(card: HTMLElement, s: string, cls = '') {
  const p = document.createElement('p');
  p.textContent = s;
  if (cls) p.className = cls;
  card.appendChild(p);
  return p;
}

// pede um texto (código de amigo): devolve o texto ou null (cancelou). check: valida antes de fechar
// (devolve a mensagem de erro, ou '' se estiver certo)
export function askText(title: string, hint: string, check?: (s: string) => Promise<string> | string, opt: { placeholder?: string; value?: string; short?: boolean } = {}): Promise<string | null> {
  return new Promise((res) => {
    dialog(title, (card, close) => {
      para(card, hint);
      const ta = document.createElement('textarea');
      ta.placeholder = opt.placeholder ?? 'Cole aqui o código';
      if (opt.value) ta.value = opt.value;
      if (opt.short) ta.style.height = '2.4em';
      card.appendChild(ta);
      const err = para(card, '', 'err');
      const row = document.createElement('div');
      row.className = 'row';
      // colar da área de transferência (onde o navegador deixa)
      if (!opt.short && navigator.clipboard?.readText) btn(row, 'COLAR', async () => {
        try { ta.value = await navigator.clipboard.readText(); } catch { err.textContent = 'Toque e segure na caixa para colar.'; }
      });
      btn(row, 'CANCELAR', () => { close(); res(null); });
      btn(row, 'OK', async () => {
        const v = ta.value.trim();
        if (!v) { err.textContent = opt.short ? 'Escreva primeiro.' : 'Cole o código primeiro.'; return; }
        const e = check ? await check(v) : '';
        if (e) { err.textContent = e; return; }
        close();
        res(v);
      }, true);
      card.appendChild(row);
    }, () => res(null));
  });
}

// copia um texto para a área de transferência; sem permissão, deixa o texto à mostra e selecionado
export async function copyText(s: string) {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
// mostra um código para mandar ao amigo (já copiado, se o aparelho deixou)
export function showText(title: string, hint: string, s: string): Promise<void> {
  return new Promise((res) => {
    dialog(title, (card, close) => {
      para(card, hint);
      const ta = document.createElement('textarea');
      ta.readOnly = true;
      ta.value = s;
      card.appendChild(ta);
      const msg = para(card, '', 'err');
      const row = document.createElement('div');
      row.className = 'row';
      btn(row, 'COPIAR', async () => {
        ta.select();
        msg.textContent = (await copyText(s)) ? 'Copiado! Cole no WhatsApp ou no e-mail.' : 'Selecione o texto e copie.';
      });
      if (navigator.share) btn(row, 'ENVIAR', () => { navigator.share({ text: s }).catch(() => {}); });
      btn(row, 'FECHAR', () => { close(); res(); }, true);
      card.appendChild(row);
      setTimeout(() => ta.select(), 40);
    }, () => res());
  });
}

// ---------- imagem pronta: salvar / compartilhar ----------
// Android (APK): a ponte do app grava na galeria e abre o compartilhar do sistema; navegador com
// compartilhar de arquivos (celular): COMPARTILHAR; programa de PC e navegador comum: BAIXAR. Em todos
// a imagem fica à mostra (no artifact o download pode estar bloqueado: tocar e segurar / botão direito)
type Bridge = { saveImage?: (b64: string, name: string) => string; shareImage?: (b64: string, name: string) => string };
const bridge = () => (window as unknown as { DuelAndroid?: Bridge }).DuelAndroid;
export function showImage(cv: HTMLCanvasElement, name: string, onDone?: () => void) {
  const url = cv.toDataURL('image/png');
  const file = `${name}.png`;
  let blob: Blob | null = null;
  cv.toBlob((b) => { blob = b; }, 'image/png');
  dialog('FOTO PRONTA', (card, close) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Foto do Duel Racer';
    card.appendChild(img);
    const br = bridge();
    para(card, br ? 'Salve na galeria ou mande para os amigos.' : 'Toque e segure na foto (ou clique com o botão direito) para salvar, se os botões não funcionarem aqui.');
    const msg = para(card, '', 'err');
    const row = document.createElement('div');
    row.className = 'row';
    const b64 = () => url.slice(url.indexOf(',') + 1);
    if (br?.saveImage) btn(row, 'SALVAR', () => { msg.textContent = br.saveImage!(b64(), file) || 'Salva na galeria (Imagens > DuelRacer).'; });
    if (br?.shareImage) btn(row, 'COMPARTILHAR', () => { const e = br.shareImage!(b64(), file); if (e) msg.textContent = e; });
    if (!br && navigator.share && navigator.canShare) btn(row, 'COMPARTILHAR', async () => {
      try {
        const f = new File([blob ?? (await (await fetch(url)).blob())], file, { type: 'image/png' });
        if (!navigator.canShare({ files: [f] })) throw new Error('sem arquivos');
        await navigator.share({ files: [f], title: 'Duel Racer' });
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') msg.textContent = 'Aqui não dá para compartilhar: segure na foto para salvar.';
      }
    });
    if (!br) btn(row, 'BAIXAR', () => {
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = file;
        document.body.appendChild(a);
        a.click();
        a.remove();
        msg.textContent = 'Se não baixou, segure na foto (ou botão direito) e salve.';
      } catch {
        msg.textContent = 'Segure na foto (ou botão direito) e salve.';
      }
    });
    btn(row, 'FECHAR', () => { close(); onDone?.(); }, true);
    card.appendChild(row);
  }, () => onDone?.());
}
