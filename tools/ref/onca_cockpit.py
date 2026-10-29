"""Acabamento da cabine do Onça GTB (depois de import_cockpit.py br-pumagtb): tira a marca do
miolo do volante (o nome da fábrica real em dourado) e põe no lugar as letras GTB, do modelo.

Uso: python3 tools/ref/onca_cockpit.py src/assets/cockpit
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

GLYPHS = {
    'G': ['111', '100', '101', '101', '111'],
    'T': ['111', '010', '010', '010', '010'],
    'B': ['110', '101', '110', '101', '110'],
}


def clean_dash(d):
    """Manchas laranja na borda do painel e em volta dos mostradores (sobras dos ponteiros
    da arte espalhadas pela reconstrução atrás do aro): viram o cinza do painel em volta."""
    total = 0
    for name in ('dash', 'top'):
        fn = os.path.join(d, f'br-pumagtb-{name}.png')
        a = np.array(Image.open(fn).convert('RGBA'))
        rgb = a[..., :3].astype(int)
        hot = (a[..., 3] > 0) & (rgb[..., 0] > rgb[..., 2] + 50) & (rgb[..., 0] > 90)
        # só no meio (entre a coluna da porta e o console): o retrovisor vermelho e os
        # mostradores do console ficam como estão
        hot[:, :102 + 20] = False
        hot[:, 102 + 232:] = False
        hot = cv2.dilate(hot.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        hot &= a[..., 3] > 0
        bgr = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2BGR)
        fill = cv2.inpaint(bgr, hot.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
        a[hot, :3] = cv2.cvtColor(fill, cv2.COLOR_BGR2RGB)[hot]
        Image.fromarray(a, 'RGBA').save(fn)
        total += int(hot.sum())
    print('painel: manchas laranja limpas:', total)


def main():
    clean_dash(sys.argv[1])
    fn = os.path.join(sys.argv[1], 'br-pumagtb-wheel.png')
    a = np.array(Image.open(fn).convert('RGBA'))
    rgb = a[..., :3].astype(int)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    # letras douradas no miolo: saturadas e quentes, na região do botão da buzina
    zone = np.zeros(a.shape[:2], bool)
    zone[120:135, 112:144] = True
    gold = zone & (sat > 60) & (rgb[..., 0] > rgb[..., 2] + 40)
    gold = cv2.dilate(gold.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    bgr = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2BGR)
    fill = cv2.inpaint(bgr, gold.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
    a[gold, :3] = cv2.cvtColor(fill, cv2.COLOR_BGR2RGB)[gold]
    # GTB em dourado, centrado no botão
    x = 128 - 5
    for ch in 'GTB':
        for j, row in enumerate(GLYPHS[ch]):
            for i, v in enumerate(row):
                if v == '1':
                    a[125 + j, x + i, :3] = (236, 176, 44) if j < 4 else (176, 120, 24)
        x += 4
    Image.fromarray(a, 'RGBA').save(fn)
    print('volante: marca trocada por GTB; letras douradas removidas:', int(gold.sum()))


if __name__ == '__main__':
    main()
