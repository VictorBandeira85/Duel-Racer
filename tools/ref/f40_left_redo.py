"""Fúria F4 (F40): lado esquerdo da cabine refeito (pedido do Victor: porta e retrovisor feios).
- moldura da janela: a faixa vermelha em "V" (moldura externa vermelha subindo pela coluna e virando
  no alto) vira a borracha preta da janela, com o mesmo sombreado convertido pelo brilho;
- retrovisor da F40 real: carcaça em gota na cor da carroceria, presa por uma haste curta na porta,
  no canto dianteiro de baixo da janela, do lado de FORA (a coluna fica na frente dele); o vidro é
  transparente (o jogo põe a vista de trás: glass.at em cockpit.ts);
- porta: forro de feltro com costura e a alça de puxar (cinta preta), seguindo a inclinação da soleira.
Roda sobre os PNG atuais (src/assets/cockpit/f40-top.png e f40-dash.png) só uma vez: guarda os
originais em <pasta> na primeira vez e parte deles nas seguintes.
Uso: python3 tools/ref/f40_left_redo.py <pasta para guardar/ler os originais>
"""
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(__file__)
C = os.path.join(HERE, '..', '..', 'src/assets/cockpit/f40-')
S = 8  # supersample do desenho do retrovisor


def stack(a, b):
    return np.concatenate([np.array(Image.open(a).convert('RGBA')), np.array(Image.open(b).convert('RGBA'))]).astype(int)


def save(c):
    c = np.clip(c, 0, 255).astype(np.uint8)
    Image.fromarray(c[:76]).save(C + 'top.png', optimize=True)
    Image.fromarray(c[76:]).save(C + 'dash.png', optimize=True)


def band_left(y):
    """borda esquerda da faixa da moldura (vermelha na arte original) na linha y"""
    return 10 + 0.2 * y


def sill_top(x):
    """primeira linha da soleira (vermelha, por fora) na coluna x"""
    return 131 - 0.5 * x


