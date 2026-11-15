"""Objetos da beira da estrada desenhados pelo Victor (pixel art sobre magenta) -> src/assets/scenery:
cerca, poste de luz, baliza, guard-rail, outdoor, placas de curva (losango), placas de chevrons, placa
azul do posto e viaduto. Usa scenery_sprite.py (grade da arte, cor do miolo de cada bloco) e:
- guard-rail: recorta um módulo (um poste e o vão de cada lado), que se repete ao longo da curva
- poste e outdoor vieram ACESOS: a arte acesa vira <tipo>-night e a de dia tem as lentes apagadas
  (cinza) e, no outdoor, o painel branco sem o facho amarelo
Uso: python3 tools/ref/road_objects.py <pasta com as artes> (nomes em SRC)
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', '..', 'src/assets/scenery')
# saída: (arquivo da arte, bloco forçado ou None)
SRC = {
    'fence': ('e0d5bd1e-image.png', None),
    'lamp-night': ('f0e434a0-image.png', None),
    'post': ('4e2c785e-image.png', None),
    'rail': ('dde2c4f0-image.png', 12.5),  # a detecção achava 32,75
    'billboard-night': ('1bbc624b-image.png', None),
    'warnL': ('cdc68042-image.png', None),
    'warnR': ('c056705b-image.png', None),
    'sharpL': ('8b76a2a2-image.png', None),
    'sharpR': ('5e1f4cdd-image.png', None),
    'signL': ('c3e69204-image.png', None),
    'signR': ('4b3ad64c-image.png', 12.48),  # mesmo bloco da esquerda (saem do mesmo tamanho)
    'gasKm': ('8de37606-image.png', None),
    'bridge': ('80ca7864-image.png', None),
}


def yellow(a):
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    return (al > 0) & (r > 170) & (g > 110) & (r - b > 60)


def unlit_lens(a, ymax):
    """lentes acesas (amarelas) acima de ymax viram vidro fosco cinza, pelo brilho"""
    o = a.copy()
    m = yellow(a)
    m[ymax:] = False
    lum = a[..., :3].mean(-1)
    tones = np.array([[96, 98, 110], [138, 140, 152], [178, 180, 190], [214, 216, 224]])
    lv = np.clip(((lum - 120) / 135 * 4).astype(int), 0, 3)
    for k in range(4):
        o[m & (lv == k), :3] = tones[k]
    return o


def main():
    src = sys.argv[1]
    for name, (f, blk) in SRC.items():
        cmd = ['python3', os.path.join(HERE, 'scenery_sprite.py'), os.path.join(src, f), os.path.join(OUT, f'{name}.png')]
        if blk:
            cmd.append(str(blk))
        subprocess.run(cmd, check=True)
    # guard-rail: módulo de um poste (postes a cada ~42 px; o do meio-esquerda fica no centro)
    p = os.path.join(OUT, 'rail.png')
    a = np.array(Image.open(p).convert('RGBA'))
    Image.fromarray(a[:, 39:81]).save(p, optimize=True)
    # poste: lente da luminária (alto da arte) apagada de dia; as listras amarelas do pé ficam
    a = np.array(Image.open(os.path.join(OUT, 'lamp-night.png')).convert('RGBA')).astype(int)
    Image.fromarray(unlit_lens(a, 16).astype(np.uint8)).save(os.path.join(OUT, 'lamp.png'), optimize=True)
    # outdoor: refletores apagados e o painel inteiro branco (o facho amarelo some)
    a = np.array(Image.open(os.path.join(OUT, 'billboard-night.png')).convert('RGBA')).astype(int)
    o = unlit_lens(a, 12)
    pan = np.zeros(a.shape[:2], bool)
    pan[12:42, 4:98] = True
    o[pan, :3] = (252, 252, 250)
    Image.fromarray(o.astype(np.uint8)).save(os.path.join(OUT, 'billboard.png'), optimize=True)
    print('ok')


if __name__ == '__main__':
    main()
