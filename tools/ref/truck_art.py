"""Caminhões do trânsito com a arte do Victor (uma folha por caminhão: traseira à esquerda e frente à
direita sobre magenta, 1536 x 1024) virando os sprites do jogo (src/assets/traffic/<modelo>-<vista>.png
+ -mask.png), como tools/ref/traffic_art.py faz com os carros:
- escala única por folha: a carroceria (faixa de baixo: para-choque e pneus, sem os retrovisores) da vista
  mais larga fica com 160 px, a largura do caminhão antigo (TRUCK_W); os retrovisores passam disso, e o
  jogo desenha o sprite mais largo na mesma proporção (TRUCK_PX em src/race.ts);
- cor do miolo de cada bloco (mediana do centro, sem reduzir por área) + paleta curta; magenta transparente;
- máscara de pintura só na cabine vermelha (matiz do vermelho, saturado), nunca em lanternas, piscas,
  faróis, frisos, grade, cromados, carroceria, baú ou tanque: de trás só onde a cabine aparece (CAB).
Uso: python3 tools/ref/truck_art.py <folha_kenworth> <folha_f4000> <folha_cargo> <folha_mb1113> <folha_vw790> <folha_volvon10>
     (ou <modelo>=<folha> ...). Grava também <scratchpad>/trucks/raw-*.png se TRUCK_RAW=<pasta>.
"""
import colorsys
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src/assets/traffic')
MODELS = ['kenworth', 'f4000', 'cargo', 'mb1113', 'vw790', 'volvon10']
W = 160  # largura da carroceria na vista mais larga
COLORS = 10  # paleta curta: cores a menos de 10 (Lab) de outra mais comum juntam-se a ela

# onde a cabine aparece de trás (caixas em pixels do sprite); sem caixa, a traseira não tem pintura
CAB = {
    'kenworth': [(0, 0, 999, 40)],  # teto da cabine acima da carreta, entre as chaminés
}
# de frente: caixas (pixels do sprite) que nunca entram na máscara (luzes de teto vermelhas, letreiros)
EXCL_FRONT = {
    'f4000': [(0, 0, 999, 31)],  # travessa de cima da gaiola de madeira (avermelhada), acima do teto da cabine
}


def magenta(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 150) & (g < 130) & (b > 150) & (r - g > 90) & (b - g > 90)


def views(a):
    """recortes (traseira, frente) da folha: os dois lados separados pela coluna vazia do meio"""
    mag = magenta(a)
    cols = np.where((~mag).sum(0) > 3)[0]
    gaps = [(cols[i], cols[i + 1]) for i in np.where(np.diff(cols) > 1)[0] if cols[i + 1] - cols[i] > 20]
    mid = (gaps[0][0] + gaps[0][1]) // 2 if gaps else a.shape[1] // 2
    out = []
    for x0, x1 in ((0, mid), (mid, a.shape[1])):
        m = ~mag[:, x0:x1]
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0  # ruído solto
        ys, xs = np.where(m)
        out.append((x0 + xs.min(), ys.min(), x0 + xs.max() + 1, ys.max() + 1))
    return out


def body_width(a, box):
    """largura da carroceria: a linha mais larga da faixa de baixo (45%), sem retrovisores"""
    x0, y0, x1, y1 = box
    m = ~magenta(a[y0:y1, x0:x1])
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    best = 0
    for y in range(int((y1 - y0) * 0.55), y1 - y0):
        xs = np.where(m[y])[0]
        if len(xs):
            best = max(best, xs.max() - xs.min() + 1)
    return best


