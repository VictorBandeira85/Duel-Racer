# Limpa o painel por baixo do volante (restos do volante antigo): degradê entre as cores do painel
# dos dois lados, sombra sob o quadro e coluna de direção. Já aplicado; rodar só sobre a arte importada.
import sys, numpy as np, cv2
from PIL import Image
sys.path.insert(0,'.')
from wheel_reveal import masks, CARS, D
BK={}
YC={'br-vectra':86,'br-uno':83,'br-corsa':90,'br-passat':96,'br-pumagte':96,'br-pumagtb':97,'diablo':76}
def interior(inter):
  free=(~inter).astype(np.uint8)
  H,W=free.shape
  ff=free.copy(); m=np.zeros((H+2,W+2),np.uint8)
  for x in range(W):
    if ff[0,x]==1: cv2.floodFill(ff,m,(x,0),2)
  for y in range(H):
    for x in (0,W-1):
      if ff[y,x]==1: cv2.floodFill(ff,m,(x,y),2)
  return ff==1
def fix(key, write=False):
  dash,rev,uni=masks(key)
  (px,py),wdx,wdy,wt=CARS[key]
  w=np.array(Image.open(D+key+'-wheel.png').convert('RGBA'))[...,3]>128
  H,W=dash.shape[:2]
  big=np.zeros((H,W),bool); ox,oy=102+wdx,-wt+wdy
  hh,ww=w.shape
  for y in range(H):
    sy=y-oy
    if 0<=sy<hh: big[y,ox:ox+ww]=w[sy,:W-ox]
  inn=interior(big)|big
  inn=cv2.dilate(inn.astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
  yc=YC[key]
  R=inn.copy(); R[:yc]=False
  cx=102+wdx+px; cy=py+wdy
  rgb=dash[...,:3].astype(float)
  out=dash.copy()
  rows=[y for y in range(yc,H) if R[y].any()]
  L=[];Rr=[];XL=[];XR=[]
  for y in rows:
    xs=np.where(R[y])[0]; xl,xr=xs.min(),xs.max()
    XL.append(xl);XR.append(xr)
    L.append(np.median(rgb[max(0,y-1):y+2,max(0,xl-5):xl].reshape(-1,3),axis=0))
    Rr.append(np.median(rgb[max(0,y-1):y+2,xr+1:min(W,xr+6)].reshape(-1,3),axis=0))
  L=np.array(L);Rr=np.array(Rr)
  # suaviza na vertical (sem listras) e junta as duas pontas num tom só no meio
  L=cv2.GaussianBlur(L[:,None,:].astype(np.float32),(1,0),sigmaX=0.1,sigmaY=4)[:,0]
  Rr=cv2.GaussianBlur(Rr[:,None,:].astype(np.float32),(1,0),sigmaX=0.1,sigmaY=4)[:,0]
  lum=lambda c:c.mean()
  for i,y in enumerate(rows):
    xl,xr=XL[i],XR[i]; xs=np.arange(xl,xr+1)
    t=(xs-xl)/max(1,xr-xl)
    col=L[i][None]*(1-t[:,None])+Rr[i][None]*t[:,None]
    k=0.62 if y==yc else (0.8 if y==yc+1 else 1.0)
    col=col*k
    # coluna de direção: um pouco mais escura, com quina clara
    if y>cy-4:
      hw=12+(y-cy)*0.4
      d=np.abs(xs+0.5-cx)
      col[d<=hw]*=0.72
      edge=np.abs(d-hw)<0.6
      col[edge]=col[edge]/0.72*1.25
    m=R[y,xl:xr+1]
    out[y,xl:xr+1][m,:3]=np.clip(col[m],0,255).astype(np.uint8)
    out[y,xl:xr+1][m,3]=255
  if write: Image.fromarray(out,'RGBA').save(D+key+'-dash.png')
  return out,R
if __name__=='__main__':
  write='--write' in sys.argv
  for key in [a for a in sys.argv[1:] if not a.startswith('--')]:
    out,R=fix(key,write)
    ys,xs=np.where(R); x0,x1=max(0,xs.min()-30),min(out.shape[1],xs.max()+30)
    rgb=out[...,:3].copy(); rgb[out[...,3]<128]=(255,0,255)
    Image.fromarray(rgb[:,x0:x1]).resize(((x1-x0)*3,out.shape[0]*3),Image.NEAREST).save(f'under-{key}.png')
    print(key,'px',R.sum())
