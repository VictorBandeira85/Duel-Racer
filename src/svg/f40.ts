// Arte vetorial (SVG) do Furia F4, inspirado no F40.
// A silhueta do perfil foi vetorizada (Potrace) a partir de uma foto de referência;
// os detalhes internos foram desenhados à mão nas posições medidas.

// Perfil: viewBox 1071 x 300, chão em y = 294
export const F40_SIDE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1071 300">
<defs>
  <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ff5a46"/><stop offset="0.3" stop-color="#e82a1e"/>
    <stop offset="0.62" stop-color="#c8161a"/><stop offset="0.85" stop-color="#9a0e10"/><stop offset="1" stop-color="#5a0606"/>
  </linearGradient>
  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7a8a9c"/><stop offset="0.45" stop-color="#2c3846"/><stop offset="1" stop-color="#121a24"/>
  </linearGradient>
  <linearGradient id="hl" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ff8a70" stop-opacity="0"/><stop offset="0.5" stop-color="#ffb09a" stop-opacity="0.55"/><stop offset="1" stop-color="#ff8a70" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="rim" cx="0.4" cy="0.35" r="0.7">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#c8cacf"/><stop offset="1" stop-color="#8a8c92"/>
  </radialGradient>
  <g id="wheel">
    <circle r="84" fill="#1a0606"/>
    <circle r="79" fill="#141414"/>
    <circle r="76" fill="none" stroke="#2a2a2a" stroke-width="3"/>
    <circle r="56" fill="url(#rim)"/>
    <g fill="#26282c">
      <path d="M0,-17 L-14,-50 A52,52 0 0 1 14,-50 Z" transform="rotate(36)"/>
      <path d="M0,-17 L-14,-50 A52,52 0 0 1 14,-50 Z" transform="rotate(108)"/>
      <path d="M0,-17 L-14,-50 A52,52 0 0 1 14,-50 Z" transform="rotate(180)"/>
      <path d="M0,-17 L-14,-50 A52,52 0 0 1 14,-50 Z" transform="rotate(252)"/>
      <path d="M0,-17 L-14,-50 A52,52 0 0 1 14,-50 Z" transform="rotate(324)"/>
    </g>
    <circle r="54" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="3" stroke-dasharray="60 400" transform="rotate(200)"/>
    <circle r="13" fill="#4a4c52"/><circle r="7" fill="#d8dade"/><circle r="3" fill="#6a6c72"/>
  </g>