def reduce(a, box, bs):
    """cada pixel do sprite = mediana do miolo do bloco correspondente da arte (nada de média por área)"""
    x0, y0, x1, y1 = box
    mag = magenta(a)
    Wo = int(round((x1 - x0) / bs))
    Ho = int(round((y1 - y0) / bs))
    cx0 = (x0 + x1) / 2 - Wo * bs / 2
    o = np.zeros((Ho, Wo, 4), np.uint8)
    rr = max(1, int(bs * 0.2))
    for j in range(Ho):
        cy = int(y0 + (j + 0.5) * bs)
        for i in range(Wo):
            cx = int(cx0 + (i + 0.5) * bs)
            blk = a[cy - rr:cy + rr + 1, cx - rr:cx + rr + 1].reshape(-1, 3)
            m = mag[cy - rr:cy + rr + 1, cx - rr:cx + rr + 1].reshape(-1)
            if m.mean() > 0.5:
                continue
            o[j, i] = [*np.median(blk[~m], axis=0).astype(np.uint8), 255]
    # pixels de borda misturados com o magenta (roxos) viram o contorno preto
    r, g, b = [o[..., k].astype(int) for k in range(3)]
    fringe = (o[..., 3] > 0) & (r - g > 60) & (b - g > 60)
    o[fringe, :3] = [20, 12, 20]
    # pixel solto sem vizinho opaco sai
    op = (o[..., 3] > 0).astype(np.uint8)
    nb = cv2.filter2D(op, -1, np.ones((3, 3), np.float32), borderType=cv2.BORDER_CONSTANT) - op
    o[(op > 0) & (nb < 2)] = 0
    return o


def palette(o, tol=COLORS):
    """paleta curta por proximidade (Lab): das cores mais comuns para as raras, cada cor junta-se à
    primeira da paleta a menos de tol; senão vira cor nova. Corte pela mediana apagava as cores de pouca
    área (luzes âmbar viravam vermelhas); assim o chuvisco some e as luzes ficam."""
    op = o[..., 3] > 0
    px = o[op][:, :3]
    lab = cv2.cvtColor(px.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(float)
    lab[:, 0] *= 100 / 255
    lab[:, 1:] -= 128
    keys, inv, cnt = np.unique(px, axis=0, return_inverse=True, return_counts=True)
    inv = inv.reshape(-1)
    klab = np.zeros((len(keys), 3))
    np.add.at(klab, inv, lab)
    klab /= cnt[:, None]
    pal, plab, out = [], [], np.zeros(len(keys), int)
    for k in np.argsort(-cnt):
        if plab:
            d = np.linalg.norm(np.array(plab) - klab[k], axis=1)
            j = int(np.argmin(d))
            if d[j] < tol:
                out[k] = j
                continue
        out[k] = len(pal)
        pal.append(keys[k])
        plab.append(klab[k])
    o = o.copy()
    o[op, :3] = np.array(pal)[out[inv]]
    return o


def hsv(o):
    rgb = o[..., :3].astype(float) / 255
    mx, mn = rgb.max(2), rgb.min(2)
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    h = np.zeros(mx.shape)
    for y, x in zip(*np.nonzero(o[..., 3] > 0)):
        h[y, x] = colorsys.rgb_to_hsv(*rgb[y, x])[0] * 360
    return h, s, mx


def red_mask(o, region):
    """vermelho da cabine: matiz perto de 4 graus, saturado; o laranja dos piscas (25-50 graus), os
    brancos/cromados e o preto ficam de fora; grupos pequenos saem (lâmpadas, refletores)"""
    h, s, v = hsv(o)
    dh = np.abs((h - 4 + 180) % 360 - 180)
    op = o[..., 3] > 0
    core = op & region & (dh < 13) & (s > 0.55) & (v > 0.32)
    # bordas escuras e reflexos claros da lataria colados à máscara (mesmo matiz, menos saturado)
    m = core.copy()
    for _ in range(2):
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= near & op & region & (dh < 16) & (s > 0.35) & (v > 0.18)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    for i in range(1, n):  # sobra solta (chuvisco) ou lâmpada vermelha viva: sai; pedaços de lataria ficam
        if st[i, 4] < 6 or (st[i, 4] < 40 and v[lab == i].mean() > 0.9):
            m[lab == i] = False
    # vincos e filetes finos (1-2 px) no meio da lataria, alaranjados no brilho (capô do F-4000): entram
    # quando há lataria dos dois lados; lâmpadas são manchas de 3 px ou mais e ficam de fora
    warm = op & region & ((dh < 30) | ((h > 330) | (h < 32))) & (s > 0.25) & (v > 0.15)
    for k in ((4, 1), (1, 4)):
        cl = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones(k, np.uint8)) > 0
        m |= cl & warm
    return m


def boxes(H, Wd, bxs):
    r = np.zeros((H, Wd), bool)
    for x0, y0, x1, y1 in bxs:
        r[max(0, y0):y1, max(0, x0):x1] = True
    return r


