"""Sprites do Toro LP5 (Countach 5000 QV, pixel art nova do Victor, 1672 x 941 com cenário: árvores,
muro de pedra, céu e asfalto). Segue monza_sprites.py: o carro sai por inundação do fundo a partir das
bordas (o contorno preto segura), a sombra e o asfalto de baixo saem por geometria (linha de baixo da
carroceria e os pneus) e o cenário visto pelos vãos da asa fica transparente (sementes extras da
inundação); o que se vê pelos vidros vira cor de vidro.
- lateral vermelha, já com a frente para a esquerda;
- traseira AMARELA na arte: a lataria passa para o vermelho de fábrica pelo brilho (alisado antes, sem o
  grão da arte, e convertido com a conta da repintura do jogo, chapado em poucos tons: faixas lisas como
  na frente); "lamborghini" + touro e "countach 5000QV" da tampa somem (lataria continuada), o emblema
  da Toro fica no meio da tampa e a placa vira placa lisa (o jogo põe a dele, PLATE_BOX);
- frente com os faróis escamoteáveis fechados; o brasão do capô vira lataria;
- frente com os faróis levantados (front-up.png): alinhada à fechada (ECC afim), reduzida na MESMA grade
  e só as caixas dos faróis (e os faróis de milha acesos do para-choque) entram no sprite da frente, como
  em testarossa_popup.py: a troca de sprite no jogo não mexe no resto do carro.
Vira pixel art nítida (shrink de monza_sprites.py: lateral 400, frente e traseira 260). O emblema da
Toro entra na frente e na traseira com o stamp de brand_badges.py (SPOTS['countach']).
Máscara de pintura: o vermelho da lataria e os reflexos claros dele; fora lanternas, piscas, faróis,
borrachas, vidros, grades e o interior visto pelo para-brisa.
Uso: python3 tools/ref/countach_sprites.py <pasta com side/rear/front/front-up.png> <src/assets/cars>
     (DBG=<pasta> grava o recorte, o sprite ampliado e a pintura trocada para conferir)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from monza_sprites import shrink, rowfill  # noqa: E402
from glass_fix import fix_glass  # noqa: E402

WIDTH = {'side': 400, 'rear': 260, 'front': 260}
# lateral: centros dos pneus, raio do pneu e a linha de baixo da carroceria (soleira)
SW, SR, SBOT, STOP = ((439, 668), (1302, 668)), 117, 734, 357
# traseira: a parte de baixo (escapes, suspensão) vai até RBOT; os pneus (colunas) até o chão
RBOT, RTIRE, RGND = 772, ((236, 502), (1172, 1436)), 828
# frente: para-choque até FBOT; a ponta dos pneus aparece nos cantos
FBOT, FTIRE, FGND = 808, ((280, 345), (1330, 1395)), 842
# vão entre a asa e a carroceria (faixa de linhas e colunas): o céu, os morros e a grama vistos por
# ele viram fundo (os morros escuros não passariam pela inundação)
# placa da traseira (moldura inclusa no retângulo: x0, y0, x1, y1 do miolo)
PLATE = (740, 553, 932, 631)
# caixas dos faróis escamoteáveis e dos faróis de milha (para o alinhamento ignorar)
UP_BOXES = [(330, 420, 590, 560), (1090, 420, 1350, 560), (560, 700, 1110, 800)]
# vidro traseiro (visto por cima da tampa do motor)
RWIN = (590, 240, 1082, 300)
# lanternas da traseira (fora da conversão de cor e da máscara)
REAR_LAMPS = [(282, 404, 566, 530), (1104, 404, 1390, 530)]
# lentes âmbar (piscas) da traseira
AMBER = [(303, 432, 378, 488), (1294, 432, 1369, 488)]
# emblema da Toro: no capô (no lugar do brasão) e no meio da tampa traseira (entre as lanternas, acima da placa)
BADGE = {'front': (834, 611), 'rear': (836, 462)}
GAP = {'rear': (200, 236, 280, 1392), 'front': (196, 248, 400, 1270)}


def segment(a, k):
    rgb = a.astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb.mean(axis=2)
    # contorno/peças escuras do carro: quase preto e sem o azulado da sombra do chão
    dark = (lum < 62) & ~((b > r + 18) & (b > 38))
    if k == 'rear':  # amarela
        paint = (r > 120) & (g > 60) & (b < 0.6 * g) & (r > b * 2)
    else:
        paint = (r > 110) & (r > g * 1.9) & (r > b * 1.9)
    can = ~dark & ~paint  # por onde o fundo pode passar
    can[:3], can[-3:], can[:, :3], can[:, -3:] = True, True, True, True
    n, lab = cv2.connectedComponents(can.astype(np.uint8), connectivity=4)
    bg = lab == lab[0, 0]
    if k in GAP:
        y0, y1, x0, x1 = GAP[k]
        green = (g > r + 12) & (g > b + 6)
        scen = (((b > r + 10) & (b > 25)) | green) & ~paint
        n, lab = cv2.connectedComponents(scen.astype(np.uint8), connectivity=4)
        ids = np.unique(lab[y0:y1, x0:x1][scen[y0:y1, x0:x1]])
        bg |= np.isin(lab, ids[ids > 0])
    if k == 'side':  # restos da árvore encostados na asa (casca marrom e folhas)
        H, W = lum.shape
        yy, xx = np.mgrid[0:H, 0:W]
        green = (g > r + 8) & (g > b + 4)  # (o carro não tem verde: grama e folhas na borda saem)
        bg |= ((xx > 1380) & (xx < 1540) & (yy < 368) & ~paint) | green
    car = ~bg
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car, 8)
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    core = (lab == big).astype(np.uint8)
    car = (cv2.dilate(core, np.ones((11, 11), np.uint8)) > 0) & ~bg
    n, lab, st, _ = cv2.connectedComponentsWithStats(car.astype(np.uint8), 8)
    return lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))), bg


def ground(car, bg, a, k):
    """tira a sombra e o asfalto embaixo do carro; o cenário visto pelos vidros vira cor de vidro"""
    H, W = car.shape
    yy, xx = np.mgrid[0:H, 0:W]
    if k == 'side':
        wheels = np.zeros_like(car)
        for cx, cy in SW:
            wheels |= np.hypot(xx - cx, yy - cy) <= SR
        car &= ((yy <= SBOT) | wheels) & (yy >= STOP)  # acima da asa: só a árvore
    elif k == 'rear':
        tire = np.zeros_like(car)
        for x0, x1 in RTIRE:
            tire |= (xx >= x0) & (xx < x1)
        car &= (yy <= RBOT) | (tire & (yy <= RGND))
    else:
        tire = np.zeros_like(car)
        for x0, x1 in FTIRE:
            tire |= (xx >= x0) & (xx < x1)
        car &= (yy <= FBOT) | (tire & (yy <= FGND))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car.astype(np.uint8), 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    n, lab = cv2.connectedComponents((~car).astype(np.uint8), connectivity=4)
    hole = ~car & (lab != lab[0, 0]) & ~bg
    glassify(a, car | hole)
    return car | hole


def glassify(a, sel):
    """o verde de dentro (paisagem vista pelos vidros, metade de cima) vira cor de vidro"""
    rgb = a.astype(int)
    green = (rgb[..., 1] > rgb[..., 0] + 12) & (rgb[..., 1] > rgb[..., 2] + 6)
    lum = rgb.mean(axis=2)
    g2 = sel & green
    g2[int(a.shape[0] * 0.45):] = False
    a[g2] = np.clip(np.dstack([lum * 0.3, lum * 0.62, lum * 1.15 + 30]), 0, 255).astype(np.uint8)[g2]


def debrand(a, k):
    if k == 'rear':
        # vidro traseiro: o céu e os morros vistos por ele viram vidro escuro
        x0, y0, x1, y1 = RWIN
        sub = a[y0:y1, x0:x1].astype(int)
        r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]
        scen = ((b > r + 10) & (b > 25)) | ((g > r + 12) & (g > b + 6))
        lum = sub.mean(axis=2)
        t = np.linspace(0, 1, y1 - y0)[:, None]
        glass = np.dstack([18 + lum * 0.22 - t * 6, 26 + lum * 0.26 - t * 6, 36 + lum * 0.32 - t * 8])
        sub[scen] = np.clip(glass, 0, 255)[scen]
        a[y0:y1, x0:x1] = sub.astype(np.uint8)
        rowfill(a, 592, 414, 728, 498)  # "lamborghini" e o touro
        rowfill(a, 934, 426, 1100, 502)  # "countach 5000QV"
        # placa lisa (o jogo põe a dele por cima): miolo claro sem letras nem parafusos
        x0, y0, x1, y1 = PLATE
        a[y0:y1, x0:x1] = np.median(a[y0 + 20:y1 - 6, x0 + 10:x1 - 10].reshape(-1, 3), axis=0).astype(np.uint8)
    elif k in ('front', 'front-up'):
        rowfill(a, 810, 588, 857, 634)  # brasão do capô


def align(ref, mov, skip):
    """alinha a arte dos faróis levantados à dos fechados (ECC afim, sem as áreas que mudam)"""
    k = 4
    A = cv2.GaussianBlur(cv2.resize(cv2.cvtColor(ref, cv2.COLOR_RGB2GRAY), None, fx=1 / k, fy=1 / k, interpolation=cv2.INTER_AREA).astype(np.float32) / 255, (0, 0), 1.2)
    mv = np.zeros_like(ref)
    mv[:mov.shape[0], :mov.shape[1]] = mov[:ref.shape[0], :ref.shape[1]]
    B = cv2.GaussianBlur(cv2.resize(cv2.cvtColor(mv, cv2.COLOR_RGB2GRAY), None, fx=1 / k, fy=1 / k, interpolation=cv2.INTER_AREA).astype(np.float32) / 255, (0, 0), 1.2)
    msk = np.ones_like(A, np.uint8)
    for x0, y0, x1, y1 in skip:
        msk[y0 // k:y1 // k, x0 // k:x1 // k] = 0
    Wm = np.eye(2, 3, dtype=np.float32)
    _, Wm = cv2.findTransformECC(A, B, Wm, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-6), msk, 5)
    Wm[:, 2] *= k
    print('alinhamento faróis levantados', np.round(Wm, 4).tolist())
    return cv2.warpAffine(mv, Wm, (ref.shape[1], ref.shape[0]), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)


def hue_sat_val(s):
    hsv = cv2.cvtColor(np.ascontiguousarray(s[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(int)
    return hsv[..., 0] * 360 / 256, hsv[..., 1], hsv[..., 2]


def grow(m, s, hue_ok, rounds=4):
    """reflexos claros e bordas escuras da lataria encostados na pintura entram na máscara"""
    hue, sat, val = hue_sat_val(s)
    al = s[..., 3] > 0
    for _ in range(rounds):
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m = m | (al & near & hue_ok & (((val > 150) & (sat > 15)) | ((val > 35) & (sat > 90))))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    return np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 4])


def red_paint(s):
    hue, sat, val = hue_sat_val(s)
    al = s[..., 3] > 0
    core = al & ((hue < 12) | (hue > 340)) & (sat > 120) & (val > 60)
    return grow(core, s, (hue < 22) | (hue > 330))


def yellow_paint(s):
    hue, sat, val = hue_sat_val(s)
    al = s[..., 3] > 0
    core = al & (hue > 30) & (hue < 62) & (sat > 110) & (val > 70)
    return grow(core, s, (hue > 18) & (hue < 70))


def smooth_lum(a):
    """brilho da lataria amarela sem o grão da arte (a textura virava manchas de camuflagem no vermelho):
    filtro bilateral só dentro da pintura (o que é de fora fica longe na escala e não entra na média),
    que alisa o grão e guarda os vincos, os contornos e os reflexos fortes; depois mediana larga"""
    hue, sat, val = hue_sat_val(np.dstack([a, np.full(a.shape[:2], 255, np.uint8)]))
    yel = (hue > 25) & (hue < 66) & (sat > 90) & (val > 50)
    lum = a.astype(np.float32).mean(axis=2)
    x = np.where(yel, lum, -1000).astype(np.float32)
    for _ in range(2):
        x = cv2.bilateralFilter(x, 15, 22, 7)
        x = np.where(yel, x, -1000).astype(np.float32)
    med = cv2.medianBlur(np.clip(x, 0, 255).astype(np.uint8), 7)
    out = np.where(yel, med, lum)
    return np.dstack([np.clip(out, 0, 255)] * 3).astype(np.uint8)


def to_red(s, m, ref, L, tones=12):
    """lataria amarela -> vermelho de fábrica pelo brilho alisado L, com a mesma conta da repintura do jogo
    (paintImage em svgsprites.ts): o tom médio vira o vermelho médio da frente, o mais escuro escurece na
    mesma proporção e o mais claro sobe para o branco. (A conversão por posição na escala de tons esticava
    as pequenas diferenças do meio e virava manchas.) Depois, poucos tons chapados: faixas suaves."""
    import colorsys
    l = L[..., 0][m].astype(float) / 255
    base = np.median(l)
    rl = np.array([colorsys.rgb_to_hls(*(c / 255)) for c in ref.astype(float)])
    th, tl, ts = np.median(rl[:, 0]), np.median(rl[:, 1]), np.median(rl[:, 2])
    nl = np.where(l < base, tl * (np.maximum(l, 1e-3) / base) ** 0.8, tl + (l - base) * (1 - tl) / (1 - base))
    nl = np.clip(nl, 0.04, 0.96)
    col = np.array([colorsys.hls_to_rgb(th, v, ts) for v in nl]) * 255
    lab = cv2.cvtColor(np.clip(col, 0, 255).astype(np.uint8)[None], cv2.COLOR_RGB2LAB)[0].astype(np.float32)
    cv2.setRNGSeed(7)
    _, lbl, cen = cv2.kmeans(lab, tones, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.2), 3, cv2.KMEANS_PP_CENTERS)
    q = np.clip(cen[lbl.ravel()], 0, 255).astype(np.uint8)
    s[..., :3][m] = cv2.cvtColor(q[None], cv2.COLOR_LAB2RGB)[0]
    print('traseira: vermelho HLS', round(th, 3), round(tl, 3), round(ts, 3), 'brilho médio', round(base, 3))


def save_dbg(dbg, name, s, m):
    z = 3
    v = np.array(Image.fromarray(s).resize((s.shape[1] * z, s.shape[0] * z), Image.NEAREST))
    bg = np.zeros_like(v[..., :3]); bg[:] = (0, 160, 0)
    al = v[..., 3:] / 255
    Image.fromarray((v[..., :3] * al + bg * (1 - al)).astype(np.uint8)).save(os.path.join(dbg, f'out-{name}.png'))
    mm = np.array(Image.fromarray((m * 255).astype(np.uint8)).resize((s.shape[1] * z, s.shape[0] * z), Image.NEAREST)) > 0
    bl = v[..., :3].copy(); bl[mm] = bl[mm][:, ::-1]  # repinta de azul para conferir
    Image.fromarray((bl * al + bg * (1 - al)).astype(np.uint8)).save(os.path.join(dbg, f'blue-{name}.png'))


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    raw = {k: np.array(Image.open(os.path.join(src, f'{k}.png')).convert('RGB')) for k in ('side', 'rear', 'front', 'front-up')}
    S, M, G = {}, {}, {}
    for k in ('side', 'rear', 'front'):
        a = raw[k].copy()
        car = ground(*segment(a, k), a, k)
        debrand(a, k)
        if dbg:
            v = a.copy()
            v[~car] = (0, 200, 0)
            Image.fromarray(v).save(os.path.join(dbg, f'cut-{k}.png'))
        s, G[k] = shrink(a, car, WIDTH[k])
        if k == 'rear':  # brilho alisado na mesma grade (para a conversão de cor)
            LS, _ = shrink(smooth_lum(a), car, WIDTH[k], colors=0)
        if k == 'front':
            # faróis levantados: mesma grade e mesmo recorte da frente fechada
            up = align(raw['front'], raw['front-up'], UP_BOXES)
            debrand(up, 'front-up')
            glassify(up, car)
            S['front-up'], _ = shrink(up, car, WIDTH[k])
        S[k] = s
    sp = lambda k, x, y: (int(round((x - G[k][0]) / G[k][2])), int(round((y - G[k][1]) / G[k][2])))  # noqa: E731
    M['side'] = red_paint(S['side'])
    M['front'] = red_paint(S['front'])
    # traseira amarela -> vermelha (fora as lanternas)
    r = S['rear']
    ym = yellow_paint(r)
    for x0, y0, x1, y1 in REAR_LAMPS:
        (a0, b0), (a1, b1) = sp('rear', x0, y0), sp('rear', x1, y1)
        hue, sat, val = hue_sat_val(r)  # na caixa só fica o amarelo de verdade (a lente âmbar sai)
        ym[b0:b1, a0:a1] &= ((hue > 31) & (hue < 62) & (sat > 100))[b0:b1, a0:a1]
        # brilhos da lente soltos dentro da lanterna: só fica o que encosta na lataria de fora da caixa
        n, lab = cv2.connectedComponents(ym.astype(np.uint8), connectivity=4)
        out_ids = np.unique(np.concatenate([lab[:b0].ravel(), lab[b1:].ravel(), lab[:, :a0].ravel(), lab[:, a1:].ravel()]))
        inner = np.zeros_like(ym)
        inner[b0:b1, a0:a1] = True
        ym &= ~inner | np.isin(lab, out_ids[out_ids > 0])
    to_red(r, ym, S['front'][..., :3][M['front']], LS)
    # pontinhos amarelos que sobraram na borda (fora das lentes âmbar): a cor vermelha vizinha
    hue, sat, val = hue_sat_val(r)
    stray = (r[..., 3] > 0) & ~ym & (hue > 30) & (hue < 70) & (sat > 80) & (val > 60)
    for x0, y0, x1, y1 in AMBER:
        (a0, b0), (a1, b1) = sp('rear', x0, y0), sp('rear', x1, y1)
        stray[b0 - 1:b1 + 1, a0 - 1:a1 + 1] = False
    for y, x in zip(*np.nonzero(stray)):
        nb = ym[max(0, y - 2):y + 3, max(0, x - 2):x + 3]
        if nb.any():
            r[y, x, :3] = np.median(r[max(0, y - 2):y + 3, max(0, x - 2):x + 3, :3][nb], axis=0)
            ym[y, x] = True
    M['rear'] = ym
    # frente com os faróis levantados: só as caixas dos faróis (e os de milha) vêm da outra arte
    f, u = S['front'], S['front-up']
    box = np.zeros(f.shape[:2], bool)
    for x0, y0, x1, y1 in UP_BOXES:
        (a0, b0), (a1, b1) = sp('front', x0, y0), sp('front', x1, y1)
        box[b0:b1, a0:a1] = True
    diff = (np.abs(f[..., :3].astype(int) - u[..., :3].astype(int)).sum(axis=2) > 60) & box
    diff = cv2.morphologyEx(diff.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)).astype(bool)
    n, lab = cv2.connectedComponents((~diff).astype(np.uint8), connectivity=4)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    diff |= ~np.isin(lab, list(edge)) & box
    diff = (cv2.dilate(diff.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & box & (f[..., 3] > 0)
    fu = f.copy()
    fu[diff, :3] = u[diff, :3]
    S['front-up'] = fu
    M['front-up'] = M['front'].copy()
    M['front-up'][diff] = red_paint(fu)[diff]
    # emblema da Toro (brand_badges.py) no capô e na tampa traseira
    from brand_badges import stamp  # noqa: E402
    for k, (x, y), size in (('front', BADGE['front'], 9), ('front-up', BADGE['front'], 9), ('rear', BADGE['rear'], 11)):
        kk = 'front' if k == 'front-up' else k
        cx, cy = sp(kk, x, y)
        stamp(S[k], M[k], 'toro', (cx, cy, size, 0))  # a máscara fica sem a logo (a troca de cor não a tinge)
        print(k, 'emblema em', cx, cy)
    for k in ('side', 'rear', 'front', 'front-up'):
        s, m = S[k], M[k]
        fix_glass(s, m, 'front' if k == 'front-up' else k)
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'countach-{k}.png'), optimize=True)
        Image.fromarray((m * 255).astype(np.uint8), 'L').convert('RGBA').save(os.path.join(out, f'countach-{k}-mask.png'), optimize=True)
        g = G['front' if k == 'front-up' else k]
        print(k, s.shape[1], s.shape[0], 'origem', g[0], g[1], 'fator', round(g[2], 3), 'máscara', int(m.sum()))
        if dbg:
            save_dbg(dbg, k, s, m)


if __name__ == '__main__':
    main()
