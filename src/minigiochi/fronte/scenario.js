/* =====================================================================
   THE BORG - FRONTE DELLA COMETA: le mappe in 3D.
   Ogni struttura delle regole (casa, torre, muro, cassa, roccia...) diventa
   qualche pezzo semplice; i pezzi uguali sono disegnati tutti insieme
   (InstancedMesh), cosi' anche la valle di Ultima Luce resta leggera sul telefono.
   Stile del borgo: colori pieni, ombre a toni.
   B3.FronteScenario.costruisci(scena, mappa) -> { anim(t), minimappa }
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, PI = Math.PI;

  // geometrie unitarie (si scalano per ogni pezzo)
  let GEO = null;
  function geo() {
    if (GEO) return GEO;
    const tetto = new T.BufferGeometry();   // prisma triangolare: base 1 x 1, alto 1, colmo lungo z
    const v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5];
    const idx = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
    const pos = []; idx.forEach(i => pos.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]));
    tetto.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tetto.computeVertexNormals();
    const pir = new T.ConeGeometry(0.7071, 1, 4, 1); pir.rotateY(PI / 4); pir.translate(0, 0.5, 0);
    const cil = new T.CylinderGeometry(0.5, 0.5, 1, 14); cil.translate(0, 0.5, 0);
    const cono = new T.ConeGeometry(0.5, 1, 8); cono.translate(0, 0.5, 0);
    const box = new T.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const ruota = new T.CylinderGeometry(0.5, 0.5, 1, 14); ruota.rotateZ(PI / 2);
    const roccia = new T.IcosahedronGeometry(0.5, 1); roccia.translate(0, 0.35, 0);
    const p = roccia.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.82 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } roccia.computeVertexNormals();
    const sfera = new T.SphereGeometry(0.5, 12, 9); sfera.translate(0, 0.5, 0);
    return (GEO = { box, cil, cono, tetto, pir, ruota, roccia, sfera });
  }

  /* raccoglie i pezzi e alla fine crea una InstancedMesh per ogni geometria + materiale */
  function lotti() {
    const L = {}, mt = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), pv = new T.Vector3(), sv = new T.Vector3(), col = new T.Color();
    const add = (g, m, x, y, z, sx, sy, sz, ry, colore, rx, rz) => {
      const k = g + '|' + m; (L[k] = L[k] || { g, m, l: [] }).l.push([x, y, z, sx, sy, sz, ry || 0, colore, rx || 0, rz || 0]);
    };
    add.chiudi = scena => {
      const gm = B.M('#fff').gradientMap, G = geo(), out = [];
      const MAT = {
        toon: () => new T.MeshToonMaterial({ color: 0xffffff, gradientMap: gm }),
        luce: () => new T.MeshBasicMaterial({ color: 0xffffff }),
        vetro: () => new T.MeshToonMaterial({ color: 0xffffff, gradientMap: gm, emissive: new T.Color('#2a3550'), emissiveIntensity: 0.5 })
      };
      Object.keys(L).forEach(k => {
        const lo = L[k], n = lo.l.length, im = new T.InstancedMesh(G[lo.g], MAT[lo.m](), n);
        lo.l.forEach((p, i) => {
          pv.set(p[0], p[1], p[2]); sv.set(p[3], p[4], p[5]); e.set(p[8], p[6], p[9], 'YXZ'); q.setFromEuler(e);
          mt.compose(pv, q, sv); im.setMatrixAt(i, mt); im.setColorAt(i, col.set(p[7]));
        });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; scena.add(im); out.push(im);   // three r150: niente sfera d'ingombro per le istanze
      });
      return out;
    };
    return add;
  }

  // varieta' ripetibile: lo stesso pezzo ha sempre lo stesso colore
  const h = (i, k) => { const s = Math.sin(i * 127.1 + (k || 0) * 311.7) * 43758.5453; return s - Math.floor(s); };
  const pick = (l, i, k) => l[Math.floor(h(i, k) * l.length)];
  const PIETRA = ['#e3d2b4', '#d9c3a1', '#cdb594', '#e8dcc4', '#d4bc98'], TEGOLE = ['#b9573f', '#a84b39', '#c46a48', '#9c4a3a'];
  const LEGNO = '#9a6a3e', LEGNO_S = '#6b4326', FERRO = '#4c5058';

  /* ---------- le ricette: come si disegna ogni tipo di struttura ---------- */
  function finestre(add, s, y, lato, salta) {
    const lungo = lato === 'z' ? s.w : s.d, n = Math.max(1, Math.floor(lungo / 2.6));
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n - 0.5; if (salta && Math.abs(u) < 0.18) continue;
      [-1, 1].forEach(sg => {
        if (lato === 'z') { const x = s.x + u * s.w, z = sg > 0 ? s.z1 : s.z0; add('box', 'toon', x, y - 0.55, z, 1.0, 1.1, 0.1, 0, '#f4ecdf'); add('box', 'vetro', x, y - 0.47, z + sg * 0.04, 0.78, 0.94, 0.08, 0, '#3f5277'); }
        else { const z = s.z + u * s.d, x = sg > 0 ? s.x1 : s.x0; add('box', 'toon', x, y - 0.55, z, 0.1, 1.1, 1.0, 0, '#f4ecdf'); add('box', 'vetro', x + sg * 0.04, y - 0.47, z, 0.08, 0.94, 0.78, 0, '#3f5277'); }
      });
    }
  }
  const RICETTE = {
    casa(add, s) {
      const c = pick(PIETRA, s.i), lungoZ = s.d > s.w;
      add('box', 'toon', s.x, 0, s.z, s.w, s.h, s.d, 0, c);
      add('box', 'toon', s.x, 0, s.z, s.w + 0.12, 0.5, s.d + 0.12, 0, '#8f7a62');                  // zoccolo
      add('box', 'toon', s.x, s.h - 0.05, s.z, s.w + 0.5, 0.18, s.d + 0.5, 0, '#f1e6d2');           // cornicione
      add('tetto', 'toon', s.x, s.h + 0.1, s.z, (lungoZ ? s.w : s.d) + 0.6, 1.4 + Math.min(s.w, s.d) * 0.12, (lungoZ ? s.d : s.w) + 0.6, lungoZ ? 0 : PI / 2, pick(TEGOLE, s.i, 2));
      add('box', 'toon', s.x + s.w * 0.25, s.h + 0.4, s.z + s.d * 0.15, 0.6, 1.5, 0.6, 0, '#8f7a62');   // comignolo
      add('box', 'toon', s.x, 0, s.z1 + 0.03, 1.15, 2.15, 0.14, 0, LEGNO_S);                          // porta
      add('box', 'toon', s.x, 0, s.z0 - 0.03, 1.15, 2.15, 0.14, 0, LEGNO_S);
      finestre(add, s, s.h * 0.68 + 0.4, 'z', true); finestre(add, s, s.h * 0.68 + 0.4, 'x', false);
      if (s.h > 4.8) finestre(add, s, 2.2, 'x', false);
    },
    torre(add, s) {
      const c = pick(PIETRA, s.i);
      add('box', 'toon', s.x, 0, s.z, s.w, s.h, s.d, 0, c);
      add('box', 'toon', s.x, 0, s.z, s.w + 0.2, 0.7, s.d + 0.2, 0, '#8f7a62');
      add('box', 'toon', s.x, s.h - 0.25, s.z, s.w + 0.4, 0.3, s.d + 0.4, 0, '#f1e6d2');
      add('pir', 'toon', s.x, s.h, s.z, s.w + 0.7, Math.max(2, s.w * 0.9), s.d + 0.7, 0, pick(TEGOLE, s.i, 3));
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([a, b]) => {
        add('box', 'luce', s.x + a * (s.w / 2 + 0.02), s.h - 2.2, s.z + b * (s.d / 2 + 0.02), a ? 0.08 : 0.9, 1.3, b ? 0.08 : 0.9, 0, '#2a2030');   // cella campanaria
        add('cil', 'toon', s.x + a * (s.w / 2), s.h - 4.2, s.z + b * (s.d / 2), 0.95, 0.06, 0.95, a ? a * PI / 2 : (b > 0 ? 0 : PI), '#3a3040', PI / 2);   // orologio
        add('cil', 'toon', s.x + a * (s.w / 2 + 0.03), s.h - 4.2, s.z + b * (s.d / 2 + 0.03), 0.8, 0.05, 0.8, a ? a * PI / 2 : (b > 0 ? 0 : PI), '#efe6d2', PI / 2);
      });
      add('box', 'toon', s.x, 0, s.z1 + 0.03, 1.1, 2.2, 0.14, 0, LEGNO_S);
    },
    muro(add, s) { add('box', 'toon', s.x, 0, s.z, s.w, s.h, s.d, 0, pick(PIETRA, s.i, 4)); add('box', 'toon', s.x, s.h, s.z, s.w + 0.14, 0.14, s.d + 0.14, 0, '#f1e6d2'); },
    muretto(add, s) { add('box', 'toon', s.x, 0, s.z, s.w, s.h, s.d, 0, pick(PIETRA, s.i, 5)); add('box', 'toon', s.x, s.h, s.z, s.w + 0.16, 0.12, s.d + 0.16, 0, '#efe2c8'); },
    carro(add, s) {
      const lx = s.w >= s.d, L = lx ? s.w : s.d, W = lx ? s.d : s.w, ry = lx ? 0 : PI / 2;
      const P = (u, v) => lx ? [s.x + u, s.z + v] : [s.x + v, s.z + u];
      add('box', 'toon', s.x, 0.62, s.z, s.w, 0.5, s.d, 0, LEGNO);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => { const p = P(a * (L / 2 - 0.5), b * (W / 2 + 0.05)); add('ruota', 'toon', p[0], 0.55, p[1], 0.18, 1.1, 1.1, ry, LEGNO_S); });
      for (let k = 0; k < 3; k++) { const p = P((k - 1) * L * 0.28, 0); add('sfera', 'toon', p[0], 1.05, p[1], L * 0.3, 0.6, W * 0.7, ry, k % 2 ? '#d8c08a' : '#e6cf96'); }
    },
    bancarella(add, s) {
      add('box', 'toon', s.x, 0, s.z, s.w, 1.0, s.d, 0, LEGNO);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => add('box', 'toon', s.x + a * (s.w / 2 - 0.08), 0, s.z + b * (s.d / 2 - 0.08), 0.1, 2.35, 0.1, 0, LEGNO_S));
      const n = 5, c1 = pick(['#d94a4a', '#3f8cff', '#2fae6e', '#e8a93a'], s.i);
      for (let k = 0; k < n; k++) { const lx = s.w >= s.d; const u = (k + 0.5) / n - 0.5; add('box', 'toon', s.x + (lx ? u * (s.w + 0.4) : 0), 2.3, s.z + (lx ? 0 : u * (s.d + 0.4)), lx ? (s.w + 0.4) / n : s.w + 0.5, 0.12, lx ? s.d + 0.5 : (s.d + 0.4) / n, 0, k % 2 ? '#fff6e6' : c1); }
      for (let k = 0; k < 4; k++) add('sfera', 'toon', s.x + (h(s.i, k) - 0.5) * s.w * 0.7, 1.0, s.z + (h(s.i, k + 9) - 0.5) * s.d * 0.6, 0.32, 0.28, 0.32, 0, pick(['#e8613a', '#f2c040', '#8cc152', '#d94a7a'], s.i, k));
    },
    cassa(add, s) { add('box', 'toon', s.x, 0, s.z, s.w, s.h, s.d, h(s.i) * 0.3, '#b8834a'); add('box', 'toon', s.x, s.h * 0.15, s.z, s.w + 0.04, 0.1, s.d + 0.04, h(s.i) * 0.3, '#7a5230'); add('box', 'toon', s.x, s.h * 0.78, s.z, s.w + 0.04, 0.1, s.d + 0.04, h(s.i) * 0.3, '#7a5230'); },
    casse(add, s) {
      add('box', 'toon', s.x, 0, s.z, s.w, s.h * 0.55, s.d, 0, '#b8834a'); add('box', 'toon', s.x, s.h * 0.27, s.z, s.w + 0.04, 0.1, s.d + 0.04, 0, '#7a5230');
      add('box', 'toon', s.x + 0.1, s.h * 0.55, s.z - 0.05, s.w * 0.8, s.h * 0.45, s.d * 0.8, 0.4, '#c69356'); add('box', 'toon', s.x + 0.1, s.h * 0.75, s.z - 0.05, s.w * 0.82, 0.08, s.d * 0.82, 0.4, '#7a5230');
    },
    botte(add, s) { add('cil', 'toon', s.x, 0, s.z, s.r * 2, s.h, s.r * 2, 0, '#9a6236'); [0.18, 0.82].forEach(f => add('cil', 'toon', s.x, s.h * f - 0.04, s.z, s.r * 2.06, 0.08, s.r * 2.06, 0, '#3a3540')); },
    albero(add, s) {
      add('cil', 'toon', s.x, 0, s.z, s.r * 1.4, s.h * 0.45, s.r * 1.4, 0, '#7a4e2e');
      const pino = h(s.i, 7) < 0.4, v = ['#4d9a4f', '#5aa957', '#3f8a46', '#68b25d'];
      if (pino) { for (let k = 0; k < 3; k++) add('cono', 'toon', s.x, s.h * (0.3 + k * 0.2), s.z, 3.2 - k * 0.8, s.h * 0.38, 3.2 - k * 0.8, 0, pick(v, s.i, k)); }
      else { add('sfera', 'toon', s.x, s.h * 0.38, s.z, 3.4, 2.8, 3.4, 0, pick(v, s.i)); add('sfera', 'toon', s.x + 0.5, s.h * 0.58, s.z - 0.3, 2.5, 2.2, 2.5, 0, pick(v, s.i, 1)); add('sfera', 'toon', s.x - 0.6, s.h * 0.5, s.z + 0.5, 2.0, 1.8, 2.0, 0, pick(v, s.i, 2)); }
    },
    lampione(add, s) { add('cil', 'toon', s.x, 0, s.z, 0.18, s.h, 0.18, 0, '#2c2431'); add('cil', 'toon', s.x, 0, s.z, 0.5, 0.3, 0.5, 0, '#2c2431'); add('box', 'luce', s.x, s.h - 0.15, s.z, 0.42, 0.5, 0.42, 0, '#ffe2a0'); add('pir', 'toon', s.x, s.h + 0.35, s.z, 0.6, 0.35, 0.6, 0, '#2c2431'); },
    roccia(add, s) { add('roccia', 'toon', s.x, -0.15, s.z, s.r * 2.2, s.h * 1.25, s.r * 2.2, h(s.i) * 6, pick(['#9a8a7a', '#8b7d70', '#a8998a', '#7f7468'], s.i)); if (s.r > 1.5) add('roccia', 'toon', s.x + s.r * 0.6, -0.1, s.z - s.r * 0.4, s.r * 1.1, s.h * 0.6, s.r * 1.1, h(s.i, 2) * 6, '#8b7d70'); },
    capanno(add, s) {
      add('box', 'toon', s.x, 0, s.z, s.w, s.h, s.d, 0, '#a07446');
      for (let k = 0; k < 5; k++) add('box', 'toon', s.x, 0.35 + k * 0.65, s.z1 + 0.02, s.w, 0.06, 0.05, 0, '#7a5230');
      add('box', 'toon', s.x, s.h - 0.1, s.z, s.w + 0.6, 0.18, s.d + 0.8, 0, '#5d5a62', 0.12);
      add('box', 'toon', s.x, 0, s.z1 + 0.04, 1.1, 2.1, 0.1, 0, LEGNO_S);
      add('box', 'luce', s.x + s.w * 0.3, s.h - 1.1, s.z1 + 0.05, 0.8, 0.6, 0.05, 0, '#ffd27a');
    },
    silo(add, s) {
      add('cil', 'toon', s.x, 0, s.z, s.w * 1.04, s.h, s.d * 1.04, 0, '#8a9097'); add('cono', 'toon', s.x, s.h, s.z, s.w * 1.1, 1.4, s.d * 1.1, 0, '#6d737b');
      for (let k = 1; k < 5; k++) add('cil', 'toon', s.x, s.h * k / 5, s.z, s.w * 1.08, 0.1, s.d * 1.08, 0, '#5d6269');
      [-0.22, 0.22].forEach(o => add('box', 'toon', s.x + o, 0, s.z1 + 0.12, 0.05, s.h, 0.05, 0, '#3a3540')); for (let y = 0.4; y < s.h; y += 0.45) add('box', 'toon', s.x, y, s.z1 + 0.12, 0.44, 0.04, 0.04, 0, '#3a3540');
    },
    carrello(add, s) {
      add('box', 'toon', s.x, 0.3, s.z, s.w, s.h - 0.3, s.d, 0, '#8a5a3a'); add('box', 'toon', s.x, s.h - 0.08, s.z, s.w + 0.08, 0.1, s.d + 0.08, 0, '#4c5058');
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => add('ruota', 'toon', s.x + a * (s.w / 2 + 0.02), 0.22, s.z + b * (s.d / 2 - 0.35), 0.1, 0.44, 0.44, 0, FERRO));
      for (let k = 0; k < 4; k++) add('roccia', 'luce', s.x + (h(s.i, k) - 0.5) * s.w * 0.6, s.h - 0.25, s.z + (h(s.i, k + 3) - 0.5) * s.d * 0.6, 0.35, 0.35, 0.35, k, '#7fe8ff');
    },
    impalcatura(add, s) {
      const lx = s.w >= s.d, L = lx ? s.w : s.d, n = Math.round(L / 1.3);
      for (let k = 0; k <= n; k++) { const u = k / n - 0.5; add('box', 'toon', s.x + (lx ? u * L : 0), 0, s.z + (lx ? 0 : u * L), 0.14, s.h + 0.4, 0.14, 0, LEGNO_S); }
      for (let y = 0.2; y < s.h; y += 0.36) add('box', 'toon', s.x, y, s.z, lx ? s.w : s.w * 0.7, 0.3, lx ? s.d * 0.7 : s.d, 0, h(s.i, y * 10) < 0.5 ? '#b8834a' : '#a87542');
    },
    cristallo(add, s) {
      add('roccia', 'toon', s.x, -0.1, s.z, s.r * 2.2, 0.8, s.r * 2.2, 0, '#5a5068');
      for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2 + h(s.i, k); add('cono', 'luce', s.x + Math.cos(a) * s.r * 0.35, 0.1, s.z + Math.sin(a) * s.r * 0.35, 0.36, s.h * (0.6 + h(s.i, k + 2) * 0.4), 0.36, a, k % 2 ? '#8af0ff' : '#c6a6ff', Math.cos(a) * 0.35, Math.sin(a) * 0.35); }
    },
    sacchi(add, s) {
      const lx = s.w >= s.d, L = lx ? s.w : s.d, n = Math.round(L / 0.7);
      for (let r = 0; r < 3; r++) for (let k = 0; k < n - (r % 2); k++) { const u = (k + 0.5 + (r % 2) * 0.5) / n - 0.5; add('sfera', 'toon', s.x + (lx ? u * L : 0), r * 0.32, s.z + (lx ? 0 : u * L), lx ? 0.78 : s.w * 1.05, 0.4, lx ? s.d * 1.05 : 0.78, 0, pick(['#c9b07a', '#bba06c', '#d3bd88'], s.i, r * 10 + k)); }
    },
    frammento(add, s) {
      add('cil', 'toon', s.x, -0.05, s.z, s.r * 3.4, 0.1, s.r * 3.4, 0, '#6a5240');
      add('roccia', 'toon', s.x, -0.2, s.z, s.r * 2.1, s.h * 1.6, s.r * 2.1, 0.7, '#3a3346');
      for (let k = 0; k < 7; k++) { const a = k / 7 * PI * 2; add('roccia', 'luce', s.x + Math.cos(a) * s.r * 0.7, 0.2 + h(s.i, k) * s.h * 0.8, s.z + Math.sin(a) * s.r * 0.7, 0.5, 0.7, 0.5, a, k % 2 ? '#ffe9a8' : '#9fe9ff'); }
      add('sfera', 'luce', s.x, s.h * 0.95, s.z, 0.9, 0.9, 0.9, 0, '#fff4c8');
    }
  };

  /* ---------- terreno ---------- */
  function texTerreno(mp) {
    const S = 1024, [cv, x] = B.tela(S, S), W = 2 * mp.AX, H = 2 * mp.AZ, kx = S / W, kz = S / H;
    const X = v => (v + mp.AX) * kx, Z = v => (v + mp.AZ) * kz;
    if (mp.id === 'borgo') {
      x.fillStyle = '#8f7d63'; x.fillRect(0, 0, S, S);
      const cols = ['#b39e7c', '#a99372', '#bba684', '#a08a6a'];
      for (let r = 0; r < 64; r++) for (let q = 0; q < 64; q++) { x.fillStyle = cols[(Math.random() * 4) | 0]; B.rr(x, q * 16 + (r % 2) * 8 + 1, r * 16 + 1, 14, 14, 4); x.fill(); }
      x.fillStyle = 'rgba(120,150,80,.5)'; for (let i = 0; i < 300; i++) { x.beginPath(); x.ellipse(Math.random() * S, Math.random() * S, 4 + Math.random() * 8, 2, 0, 0, 7); x.fill(); }
      x.strokeStyle = 'rgba(255,250,235,.55)'; x.lineWidth = 6; x.beginPath(); x.arc(X(0), Z(0), 5 * kx, 0, 7); x.stroke();
    } else if (mp.id === 'cava') {
      x.fillStyle = '#a7815e'; x.fillRect(0, 0, S, S);
      for (let i = 0; i < 4000; i++) { x.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,240,220' : '90,60,40') + ',' + (0.05 + Math.random() * 0.08) + ')'; x.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 6, 2 + Math.random() * 4); }
      // binari: dalla base ovest alla base est, curvando intorno al frammento
      [-1, 1].forEach(sg => { x.strokeStyle = '#5d4632'; x.lineWidth = 3; for (let k = -1; k <= 1; k += 2) { x.beginPath(); for (let u = -mp.AX; u <= mp.AX; u += 1) { const v = sg * (9 + Math.cos(u / 9) * 2) + k * 0.6; u === -mp.AX ? x.moveTo(X(u), Z(v)) : x.lineTo(X(u), Z(v)); } x.stroke(); }
        x.fillStyle = '#7a5a3e'; for (let u = -mp.AX; u <= mp.AX; u += 1.1) { const v = sg * (9 + Math.cos(u / 9) * 2); x.fillRect(X(u) - 2, Z(v) - 1.1 * kz, 4, 2.2 * kz); } });
      const g = x.createRadialGradient(X(0), Z(0), 0, X(0), Z(0), 7 * kx); g.addColorStop(0, 'rgba(40,30,50,.55)'); g.addColorStop(1, 'rgba(40,30,50,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    } else {
      x.fillStyle = mp.terra; x.fillRect(0, 0, S, S);
      for (let i = 0; i < 9000; i++) { x.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '200,230,140' : '60,90,40') + ',' + (0.06 + Math.random() * 0.1) + ')'; x.fillRect(Math.random() * S, Math.random() * S, 2, 3 + Math.random() * 4); }
      // sentieri tra i villaggi e piazzette di terra battuta
      const V = mp.villaggi || []; x.strokeStyle = 'rgba(190,160,110,.85)'; x.lineWidth = 3.2 * kx; x.lineCap = 'round';
      V.forEach((v, i) => { const w = V[(i + 1) % V.length]; x.beginPath(); x.moveTo(X(v.x), Z(v.z)); x.quadraticCurveTo(X((v.x + w.x) / 2 + 8), Z((v.z + w.z) / 2 - 8), X(w.x), Z(w.z)); x.stroke(); });
      V.forEach(v => { const g = x.createRadialGradient(X(v.x), Z(v.z), 2, X(v.x), Z(v.z), 16 * kx); g.addColorStop(0, 'rgba(205,180,135,.95)'); g.addColorStop(1, 'rgba(205,180,135,0)'); x.fillStyle = g; x.beginPath(); x.arc(X(v.x), Z(v.z), 16 * kx, 0, 7); x.fill(); });
    }
    return B.tex(cv);
  }

  /* ---------- fuori dal campo: case, siepi o rocce di confine e montagne lontane ---------- */
  function contorno(add, mp, R) {
    const A = mp.AX, C = mp.AZ;
    if (mp.id === 'ultima') {
      for (let i = 0; i < 70; i++) { const a = i / 70 * PI * 2, d = A * 1.42 + R() * 30; add('cono', 'toon', Math.cos(a) * d, -2, Math.sin(a) * d, 40 + R() * 40, 25 + R() * 30, 40 + R() * 40, 0, pick(['#6f8f5a', '#7d9c63', '#5f7f52'], i)); }
      for (let i = 0; i < 160; i++) { const a = R() * PI * 2, d = A + 3 + R() * 20, x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(x) < A + 2 && Math.abs(z) < A + 2) continue; add('cono', 'toon', x, 0, z, 3.4, 7 + R() * 3, 3.4, 0, pick(['#3f8a46', '#4d9a4f'], i)); }
      // staccionata sul bordo della valle
      for (let u = -A; u <= A; u += 3) [[u, -A - 0.5], [u, A + 0.5], [-A - 0.5, u], [A + 0.5, u]].forEach(([x, z]) => add('box', 'toon', x, 0, z, 0.15, 1.1, 0.15, 0, LEGNO_S));
      [[0, -A - 0.5, 2 * A, 0.1], [0, A + 0.5, 2 * A, 0.1], [-A - 0.5, 0, 0.1, 2 * A], [A + 0.5, 0, 0.1, 2 * A]].forEach(([x, z, w, d]) => { add('box', 'toon', x, 0.75, z, w, 0.1, d, 0, LEGNO); add('box', 'toon', x, 0.35, z, w, 0.1, d, 0, LEGNO); });
      return;
    }
    if (mp.id === 'borgo') {
      // facciate di case tutto intorno: il borgo continua oltre il campo
      const fila = (x0, x1, z, lato) => { for (let x = x0; x < x1;) { const w = 5 + R() * 3, hh = 5 + R() * 3.5, s = { i: (x * 7 + z) | 0, x: x + w / 2, z: z + lato * 3.2, w, d: 6, h: hh }; s.x0 = s.x - w / 2; s.x1 = s.x + w / 2; s.z0 = s.z - 3; s.z1 = s.z + 3; RICETTE.casa(add, s); x += w + 0.2; } };
      fila(-A - 8, A + 8, -C - 0.4, -1); fila(-A - 8, A + 8, C + 0.4, 1);
      for (let z = -C; z < C;) { const d = 5 + R() * 3, hh = 5 + R() * 3; [-1, 1].forEach(sg => { const s = { i: (z * 13 + sg) | 0, x: sg * (A + 3.6), z: z + d / 2, w: 6, d, h: hh }; s.x0 = s.x - 3; s.x1 = s.x + 3; s.z0 = s.z - d / 2; s.z1 = s.z + d / 2; RICETTE.casa(add, s); }); z += d + 0.2; }
    } else {
      // pareti di roccia della cava
      for (let i = 0; i < 90; i++) { const a = i / 90 * PI * 2, k = Math.max(Math.abs(Math.cos(a)) / A, Math.abs(Math.sin(a)) / C), d = 1 / k + 2 + R() * 3; add('roccia', 'toon', Math.cos(a) * d, -1, Math.sin(a) * d, 6 + R() * 5, 6 + R() * 9, 6 + R() * 5, R() * 6, pick(['#a4826a', '#94735e', '#b28d72'], i)); }
    }
    for (let i = 0; i < 40; i++) { const a = i / 40 * PI * 2, d = Math.max(A, C) * 2.4 + R() * 25; add('cono', 'toon', Math.cos(a) * d, -4, Math.sin(a) * d, 50 + R() * 40, 30 + R() * 40, 50 + R() * 40, 0, pick(['#8d9fb8', '#9aaac0', '#7f92ad'], i)); }
  }

  /* minimappa vista dall'alto (per l'HUD): sfondo e strutture */
  function minimappa(mp, S) {
    const [cv, x] = B.tela(S, S), k = S / (2 * Math.max(mp.AX, mp.AZ)), ox = S / 2, oz = S / 2;
    x.fillStyle = mp.id === 'borgo' ? '#b9a682' : mp.id === 'cava' ? '#b48d68' : '#7c9a5c'; x.fillRect(0, 0, S, S);
    x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, S, oz - mp.AZ * k); x.fillRect(0, oz + mp.AZ * k, S, S); x.fillRect(0, 0, ox - mp.AX * k, S); x.fillRect(ox + mp.AX * k, 0, S, S);
    (B.FronteRegole.strutture(mp)).forEach(s => {
      x.fillStyle = s.tipo === 'albero' ? '#4f8a49' : s.h > 2.2 ? '#4a4252' : '#7d7280';
      if (s.t === 'b') x.fillRect(ox + s.x0 * k, oz + s.z0 * k, (s.x1 - s.x0) * k, (s.z1 - s.z0) * k);
      else { x.beginPath(); x.arc(ox + s.x * k, oz + s.z * k, Math.max(1, s.r * k), 0, 7); x.fill(); }
    });
    return { cv, k, ox, oz };
  }

  function costruisci(scena, mp) {
    const R = B.FronteRegole.caso(((mp.seme || 0) ^ (mp.id.length * 977)) + 13), add = lotti(), gm = B.M('#fff').gradientMap;
    scena.background = B.texCielo(mp.cielo[0], mp.cielo[1]);
    const lontano = mp.id === 'ultima' ? 240 : 140;
    scena.fog = new T.Fog(mp.cielo[1], mp.id === 'ultima' ? 70 : 55, lontano);
    scena.add(new T.HemisphereLight(0xfff4e0, mp.id === 'cava' ? 0x6a4a3a : 0x4f6045, 0.62));
    const sole = new T.DirectionalLight(mp.id === 'cava' ? 0xffd2a8 : 0xfff1d6, 0.62); sole.position.set(-30, 50, 20); scena.add(sole);
    // terreno: il campo disegnato e tutto intorno un prato o la roccia
    const campo = new T.Mesh(new T.PlaneGeometry(2 * mp.AX, 2 * mp.AZ), new T.MeshToonMaterial({ map: texTerreno(mp), gradientMap: gm })); campo.rotation.x = -PI / 2; scena.add(campo);
    const fuori = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshToonMaterial({ color: new T.Color(mp.erba), gradientMap: gm })); fuori.rotation.x = -PI / 2; fuori.position.y = -0.03; scena.add(fuori);
    B.FronteRegole.strutture(mp).forEach(s => { const r = RICETTE[s.tipo]; if (r) r(add, s); });
    contorno(add, mp, R);
    // ciuffi d'erba e fiori qua e la' (non bloccano niente)
    if (mp.id !== 'cava') {
      const n = mp.id === 'ultima' ? 700 : 120;
      for (let i = 0; i < n; i++) {
        const x = (R() * 2 - 1) * mp.AX, z = (R() * 2 - 1) * mp.AZ;
        if (!B.FronteRegole.liberoIn(B.FronteRegole.strutture(mp), mp.AX, mp.AZ, x, z, 0.3)) continue;
        add('cono', 'toon', x, 0, z, 0.35, 0.4 + R() * 0.3, 0.35, 0, pick(['#6aa84f', '#7cb85c', '#5c9a45'], i));
        if (R() < 0.25) add('sfera', 'toon', x + 0.2, 0.25, z, 0.14, 0.14, 0.14, 0, pick(['#f2d14a', '#f28ab0', '#ffffff', '#9ab8ff'], i, 3));
      }
    }
    const mesh = add.chiudi(scena);
    return { mesh, minimappa: S => minimappa(mp, S) };
  }

  B.FronteScenario = { costruisci, minimappa, RICETTE };
})();