def lamps(o, rear):
    """centros das luzes em fração: traseira = lanternas vermelhas na faixa de baixo; frente = faróis
    (brancos/creme) na metade de baixo; também o maior grupo âmbar (pisca) de cada lado"""
    H, Wd = o.shape[:2]
    r, g, b, a = [o[..., i].astype(int) for i in range(4)]
    if rear:
        c = (a > 0) & (r > 170) & (g < 90) & (b < 90)
        c[:int(H * 0.6)] = False
    else:
        c = (a > 0) & (r > 200) & (g > 190) & (b > 150) & (np.abs(r - g) < 40)
        c[:int(H * 0.45)] = False
        c[int(H * 0.86):] = False
    amb = (a > 0) & (r > 200) & (g > 110) & (g < 200) & (b < 90)
    amb[:int(H * (0.6 if rear else 0.4))] = False
    res = {}
    for name, cc0 in (('lamp', c), ('amber', amb)):
        side = []
        for half in (slice(0, Wd // 2 - 6), ):
            cc = np.zeros_like(cc0)
            cc[:, half] = cc0[:, half]
            n, lab, st, cen = cv2.connectedComponentsWithStats(cc.astype(np.uint8))
            if n > 1:
                if name == 'lamp' and rear:  # todas as lanternas vermelhas do lado: o meio delas
                    ys, xs = np.nonzero(cc)
                    side.append([round(xs.mean() / Wd, 3), round(ys.mean() / H, 3), round((xs.max() - xs.min() + 1) / Wd, 3)])
                else:
                    i = 1 + int(np.argmax(st[1:, 4]))
                    side.append([round(cen[i][0] / Wd, 3), round(cen[i][1] / H, 3), int(st[i, 4])])
        res[name] = side
    return res


def plate(o, rear):
    """placa: o maior retângulo branco-gelo no terço do meio, na metade de baixo"""
    H, Wd = o.shape[:2]
    r, g, b, a = [o[..., i].astype(int) for i in range(4)]
    mn = np.minimum(np.minimum(r, g), b)
    c = (a > 0) & (mn > 200) & (np.maximum(np.maximum(r, g), b) - mn < 40)
    c[:int(H * 0.55)] = False
    c[:, :int(Wd * 0.3)] = False
    c[:, int(Wd * 0.7):] = False
    n, lab, st, _ = cv2.connectedComponentsWithStats(c.astype(np.uint8))
    if n < 2:
        return None
    i = 1 + int(np.argmax(st[1:, 4]))
    x, y, w, h = st[i, :4]
    return [int(x), int(y), int(x + w), int(y + h), Wd, H]


def main():
    args = sys.argv[1:]
    pairs = [x.split('=', 1) if '=' in x else (MODELS[i], x) for i, x in enumerate(args)]
    raw = os.environ.get('TRUCK_RAW')
    report = {}
    for model, path in pairs:
        a = np.array(Image.open(path).convert('RGB')).astype(int)
        vb = views(a)
        bw = [body_width(a, b) for b in vb]
        bs = max(bw) / W
        for view, box in zip(('rear', 'front'), vb):
            o = reduce(a, box, bs)
            o = palette(o)
            H, Wd = o.shape[:2]
            if view == 'rear':
                region = boxes(H, Wd, CAB.get(model, []))
            else:
                region = ~boxes(H, Wd, EXCL_FRONT.get(model, []))
            m = red_mask(o, region)
            Image.fromarray(o).save(os.path.join(OUT, f'{model}-{view}.png'), optimize=True)
            if m.any():
                Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(os.path.join(OUT, f'{model}-{view}-mask.png'), optimize=True)
            elif os.path.exists(os.path.join(OUT, f'{model}-{view}-mask.png')):
                os.remove(os.path.join(OUT, f'{model}-{view}-mask.png'))
            if raw:
                Image.fromarray(o).save(os.path.join(raw, f'raw-{model}-{view}.png'))
            body = round(bw[0 if view == 'rear' else 1] / bs)
            report[f'{model}-{view}'] = dict(size=[Wd, H], body=body, mask=int(m.sum()), lights=lamps(o, view == 'rear'), plate=plate(o, view == 'rear'))
            print(f'{model}-{view}', Wd, 'x', H, 'carroceria', body, 'máscara', int(m.sum()),
                  'luzes', report[f'{model}-{view}']['lights'], 'placa', report[f'{model}-{view}']['plate'])
    return report


if __name__ == '__main__':
    main()