</defs>
<ellipse cx="536" cy="294" rx="560" ry="10" fill="#000" opacity="0.45"/>
<path d="M 545 1.4 C 497.8 4.2, 481.9 7.0, 474.5 13.9 C 472.8 15.5, 468.3 18.4, 464.5 20.5 C 449.8 28.3, 445.0 31.0, 433.9 37.4 C 427.6 41.1, 422.0 44.2, 421.5 44.3 C 420.9 44.4, 420.2 44.7, 420 45.1 C 419.2 45.9, 406.3 53.8, 401.5 56.4 C 399.3 57.5, 397.3 58.8, 397.1 59.2 C 396.9 59.6, 396.3 60, 395.8 60 C 395.3 60, 394.2 60.6, 393.4 61.4 C 392.5 62.2, 391.2 62.6, 390.4 62.3 C 389.6 62.0, 386.8 63.1, 384.2 64.7 C 381.6 66.3, 378.7 67.9, 377.7 68.2 C 376.7 68.6, 376 69.8, 376 70.9 C 376 72.3, 375.3 73, 373.8 73 C 369.8 73, 362.8 77.1, 359.9 81.2 C 358.1 83.6, 357 84.6, 357 83.6 C 357 81.8, 354.4 81.3, 353.4 83.0 C 352.8 83.9, 345.6 88, 344.5 88 C 344.2 88, 344 86.8, 344 85.5 C 344 83.7, 343.5 83.2, 342.5 83.6 C 341.2 84.1, 341 82.5, 341 73.1 C 341 66.3, 340.6 62, 340 62 C 339.3 62, 339 67.5, 339 76.6 C 339 89.5, 338.8 91.1, 337.4 90.6 C 336.5 90.2, 335.1 90, 334.4 90 C 333.2 90, 333 87.4, 333 76.5 C 333 63.8, 332.8 63, 331.0 63 C 330.0 63, 328.8 63.8, 328.5 64.9 C 328.1 66.0, 327.3 66.6, 326.5 66.3 C 325.7 66.0, 323.8 66.5, 322.2 67.3 C 320.1 68.4, 317.7 68.7, 314.3 68.3 C 311.4 68.0, 307.2 68.4, 303.8 69.3 C 294.7 71.7, 294 72.4, 294 77.5 C 294 81.7, 293.7 82.1, 290.9 83.1 C 287.2 84.4, 286 86.6, 286 91.8 L 286 95.7 271.2 96.9 C 263.1 97.6, 251.1 99.1, 244.5 100.1 C 237.9 101.2, 230.8 102.3, 228.7 102.6 L 225 103.2 225 98.5 C 225 91.7, 221.6 92.3, 221.1 99.1 L 220.8 103.8 215.6 104.9 C 212.8 105.5, 206 106.9, 200.5 108.0 C 195 109.1, 188.7 110.6, 186.5 111.4 C 184.3 112.1, 180.7 113.1, 178.5 113.4 C 176.3 113.8, 172.7 114.7, 170.5 115.4 C 168.3 116.2, 162.1 117.8, 156.7 119.0 C 151.3 120.2, 141.2 123.2, 134.2 125.6 C 127.2 128.0, 120.1 130.4, 118.5 130.9 C 116.8 131.4, 110.3 134.1, 104 137.0 C 90.5 143.0, 88.1 143.7, 86.9 141.8 C 86.2 140.8, 86.0 140.9, 86 142.5 C 85.9 144.0, 85.7 144.2, 85.0 143.0 C 84.0 141.4, 81.0 143.1, 80.9 145.3 C 80.9 145.9, 79.0 147.3, 76.7 148.4 C 74.4 149.5, 70.6 151.6, 68.3 153.2 C 66.0 154.7, 63.8 156, 63.6 156 C 62.6 156, 43.7 167.0, 34 173.2 C 28.7 176.6, 22.9 180.3, 21 181.5 C 19.0 182.7, 16.3 184.1, 15 184.5 C 10.8 185.7, 10.1 186.9, 9.4 193.0 C 9.0 196.6, 8.2 199, 7.5 199 C 4.9 199, 4 204.2, 4 217.5 C 4 228.5, 3.6 231.9, 2.0 236.2 C -0.4 242.7, -0.7 251.5, 1.5 250.6 C 2.3 250.3, 3 250.4, 3 250.8 C 3 251.3, 3.5 251.7, 4.2 251.8 C 4.9 251.8, 8.4 252.6, 12 253.4 C 15.5 254.2, 21.5 255.2, 25.2 255.5 L 32 256.2 32 260.6 C 32 264.3, 32.3 265, 34 265 C 35.7 265, 36 264.3, 36 260.5 C 36 256.9, 36.3 256.1, 37.5 256.6 C 38.3 256.9, 39 258.4, 39 260.1 C 39 264.0, 41.7 265, 53.5 265 L 63 265 63 273.3 L 63 281.7 77.2 282.4 C 85.0 282.8, 104.7 282.9, 121 282.8 C 149.5 282.5, 163.6 283.1, 168.5 285.0 C 180.8 289.6, 237.9 289.7, 270 285.0 L 292.5 281.7 319.5 282.4 C 334.3 282.8, 409.9 283.3, 487.5 283.5 C 565.0 283.7, 648.5 284.4, 673 285.0 C 697.4 285.6, 728.9 286.0, 743 285.8 C 769.5 285.4, 793.5 286.9, 804.5 289.4 C 822.2 293.6, 881.7 294.9, 900.5 291.6 C 910.9 289.7, 911.7 289.6, 921.5 288.5 C 924.8 288.1, 928.2 287.3, 929.2 286.8 C 930.2 286.3, 931.5 286.1, 932.0 286.5 C 932.6 286.9, 933.8 286.5, 934.8 285.7 C 935.7 284.9, 937.1 284.2, 938 284.1 C 941.1 284.0, 946.7 282.2, 949.3 280.5 L 952 278.7 952 251.2 C 952 228.4, 952.2 223.9, 953.3 224.8 C 954.0 225.4, 955.2 228.4, 955.9 231.4 C 957.0 236.5, 957.6 237.3, 962.5 240.7 C 965.4 242.8, 968.0 245.3, 968.1 246.4 C 969.1 252.3, 979.4 252.0, 1004.5 245.6 C 1013.8 243.2, 1028.0 239.6, 1036 237.6 C 1064.6 230.4, 1063.5 231.0, 1066.5 222.5 C 1067.2 220.2, 1068.6 206.7, 1069.9 187 C 1071.1 169.4, 1071.2 82.9, 1070.0 67.5 C 1067.4 34.0, 1064.5 8.9, 1063.0 6 C 1062.5 5.0, 1061.1 4.5, 1059.3 4.7 C 1057.7 4.8, 1048.8 4.8, 1039.5 4.7 C 1004.2 4.3, 996 5.0, 996 8.1 C 996 9.2, 991.2 9.2, 990.5 8.1 C 990.2 7.6, 984.4 7.1, 977.5 7.1 C 970.5 7.0, 963.7 6.4, 962.3 5.9 C 960.9 5.4, 954.4 4.8, 947.8 4.6 L 935.9 4.2 933.5 7.3 C 932.2 9.0, 930.1 12.9, 928.7 16 C 927.3 19.0, 923.4 27.1, 920.1 34.1 C 914.0 46.8, 914 46.8, 914 55.9 L 914 65 910.5 65 C 908.7 65, 907.0 64.5, 906.8 63.9 C 906.5 63.2, 899.7 62.4, 889.0 61.9 C 876.6 61.2, 870.9 60.5, 869.3 59.4 C 868.0 58.6, 865.8 58, 864.3 58 C 862.8 58, 860.2 57.5, 858.5 57.0 C 844.1 52.6, 838.0 51, 836.1 51 C 834.9 51, 834 50.6, 834 50.1 C 834 49.6, 831.1 48.4, 827.7 47.4 C 824.3 46.4, 821.0 45.2, 820.5 44.8 C 820.0 44.3, 818.3 44, 816.8 44 C 815.3 44, 813.8 43.5, 813.5 43.0 C 813.2 42.5, 811.1 41.8, 809 41.5 C 806.8 41.1, 804.7 40.4, 804.4 39.9 C 804.1 39.4, 803.0 39, 801.9 39 C 800.8 39, 799.1 38.6, 798.2 38.1 C 797.2 37.6, 790.8 35.4, 784 33.1 C 768.1 28.0, 762.0 25.9, 759.5 24.8 C 753.9 22.6, 728.3 14.5, 720 12.4 C 703.0 8.2, 678.7 5.4, 629 1.9 C 604.5 0.2, 569.3 0.0, 545 1.4" fill="url(#b)"/>
<path d="M60,146 Q500,131 1030,112 L1030,155 Q500,174 60,187 Z" fill="url(#hl)"/>
<path d="M290,225 L830,225 L830,232 L290,232 Z" fill="#1a0404"/>
<path d="M396,85 Q439,41 487,16 L636,9 636,95 450,95 Z" fill="url(#g)"/>
<path d="M648,10 718,18 Q750,37 756,56 L728,91 648,91 Z" fill="url(#g)"/>
<path d="M487,16 557,11 L503,80 Z" fill="#ffffff" opacity="0.18"/>
<path d="M632,95 677,98 677,133 643,128 Z" fill="#120404"/>
<path d="M643,187 718,187 718,217 664,214 Z" fill="#120404"/>
<path d="M32,217 107,198 107,189 32,208 Z" fill="#120404"/>
<rect x="13" y="189" width="20" height="8" rx="2" fill="#f0a020"/>
<path d="M353,80 381,80 381,65 360,65 Z" fill="#1a1a1a"/>
<g stroke="#2a0404" stroke-width="4" fill="none">
  <line x1="336" y1="112" x2="336" y2="257"/>
  <line x1="630" y1="95" x2="630" y2="257"/>
