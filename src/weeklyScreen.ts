// Página RANKING DA SEMANA (Ranking > SEMANA): a tabela de cada roteiro com você e os amigos que
// mandaram o código desta semana. ◀▶ troca de roteiro; ENVIAR copia o seu código; COLAR lê o do amigo.
import { SAFE_W, view } from './config';
import { COURSES } from './courses';
import { BLUE, GREY, INK, RED, box, headline, ink, kicker, masthead, paper, rule, tag, arrow } from './mag';
import { askText, closeOverlay, openOverlay, showText, type Overlay } from './overlay';
import { activeCourses, addFriend, clearFriends, friends, myName, parseWeekCode, table, weekCode, weekKey, weekSpan } from './weekly';
import { focusRing, inside, text, type Rect } from './ui';
import { formatTime } from './util';
import { lastDevice } from './input';
import { toast } from './challenges';
import { playerName, setPlayerName, cleanName } from './daily';

const ox = () => Math.floor((view.w - SAFE_W) / 2);

export function openWeekly(startCourse = 0, onClose?: () => void) {
  let act = activeCourses();
  let ci = act.includes(startCourse) ? startCourse : act[0] ?? startCourse;
  let focus = 0; // 0 roteiro, 1 voltar, 2 enviar, 3 colar, 4 apagar
  let confirmT = 0;
  const step = (d: number) => {
    act = activeCourses();
    if (!act.length) return;
    const i = act.indexOf(ci);
    ci = act[((i < 0 ? 0 : i + d) + act.length) % act.length];
  };
  const rects = (): Rect[] => {
    const x = ox();
    return [
      { x: x + 4, y: 28, w: SAFE_W - 8, h: 18 },
      { x: x + 4, y: 212, w: 52, h: 15 },
      { x: x + 60, y: 212, w: 100, h: 15 },
      { x: x + 164, y: 212, w: 72, h: 15 },
      { x: x + 240, y: 212, w: 76, h: 15 },
    ];
  };
  async function send() {
    if (!playerName()) {
      const n = await askText('SEU APELIDO', 'Como você aparece no ranking dos amigos (até 10 letras).', (s) => (cleanName(s).length ? '' : 'Use letras ou números.'), { placeholder: 'PILOTO', short: true });
      if (!n) return;
      setPlayerName(n);
    }
    const g = weekCode();
    if (!g) return toast('SEM TEMPOS NESTA SEMANA', 'Complete um trecho de roteiro do Arcade', '#ff8060');
    const msg = `Duel Racer: meus tempos da semana (${g.n} trecho${g.n > 1 ? 's' : ''}). Cole em Ranking > SEMANA\n${g.code}`;
    await showText('MEUS TEMPOS DA SEMANA', `${myName()}: mande este código para os amigos (WhatsApp, e-mail). Vale até domingo.`, msg);
  }
  async function paste() {
    let got: ReturnType<typeof parseWeekCode> | null = null;
    const raw = await askText('CÓDIGO DO AMIGO', 'Cole o código de tempos da semana que o seu amigo mandou (começa com DRW1.).', (s) => {
      const r = parseWeekCode(s);
      if (typeof r === 'string') return r;
      got = r;
      return '';
    });
    if (!raw || !got) return;
    const f = got as Exclude<ReturnType<typeof parseWeekCode>, string>;
    addFriend(f);
    act = activeCourses();
    const first = COURSES.findIndex((c) => f.e[c.id]?.some(Boolean));
    if (first >= 0) ci = first;
    toast(`${f.n} ENTROU NO RANKING!`, `Placa ${f.p}`, '#30e060');
  }
  const press = (i: number) => {
    if (i === 0) step(1);
    else if (i === 1) closeOverlay(o);
    else if (i === 2) void send();
    else if (i === 3) void paste();
    else if (i === 4) {
      if (!friends().length) return toast('NENHUM AMIGO AINDA', 'Cole o código de um amigo', '#ff8060');
      if (confirmT > 0) {
        clearFriends();
        confirmT = 0;
        act = activeCourses();
        toast('AMIGOS APAGADOS', 'O ranking ficou só com você');
      } else confirmT = 3;
    }
  };
  const o: Overlay = {
    draw(c, dt) {
      confirmT = Math.max(0, confirmT - dt);
      const x = ox();
      paper(c);
      masthead(c, 'RANKING DA SEMANA');
      kicker(c, `SEMANA ${weekKey().slice(5)} · ${weekSpan()}`, x + 4, 20, RED, '#fff');
      const nf = friends().length;
      ink(c, nf ? `${nf} amigo${nf > 1 ? 's' : ''} nesta semana` : 'Cole o código de um amigo', x + SAFE_W - 4, 22, 4, GREY, 'right');
      const rs = rects();
      const course = COURSES[ci];
      const kb = lastDevice.kind !== 'touch';
      arrow(c, { x: rs[0].x, y: rs[0].y + 4, w: 14, h: 12 }, 'left', focus === 0 && kb);
      arrow(c, { x: rs[0].x + rs[0].w - 14, y: rs[0].y + 4, w: 14, h: 12 }, 'right', focus === 0 && kb);
      headline(c, course ? course.name.toUpperCase() : '-', x + SAFE_W / 2, rs[0].y + 6, 8, INK, 'center');
      const t: Rect = { x: x + 4, y: 50, w: SAFE_W - 8, h: 144 };
      box(c, t, 'CLASSIFICAÇÃO');
      const rows = course ? table(course.id) : [];
      const cols = { pos: t.x + 8, name: t.x + 30, plate: t.x + 120, done: t.x + 200, time: t.x + t.w - 8 };
      ink(c, 'POS', cols.pos, t.y + 13, 4, GREY);
      ink(c, 'PILOTO', cols.name, t.y + 13, 4, GREY);
      ink(c, 'PLACA', cols.plate, t.y + 13, 4, GREY);
      ink(c, 'TRECHOS', cols.done, t.y + 13, 4, GREY);
      ink(c, 'TEMPO TOTAL', cols.time, t.y + 13, 4, GREY, 'right');
      rule(c, t.x + 4, t.y + 20, t.w - 8, RED);
      if (!rows.length) {
        ink(c, act.length ? 'Ninguém correu este roteiro nesta semana.' : 'Corra os roteiros do Arcade nesta semana', x + SAFE_W / 2, t.y + 60, 5, GREY, 'center');
        if (!act.length) ink(c, 'e troque códigos com os amigos.', x + SAFE_W / 2, t.y + 72, 5, GREY, 'center');
      }
      const n = course?.stages.length ?? 0;
      rows.slice(0, 9).forEach((r, i) => {
        const y = t.y + 25 + i * 13;
        if (r.me) {
          c.fillStyle = 'rgba(255,210,26,0.45)';
          c.fillRect(t.x + 2, y - 2, t.w - 4, 12);
        } else if (i % 2) {
          c.fillStyle = 'rgba(26,22,20,0.05)';
          c.fillRect(t.x + 2, y - 2, t.w - 4, 12);
        }
        text(c, `${i + 1}º`, cols.pos, y, 5, i === 0 ? RED : INK, 'left', null);
        ink(c, r.me ? `${r.name} (VOCÊ)` : r.name, cols.name, y + 1, 5, r.me ? INK : BLUE);
        // plaquinha cinza
        c.fillStyle = INK;
        c.fillRect(cols.plate - 1, y - 2, 52, 11);
        c.fillStyle = '#c8cacf';
        c.fillRect(cols.plate, y - 1, 50, 9);
        ink(c, r.plate, cols.plate + 25, y + 1, 4, INK, 'center');
        ink(c, `${r.done}/${n}`, cols.done + 14, y + 1, 5, r.done === n ? '#1a6a2a' : GREY, 'center');
        ink(c, formatTime(r.total), cols.time, y + 1, 5, INK, 'right');
      });
      if (rows.length > 9) ink(c, `+ ${rows.length - 9}`, t.x + t.w / 2, t.y + t.h - 8, 4, GREY, 'center');
      if (act.length > 1) ink(c, `Roteiro ${act.indexOf(ci) + 1} de ${act.length} com tempos`, x + 4, 200, 4, GREY);
      const labels = ['◀ VOLTAR', 'ENVIAR MEUS TEMPOS', 'COLAR CÓDIGO', confirmT > 0 ? 'CONFIRMAR?' : 'APAGAR AMIGOS'];
      labels.forEach((l, i) => tag(c, rs[i + 1], l, kb && focus === i + 1 || (i === 3 && confirmT > 0), 5));
      if (kb) focusRing(c, rs[focus]);
    },
    key(k) {
      if (k === 'back' || k === 'start') return closeOverlay(o);
      if (focus === 0 && (k === 'left' || k === 'right')) return step(k === 'right' ? 1 : -1);
      if (k === 'prevTab' || k === 'nextTab') return step(k === 'nextTab' ? 1 : -1);
      if (k === 'down' && focus === 0) focus = 2;
      else if (k === 'up') focus = 0;
      else if (k === 'left' && focus > 1) focus--;
      else if (k === 'right' && focus > 0 && focus < 4) focus++;
      else if (k === 'ok') press(focus);
    },
    tap(x, y) {
      const rs = rects();
      if (inside(x, y, rs[0])) {
        focus = 0;
        return step(x < rs[0].x + rs[0].w / 2 ? -1 : 1);
      }
      const i = rs.findIndex((r, k) => k > 0 && inside(x, y, r));
      if (i > 0) {
        focus = i;
        press(i);
      }
    },
    onClose,
  };
  openOverlay(o);
}
