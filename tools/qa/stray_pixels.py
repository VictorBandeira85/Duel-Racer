"""Pixels soltos na arte (cabines e sprites): acha e corrige os pixels claros (ou de cor que destoa)
isolados, em grupos de 1 a 3 px cercados de outra cor, e a franja clara que sobrou na borda das
áreas recortadas (vidro/céu transparente): o branco que aparece por cima do céu no jogo.
- miolo: pixel opaco bem mais claro que TODOS os vizinhos (grupo de até 3 px, anel todo opaco e
  escuro) no meio de cor viva (lataria, capô); reflexos de verdade formam linhas/manchas maiores ou
  têm meio-tom em volta e ficam; no painel escuro/cinza o pontilhado é desenho (marcações, chuvisco)
- destoa: grupo de até 2 px claro numa área lisa de cor viva (anel uniforme) com cor muito diferente
- franja: pixel opaco encostado no transparente, claro e pouco saturado, mais claro que a peça ao
  lado (grupo de até 6 px na borda); vira transparente se está do lado de fora do contorno, senão
  recebe a cor da peça
- máscara: pixel de máscara solto (1-2 px marcados no meio do vazio, ou furo de 1-2 px na máscara)
Correção: cor dominante do anel (a cor da própria paleta mais próxima da mediana), ou transparente.
Áreas protegidas: mostradores (os fundos/ponteiros são do código e os números ficam), letreiros.
Uso: python3 tools/qa/stray_pixels.py <saída_dir> [alvo ...]       -> relatório + folha ampliada
     python3 tools/qa/stray_pixels.py --fix <saída_dir> [alvo ...]  -> corrige e grava folha antes/depois
     --mask junto com --fix corrige também os pixels soltos das máscaras (por padrão só relata)
Alvos: id da cabine (viper, br-golgti...) ou car:<arte> (sprites externos). Sem alvos: os atualizados.
"""
import os
import re
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
COCK = os.path.join(ROOT, 'src/assets/cockpit')
CARS = os.path.join(ROOT, 'src/assets/cars')
FIXMASK = '--mask' in sys.argv  # máscaras: só relatório, a menos que peça (pontilhado pode ser de propósito)
PAD = 102  # colunas a mais de cada lado da arte da cabine (DASH_PAD em cockpit.ts)
TOPH = 76

# carros atualizados (CLAUDE.md): cabines e artes externas
DASHES = ['viper', 'diablo', 'testarossa', 'f40', 'nsx', 'br-golgti', 'br-monza', 'br-monzasedan', 'br-voyage',
          'br-voyagesport', 'br-santana', '959', 'countach', 'br-passat', 'br-pumagte']
# achados conferidos na folha que são desenho (lanterna, visor do rádio, friso): ficam
KEEP = {'br-santana-front': [(14, 133)], 'countach-front-up': [(81, 137)], 'br-passat': [(334, 188)]}
KEEP_BOX = {'br-passat-side': [(116, 0, 127, 46)]}  # antena (fio cromado de 2 px)
ARTS = ['viper', 'diablo', 'diablosv', 'patrolsv', 'testarossa', 'f40', 'nsx', 'br-golgti', 'br-monza', 'br-monzacoupe',
        'br-voyage', 'br-voyagesport', 'br-santana', '959', 'countach', 'br-passat', 'br-pumagte']


def rgba(p):
    return np.array(Image.open(p).convert('RGBA'))