</g>
<g fill="#160404">
  <rect x="1001" y="101" width="6" height="50" rx="2"/><rect x="1013" y="101" width="6" height="50" rx="2"/>
  <rect x="1025" y="101" width="6" height="50" rx="2"/><rect x="1037" y="101" width="6" height="50" rx="2"/>
</g>
<g stroke="#1a0606" stroke-width="5">
  <line x1="771" y1="31" x2="900" y2="58"/><line x1="782" y1="39" x2="900" y2="67"/>
</g>
<path d="M937,13 1044,11 1044,5 937,7 Z" fill="#ff8a76"/>
<rect x="1060" y="123" width="10" height="26" fill="#ff3a30"/>
<use href="#wheel" x="218" y="215"/>
<use href="#wheel" x="857" y="215"/>
</svg>`;

// Traseira: viewBox 1000 x 530 (altura = 0,53 da largura), chão em y = 530
export const F40_REAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 530">
<defs>
  <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ff4a3a"/><stop offset="0.5" stop-color="#d81c18"/><stop offset="1" stop-color="#8a0c0c"/>
  </linearGradient>
  <linearGradient id="cov" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f2f4f6"/><stop offset="1" stop-color="#a4a9ae"/>
  </linearGradient>
  <radialGradient id="amb" cx="0.4" cy="0.38" r="0.65"><stop offset="0" stop-color="#ffe2a0"/><stop offset="0.45" stop-color="#f09a30"/><stop offset="1" stop-color="#9a4a0a"/></radialGradient>
  <radialGradient id="red" cx="0.4" cy="0.38" r="0.65"><stop offset="0" stop-color="#ff9a80"/><stop offset="0.45" stop-color="#e02818"/><stop offset="1" stop-color="#7a0606"/></radialGradient>
  <radialGradient id="pipe" cx="0.4" cy="0.4" r="0.6"><stop offset="0" stop-color="#d0d0d4"/><stop offset="1" stop-color="#5a5a5e"/></radialGradient>
  <pattern id="mesh" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#141414"/><circle cx="4" cy="4" r="2" fill="#262626"/></pattern>
</defs>
<rect x="50" y="456" width="150" height="74" rx="12" fill="#111"/><rect x="800" y="456" width="150" height="74" rx="12" fill="#111"/>
<rect x="60" y="16" width="880" height="127" fill="#0b0b10"/>
<path d="M240,44 Q500,30 760,44 L822,134 L178,134 Z" fill="url(#cov)"/>
<g fill="#151515">
  <rect x="300" y="54" width="186" height="8" rx="4"/><rect x="295" y="68" width="191" height="8" rx="4"/><rect x="290" y="82" width="196" height="8" rx="4"/>
  <rect x="285" y="96" width="201" height="8" rx="4"/><rect x="280" y="110" width="206" height="8" rx="4"/>
  <rect x="514" y="54" width="186" height="8" rx="4"/><rect x="514" y="68" width="191" height="8" rx="4"/><rect x="514" y="82" width="196" height="8" rx="4"/>
  <rect x="514" y="96" width="201" height="8" rx="4"/><rect x="514" y="110" width="206" height="8" rx="4"/>
</g>
<path d="M18,132 L982,132 L985,322 L15,322 Z" fill="url(#b)"/>
<rect x="18" y="132" width="964" height="7" fill="#ff7a68"/>
<rect x="40" y="172" width="920" height="146" rx="14" fill="url(#mesh)"/>
<rect x="380" y="210" width="240" height="66" rx="5" fill="#070707"/>
<circle cx="100" cy="246" r="50" fill="#1a0404"/><circle cx="100" cy="246" r="45" fill="url(#amb)"/>
<circle cx="205" cy="246" r="50" fill="#1a0404"/><circle cx="205" cy="246" r="45" fill="url(#red)"/>
<circle cx="795" cy="246" r="50" fill="#1a0404"/><circle cx="795" cy="246" r="45" fill="url(#red)"/>
<circle cx="900" cy="246" r="50" fill="#1a0404"/><circle cx="900" cy="246" r="45" fill="url(#amb)"/>
<path d="M15,322 L985,322 L978,468 Q950,482 900,480 L100,480 Q50,482 22,468 Z" fill="url(#b)"/>
<rect x="15" y="322" width="970" height="8" fill="#3a0404"/>
<rect x="75" y="368" width="92" height="30" rx="4" fill="#b8200a"/><rect x="80" y="372" width="40" height="8" fill="#ff7a50"/>
<rect x="833" y="368" width="92" height="30" rx="4" fill="#b8200a"/><rect x="838" y="372" width="40" height="8" fill="#ff7a50"/>
<rect x="408" y="406" width="184" height="42" rx="21" fill="#151515"/>
<ellipse cx="452" cy="427" rx="20" ry="15" fill="url(#pipe)"/><ellipse cx="452" cy="427" rx="11" ry="8" fill="#1a1a1a"/>
<ellipse cx="500" cy="427" rx="18" ry="15" fill="url(#pipe)"/><ellipse cx="500" cy="427" rx="10" ry="8" fill="#1a1a1a"/>
<ellipse cx="548" cy="427" rx="20" ry="15" fill="url(#pipe)"/><ellipse cx="548" cy="427" rx="11" ry="8" fill="#1a1a1a"/>
<rect x="70" y="480" width="860" height="14" fill="#0a0a0a"/>
<path d="M0,0 L72,0 L114,162 L40,162 Z" fill="url(#b)"/><path d="M1000,0 L928,0 L886,162 L960,162 Z" fill="url(#b)"/>
<rect x="0" y="0" width="1000" height="26" rx="4" fill="#e02a20"/><rect x="0" y="0" width="1000" height="6" fill="#ff7a68"/>
<rect x="0" y="20" width="1000" height="6" fill="#7a0808"/>
</svg>`;

