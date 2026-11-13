"""Fotos da revista do Passeio GTS (Passat GTS Pointer, pixel art do Victor). Só marcas fictícias;
tudo o que é apagado é coberto com a cor/textura do entorno (nunca tarja):
- historia: do infográfico ficam só as fotos (os três cofres do motor, os bancos e a faixa da lateral)
  remontadas no papel creme, com as plaquetas verdes dos anos (1983, 1984, 1986) e a linha pontilhada
  com as estrelas; somem os textos; o letreiro bordado dos encostos some (couro continuado) e a faixa
  fica só com "GTS" (o resto do letreiro vira a faixa escura continuada, na inclinação dela);
- anuncio: somem as faixas vermelhas de texto (fundo continuado linha a linha); o quadro das duas fotos
  pequenas desce para caber no corte 16:9 (fica no alto à direita, o título do jogo vai à esquerda) e o
  letreiro da tampa da foto pequena some (lataria prata continuada); o emblema da grade vira o logo da
  Ipê (grade refeita com as lâminas do lado) e a placa fica lisa;
- emblema: o letreiro da tampa vira "PASSEIO 1.8" em cima (o "1.8" é o da arte) e "GTS" embaixo, no
  mesmo estilo (creme com contorno escuro e relevo em cima; vazado com filete creme embaixo), na mesma
  inclinação e perspectiva; a lataria por baixo é continuada. A lanterna fica.
Reduz para 560 x 315 com paleta curta (cores do logo da Ipê garantidas).
Uso: python3 tools/ref/passat_photos.py <pasta com capa-*.png> <src/assets/photos>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402

OUT = {'historia': 'ps-historia', 'anuncio': 'ps-anuncio', 'emblema': 'ps-emblema'}
WIDE = '/usr/share/fonts/opentype/inter/Inter-Black.otf'
RNG = np.random.default_rng(87)


def lum(a):
    return a.astype(int).sum(axis=2) // 3


def sat(a):
    return a.astype(int).max(axis=2) - a.astype(int).min(axis=2)


def rect_mask(a, x0, y0, x1, y1):
    m = np.zeros(a.shape[:2], bool)
    m[y0:y1, x0:x1] = True
    return m


def poly_mask(a, pts):
    m = np.zeros(a.shape[:2], np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m > 0


def ell_mask(a, cx, cy, rx, ry):
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1


def grow(m, n):
    return cv2.dilate(m.astype(np.uint8), np.ones((2 * n + 1, 2 * n + 1), np.uint8)) > 0


def heal(a, mask, r=4):
    """Cobre `mask` continuando o entorno (superfícies lisas com degradê)."""
    a[:] = cv2.inpaint(a, mask.astype(np.uint8), r, cv2.INPAINT_TELEA)


def flat_rows(a, mask, ref):
    """Plaqueta lisa: cada linha de `mask` vira a mediana da cor de fundo (`ref`) da mesma linha."""
    allc = np.median(a[ref], axis=0).astype(np.uint8)
    for y in np.where(mask.any(axis=1))[0]:
        a[y, mask[y]] = np.median(a[y][ref[y]], axis=0).astype(np.uint8) if ref[y].sum() > 3 else allc


def sow(a, mask, src):
    """Cobre `mask` com pixels sorteados de `src` da mesma linha (mantém o pontilhado do fundo)."""
    allp = a[src]
    for y in np.where(mask.any(axis=1))[0]:
        xs = np.where(mask[y])[0]
        pool = a[y][src[y]]
        if len(pool) < 4:
            pool = allp
        a[y, xs] = pool[RNG.integers(0, len(pool), len(xs))]


def ipe(a, cx, cy, d):
    """Logo da Ipê (src/assets/brands.json) com diâmetro d, centrado em (cx, cy)."""
    lg = np.array(Image.fromarray(logo_img('ipe', 48)).resize((d, d), Image.NEAREST))
    y0, x0 = cy - d // 2, cx - d // 2
    sel = lg[..., 3] > 0
    a[y0:y0 + d, x0:x0 + d][sel] = lg[..., :3][sel]


def paper(h, w, src):
    """Papel creme: retalho limpo da página repetido (espelhado a cada volta para não marcar emenda)."""
    ph, pw = src.shape[:2]
    out = np.zeros((h, w) + src.shape[2:], src.dtype)
    for j in range(0, h, ph):
        for i in range(0, w, pw):
            t = src[:, ::-1] if (i // pw) % 2 else src
            t = t[::-1] if (j // ph) % 2 else t
            out[j:j + ph, i:i + pw] = t[:min(ph, h - j), :min(pw, w - i)]
    return out


def put(c, img, x, y, k, shade=True):
    """Cola a foto com fator k (vizinho mais próximo: guarda o pixel) e sombra leve no papel. As fotos
    do infográfico já têm o filete escuro arredondado; os cantos de fora do filete são papel."""
    h, w = img.shape[:2]
    im = np.array(Image.fromarray(img).resize((int(round(w * k)), int(round(h * k))), Image.NEAREST))
    h, w = im.shape[:2]
    if shade:
        sh = c[y + 6:y + h + 6, x + 6:x + w + 6].astype(np.float32)
        c[y + 6:y + h + 6, x + 6:x + w + 6] = (sh * 0.78).astype(np.uint8)
    c[y:y + h, x:x + w] = im


# ---------------------------------------------------------------- historia (infográfico)
def historia(a):
    # bancos: o letreiro bordado dos encostos some (o couro preto em volta continua por cima)
    for x0, y0, x1, y1 in ((832, 706, 906, 740), (1000, 744, 1088, 784)):
        r = rect_mask(a, x0, y0, x1, y1)
        heal(a, grow(r & (lum(a) > 110), 2) & grow(r, 2), 6)
    # faixa: fica o "GTS"; o resto do letreiro vira a faixa escura (com o pontilhado dela), copiada
    # coluna a coluna do trecho limpo à esquerda do "GTS" (ida e volta, sem emenda), acompanhando a
    # inclinação da faixa (filete cinza de cima: y 718 em x 1195, desce 0,111 px por px). Só a faixa
    # das letras (y 745 a 786 em x 1352, mesma inclinação) é trocada: os filetes ficam os da arte.
    src = a.copy()
    for x in range(1352, 1604):
        top = int(round(745 + 0.111 * (x - 1352)))
        bot = int(round(787 + 0.111 * (x - 1352)))
        k = (x - 1352) % 88
        xs = 1198 + (k if k < 44 else 87 - k)
        dy = int(round(0.111 * (x - xs)))
        a[top:bot, x] = src[top - dy:bot - dy, xs]
    # fotos e plaquetas
    eng = [a[320:615, x0:x1].copy() for x0, x1 in ((36, 547), (581, 1095), (1128, 1637))]
    seats = a[655:880, 717:1169].copy()
    strip = a[655:880, 1182:1636].copy()
    head = a[44:136, 100:1572].copy()
    rule = a[629:641, 23:1650].copy()
    # moldura verde com o filete dourado fica; o miolo vira papel creme
    cream = (a[..., 0] > 215) & (a[..., 1] > 170) & (a[..., 2] > 100)
    n, lab, st, _ = cv2.connectedComponentsWithStats(cream.astype(np.uint8), 4)
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    cnts, _ = cv2.findContours((lab == big).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    inner = np.zeros(a.shape[:2], np.uint8)
    cv2.drawContours(inner, [max(cnts, key=cv2.contourArea)], -1, 1, -1)
    inner = inner > 0
    c = a.copy()
    pp = paper(941, 1672, a[640:653, 25:700].copy())
    c[inner] = pp[inner]
    # plaquetas dos anos com a linha pontilhada e as estrelas (sem o pontilhado que descia das estrelas)
    c[44:136, 100:1572] = head
    for sx in (566, 1116):
        c[112:136, sx - 12:sx + 12] = pp[112:136, sx - 12:sx + 12]
    # cofres lado a lado logo abaixo, filete vermelho e as duas fotos maiores embaixo
    for img, x in zip(eng, (36, 581, 1128)):
        put(c, img, x, 150, 1.0)
    c[460:472, 23:1650] = rule
    put(c, seats, 52, 492, 1.72)
    put(c, strip, 852, 492, 1.72)
    return c


# ---------------------------------------------------------------- anuncio (cupê vermelho, fundo azul)
def anuncio(a):
    # foto pequena da traseira: letreiro da tampa na lataria prata
    r = rect_mask(a, 1288, 64, 1462, 94)
    heal(a, grow(r & (lum(a) < 120), 2) & r, 6)
    pics = a[22:248, 930:1518].copy()
    # faixas de texto e o quadro das fotos: fundo escuro continuado linha a linha (pixels sorteados do
    # fundo da mesma linha: mantém o pontilhado leve)
    bg = (lum(a) < 60) & (sat(a) < 60)
    left = rect_mask(a, 0, 0, 16, 300) | rect_mask(a, 922, 0, 930, 300) | rect_mask(a, 1520, 0, 1536, 300)
    hole = rect_mask(a, 14, 40, 926, 234) | rect_mask(a, 926, 18, 1522, 252)
    sow(a, hole, left & bg)
    sm = cv2.GaussianBlur(a, (0, 0), 1.2)
    a[hole] = sm[hole]
    # emblema da grade: lâminas da direita e logo da Ipê
    a[592:668, 432:504] = a[592:668, 512:584]
    ipe(a, 466, 630, 50)
    # placa lisa (a borda escura e o filete claro ficam)
    inner = rect_mask(a, 340, 745, 570, 826)
    flat_rows(a, inner, inner & (lum(a) > 170))
    # corte 16:9 (do teto ao chão com a sombra) e o quadro das fotos menor no alto à direita
    c = a[138:1002].copy()
    put(c, pics, 1536 - 18 - int(588 * 0.6), 14, 0.6)
    return c


# ---------------------------------------------------------------- emblema (traseira, close)
def quad_at(q, t0, t1):
    """Pedaço [t0, t1] (ao longo do comprimento) do quadrilátero q = (TL, TR, BR, BL)."""
    tl, tr, br, bl = (np.array(p, np.float32) for p in q)
    return [tl + (tr - tl) * t0, tl + (tr - tl) * t1, bl + (br - bl) * t1, bl + (br - bl) * t0]


def glyphs(text, q, shape, gap=0.16):
    """Máscara do texto em caixa alta (fonte larga negrita) levada ao quadrilátero q da tampa: a
    perspectiva e a inclinação itálica vêm do próprio quadrilátero, medido no letreiro da arte."""
    f = ImageFont.truetype(WIDE, 200)
    cap = f.getbbox('H')
    h = cap[3] - cap[1]
    ws = [f.getbbox(ch)[2] - f.getbbox(ch)[0] for ch in text]
    g = int(h * gap)
    lay = Image.new('L', (sum(ws) + g * (len(text) - 1), h), 0)
    d = ImageDraw.Draw(lay)
    x = 0
    for ch, w in zip(text, ws):
        d.text((x - f.getbbox(ch)[0], -cap[1]), ch, font=f, fill=255)
        x += w + g
    lay = np.array(lay)
    H, W = lay.shape
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [W, 0], [W, H], [0, H]]), np.float32(q))
    return cv2.warpPerspective(lay, M, (shape[1], shape[0]), flags=cv2.INTER_LINEAR) > 110


def shift(m, dx, dy):
    return np.roll(np.roll(m, dy, axis=0), dx, axis=1)


def emblema(a):
    L = lum(a)
    q = a.astype(int)
    # tira de borracha da tampa (cinza escuro): começa em y 740 - 0,373 x; nada abaixo dela é mexido
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    above = yy < 734 - 0.373 * xx
    # "1.8" da arte fica: miolos creme do 1, do ponto e do 8 (os componentes dentro do contorno dele)
    # e o contorno escuro em volta, sem o filete creme do R que encosta embaixo
    cream = (q[..., 1] > 0.6 * q[..., 0]) & (L > 140)
    p18 = poly_mask(a, [(862, 200), (866, 170), (950, 150), (1000, 105), (1050, 95), (1080, 100), (1086, 140),
                        (1082, 200), (1068, 224), (1000, 238), (965, 245), (900, 278), (878, 280), (868, 262)])
    n, lab, st, cen = cv2.connectedComponentsWithStats(cream.astype(np.uint8), 8)
    fill18 = np.zeros(a.shape[:2], bool)
    for i in range(1, n):
        cx, cy = cen[i]
        if st[i, cv2.CC_STAT_AREA] > 30 and p18[int(cy), int(cx)]:
            fill18 |= lab == i
    keep = grow(fill18, 9) & ~(cream & ~fill18)
    # letreiro antigo: tudo o que não é a lataria vermelha (creme, contorno, relevo, sombra) na faixa
    # inclinada das duas palavras, com os miolos vermelhos do "POINTER" (buracos fechados)
    v = yy + 0.31 * (xx - 300)
    band = (v > 375) & (v < 600) & (xx > 280) & (xx < 1125) & above
    body = (q[..., 0] > 90) & (q[..., 1] < 0.58 * q[..., 0]) & (q[..., 2] < 0.58 * q[..., 0])
    ink = band & ~body & ~keep
    ink = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((13, 13), np.uint8))
    cnts, _ = cv2.findContours(ink, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    hole = np.zeros(a.shape[:2], np.uint8)
    cv2.drawContours(hole, cnts, -1, 1, -1)
    hole = grow(hole > 0, 4) & ~keep & above
    # lataria continuada: o degradê vem do entorno (inpaint) e o xadrez do pontilhado vem de um retalho
    # limpo da tampa (só o detalhe fino dele, somado por cima)
    heal(a, hole, 9)
    patch = a[500:615, 20:290].astype(np.float32)
    tex = paper(a.shape[0], a.shape[1], patch - cv2.GaussianBlur(patch, (0, 0), 5))
    f = a.astype(np.float32)
    f[hole] += tex[hole]
    a[:] = np.clip(f, 0, 255).astype(np.uint8)
    # "PASSEIO" no lugar do nome antigo: creme pontilhado, chanfro lilás embaixo à esquerda, contorno
    # escuro grosso e sombra na lataria (quadrilátero do letreiro da arte: cantos do P e do T)
    top = glyphs('PASSEIO', [(328, 402), (846, 222), (824, 309), (300, 488)], a.shape)
    dark = grow(top, 6)
    shadow = shift(dark, 5, 6) & ~dark & above & ~keep
    a[shadow] = (a[shadow].astype(np.float32) * 0.55).astype(np.uint8)
    a[dark] = (22, 20, 30)
    bevel = grow(top, 2) & ~shift(top, 3, -3)
    a[bevel & dark] = (126, 118, 140)
    cr = top
    chk = ((xx // 4 + yy // 4) % 2 == 0)
    a[cr] = np.where(chk[cr][:, None], (236, 214, 172), (246, 228, 190))
    lower = top & ~shift(top, 0, -4)
    a[lower] = (206, 178, 132)
    # "GTS" embaixo como o "POINTER": letra vazada no vermelho da lataria, filete creme e contorno fino
    # escuro, na ponta direita da linha de baixo (embaixo do "1.8", onde ficava o fim do letreiro)
    pq = [(603, 390), (1104, 230), (1088, 314), (585, 472)]  # (a linha do "POINTER", 16 px abaixo: folga do 1.8)
    low = glyphs('GTS', quad_at(pq, 0.56, 0.97), a.shape, gap=0.24)
    core = low & ~grow(~low, 1)
    a[grow(low, 6) & ~keep] = (30, 12, 14)
    a[grow(low, 4) & ~keep] = (238, 210, 160)
    a[core] = (176, 26, 24)
    a[core & ~shift(core, 0, -3)] = (128, 16, 18)
    # corte 16:9 de cima (o letreiro fica no meio da altura, longe do título da capa) com a lanterna
    return a[0:864].copy()


def main():
    src, out = sys.argv[1], sys.argv[2]
    fn = {'historia': historia, 'anuncio': anuncio, 'emblema': emblema}
    cols = sorted({tuple(int(v) for v in c[:3]) for c in logo_img('ipe', 48).reshape(-1, 4) if c[3] > 0})
    for k, name in OUT.items():
        p = os.path.join(src, f'capa-{k}.png')
        if not os.path.exists(p):
            continue
        a = np.ascontiguousarray(np.array(Image.open(p).convert('RGB')))
        a = fn[k](a)
        im = Image.fromarray(a)
        if os.environ.get('DBG'):
            im.save(os.path.join(os.environ['DBG'], f'full-{k}.png'))
        im = im.resize((560, 315), Image.LANCZOS)
        n = 156
        q = im.quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        extra = cols if k == 'anuncio' else []
        pal = Image.new('P', (1, 1))
        pal.putpalette((q.getpalette()[:n * 3] + [v for c in extra for v in c] + [0] * 768)[:768])
        im = im.quantize(palette=pal, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name, os.path.getsize(os.path.join(out, f'{name}.png')))


if __name__ == '__main__':
    main()