def main():
    keep = sys.argv[1]
    os.makedirs(keep, exist_ok=True)
    for p in ('top', 'dash'):
        if not os.path.exists(os.path.join(keep, p + '.png')):
            shutil.copy(C + p + '.png', os.path.join(keep, p + '.png'))
    c = stack(os.path.join(keep, 'top.png'), os.path.join(keep, 'dash.png'))
    H, W = c.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    r, g, b, a = c[..., 0], c[..., 1], c[..., 2], c[..., 3]
    op = a > 0

    # 1) retrovisor antigo (anel vermelho dentro da janela) sai: a janela fica toda transparente
    win = (xx < band_left(yy)) & (yy > 40) & (yy < sill_top(xx)) & (xx < 31)
    old_mirror = win & (yy >= 88) & (yy <= 119)
    c[old_mirror, 3] = 0
    # o pé do anel antigo encostado na soleira/coluna (x 24..31, y 112..119)
    foot = (xx >= 22) & (xx <= 31) & (yy >= 112) & (yy <= 117) & (xx < band_left(yy))
    c[foot, 3] = 0

    # 2) moldura em "V": vermelho da faixa da coluna e do alto à esquerda vira borracha preta
    red = op & (r > 28) & (r > g * 2.2) & (r > b * 1.6)
    frame = red & (yy < 124) & (xx < 52) & ~((yy >= sill_top(xx) - 1) & (xx < 34))
    lum = (r * 0.6 + g * 0.3 + b * 0.1)[frame]
    t = np.clip((lum - 20) / 150, 0, 1)
    ramp = np.array([[8, 8, 12], [22, 22, 30], [40, 40, 52], [62, 62, 78], [84, 86, 104]], float)
    k = t * (len(ramp) - 1)
    i0 = np.floor(k).astype(int).clip(0, len(ramp) - 2)
    f = (k - i0)[:, None]
    c[frame, :3] = (ramp[i0] * (1 - f) + ramp[i0 + 1] * f).round().astype(int)

    # 3) retrovisor novo: carcaça em gota achatada (quase retangular, cantos bem redondos) na cor da
    # carroceria; visto de dentro e de trás, aparece a parede interna da carcaça do lado de dentro
    # (direita, mais escura); haste curta e inclinada até a porta; vidro vazado
    cx, cy = 22.0, 101.5  # o mais para dentro possível: no celular a borda esquerda da arte fica fora da tela
    ox = np.arange(W * S) / S + 0.5 / S
    oy = np.arange(H * S) / S + 0.5 / S
    X, Y = np.meshgrid(ox, oy)

    def blob(x0, y0, rx, ry, p=3.0):
        return (np.abs((X - x0) / rx) ** p + np.abs((Y - y0) / ry) ** p) <= 1

    outer = blob(cx, cy, 14.0, 11.5)
    glass_m = blob(cx + 1.2, cy - 0.4, 9.6, 7.5)  # mais para dentro: a carcaça aparece mais grossa do lado de fora
    # haste: da base da carcaça (lado de dentro) descendo inclinada até a soleira
    t = np.clip((Y - (cy + 8)) / max(1.0, sill_top(24) + 1 - (cy + 8)), 0, 1)
    xc = 21.0 + t * 3.0
    stalk = (np.abs(X - xc) <= 2.2 - 0.6 * t) & (Y >= cy + 8) & (Y <= sill_top(24) + 1.5)
    shape = outer | stalk

    def down(m):
        return m[S // 2::S, S // 2::S]

    sh, gl, st = down(shape), down(glass_m), down(stalk)
    pad = np.pad(sh, 1)
    edge = sh & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    gpad = np.pad(gl, 1)
    lip = sh & ~gl & (gpad[:-2, 1:-1] | gpad[2:, 1:-1] | gpad[1:-1, :-2] | gpad[1:-1, 2:])
    body = sh & ~gl & ~edge & ~lip
    reds = np.array([[86, 6, 10], [132, 10, 16], [180, 16, 22], [214, 34, 40], [240, 84, 86]])
    nx, ny = (xx - cx) / 14, (yy - cy) / 11.5
    light = -(nx * 0.55 + ny * 0.85)
    lv = np.digitize(light, [-0.5, -0.05, 0.4, 0.8])
    inner = body & (xx > cx + 6) & (yy > cy - 9) & (yy < cy + 9)  # parede interna (lado de dentro)
    lv = np.where(inner, np.minimum(lv, 1), lv)
    lv = np.where(st & ~edge, np.digitize(-(xx - xc[S // 2::S, S // 2::S]), [-1.2, -0.3, 0.4, 1.2]), lv)
    mirror = np.zeros((H, W, 4), int)
    mirror[body, :3] = reds[lv[body]]
    mirror[lip, :3] = [40, 6, 10]
    mirror[edge, :3] = [22, 4, 6]
    mirror[sh & ~gl, 3] = 255
    # só onde é a janela (por fora): a coluna, a moldura e a soleira ficam na frente
    behind = (c[..., 3] == 0) | ((xx < band_left(yy)) & (yy < sill_top(xx) + 1))
    put = (mirror[..., 3] > 0) & behind
    c[put] = mirror[put]
    # vidro: só onde era janela (a moldura, opaca, fecha o vidro do lado de dentro)
    glass = gl & behind
    c[glass, 3] = 0

    # 4) porta: forro de feltro com costura e alça (cinta preta) na inclinação da soleira (desce
    # 0,6 por coluna indo para a borda)
    def ytop(x):
        return 155 - 0.6 * x  # linha clara do alto da porta (friso) na arte

    felt0, felt1 = 14, 34  # faixa do feltro abaixo do friso
    door = (xx < 44) & (yy > ytop(xx) + felt0) & (yy < ytop(xx) + felt1) & (c[..., 3] > 0)
    # feltro: a textura da própria arte, um pouco mais clara e acinzentada
    lumd = c[door, :3].mean(1)
    c[door, :3] = (np.stack([lumd] * 3, 1) * 0.7 + np.array([30, 30, 38])).clip(0, 255)
    up = (xx < 44) & (np.abs(yy - (ytop(xx) + felt0)) < 0.5)
    c[up & (c[..., 3] > 0), :3] = [16, 16, 22]
    lo = (xx < 44) & (np.abs(yy - (ytop(xx) + felt1)) < 0.5)
    c[lo & (c[..., 3] > 0), :3] = [74, 74, 88]
    seam = (xx < 42) & (np.abs(yy - (ytop(xx) + felt0 + 2)) < 0.5) & (xx % 3 != 0)
    c[seam & (c[..., 3] > 0), :3] = [88, 88, 104]
    # alça de puxar: cinta preta presa nas duas pontas (parafusos), caída no meio, brilho em cima
    for x in range(12, 36):
        y = int(round(ytop(x) + felt0 + 8 + 2.2 * np.sin((x - 12) / 23 * np.pi)))
        if c[y, x, 3]:
            c[y - 1, x, :3] = [78, 78, 92]
            c[y:y + 3, x, :3] = [12, 12, 16]
            c[y + 3, x, :3] = [34, 34, 42]
    for x in (12, 35):
        y = int(round(ytop(x) + felt0 + 8))
        c[y:y + 3, x - 1:x + 1, :3] = [10, 10, 12]
        c[y + 1, x, :3] = [110, 110, 124]
    save(c)
    print('ok: retrovisor em', (int(cx), int(cy)))


if __name__ == '__main__':
    main()