// Volante Momo de 3 raios: viewBox 200 x 200, centro em (100, 100)
export const F40_WHEEL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs>
  <linearGradient id="r" x1="0.15" y1="0.1" x2="0.85" y2="0.9">
    <stop offset="0" stop-color="#6e7078"/><stop offset="0.35" stop-color="#1e1e22"/><stop offset="1" stop-color="#0a0a0c"/>
  </linearGradient>
  <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8a8c94"/><stop offset="1" stop-color="#3a3b40"/>
  </linearGradient>
  <radialGradient id="y" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#fff6a0"/><stop offset="0.5" stop-color="#f0c814"/><stop offset="1" stop-color="#9a7a08"/></radialGradient>
</defs>
<path d="M88,95 L10,92 L10,109 L88,108 Z" fill="url(#s)"/>
<path d="M112,95 L190,92 L190,109 L112,108 Z" fill="url(#s)"/>
<path d="M93,112 L88,192 L112,192 L107,112 Z" fill="url(#s)"/>
<g fill="#16161a">
  <rect x="34" y="97" width="34" height="6" rx="3"/><rect x="132" y="97" width="34" height="6" rx="3"/><rect x="97" y="140" width="6" height="34" rx="3"/>
</g>
<circle cx="100" cy="100" r="92" fill="none" stroke="url(#r)" stroke-width="14"/>
<path d="M26,58 A86,86 0 0 1 82,15" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="3" stroke-linecap="round"/>
<circle cx="100" cy="100" r="25" fill="#121216"/>
<g fill="#8a8c94">
  <circle cx="100" cy="81" r="2.5"/><circle cx="116.5" cy="90.5" r="2.5"/><circle cx="116.5" cy="109.5" r="2.5"/>
  <circle cx="100" cy="119" r="2.5"/><circle cx="83.5" cy="109.5" r="2.5"/><circle cx="83.5" cy="90.5" r="2.5"/>
</g>
<circle cx="100" cy="100" r="14" fill="url(#y)" stroke="#8a6c08" stroke-width="2"/>
<rect x="98" y="93" width="4" height="13" rx="1" fill="#1a1a1a"/>
</svg>`;
