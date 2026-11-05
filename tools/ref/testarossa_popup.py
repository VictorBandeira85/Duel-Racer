"""Frente da Furia TR com os faróis escamoteáveis levantados, a partir da arte do Victor (src-frontup.png):
a arte é alinhada à da frente fechada (ECC afim, sem as áreas dos faróis), reamostrada na mesma
grade (regrid.py, 5,31 px) e só as caixas dos faróis entram no sprite da frente já pronto
(testarossa-front.png, com o emblema); a máscara de pintura pega a carcaça vermelha das caixas.
O jogo troca para este sprite quando os faróis sobem.

Uso: python3 tools/ref/testarossa_popup.py <pasta com src-front.png e src-frontup.png> <src/assets/cars>
"""
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from vectra_sprites import red_mask  # noqa: E402


def main():
    src, out = sys.argv[1], sys.argv[2]
    a = np.array(Image.open(os.path.join(src, 'src-front.png')).convert('L')).astype(np.float32) / 255
    bu = np.array(Image.open(os.path.join(src, 'src-frontup.png')).convert('RGB'))
    b = cv2.cvtColor(bu, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    k = 4
    A = cv2.GaussianBlur(cv2.resize(a, (a.shape[1] // k, a.shape[0] // k), interpolation=cv2.INTER_AREA), (0, 0), 1.5)
    B = cv2.GaussianBlur(cv2.resize(b, (b.shape[1] // k, b.shape[0] // k), interpolation=cv2.INTER_AREA), (0, 0), 1.5)
    s = 950 / 1005
    Wm = np.array([[s, 0, (768 / k) * (1 - s)], [0, s, (512 / k) * (1 - s)]], np.float32)
    mask = np.ones_like(A, np.uint8)
    mask[110:160, 70:150] = 0
    mask[110:160, 235:315] = 0
    _, Wm = cv2.findTransformECC(A, B, Wm, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-6), mask, 5)
    Wm[:, 2] *= k
    al = cv2.warpAffine(bu, Wm, (a.shape[1], a.shape[0]), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)
    tmp = os.path.join(src, 'src-frontup-al.png')
    Image.fromarray(al).save(tmp)
    rg = {}
    for name, p in (('f', os.path.join(src, 'src-front.png')), ('u', tmp)):
        o = os.path.join(src, f'rgx-{name}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), p, o, '5.31'], check=True, capture_output=True)
        rg[name] = np.array(Image.open(o).convert('RGB')).astype(int)
    F, U = rg['f'], rg['u']
    S = np.array(Image.open(os.path.join(out, 'testarossa-front.png')).convert('RGBA'))
    M = np.array(Image.open(os.path.join(out, 'testarossa-front-mask.png')).convert('RGBA'))
    h, w = S.shape[:2]
    # onde o sprite pronto está na grade da arte
    m0 = S[..., 3] > 0
    best = None
    for oy in range(0, F.shape[0] - h + 1):
        for ox in range(0, F.shape[1] - w + 1):
            e = np.abs(F[oy:oy + h, ox:ox + w] - S[..., :3].astype(int)).sum(axis=2)[m0].mean()
            if best is None or e < best[0]:
                best = (e, ox, oy)
    _, ox, oy = best
    Fc, Uc = F[oy:oy + h, ox:ox + w], U[oy:oy + h, ox:ox + w]
    # caixas dos faróis: o que mudou entre as duas artes, nas duas regiões dos faróis
    box = np.zeros((h, w), bool)
    bw = int(w * 0.28)
    box[int(h * 0.34):int(h * 0.63), int(w * 0.02):int(w * 0.02) + bw] = True
    box[int(h * 0.34):int(h * 0.63), w - int(w * 0.02) - bw:w - int(w * 0.02)] = True
    m = (np.abs(Fc - Uc).sum(axis=2) > 60) & box
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool)
    n, lab = cv2.connectedComponents((~m).astype(np.uint8), connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    m |= ~np.isin(lab, list(border)) & box
    m = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & box & m0
    up = S.copy()
    up[m, :3] = Uc[m].astype(np.uint8)
    Image.fromarray(up, 'RGBA').save(os.path.join(out, 'testarossa-front-up.png'), optimize=True)
    pm = red_mask(up)
    mk = M.copy()
    mk[m, :3] = np.where(pm[m][:, None], 255, 0)
    Image.fromarray(mk, 'RGBA').save(os.path.join(out, 'testarossa-front-up-mask.png'), optimize=True)
    # centros dos faróis de fora (os acesos na arte): as manchas mais claras de cada caixa
    lum = up[..., :3].astype(int).mean(axis=2)
    for side in (0, 1):
        bx = box.copy()
        if side == 0:
            bx[:, w // 2:] = False
        else:
            bx[:, :w // 2] = False
        ys, xs = np.nonzero(bx & (lum > 225) & m)
        print('farol aceso', round(xs.mean() / w, 3), round(ys.mean() / h, 3))
    print('caixas', int(m.sum()), 'deslocamento', ox, oy)


if __name__ == '__main__':
    main()
