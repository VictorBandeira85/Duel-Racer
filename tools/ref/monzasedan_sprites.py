"""Sprites do Ímola Classic SE (Monza Classic SE sedã 1988/89, pixel art do Victor). A arte vem em fundo
preto: o carro é tudo o que não é preto puro ligado em manchas de bom tamanho, com o contorno fechado
linha a linha (para-choques, saias e pneus são quase pretos) e, embaixo do carro, só os pneus (e o
escapamento) ficam: a sombra sai por geometria. A lateral já vem com a frente para a esquerda, mas
cinza: passa para o bordô da frente/traseira copiando o brilho (mesma posição na escala de tons).
Marcas reais somem: gravata da grade, "CHEVROLET" da tampa, "Monza" da saia e da placa da frente; a
placa de trás fica lisa (o jogo escreve a dele). Vira pixel art nítida (lateral 400, frente/traseira 260: shrink de monza_sprites.py).
Emblemas da marca: brand_badges.py.
Cupê (Ímola Classic Coupé): mesma frente e traseira; só a lateral muda. Com "coupe <pasta do cupê>" no
fim, a lateral vem de <pasta do cupê>/src-side.png (ampliada para o tamanho da do sedã, as medidas são
as mesmas) e sai como br-monzacoupe-side; frente e traseira são cópias das do sedã já com emblema.
Uso: python3 tools/ref/monzasedan_sprites.py <pasta com src-*.png> <src/assets/cars> [coupe <pasta>]   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink, paint_mask, rowfill  # noqa: E402

WIDTH = {'side': 400, 'rear': 260, 'front': 260}
ID = 'br-monzasedan'
COUPE = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == 'coupe' else None
TXT_SIDE = (722, 466, 814, 502) if COUPE else (714, 460, 794, 496)      # "Monza" da saia
MIRROR = (772, 232, 880, 314)  # retrovisor externo: sempre cinza, fora da máscara de pintura (não muda com a cor)
SIDE_WHEELS, SIDE_R = ((499, 551), (1629, 551)), 133
# linha a partir da qual o contorno é fechado de ponta a ponta; abaixo de CUT só ficam as faixas dos pneus
HULL = {'front': 100, 'rear': 100, 'side': 335}
CUT = {'front': (840, 937, [(240, 400), (1110, 1282)]), 'rear': (808, 937, [(275, 480), (1090, 1282)])}


def segment(a, k):
    lum = a.astype(int).mean(axis=2)
    H, W = lum.shape
    yy, xx = np.mgrid[0:H, 0:W]
    m = cv2.morphologyEx((lum > 5).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    car = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 150])
    if k == 'side':
        wheels = np.zeros_like(car)
        for cx, cy in SIDE_WHEELS:
            wheels |= np.hypot(xx - cx, yy - cy) <= SIDE_R
        car &= (yy <= 590) | wheels
        car |= wheels
    else:
        y0, y1, spans = CUT[k]
        keep = np.zeros_like(car)
        for x0, x1 in spans:
            keep |= (xx >= x0) & (xx <= x1)
        car &= (yy <= y0) | (keep & (yy <= y1))
        car |= keep & (yy > y0 - 40) & (yy <= y1 - 6) & (lum <= 5) & False
    # contorno fechado linha a linha (as peças pretas somem no fundo preto)
    for y in range(HULL[k], H):
        if k != 'side' and y > CUT[k][0]:
            for x0, x1 in CUT[k][2]:
                xs = np.nonzero(car[y, x0:x1 + 1])[0]
                if len(xs) > 8:
                    car[y, x0 + xs.min():x0 + xs.max() + 1] = True
            continue
        if k == 'side' and y > 590:
            continue
        xs = np.nonzero(car[y])[0]
        if len(xs) > 8:
            car[y, xs.min():xs.max() + 1] = True
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab = cv2.connectedComponents((car == 0).astype(np.uint8), connectivity=4)
    car = (car > 0) | (lab != lab[0, 0])
    n, lab, st, _ = cv2.connectedComponentsWithStats(car.astype(np.uint8), 8)
    return lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))


def debrand(a, k):
    if k == 'front':
        for y in range(556, 606):  # gravata: cada linha da grade continua (as barras são horizontais)
            a[y, 700:838] = np.median(np.concatenate([a[y, 664:698], a[y, 840:874]]), axis=0).astype(np.uint8)
        a[702:767, 641:896] = (12, 12, 16)
        im = Image.fromarray(a)
        ImageDraw.Draw(im).text((768, 734), 'CLASSIC SE', font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 34), fill=(196, 196, 200), anchor='mm')
        a[:] = np.array(im)
    elif k == 'rear':
        rowfill(a, 998, 446, 1214, 488)
        a[517:604, 640:900] = (18, 18, 24)
    else:
        x0, y0, x1, y1 = TXT_SIDE  # "Monza" (fica "Classic SE"): cada linha recebe a cor da saia lisa mais atrás
        for y in range(y0, y1):
            a[y, x0 - 4:x1] = np.median(a[y, 950:990], axis=0).astype(np.uint8)


def gray_mask(a, car):
    """lataria cinza da lateral (acima do friso, sem vidros, rodas, frisos claros e peças pretas)"""
    rgb = a.astype(int)
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    # na altura dos vidros (acima da linha de cintura) só a lataria clara: colunas, molduras e palhetas escuras ficam
    m = car & (sat < 34) & (lum > np.where(yy < 292, 84, 36)) & (lum < 236) & (yy < 460)
    m &= ~((xx > MIRROR[0]) & (xx < MIRROR[2]) & (yy > MIRROR[1]) & (yy < MIRROR[3]))  # retrovisor (preto na frente): fica como está
    for cx, cy in SIDE_WHEELS:
        m &= np.hypot(xx - cx, yy - cy) > SIDE_R + 4
    return m


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    S, M = {}, {}
    for k in ('front', 'rear', 'side'):
        im = Image.open(os.path.join(COUPE if COUPE and k == 'side' else src, f'src-{k}.png')).convert('RGB')
        if COUPE and k == 'side':
            im = im.resize((2172, 724), Image.LANCZOS)
        a = np.array(im)
        car = segment(a, k)
        debrand(a, k)
        gm = gray_mask(a, car) if k == 'side' else None
        s, (ox, oy, f) = shrink(a, car, WIDTH[k])
        sy = lambda y: int(round((y - oy) / f))
        if k == 'side':
            g8, _ = shrink(np.dstack([gm * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
            m = (g8[..., 0] > 127) & (s[..., 3] > 0)
        else:
            m = paint_mask(s)
            if k == 'front':
                m[sy(612):] = False  # para-choque para baixo
            else:
                m[sy(504):sy(766)] = False  # lanternas e para-choque (a saia de baixo é da cor do carro)
            if k == 'front':
                w16 = int(round(s.shape[1] * 0.08))
                for sl in (slice(0, w16), slice(s.shape[1] - w16, s.shape[1])):  # piscas
                    m[sy(515):, sl] = False
        S[k], M[k] = s, m
        print(k, s.shape[1], s.shape[0], 'origem', ox, oy, 'fator', round(f, 3), 'máscara', int(m.sum()))
    # lateral cinza -> bordô: a cor da frente/traseira na mesma posição da escala de brilho
    ref = np.concatenate([S[v][..., :3][M[v]] for v in ('front', 'rear')]).astype(float)
    ref = ref[np.argsort(ref.mean(axis=1))]
    bins = np.array([np.median(c, axis=0) for c in np.array_split(ref, 48)])
    s, m = S['side'], M['side']
    lum = s[..., :3][m].astype(float).mean(axis=1)
    rk = np.argsort(np.argsort(lum)) / max(1, len(lum) - 1) * 47
    lo = np.floor(rk).astype(int)
    hi = np.minimum(lo + 1, 47)
    t = (rk - lo)[:, None]
    s[..., :3][m] = np.clip(bins[lo] * (1 - t) + bins[hi] * t, 0, 255).astype(np.uint8)
    # tons chapados na lataria (a conversão pixel a pixel deixava chuvisco): 14 tons de bordô
    lab = cv2.cvtColor(np.ascontiguousarray(s[..., :3]), cv2.COLOR_RGB2LAB).astype(np.float32)
    lab = cv2.medianBlur(lab, 3)
    cv2.setRNGSeed(7)
    _, lbl, cen = cv2.kmeans(lab[m], 14, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.2), 3, cv2.KMEANS_PP_CENTERS)
    q = lab.copy()
    q[m] = cen[lbl.ravel()]
    s[..., :3][m] = cv2.cvtColor(np.clip(q, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)[m]
    if COUPE:
        import shutil
        for v in ('front', 'rear'):
            for suf in ('', '-mask'):
                shutil.copy(os.path.join(out, f'br-monzasedan-{v}{suf}.png'), os.path.join(out, f'br-monzacoupe-{v}{suf}.png'))
    for k in (['side'] if COUPE else list(S)):
        ID = 'br-monzacoupe' if COUPE else 'br-monzasedan'
        Image.fromarray(S[k], 'RGBA').save(os.path.join(out, f'{ID}-{k}.png'), optimize=True)
        Image.fromarray((M[k] * 255).astype(np.uint8), 'L').convert('RGBA').save(os.path.join(out, f'{ID}-{k}-mask.png'), optimize=True)
        if dbg:
            v = np.array(Image.fromarray(S[k]).resize((S[k].shape[1] * 4, S[k].shape[0] * 4), Image.NEAREST))
            bg = np.zeros_like(v[..., :3]); bg[:] = (0, 200, 0)
            al = v[..., 3:] / 255
            Image.fromarray((v[..., :3] * al + bg * (1 - al)).astype(np.uint8)).save(os.path.join(dbg, f'out-{k}.png'))
            mm = np.array(Image.fromarray((M[k] * 255).astype(np.uint8)).resize((S[k].shape[1] * 4, S[k].shape[0] * 4), Image.NEAREST)) > 0
            bl = v[..., :3].copy(); bl[mm] = bl[mm][:, ::-1]
            Image.fromarray((bl * al + bg * (1 - al)).astype(np.uint8)).save(os.path.join(dbg, f'blue-{k}.png'))


if __name__ == '__main__':
    main()
