"""Mostradores grandes do Serpe V10 a partir da arte do Victor (cab-nowheel.png), na resolução
da arte (o jogo desenha esta imagem por cima do painel, com mais detalhe que um pixel do jogo):
- fica tudo da arte: fundo creme, marcações, faixa amarela e vermelha, "MPH" e "RPM x1000"
- saem o ponteiro e o miolo pintados (o jogo desenha os dele, girando)
- os números da arte tinham repetições (60 duas vezes, 180 três vezes, "6 6 8 8"): cada número
  é apagado e reescrito no mesmo lugar, em fonte grotesca negrita, preta, do mesmo tamanho:
  velocímetro 20..200 mph (de 20 em 20, 29° entre eles) e conta-giros 0..8
Uso: python3 tools/ref/viper_gauges.py <cab-nowheel.png> <src/assets/cockpit>
"""
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf'
# centro (miolo), raio do fundo, raio dos números, ângulo do primeiro número, passo, valores,
# meia caixa apagada em volta de cada número, corpo da fonte
DIALS = {
    'speed': dict(c=(462, 395), r=86, rl=55, ro=62, a0=149, step=29, vals=list(range(20, 201, 20)), box=(28, 14), size=21, keep=(436, 437, 489, 457)),
    'tach': dict(c=(747, 395), r=84, rl=56, ro=63, a0=132, step=28.25, vals=list(range(0, 9)), box=(16, 14), size=22, keep=(726, 428, 802, 463)),
}


