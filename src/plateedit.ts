// Editor da placa do jogador (AJUSTES > INTERFACE > PLACA): como a tela de nome dos fliperamas,
// cada caractere gira com cima/baixo (ou os botões ▲▼, ou digitando direto no teclado); a cidade
// troca com esquerda/direita. Mostra o carro de trás com a placa nova.
import { SAFE_W, view } from './config';
import { CARS, drawCar, type CarSpec } from './cars';
import { INK, GREY, RED, BLUE, ink, kicker, masthead, paper, tag, headline, arrow } from './mag';
import { CITIES, PLATE_LETTERS, bigPlateCells, drawBigPlate, myPlate, parsePlate, randomPlate, setMyPlate } from './myplate';
import { closeOverlay, openOverlay, type Overlay } from './overlay';
import { focusRing, inside, type Rect } from './ui';
import { paintHex } from './paint';
import { lastDevice } from './input';
import { toast } from './challenges';

const DIGITS = '0123456789';
const ox = () => Math.floor((view.w - SAFE_W) / 2);

export function openPlateEditor(car?: CarSpec) {
  const p = myPlate();
  let chars = p.text.replace('-', '').split('');
  let city = Math.max(0, CITIES.indexOf(p.city));
  let cur = 0; // caractere com o cursor
  let row = 0; // 0 = placa, 1 = cidade, 2 = botões
  let btnI = 1; // 0 sortear, 1 salvar, 2 cancelar
  let t = 0;
  const carSpec = car ?? CARS[0];
  const PW = 200;
  const plateX = () => ox() + 8, plateY = 50;
  const cells = () => bigPlateCells(plateX(), plateY, PW);
  const ph = Math.round(PW * 0.31);
  const ups = () => cells().map((r): Rect => ({ x: r.x - 2, y: plateY - 14, w: r.w + 4, h: 11 }));
  const downs = () => cells().map((r): Rect => ({ x: r.x - 2, y: plateY + ph + 3, w: r.w + 4, h: 11 }));
  const cityR = (): Rect => ({ x: ox() + 8, y: 136, w: PW, h: 16 });
  const btns = (): Rect[] => [{ x: ox() + 8, y: 196, w: 70, h: 15 }, { x: ox() + 84, y: 196, w: 90, h: 15 }, { x: ox() + 180, y: 196, w: 74, h: 15 }];
  const pool = (i: number) => (i < 3 ? PLATE_LETTERS : DIGITS);
  const spin = (i: number, d: number) => {
    const s = pool(i);
    chars[i] = s[(s.indexOf(chars[i]) + d + s.length) % s.length];
  };
  const text = () => `${chars.slice(0, 3).join('')}-${chars.slice(3).join('')}`;
  const save = () => {
    if (!parsePlate(text())) return toast('PLACA INVÁLIDA', 'Três letras e quatro números', '#ff8060');
    setMyPlate(text(), CITIES[city]);
    toast('PLACA SALVA!', `${text()}${CITIES[city] ? ' · ' + CITIES[city] : ''}`, '#30e060');
    closeOverlay(o);
  };
  const act = (i: number) => {
    if (i === 0) {
      chars = randomPlate().replace('-', '').split('');
    } else if (i === 1) save();
    else closeOverlay(o);
  };
  const o: Overlay = {
    draw(c, dt) {
      t += dt;
      const x = ox();
      paper(c);
      masthead(c, 'PLACA DO CARRO');
      kicker(c, 'SUA PLACA', x + 4, 22, RED, '#fff');
      ink(c, 'Aparece no carro nas fotos, replays e no seu fantasma', x + 66, 24, 4, GREY);
      // setas de cada caractere
      const kb = lastDevice.kind !== 'touch';
      ups().forEach((r, i) => arrow(c, r, 'up', i === cur && row === 0));
      downs().forEach((r, i) => arrow(c, r, 'down', i === cur && row === 0));
      drawBigPlate(c, plateX(), plateY, PW, text(), CITIES[city], row === 0 ? cur : -1, Math.floor(t * 3) % 3 !== 0);
      // cidade
      const cr = cityR();
      c.fillStyle = row === 1 ? '#fff8e4' : '#f6efdd';
      c.fillRect(cr.x, cr.y, cr.w, cr.h);
      c.strokeStyle = row === 1 ? RED : 'rgba(26,22,20,0.35)';
      c.lineWidth = row === 1 ? 2 : 1;
      c.strokeRect(cr.x + 0.5, cr.y + 0.5, cr.w - 1, cr.h - 1);
      ink(c, '◀', cr.x + 5, cr.y + 5, 5, RED);
      ink(c, '▶', cr.x + cr.w - 10, cr.y + 5, 5, RED);
      ink(c, CITIES[city] ? `CIDADE: ${CITIES[city]}` : 'CIDADE: SEM CIDADE', cr.x + cr.w / 2, cr.y + 5, 5, INK, 'center');
      ink(c, 'Três letras e quatro números, como as placas cinzas de 1990.', x + 8, 160, 4, GREY);
      ink(c, kb ? '▲▼ troca · ◀▶ anda · digite letras e números · Enter: seguir' : 'Toque nas setas para trocar cada letra', x + 8, 168, 4, GREY);
      btns().forEach((r, i) => tag(c, r, ['SORTEAR', 'SALVAR', 'CANCELAR'][i], row === 2 && btnI === i, 5));
      if (row === 2 && kb) focusRing(c, btns()[btnI]);
      // o carro de trás, com a placa nova
      const px = x + SAFE_W - 56, py = 128;
      c.fillStyle = 'rgba(26,22,20,0.12)';
      c.fillRect(px - 52, 40, 104, 96);
      c.strokeStyle = INK;
      c.strokeRect(px - 51.5, 40.5, 103, 95);
      ink(c, 'VISTA DE TRÁS', px, 44, 4, GREY, 'center');
      drawCar(c, px, py, 88, { color: carSpec.color, rear: carSpec.rear, paint: paintHex(carSpec.id), plate: { style: 'br', text: text(), year: 1992 }, drop: carSpec.rideDrop, driver: null });
      headline(c, text(), px, 142, 8, BLUE, 'center');
    },
    key(k) {
      if (k === 'back' || k === 'start') return closeOverlay(o);
      if (row === 0) {
        if (k === 'up') spin(cur, 1);
        else if (k === 'down') spin(cur, -1);
        else if (k === 'left') cur = Math.max(0, cur - 1);
        else if (k === 'right') cur = Math.min(6, cur + 1);
        else if (k === 'ok' || k === 'nextTab') row = 1;
      } else if (row === 1) {
        if (k === 'left' || k === 'right') city = (city + (k === 'right' ? 1 : -1) + CITIES.length) % CITIES.length;
        else if (k === 'up' || k === 'prevTab') row = 0;
        else if (k === 'down' || k === 'ok' || k === 'nextTab') row = 2;
      } else {
        if (k === 'left') btnI = Math.max(0, btnI - 1);
        else if (k === 'right') btnI = Math.min(2, btnI + 1);
        else if (k === 'up' || k === 'prevTab') row = 1;
        else if (k === 'ok') act(btnI);
      }
    },
    type(e) {
      const ch = e.key.length === 1 ? e.key.toUpperCase() : '';
      if (row === 0 && ch && pool(cur).includes(ch)) {
        chars[cur] = ch;
        cur = Math.min(6, cur + 1);
        return true;
      }
      if (row === 0 && e.code === 'Backspace') {
        cur = Math.max(0, cur - 1);
        return true;
      }
      return false;
    },
    tap(x, y) {
      const hitI = (rs: Rect[]) => rs.findIndex((r) => inside(x, y, r));
      let i = hitI(ups());
      if (i >= 0) { row = 0; cur = i; spin(i, 1); return; }
      i = hitI(downs());
      if (i >= 0) { row = 0; cur = i; spin(i, -1); return; }
      i = hitI(cells().map((r) => ({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 })));
      if (i >= 0) { row = 0; cur = i; return; }
      const cr = cityR();
      if (inside(x, y, cr)) {
        row = 1;
        city = (city + (x < cr.x + cr.w / 2 ? -1 : 1) + CITIES.length) % CITIES.length;
        return;
      }
      i = hitI(btns());
      if (i >= 0) { row = 2; btnI = i; act(i); }
    },
  };
  openOverlay(o);
}