def gauges(dash):
    """círculos dos mostradores da cabine (x, y, r) em pixels do topo+painel empilhados, lidos de cockpit.ts"""
    src = open(os.path.join(ROOT, 'src/cockpit.ts'), encoding='utf-8').read()
    key = f"COCKPIT_ART['{dash}']" if not re.match(r'^[a-z]\w*$', dash) else None
    pats = [f"COCKPIT_ART.{dash} = {{", f"COCKPIT_ART['{dash}'] = {{", f"'{dash}': {{", f"{dash}: {{"]
    i = -1
    for p_ in pats:
        i = src.find(p_)
        if i >= 0:
            break
    if i < 0:
        return []
    j = src.find('\n};', i)
    j2 = src.find('\n  },\n  ', i)
    blk = src[i:j if j > 0 else i + 6000]
    if j2 > 0 and j2 < j and pats.index(p_) >= 2:
        blk = src[i:j2]
    out = []
    for m in re.finditer(r'\{\s*x:\s*([\d.]+),\s*y:\s*([\d.]+),\s*r:\s*([\d.]+)', blk):
        x, y, r = map(float, m.groups())
        out.append((x + PAD, y + TOPH, r + 2.5))
    for m in re.finditer(r"\{\s*src:[^}]*?x:\s*([\d.]+),\s*y:\s*([\d.]+),\s*w:\s*([\d.]+),\s*h:\s*([\d.]+)", blk):
        x, y, w, h = map(float, m.groups())
        out.append((x + w / 2 + PAD, y + h / 2 + TOPH, max(w, h) / 2 + 1))
    return out


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def ring_of(lab_mask):
    return cv2.dilate(lab_mask.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~lab_mask


def pick(colors):
    """cor dominante do anel: a cor (da paleta da própria arte) mais próxima da mediana"""
    med = np.median(colors, axis=0)
    vals, cnt = np.unique(colors, axis=0, return_counts=True)
    if cnt.max() >= max(3, len(colors) // 2):
        return vals[cnt.argmax()]
    return colors[np.argmin(((colors - med) ** 2).sum(1))]


def body_ring(c, rg):
    """anel de cor viva e de um tom só, fora de lanternas/piscas (âmbar) e vidros (azul)"""
    rc = c[rg]
    hsv = cv2.cvtColor(np.clip(rc, 0, 255).astype(np.uint8)[None], cv2.COLOR_RGB2HSV_FULL)[0].astype(float)
    h = hsv[:, 0] * 360 / 256
    ref = np.median(h)
    dev = np.abs((h - ref + 180) % 360 - 180)
    if dev.max() > 28:
        return False
    if 22 < ref < 58 or 170 < ref < 270:
        return False
    return True


def keep(name, found):
    ok = KEEP.get(name, [])
    box = KEEP_BOX.get(name, [])
    inb = lambda y, x: any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in box)
    return [f for f in found if not any((x, y) in ok or inb(y, x) for y, x in f[1])]


def find(a, protect=None):
    """lista de achados: (tipo, [(y, x)...], cor nova ou None = transparente)"""
    H, W = a.shape[:2]
    op = a[..., 3] >= 128
    c = a[..., :3].astype(np.float32)
    L = lum(c)
    sat = c.max(-1) - c.min(-1)
    tr = ~op
    pad_op = np.pad(op, 1)
    pad_L = np.pad(L, 1)
    # maior e mediana do brilho dos vizinhos opacos (8)
    nbL = np.stack([pad_L[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx])
    nbO = np.stack([pad_op[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx])
    nbLm = np.where(nbO, nbL, np.nan)
    with np.errstate(all='ignore'):
        import warnings
        warnings.simplefilter('ignore')
        medL = np.nanmedian(nbLm, axis=0)
    edge4 = op & (np.pad(tr, 1)[:-2, 1:-1] | np.pad(tr, 1)[2:, 1:-1] | np.pad(tr, 1)[1:-1, :-2] | np.pad(tr, 1)[1:-1, 2:])
    if protect is None:
        protect = np.zeros((H, W), bool)
    found = []
    taken = np.zeros((H, W), bool)

    # miolo: claro e isolado
    cand = op & ~edge4 & (L - np.nan_to_num(medL, nan=255) > 40) & ~protect
    n, lab, st, _ = cv2.connectedComponentsWithStats(cand.astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if st[i, 4] > 3:
            continue
        m = lab == i
        rg = ring_of(m)
        if not op[rg].all():
            continue
        lo = L[m].min()
        if lo < 165 or L[rg].max() > lo - 55:  # pouco claro, ou com meio-tom encostado: textura/reflexo
            continue
        # outro brilho parecido a 2 px (pontilhado de um reflexo ou do chuvisco da arte): fica
        ys_, xs_ = np.nonzero(m)
        y0_, y1_, x0_, x1_ = max(0, ys_.min() - 2), ys_.max() + 3, max(0, xs_.min() - 2), xs_.max() + 3
        win = (L[y0_:y1_, x0_:x1_] > lo - 45) & op[y0_:y1_, x0_:x1_] & ~m[y0_:y1_, x0_:x1_]
        if win.any():
            continue
        if (rg & protect).any():
            continue
        if np.median(sat[rg]) < 70 or not body_ring(c, rg):  # só no meio da lataria/capô: no painel escuro é desenho ou chuvisco
            continue
        found.append(('miolo', list(zip(*np.nonzero(m))), pick(a[rg][:, :3].astype(int))))
        taken |= m

    # destoa: cor muito diferente de uma área lisa
    ys, xs = np.nonzero(op & ~edge4 & ~taken & ~protect)
    pc = np.pad(c, ((1, 1), (1, 1), (0, 0)))
    nbC = np.stack([pc[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx])
    medC = np.median(nbC, axis=0)
    dist = np.sqrt(((c - medC) ** 2).sum(-1))
    cand = op & ~edge4 & ~taken & ~protect & (dist > 70)
    n, lab, st, _ = cv2.connectedComponentsWithStats(cand.astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if st[i, 4] > 2:
            continue
        m = lab == i
        rg = ring_of(m)
        if not op[rg].all() or (rg & protect).any():
            continue
        rc = c[rg]
        rmed = np.median(rc, axis=0)
        if np.sqrt(((rc - rmed) ** 2).sum(-1)).max() > 34:  # anel não é liso: textura/desenho
            continue
        if np.sqrt(((c[m] - rmed) ** 2).sum(-1)).min() < 75:
            continue
        if rmed.max() - rmed.min() < 70 or not body_ring(c, rg):  # só no meio da lataria/capô
            continue
        if L[m].min() < lum(rmed) + 50:  # só o que é mais claro que a área (o branco que aparece)
            continue
        found.append(('destoa', list(zip(*np.nonzero(m))), pick(a[rg][:, :3].astype(int))))
        taken |= m

    # franja clara na borda do recorte
    nbLin = np.where(nbO & ~np.stack([np.pad(edge4, 1)[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]), nbL, np.nan)
    with np.errstate(all='ignore'):
        medIn = np.nanmedian(nbLin, axis=0)
    ref = np.where(np.isnan(medIn), np.nan_to_num(medL, nan=0), medIn)
    cand = edge4 & ~taken & ~protect & (L > 115) & (sat < 35) & (L - ref > 45)  # cinza/branco (reflexo da lataria tem a cor dela)
    n, lab, st, _ = cv2.connectedComponentsWithStats(cand.astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if st[i, 4] > 6:
            continue
        m = lab == i
        rg = ring_of(m)
        rop = rg & op
        if not rop.any():
            # pixel claro solto no meio do transparente: some
            found.append(('franja', list(zip(*np.nonzero(m))), None))
            taken |= m
            continue
        if L[rop].max() > L[m].min() - 25 and (L[rop] > L[m].min() - 25).sum() > 2:
            continue  # encostado em peça igualmente clara: borda clara de verdade (cromado, vidro claro)
        pts = list(zip(*np.nonzero(m)))
        # do lado de fora do contorno (tem vizinho transparente e o resto é contorno/peça): some;
        # entre duas peças (muito vizinho opaco): recebe a cor da peça
        # recebe a cor da peça ao lado (a silhueta fica; um contorno sem linha escura não fica serrilhado)
        found.append(('franja', pts, pick(a[rop][:, :3].astype(int))))
        taken |= m

    # fora do contorno: pixel cinzento/claro entre o transparente e o contorno escuro da peça (sobra
    # do fundo antigo, aparece como pontilhado claro por cima do céu): some
    pt = np.pad(tr, 1, constant_values=False)
    pL = np.pad(L, 1, constant_values=255)
    pO = np.pad(op, 1, constant_values=False)
    out = np.zeros((H, W), bool)
    base = edge4 & ~taken & ~protect & (L > 75) & (sat < 80)
    for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
        for sg in (1, -1):
            ty, tx = 1 - sg * dy, 1 - sg * dx      # lado do transparente
            iy, ix = 1 + sg * dy, 1 + sg * dx      # lado de dentro (contorno)
            tside = pt[ty:ty + H, tx:tx + W]
            inL = pL[iy:iy + H, ix:ix + W]
            inO = pO[iy:iy + H, ix:ix + W]
            # e a peça continua depois do contorno (antena, haste e friso de 2 px ficam)
            jy, jx = 1 + 2 * sg * dy, 1 + 2 * sg * dx
            in2 = np.pad(op, 2, constant_values=False)[1 + jy:1 + jy + H, 1 + jx:1 + jx + W]
            out |= base & tside & inO & in2 & (inL < 62) & (L - inL > 40)
    n, lab, st, _ = cv2.connectedComponentsWithStats(out.astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if st[i, 4] > 40:
            continue
        m = lab == i
        found.append(('franja', list(zip(*np.nonzero(m))), None))
        taken |= m
    return found


def find_mask(mk, img_op):
    """pixels soltos na máscara (só dentro da parte opaca da arte)"""
    on = mk & img_op
    out = []
    for val, src in ((False, on), (True, ~mk & img_op)):
        n, lab, st, _ = cv2.connectedComponentsWithStats(src.astype(np.uint8), connectivity=8)
        for i in range(1, n):
            if st[i, 4] > 2:
                continue
            m = lab == i
            rg = ring_of(m) & img_op
            if not rg.any():
                continue
            if val is False and not mk[rg].any():   # marcado solto no meio do não marcado
                out.append(('mascara', list(zip(*np.nonzero(m))), 0))
            elif val is True and mk[rg].all():       # furo de 1-2 px dentro da máscara
                out.append(('mascara', list(zip(*np.nonzero(m))), 255))
    return out


def apply(a, found):
    b = a.copy()
    for kind, pts, col in found:
        for y, x in pts:
            if col is None:
                b[y, x] = (0, 0, 0, 0)
            else:
                b[y, x, :3] = col
                b[y, x, 3] = 255
    return b


BG = np.array([0, 150, 235], np.uint8)  # céu azul de fundo para enxergar a franja


def flat(a):
    o = np.empty(a.shape[:2] + (3,), np.uint8)
    o[:] = BG
    m = a[..., 3] >= 128
    o[m] = a[..., :3][m]
    return o


def sheet(name, before, after, found, path, z=6, cell=15):
    """folha: a imagem inteira com os achados marcados + cada achado ampliado (antes | depois)"""
    fb, fa = flat(before), flat(after)
    H, W = fb.shape[:2]
    s = max(1, min(4, 1400 // W))
    over = Image.fromarray(fb).resize((W * s, H * s), Image.NEAREST)
    dr = ImageDraw.Draw(over)
    cols = {'miolo': (255, 0, 255), 'destoa': (255, 160, 0), 'franja': (0, 255, 0), 'mascara': (255, 255, 0)}
    for kind, pts, _ in found:
        ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
        dr.rectangle([min(xs) * s - 3, min(ys) * s - 3, (max(xs) + 1) * s + 2, (max(ys) + 1) * s + 2], outline=cols[kind])
    cw = cell * z
    per = max(1, (W * s) // (2 * cw + 10))
    rows = (len(found) + per - 1) // per
    out = Image.new('RGB', (max(W * s, per * (2 * cw + 10)), H * s + 20 + rows * (cw + 16)), (30, 30, 34))
    out.paste(over, (0, 0))
    d = ImageDraw.Draw(out)
    d.text((4, H * s + 4), f'{name}: {len(found)} achados ({sum(len(f[1]) for f in found)} px)  rosa=miolo laranja=destoa verde=franja amarelo=mascara', fill=(255, 255, 255))
    for k, (kind, pts, _) in enumerate(found):
        cy, cx = pts[0]
        x0, y0 = int(np.clip(cx - cell // 2, 0, max(0, W - cell))), int(np.clip(cy - cell // 2, 0, max(0, H - cell)))
        ox, oy = (k % per) * (2 * cw + 10), H * s + 20 + (k // per) * (cw + 16)
        for j, im in enumerate((fb, fa)):
            crop = Image.fromarray(im[y0:y0 + cell, x0:x0 + cell]).resize((cell * z, cell * z), Image.NEAREST)
            out.paste(crop, (ox + j * (cw + 2), oy))
        for y, x in pts:
            px, py = ox + (x - x0) * z, oy + (y - y0) * z
            d.rectangle([px, py, px + z - 1, py + z - 1], outline=cols[kind])
        d.text((ox, oy + cw + 2), f'{kind} {cx},{cy}', fill=(200, 200, 200))
    out.save(path)


def protect_cockpit(dash, H, W):
    pr = np.zeros((H, W), bool)
    yy, xx = np.mgrid[0:H, 0:W]
    for x, y, r in gauges(dash):
        pr |= (xx - x) ** 2 + (yy - y) ** 2 <= r * r
    return pr


def run(target, outdir, fix):
    report = []
    if target.startswith('car:'):
        art = target[4:]
        for v in ('side', 'front', 'rear', 'front-up'):
            p = os.path.join(CARS, f'{art}-{v}.png')
            if not os.path.exists(p):
                continue
            a = rgba(p)
            f = keep(f'{art}-{v}', find(a))
            mp = os.path.join(CARS, f'{art}-{v}-mask.png')
            b = apply(a, f)
            if os.path.exists(mp):
                mim = Image.open(mp)
                mk = np.array(mim.convert('L')) > 127
                fm = find_mask(mk, b[..., 3] >= 128)
                f_all = f + fm
            else:
                fm, f_all = [], f
            report.append((f'{art}-{v}', f_all))
            if f_all:
                sheet(f'{art}-{v}', a, b, f_all, os.path.join(outdir, f'{art}-{v}.png'), z=8)
            if fix and f:
                Image.fromarray(b, 'RGBA').save(p, optimize=True)
            if fix and fm and FIXMASK:
                mm = np.array(mim.convert('RGBA'))
                for _, pts, val in fm:
                    for y, x in pts:
                        mm[y, x, :3] = val
                        mm[y, x, 3] = 255
                Image.fromarray(mm, 'RGBA').convert(mim.mode).save(mp, optimize=True)
        return report
    dash = target
    tp, dp, wp = (os.path.join(COCK, f'{dash}-{k}.png') for k in ('top', 'dash', 'wheel'))
    t, d = rgba(tp), rgba(dp)
    st = np.concatenate([t, d], axis=0)
    f = keep(dash, find(st, protect_cockpit(dash, *st.shape[:2])))
    b = apply(st, f)
    fm = []
    masks = [os.path.join(COCK, f'{dash}-{k}-mask.png') for k in ('top', 'dash')]
    if all(os.path.exists(m) for m in masks):
        mt, md = (np.array(Image.open(m).convert('L')) for m in masks)
        mk = np.concatenate([mt, md], axis=0) > 127
        fm = find_mask(mk, b[..., 3] >= 128)
    report.append((f'{dash} cabine', f + fm))
    if f or fm:
        sheet(f'{dash} cabine', st, b, f + fm, os.path.join(outdir, f'{dash}-cabine.png'))
    if fix and f:
        Image.fromarray(b[:t.shape[0]], 'RGBA').save(tp, optimize=True)
        Image.fromarray(b[t.shape[0]:], 'RGBA').save(dp, optimize=True)
    if fix and fm and FIXMASK:
        for k, m in enumerate(masks):
            mm = np.array(Image.open(m).convert('L'))
            for _, pts, val in fm:
                for y, x in pts:
                    yy = y - (0 if k == 0 else t.shape[0])
                    if 0 <= yy < mm.shape[0]:
                        mm[yy, x] = val
            Image.fromarray(mm, 'L').save(m, optimize=True)
    w = rgba(wp)
    fw = [x for x in find(w) if x[0] == 'franja']  # o couro do volante tem pontilhado claro de propósito
    bw = apply(w, fw)
    report.append((f'{dash} volante', fw))
    if fw:
        sheet(f'{dash} volante', w, bw, fw, os.path.join(outdir, f'{dash}-volante.png'))
    if fix and fw:
        Image.fromarray(bw, 'RGBA').save(wp, optimize=True)
    return report


def main():
    args = sys.argv[1:]
    fix = '--fix' in args
    args = [x for x in args if x not in ('--fix', '--mask')]
    outdir = args[0]
    os.makedirs(outdir, exist_ok=True)
    targets = args[1:] or DASHES + [f'car:{a}' for a in ARTS]
    for tg in targets:
        for name, f in run(tg, outdir, fix):
            kinds = {}
            for k, pts, _ in f:
                kinds[k] = kinds.get(k, 0) + len(pts)
            print(f'{name}: {len(f)} achados, {sum(kinds.values())} px {kinds if kinds else ""}')


if __name__ == '__main__':
    main()