def main():
    src, out = sys.argv[1], sys.argv[2]
    art = np.array(Image.open(src).convert('RGB'))
    H, W = art.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    font = ImageFont.truetype(FONT, 22)
    for name, d in DIALS.items():
        cx, cy = d['c']
        r = d['r']
        a = art.copy()
        dd = np.hypot(xx - cx, yy - cy)
        rgb = a.astype(int)
        face = np.median(a[(dd < r) & (dd > r * 0.55) & (rgb.min(axis=2) > 175)], axis=0)
        # ponteiro vermelho e miolo preto (com o rabicho) viram fundo
        redn = (rgb[..., 0] > 140) & (rgb[..., 0] > rgb[..., 1] * 1.6) & (dd < r)
        redn &= ~((dd > r * 0.82) & (rgb[..., 1] > 60))  # a faixa amarela/vermelha da borda fica
        hub = (dd < r * 0.24) & (rgb.max(axis=2) < 150)
        k = np.ones((7, 7), np.uint8)
        near = cv2.dilate((redn | hub).astype(np.uint8), k) > 0
        # contorno escuro do ponteiro e do miolo (tudo o que não é creme em volta deles)
        clear = (redn | hub | (near & (np.abs(rgb - face).sum(axis=2) > 18))) & (dd < r * 0.84)
        # ponta do ponteiro até a borda (fora da faixa colorida, que fica entre 12 e 3 horas)
        ang = np.degrees(np.arctan2(yy - cy, xx - cx)) % 360
        tip = (rgb[..., 0] > 140) & (rgb[..., 1] < 80) & (dd < r * 0.97) & ~((ang > 255) & (ang < 365))
        clear |= cv2.dilate(tip.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (dd < r * 0.97)
        # números antigos: todo o escuro na faixa dos números (entre o miolo e as marcações),
        # menos os textos que ficam (MPH, RPM x1000)
        kx0, ky0, kx1, ky1 = d['keep']
        band = (dd > r * 0.36) & (dd < r * 0.8) & ~((xx >= kx0) & (xx <= kx1) & (yy >= ky0) & (yy <= ky1))
        clear |= band & (rgb.min(axis=2) < 205)
        # pedaços dos números antigos que encostam nas marcações (entre 0,8r e 0,93r): cada mancha
        # escura que não chega na borda das marcações (> 0,9r) sai; as marcações ficam
        dark = ((rgb.min(axis=2) < 200) & (dd > r * 0.36) & (dd < r * 0.99)).astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(dark, 8)
        outer = np.zeros(n, bool)
        outer[np.unique(lab[(dd > r * 0.9) & (dark > 0)])] = True
        keepbox = (xx >= kx0) & (xx <= kx1) & (yy >= ky0) & (yy <= ky1)
        clear |= (lab > 0) & ~outer[lab] & ~keepbox & (dd < r * 0.93)
        # ponta vermelha antiga fora da faixa colorida (também a sombreada) e pontinhos soltos
        redish = (rgb[..., 0] > rgb[..., 1] * 1.3) & (rgb[..., 0] > 110) & ~((ang > 255) & (ang < 365)) & (dd < r + 3)
        nearred = cv2.dilate(redish.astype(np.uint8), np.ones((11, 11), np.uint8)).astype(bool)
        shadow = nearred & (rgb.min(axis=2) > 60) & (rgb.min(axis=2) < 190) & (dd > r * 0.85)  # sombra cinza da ponta
        tipclear = (cv2.dilate(redish.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) | shadow) & (dd < r + 3)
        small = (st[:, cv2.CC_STAT_AREA] < 16)
        clear |= (lab > 0) & small[lab] & (dd < r * 0.86) & ~keepbox
        # o resto do borrão claro do ponteiro antigo (diferente do creme em volta)
        clear = cv2.dilate(clear.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (dd < r * 0.93) & ~(keepbox & ~clear)
        clear |= tipclear
        # o antigo terceiro "180" fica mais embaixo, entre o 180 e o "MPH"
        # (apaga só o que for escuro e fique fora das marcações)
        # preenchimento com o creme em volta (convolução normalizada): o sombreado do fundo continua
        w = ((~clear) & (rgb.min(axis=2) > 175) & (dd < r)).astype(np.float32)
        num = cv2.GaussianBlur(art.astype(np.float32) * w[..., None], (0, 0), 6)
        den = cv2.GaussianBlur(w, (0, 0), 6)[..., None]
        val = np.clip(num / np.maximum(den, 1e-3), 0, 255).astype(np.uint8)
        m = clear & (dd < r + 3)
        a[m] = val[m]
        # sombra suave na borda de baixo do fundo (como a arte)
        im = Image.fromarray(a)
        dr = ImageDraw.Draw(im)
        f = ImageFont.truetype(FONT, d['size'])
        for i, v in enumerate(d['vals']):
            ang = math.radians(d['a0'] + i * d['step'])
            lx, ly = cx + math.cos(ang) * d['rl'], cy + math.sin(ang) * d['rl']
            t = str(v)
            x0, y0, x1, y1 = dr.textbbox((0, 0), t, font=f)
            tw, th = x1 - x0, y1 - y0
            # condensa os de três dígitos (como na arte) desenhando numa camada à parte
            lay = Image.new('L', (tw + 4, th + 4), 0)
            ImageDraw.Draw(lay).text((2 - x0, 2 - y0), t, font=f, fill=255)
            if len(t) == 3:
                lay = lay.resize((int(lay.width * 0.82), lay.height), Image.LANCZOS)
            px, py = int(round(lx - lay.width / 2)), int(round(ly - lay.height / 2))
            im.paste((22, 22, 26), (px, py), lay)
            txt = Image.new('L', im.size, 0); txt.paste(255, (px, py), lay)
            textmask = np.maximum(textmask, np.array(txt)) if i else np.array(txt)
        a = np.array(im)
        # pontinhos escuros que sobraram dos números antigos (soltos, longe dos números novos)
        tm = cv2.dilate((textmask > 0).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
        dk = (a.astype(int).min(axis=2) < 190) & (dd > r * 0.36) & (dd < r * 0.99) & ~tm & ~keepbox
        n2, lab2, st2, _ = cv2.connectedComponentsWithStats(dk.astype(np.uint8), 8)
        sm = st2[:, cv2.CC_STAT_AREA] < 25
        sm[np.unique(lab2[(dd > r * 0.86) & dk])] = False  # as marcações (chegam na borda) ficam
        sm[0] = False
        dots = cv2.dilate(sm[lab2].astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        a[dots] = val[dots]
        # recorte: só o fundo redondo (o aro fica no painel)
        R = r + 4
        x0, y0 = cx - R, cy - R
        crop = a[y0:y0 + 2 * R + 1, x0:x0 + 2 * R + 1]
        gy, gx = np.mgrid[0:crop.shape[0], 0:crop.shape[1]]
        al = (np.hypot(gx - R, gy - R) <= r + 3).astype(np.uint8) * 255
        Image.fromarray(np.dstack([crop, al]), 'RGBA').save(os.path.join(out, f'viper-{name}face.png'), optimize=True)
        print(name, 'canto', (x0, y0), 'lado', 2 * R + 1)


def aux(art, out):
    # os quatro pequenos: a arte em alta resolução, sem os ponteiros pintados
    import cv2
    rgb = art.astype(int)
    H, W = art.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    red = (rgb[..., 0] > 120) & (rgb[..., 0] > rgb[..., 1] * 1.6) & (rgb[..., 0] > rgb[..., 2] * 1.6)
    centers = [(1036, 293), (1144, 293), (1253, 293), (1362, 293)]
    m = np.zeros((H, W), np.uint8)
    for cx, cy in centers:
        dd = np.hypot(xx - cx, yy - cy)
        m |= (red & (dd < 40)).astype(np.uint8)
        hub = (dd < 40) & (np.hypot(xx - cx, yy - (cy + 17)) < 12) & (rgb.max(axis=2) < 90)
        m |= hub.astype(np.uint8)
    clean = art.copy()
    for cx, cy in centers:
        dd = np.hypot(xx - cx, yy - cy)
        face = np.median(art[(dd < 36) & (rgb.min(axis=2) > 185)], axis=0)
        redc = red & (dd < 40)
        # corpo do ponteiro (perto do miolo): sai também o contorno escuro em volta dele
        body = redc & (dd < 27)
        r0 = cv2.dilate(body.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
        near = r0 & (np.abs(rgb - face).sum(axis=2) > 25) & (dd < 30) & (xx < cx + 8)  # à direita do miolo só há textos (PSI, °F)
        # ponta (perto do aro): só o vermelho dela, sem encostar nos números (o "0" do 80)
        redl = (rgb[..., 0] > 100) & (rgb[..., 0] > rgb[..., 1] * 1.35) & (rgb[..., 0] > rgb[..., 2] * 1.35)
        tip = cv2.dilate((redl & (dd >= 27) & (dd < 38)).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        tip &= (np.abs(rgb - face).sum(axis=2) > 20) | redl
        # miolo pintado: a mancha escura perto do centro de baixo (cada mostrador tem o seu lugar),
        # mais a sombra dele (só da metade de baixo, para não pegar o "PSI" e o "°F")
        dark = ((rgb.max(axis=2) < 110) & (dd < 30)).astype(np.uint8)
        n, lab = cv2.connectedComponents(dark, connectivity=8)
        sub = lab[cy + 8:cy + 22, cx - 6:cx + 6]
        ids, cnt = np.unique(sub[sub > 0], return_counts=True)
        blob = lab == ids[np.argmax(cnt)] if len(ids) else np.zeros_like(dd, bool)
        by = np.nonzero(blob)[0].mean() if blob.any() else cy + 15
        ring = cv2.dilate(blob.astype(np.uint8), np.ones((11, 11), np.uint8)).astype(bool)
        hubm = cv2.dilate(blob.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        hubm |= ring & (np.abs(rgb - face).sum(axis=2) > 18) & (yy >= by - 1) & ~((xx > cx + 7) & (yy < by + 3))
        fix = near | hubm | (redc & (dd < 30))
        fix = (cv2.dilate(fix.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) | tip) & (dd < 38)
        # fundo: creme em volta (inclusive o sombreado mais escuro, não só o mais claro), bem
        # espalhado; a emenda é suavizada para não virar mancha clara de borda dura
        sat = rgb.max(axis=2) - rgb.min(axis=2)
        w = ((~cv2.dilate(fix.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)) & (rgb.min(axis=2) > 130) & (sat < 40) & (dd < 37)).astype(np.float32)
        num = cv2.GaussianBlur(art.astype(np.float32) * w[..., None], (0, 0), 7)
        den = cv2.GaussianBlur(w, (0, 0), 7)[..., None]
        val = num / np.maximum(den, 1e-3)
        alpha = cv2.GaussianBlur(fix.astype(np.float32), (0, 0), 1.2)
        alpha = np.maximum(alpha, fix.astype(np.float32) * 0.0)
        alpha = np.where(fix, np.maximum(alpha, 0.85), alpha)[..., None]
        sel = dd < 38
        mix = clean.astype(np.float32) * (1 - alpha) + val * alpha
        clean[sel] = np.clip(mix[sel], 0, 255).astype(np.uint8)
    for i, (cx, cy) in enumerate(centers):
        # recorte até o aro de dentro (44 px): cobre o fundo da arte do painel por inteiro
        R = 44
        crop = clean[cy - R:cy + R + 1, cx - R:cx + R + 1]
        gy, gx = np.mgrid[0:crop.shape[0], 0:crop.shape[1]]
        al = (np.hypot(gx - R, gy - R) <= 43).astype(np.uint8) * 255
        Image.fromarray(np.dstack([crop, al]), 'RGBA').save(os.path.join(out, f'viper-aux{i}.png'), optimize=True)
        print('aux', i, 'canto', (cx - R, cy - R), 'lado', 2 * R + 1)


if __name__ == '__main__':
    main()
    aux(np.array(Image.open(sys.argv[1]).convert('RGB')), sys.argv[2])
