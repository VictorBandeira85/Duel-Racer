"""Fotos da revista do Ímola S/R (Monza S/R, pixel art do Victor): as gravatas das grades viram o logo
da Vanguarda (src/assets/brands.json), os letreiros "CHEVROLET"/"MONZA" somem (cor da lataria em
volta), a placa "MONZA" vira "S/R 87", o "1.8/S" da tampa do preto vira "2.0/S" e a marca da bateria some. Reduz para 560 x 315.
Uso: python3 tools/ref/monza_photos.py <pasta com ph-*.png> <src/assets/photos>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402

# emblemas: (cx, cy, meia largura, meia altura, lado do logo; 0 = só apaga)
EMB = {'aviao': [(573, 657, 36, 17, 30)], 'casal': [(800, 620, 34, 16, 28)], 'garagem': [(956, 677, 19, 14, 22), (1457, 393, 7, 7, 0)]}
# letreiros: retângulo pintado com a cor do fundo dele (mediana da metade escura ou clara de cada
# linha) ou, com 'ink', só as letras brancas refeitas com a lataria em volta
TXT = {'palacio': [(480, 856, 550, 882, 'dark')], 'lago': [(548, 832, 622, 864, 'dark'), (1030, 164, 1084, 190, 'dark')],
       'preto': [(626, 494, 840, 536, 'dark'), (256, 513, 342, 545, 'dark')], 'casal': [(730, 684, 848, 727, 'dark')],
       'garagem': [(1498, 362, 1562, 392, 'ink'), (1347, 406, 1397, 434, 'ink'), (881, 340, 932, 384, 'ink')]}
# textos novos: (texto, centro, corpo, cor); o S/R é 2.0 (a arte trazia "1.8/S" na tampa do preto)
PLATE = {'casal': ('S/R 87', (789, 705), 30, (236, 236, 236)), 'preto': ('2.0/S', (299, 529), 25, (238, 40, 40))}
# bateria: dentro do polígono, o que não é o azul da faixa vira azul
BATT = {'motor': [(1232, 584), (1270, 578), (1350, 682), (1318, 700)]}
# sedã (Ímola Classic SE): a página de revista do lago ganha manchete nova (a original trazia o nome real)
TOP = {'palacio': 160, 'lago': 160}  # corte 16:9 a partir desta linha (padrão: centrado)
OUT = {'palacio': 'mzs-palacio', 'lago': 'mzs-lago', 'aviao': 'mz-aviao', 'preto': 'mz-preto', 'casal': 'mz-casal', 'garagem': 'mz-garagem', 'motor': 'mz-motor'}


def main():
    src, out = sys.argv[1], sys.argv[2]
    for k, name in OUT.items():
        if not os.path.exists(os.path.join(src, f'ph-{k}.png')):
            continue
        a = np.array(Image.open(os.path.join(src, f'ph-{k}.png')).convert('RGB'))
        H, W = a.shape[:2]
        yy, xx = np.mgrid[0:H, 0:W]
        for x0, y0, x1, y1, mode in TXT.get(k, []):
            reg = a[y0:y1, x0:x1].astype(int)
            lum = reg.mean(axis=2)
            if mode == 'ink':  # letreiro branco inclinado sobre a lataria: só as letras são refeitas
                ink = ((lum > 150) & (reg.max(axis=2) - reg.min(axis=2) < 80)).astype(np.uint8)
                ink = cv2.dilate(ink, np.ones((3, 3), np.uint8))
                a[y0:y1, x0:x1] = cv2.inpaint(np.ascontiguousarray(a[y0:y1, x0:x1]), ink, 4, cv2.INPAINT_TELEA)
                continue
            # linha a linha (a lataria tem degradê): mediana da metade escura/clara de cada linha
            for j in range(reg.shape[0]):
                row, l = reg[j], lum[j]
                sel = l <= np.percentile(l, 45) if mode == 'dark' else l >= np.percentile(l, 55)
                a[y0 + j, x0:x1] = np.median(row[sel], axis=0).astype(np.uint8)
        for cx, cy, hw, hh, sz in EMB.get(k, []):
            box = (((xx - cx) / (hw + 2)) ** 2 + ((yy - cy) / (hh + 2)) ** 2) <= 1
            ring = ((((xx - cx) / (hw + 6)) ** 2 + ((yy - cy) / (hh + 6)) ** 2) <= 1) & ~box
            a[box] = np.median(a[ring], axis=0).astype(np.uint8)
            if sz:
                lg = logo_img('vanguarda', sz)
                m = lg[..., 3] > 0
                a[cy - sz // 2:cy - sz // 2 + sz, cx - sz // 2:cx - sz // 2 + sz][m] = lg[..., :3][m]
        if k in BATT:
            pm = np.zeros((H, W), np.uint8)
            cv2.fillPoly(pm, [np.array(BATT[k], np.int32)], 1)
            rgb = a.astype(int)
            blue = (rgb[..., 2] > 140) & (rgb[..., 0] < 90)
            col = np.median(a[(pm > 0) & blue], axis=0).astype(np.uint8)
            a[(pm > 0) & (rgb.mean(axis=2) > 60)] = col
        im = Image.fromarray(a)
        if k == 'lago':
            d = ImageDraw.Draw(im)
            d.rectangle([0, 0, 782, 334], fill=tuple(int(v) for v in a[300, 20]))
            d.text((390, 196), 'ÍMOLA CLASSIC 89', font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 34), fill=(22, 20, 20), anchor='mm')
            d.text((390, 268), 'UM LUXO EM ASCENSÃO', font=ImageFont.truetype('/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf', 62), fill=(190, 16, 16), anchor='mm')
        if k in PLATE:
            t, (tx, ty), size, tcol = PLATE[k]
            ImageDraw.Draw(im).text((tx, ty), t, font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', size), fill=tcol, anchor='mm')
        if os.environ.get('DBG'):
            im.save(os.path.join(os.environ['DBG'], f'full-{k}.png'))
        th = int(round(W * 315 / 560))
        if th < H:
            top = min(TOP.get(k, (H - th) // 2), H - th)
            im = im.crop((0, top, W, top + th))
        im = im.resize((560, 315), Image.LANCZOS).quantize(160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name)


if __name__ == '__main__':
    main()
