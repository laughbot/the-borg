/* La Cripta del Re Senza Luce: creature scolpite e animate (i nemici).
   Ogni creatura e' una superficie unica scolpita con campi di distanza e legata a uno scheletro di ossa:
   la pelle si piega alle articolazioni (skinning), come nei giochi veri. Le animazioni sono calcolate nel codice:
   fermo, passo e corsa (anche di lato e all'indietro), attacco, colpo subito, morte con dissolvenza in cenere.
   Trucchi da gioco vero: luce d'ambiente "cotta" nei colori dei vertici, due livelli di dettaglio scelti con la distanza,
   geometrie costruite una volta e condivise da tutte le copie dello stesso nemico.
   Interfaccia come modelli.js: { root, anim(t, dt, vel), alt, nome } piu' attacca(k), colpito(f), muori(rapida).
   Richiede ambienti.js (rumore, campi di distanza, mappe di rilievo). Nessuna libreria esterna. */
(function () {
  'use strict';
  const B = window.B3 = window.B3 || {}, T = B.T || window.THREE, PI = Math.PI;
  const K = B.AmbientiRaid && B.AmbientiRaid._kit; if (!T || !K) return;
  const { n3, smin, smax, ellissoide, conoTondo, mappaNormali } = K;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, mix = (a, b, k) => a + (b - a) * k, sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const LATI = [[1, 'L'], [-1, 'R']];   // L e' il lato +x (la sinistra della creatura, che guarda verso +z)

  /* ---------- primitive, ognuna con la sua scatola d'ingombro (lontano dal pezzo non si calcola) ---------- */
  const bbS = (c, r) => [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r];
  const SF = (c, r) => ({ f: (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r, bb: bbS(c, r) });
  const EL = (c, r) => ({ f: (x, y, z) => ellissoide(x, y, z, c[0], c[1], c[2], r[0], r[1], r[2]), bb: [c[0] - r[0], c[1] - r[1], c[2] - r[2], c[0] + r[0], c[1] + r[1], c[2] + r[2]] });
  const CA = (a, b, r1, r2) => {   // cono con estremi tondi da a a b (capsula se r1 = r2)
    if (r2 == null) r2 = r1; const m = Math.max(r1, r2);
    return { f: (x, y, z) => conoTondo(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], r1, r2), bb: [Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.min(a[2], b[2]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, Math.max(a[2], b[2]) + m] };
  };
  const SC = (c, s, r, e) => {   // scatola smussata: semiassi s, raggio di smusso r, rotazione (angoli di Eulero)
    const q = new T.Quaternion().setFromEuler(new T.Euler(e ? e[0] : 0, e ? e[1] : 0, e ? e[2] : 0)).invert(), m = new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(q)).elements;
    return {
      f: (x, y, z) => {
        x -= c[0]; y -= c[1]; z -= c[2];
        const qx = Math.abs(m[0] * x + m[3] * y + m[6] * z) - s[0] + r, qy = Math.abs(m[1] * x + m[4] * y + m[7] * z) - s[1] + r, qz = Math.abs(m[2] * x + m[5] * y + m[8] * z) - s[2] + r;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
      }, bb: bbS(c, Math.hypot(s[0], s[1], s[2]))
    };
  };
  const TO = (c, asse, R, r) => {   // toro intorno a un asse ('x', 'y', 'z')
    const f = asse === 'z' ? (x, y, z) => Math.hypot(Math.hypot(x - c[0], y - c[1]) - R, z - c[2]) - r
      : asse === 'x' ? (x, y, z) => Math.hypot(Math.hypot(y - c[1], z - c[2]) - R, x - c[0]) - r
        : (x, y, z) => Math.hypot(Math.hypot(x - c[0], z - c[2]) - R, y - c[1]) - r;
    return { f, bb: bbS(c, R + r) };
  };
  const XX = (f, bb) => ({ f, bb });
  // guscio: lastra curva ricavata da un ellissoide (spessore t), tenendo solo la parte dove tieni() <= 0
  const GU = (c, r, t, tieni) => ({ f: (x, y, z) => Math.max(Math.abs(ellissoide(x, y, z, c[0], c[1], c[2], r[0], r[1], r[2])) - t, tieni(x, y, z)), bb: [c[0] - r[0] - t, c[1] - r[1] - t, c[2] - r[2] - t, c[0] + r[0] + t, c[1] + r[1] + t, c[2] + r[2] + t] });
  const catena = (S, pts, rs, osso, col, o) => { for (let i = 0; i < pts.length - 1; i++) S.u(CA(pts[i], pts[i + 1], rs[i], rs[i + 1]), osso, col, o); };

  // una scultura e' una lista di pezzi: forma, osso a cui appartiene, colore, raccordo k con il resto, rilievo (dsp)
  function Scultura() {
    const parti = [], s = {
      parti,
      u(pr, osso, col, o) { parti.push(Object.assign({ pr, osso, col, k: 0.03, op: 0, rv: 0.75, mt: 0, lu: 0 }, o)); return s; },   // aggiunge
      s(pr, o) { parti.push(Object.assign({ pr, k: 0.006, op: 1, rv: 0.8, mt: 0, lu: 0 }, o)); return s; }   // scava
    };
    return s;
  }

  /* ---------- colori ---------- */
  const tinta = (r, g, b, va, fr) => (x, y, z) => { const n = 1 + (va || 0.18) * n3(x * (fr || 9) + 3.1, y * (fr || 9), z * (fr || 9)); return [r * n, g * n, b * n]; };
  const pelleC = tinta(0.29, 0.28, 0.285, 0.16, 5), ossoC = (x, y, z) => { const n = n3(x * 14, y * 14 + 7, z * 14), m = n3(x * 4, y * 4, z * 4 + 9); return [0.58 + 0.08 * n - 0.06 * m, 0.53 + 0.07 * n - 0.07 * m, 0.44 + 0.05 * n - 0.08 * m]; };
  const scuroC = tinta(0.085, 0.082, 0.1, 0.25, 10), chitinaC = (x, y, z) => { const n = n3(x * 11, y * 11, z * 11 + 5); return [0.11 + 0.025 * n, 0.105 + 0.02 * n, 0.135 + 0.03 * n]; };
  const stoffaC = tinta(0.17, 0.12, 0.2, 0.35, 6), cuoioC = tinta(0.16, 0.11, 0.08, 0.3, 14), bronzoC = (x, y, z) => { const n = n3(x * 9, y * 9, z * 9 + 2), vr = clamp(n3(x * 5 + 4, y * 5, z * 5) * 1.6, 0, 1); return [mix(0.62, 0.22, vr) + 0.06 * n, mix(0.42, 0.36, vr) + 0.05 * n, mix(0.2, 0.3, vr)]; };
  const ferroC = (x, y, z) => { const n = n3(x * 7, y * 7, z * 7), ru = clamp(n3(x * 3 + 8, y * 3, z * 3) * 1.8, 0, 1); return [mix(0.25, 0.32, ru) + 0.04 * n, mix(0.25, 0.18, ru) + 0.04 * n, mix(0.27, 0.11, ru) + 0.04 * n]; };
  const VERDE = [0.35, 1.0, 0.55], NERO = [0.02, 0.02, 0.025];
  const rugaP = (x, y, z, d) => d + 0.0018 * n3(x * 46, y * 46, z * 46) + 0.0022 * n3(x * 13, y * 13 + 4, z * 13);   // pelle grinzosa
  const porosoO = (x, y, z, d) => d + 0.0009 * n3(x * 80, y * 80, z * 80);   // osso poroso

  /* ---------- costruzione a fette di tempo: si puo' fare mentre il menu resta fluido ---------- */
  let SCAD = Infinity;
  const pausa = () => performance.now() > SCAD;

  /* ---------- il campo: unione morbida dei pezzi, saltando quelli lontani ---------- */
  // i pezzi sono divisi in un reticolo di caselle: in ogni punto si guardano solo quelli della sua casella.
  // mg e' il margine delle caselle: largo per il campo "grosso" (decide dove la pelle non passa), stretto per quello fine.
  function campo(parti, h, extra, bb, mg) {
    parti.forEach(p => { const m = p.op ? p.k + 2.5 * h * 4 : p.k + (p.rug != null ? p.rug : p.dsp ? 0.012 : 0) + 2 * h, b = p.pr.bb; p.bbE = [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m]; p.gate = (p.rug != null ? p.rug : 0.012) * 1.5 + 2 * h; });
    const Bs = 4 * h, nbx = Math.ceil((bb[3] - bb[0]) / Bs) + 1, nby = Math.ceil((bb[4] - bb[1]) / Bs) + 1, nbz = Math.ceil((bb[5] - bb[2]) / Bs) + 1, liste = new Array(nbx * nby * nbz), vuoto = Math.max(2 * mg, 8 * h);
    for (let k = 0; k < nbz; k++) for (let j = 0; j < nby; j++) for (let i = 0; i < nbx; i++) {
      const ax = bb[0] + i * Bs - mg, ay = bb[1] + j * Bs - mg, az = bb[2] + k * Bs - mg, bx = ax + Bs + 2 * mg, by = ay + Bs + 2 * mg, bz = az + Bs + 2 * mg, L = [];
      for (const p of parti) { const b = p.bbE; if (b[3] >= ax && b[0] <= bx && b[4] >= ay && b[1] <= by && b[5] >= az && b[2] <= bz) L.push(p); }
      liste[i + nbx * (j + nby * k)] = L;
    }
    const lista = (x, y, z) => liste[clamp(Math.floor((x - bb[0]) / Bs), 0, nbx - 1) + nbx * (clamp(Math.floor((y - bb[1]) / Bs), 0, nby - 1) + nby * clamp(Math.floor((z - bb[2]) / Bs), 0, nbz - 1))];
    const F = (x, y, z) => {
      const L = lista(x, y, z);
      let d = vuoto;
      for (let q = 0; q < L.length; q++) {
        const p = L[q], b = p.bbE;
        if (x < b[0] || y < b[1] || z < b[2] || x > b[3] || y > b[4] || z > b[5]) {
          if (p.op === 0) { const c = p.pr.bb, db = Math.max(c[0] - x, x - c[3], c[1] - y, y - c[4], c[2] - z, z - c[5]) - (p.rug || 0.012); if (db < d) d = db; }   // distanza dalla scatola: un limite inferiore, basta per il segno
          continue;
        }
        let v = p.pr.f(x, y, z); if (p.dsp && (p.forma || (v < p.gate && v > -p.gate))) v = p.dsp(x, y, z, v);
        d = p.op === 0 ? (p.k > 0 ? smin(d, v, p.k) : Math.min(d, v)) : smax(d, -v, p.k);
      }
      return extra ? extra(x, y, z, d) : d;
    };
    F.lista = lista; return F;
  }

  /* ---------- superficie (surface nets a banda stretta: si calcola fine solo vicino alla pelle) ---------- */
  function* superficie(Fc, F, bb, h) {
    const x0 = bb[0], y0 = bb[1], z0 = bb[2], nx = Math.ceil((bb[3] - x0) / h) + 1, ny = Math.ceil((bb[4] - y0) / h) + 1, nz = Math.ceil((bb[5] - z0) / h) + 1, sxy = nx * ny;
    const V = new Float32Array(sxy * nz), fatto = new Uint8Array(sxy * nz), C = 4, Hc = C * h;
    const cx = Math.ceil((nx - 1) / C), cy = Math.ceil((ny - 1) / C), cz = Math.ceil((nz - 1) / C), ncx = cx + 1, ncy = cy + 1, Vc = new Float32Array(ncx * ncy * (cz + 1));
    for (let k = 0; k <= cz; k++) { for (let j = 0; j <= cy; j++) for (let i = 0; i <= cx; i++) Vc[i + ncx * (j + ncy * k)] = Fc(x0 + i * Hc, y0 + j * Hc, z0 + k * Hc); if (pausa()) yield; }
    // celle grosse: se un angolo e' lontano dalla pelle piu' della diagonale, la cella e' tutta dentro o tutta fuori
    const soglia = 1.8 * Hc, unif = [], mista = [];
    for (let k = 0; k < cz; k++) {
      for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
        let u = 0;
        for (let c = 0; c < 8 && !u; c++) { const v = Vc[(i + (c & 1)) + ncx * ((j + ((c >> 1) & 1)) + ncy * (k + (c >> 2)))]; if (Math.abs(v) > soglia) u = v > 0 ? 1 : -1; }
        const i0 = i * C, j0 = j * C, k0 = k * C, i1 = Math.min(i0 + C, nx - 1), j1 = Math.min(j0 + C, ny - 1), k1 = Math.min(k0 + C, nz - 1);
        if (u) { unif.push(i0, j0, k0, i1, j1, k1, u); continue; }
        mista.push(i0, j0, k0, i1, j1, k1);
        for (let kk = k0; kk <= k1; kk++) for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) { const p = ii + nx * jj + sxy * kk; if (fatto[p] !== 1) { V[p] = F(x0 + ii * h, y0 + jj * h, z0 + kk * h); fatto[p] = 1; } }
      }
      if (pausa()) yield;
    }
    for (let q = 0; q < unif.length; q += 7) { const u = unif[q + 6] * Hc; for (let kk = unif[q + 2]; kk <= unif[q + 5]; kk++) for (let jj = unif[q + 1]; jj <= unif[q + 4]; jj++) for (let ii = unif[q]; ii <= unif[q + 3]; ii++) { const p = ii + nx * jj + sxy * kk; if (!fatto[p]) { V[p] = u; fatto[p] = 2; } } }
    // un vertice per ogni cella fine attraversata dalla pelle (solo dentro le celle grosse miste)
    const cid = new Int32Array(sxy * nz).fill(-1), pos = [];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], co = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], cv = new Float32Array(8), ofs = co.map(c => c[0] + nx * c[1] + sxy * c[2]);
    for (let q = 0; q < mista.length; q += 6) {
      for (let k = mista[q + 2]; k < mista[q + 5]; k++) for (let j = mista[q + 1]; j < mista[q + 4]; j++) for (let i = mista[q]; i < mista[q + 3]; i++) {
        const b0 = i + nx * j + sxy * k;
        let m = 0; for (let c = 0; c < 8; c++) { const v = V[b0 + ofs[c]]; cv[c] = v; if (v < 0) m |= 1 << c; }
        if (m === 0 || m === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (let e = 0; e < 12; e++) { const a = E[e][0], b = E[e][1], va = cv[a], vb = cv[b]; if ((va < 0) === (vb < 0)) continue; const t = va / (va - vb); sx += co[a][0] + (co[b][0] - co[a][0]) * t; sy += co[a][1] + (co[b][1] - co[a][1]) * t; sz += co[a][2] + (co[b][2] - co[a][2]) * t; n++; }
        cid[b0] = pos.length / 3; pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
      }
      if ((q & 63) === 0 && pausa()) yield;
    }
    // facce: un quadrilatero per ogni spigolo che cambia segno
    const idx = [], st = [1, nx, sxy];
    for (let q = 0; q < mista.length; q += 6) {
      for (let k = Math.max(1, mista[q + 2]); k < Math.min(nz - 1, mista[q + 5]); k++) for (let j = Math.max(1, mista[q + 1]); j < Math.min(ny - 1, mista[q + 4]); j++) for (let i = Math.max(1, mista[q]); i < Math.min(nx - 1, mista[q + 3]); i++) {
        const p = i + nx * j + sxy * k, v0 = V[p];
        for (let d = 0; d < 3; d++) {
          const v1 = V[p + st[d]]; if ((v0 < 0) === (v1 < 0)) continue;
          const u = st[(d + 1) % 3], w = st[(d + 2) % 3], a = cid[p], b = cid[p - u], c = cid[p - u - w], e = cid[p - w];
          if (a < 0 || b < 0 || c < 0 || e < 0) continue;
          if (v0 < 0) idx.push(a, b, c, a, c, e); else idx.push(a, c, b, a, e, c);
        }
      }
      if ((q & 63) === 0 && pausa()) yield;
    }
    const N = new Float32Array(pos.length), e2 = h * 0.4;   // normali dal gradiente del campo (quattro campioni a tetraedro): superficie liscia
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1], z = pos[i + 2], a = F(x + e2, y - e2, z - e2), b = F(x - e2, y - e2, z + e2), c = F(x - e2, y + e2, z - e2), d = F(x + e2, y + e2, z + e2), gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d, L = Math.hypot(gx, gy, gz) || 1; N[i] = gx / L; N[i + 1] = gy / L; N[i + 2] = gz / L;
      if ((i & 1023) === 0 && pausa()) yield;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3));
    g.setIndex(pos.length / 3 > 65535 ? new T.Uint32BufferAttribute(idx, 1) : new T.Uint16BufferAttribute(idx, 1)); return g;
  }

  /* ---------- colori, materiale, ombra d'ambiente e pesi delle ossa per ogni vertice ---------- */
  function* costruisci(parti, def, h, statico) {
    const F = campo(parti, h, def.rilievo, def.bb, h), g = yield* superficie(campo(parti, h, def.rilievo, def.bb, 8 * h), F, def.bb, h);
    const P = g.attributes.position.array, Nn = g.attributes.normal.array, n = P.length / 3;
    const col = new Float32Array(n * 3), ex = new Float32Array(n * 3), uv = new Float32Array(n * 2), exM = def.crepe ? new Float32Array(n * 3) : null;
    const idxO = {}; if (!statico) def.ossa.forEach((o, i) => idxO[o[0]] = i);
    const si = statico ? null : new Uint16Array(n * 4), sw = statico ? null : new Float32Array(n * 4), wb = new Float32Array(statico ? 1 : def.ossa.length);
    const sc = def.ao || 1, AO = [0.022 * sc, 0.07 * sc], sig = Math.max(0.003, h * 0.45), sUV = 1 / (def.uv || 0.3), alt = def.alt || 1;
    parti.forEach(p => { p.oi = !statico && p.osso != null ? idxO[p.osso] : -1; p.c = typeof p.col === 'function' ? p.col : p.col ? (() => p.col) : null; if (!statico && p.op === 0 && p.oi === undefined) throw new Error('osso mancante: ' + p.osso); });
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = Nn[i * 3], ny = Nn[i * 3 + 1], nz = Nn[i * 3 + 2];
      let cr = 0, cg = 0, cb = 0, wt = 0, lu = 0, rv = 0, mt = 0, best = null, bd = 1e9; wb.fill(0);
      const Lp = F.lista(x, y, z);
      if ((i & 511) === 0 && pausa()) yield;
      for (let q = 0; q < Lp.length; q++) {
        const p = Lp[q], b = p.bbE; if (x < b[0] || y < b[1] || z < b[2] || x > b[3] || y > b[4] || z > b[5]) continue;
        let d = p.pr.f(x, y, z); if (p.dsp) d = p.dsp(x, y, z, d);
        let wc;
        if (p.op === 0) {
          if (d < bd) { bd = d; best = p; }
          if (p.oi >= 0) { const R = p.inf || (p.k * 1.3 + 0.02 + h), k = 1 - Math.max(d, 0) / R; if (k > 0) wb[p.oi] += k * k; }
          if (!p.c) continue; wc = Math.exp(-Math.max(d, 0) / sig);
        } else { if (!p.c) continue; wc = 6 * Math.exp(-Math.abs(d) / (sig * 0.35)); }
        if (wc < 1e-4) continue;
        const c = p.c(x, y, z, nx, ny, nz); cr += c[0] * wc; cg += c[1] * wc; cb += c[2] * wc; wt += wc; lu += p.lu * wc; rv += p.rv * wc; mt += p.mt * wc;
      }
      if (wt > 0) { cr /= wt; cg /= wt; cb /= wt; lu /= wt; rv /= wt; mt /= wt; } else { cr = cg = cb = 0.3; rv = 0.8; }
      // ombra d'ambiente cotta: quanto il campo "chiude" la superficie lungo la normale (pieghe e incavi piu' scuri)
      let occ = 0; for (let k = 0; k < 2; k++) { const dd = AO[k], v = F(x + nx * dd, y + ny * dd, z + nz * dd); occ += Math.max(0, dd - v) / dd * Math.pow(0.5, k); }
      const ao = clamp(1 - occ * 0.7, 0.28, 1) * mix(0.72, 1, sstep(0, alt * 0.3, y)), sp = 1 - lu * 0.7;
      col[i * 3] = cr * mix(1, ao, sp); col[i * 3 + 1] = cg * mix(1, ao, sp); col[i * 3 + 2] = cb * mix(1, ao, sp);
      ex[i * 3] = lu; ex[i * 3 + 1] = clamp(rv + (1 - ao) * 0.15, 0.05, 1); ex[i * 3 + 2] = mt;
      if (exM) { exM[i * 3] = Math.max(lu, def.crepe(x, y, z, best) || 0); exM[i * 3 + 1] = ex[i * 3 + 1]; exM[i * 3 + 2] = mt; }
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      if (ay >= ax && ay >= az) { uv[i * 2] = x * sUV; uv[i * 2 + 1] = z * sUV; } else if (ax >= az) { uv[i * 2] = z * sUV; uv[i * 2 + 1] = y * sUV; } else { uv[i * 2] = x * sUV; uv[i * 2 + 1] = y * sUV; }
      if (!statico) {   // le quattro ossa piu' vicine, pesi normalizzati
        let tot = 0; for (let s = 0; s < 4; s++) { let bi = -1, bw = 0; for (let o = 0; o < wb.length; o++) if (wb[o] > bw) { bw = wb[o]; bi = o; } if (bi < 0) { si[i * 4 + s] = 0; sw[i * 4 + s] = 0; continue; } si[i * 4 + s] = bi; sw[i * 4 + s] = bw; tot += bw; wb[bi] = 0; }
        if (tot <= 0) { si[i * 4] = best && best.oi >= 0 ? best.oi : 0; sw[i * 4] = 1; tot = 1; }
        for (let s = 0; s < 4; s++) sw[i * 4 + s] /= tot;
      }
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('extra', new T.BufferAttribute(ex, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (!statico) { g.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4)); }
    if (exM) g.userData.maledetto = new T.BufferAttribute(exM, 3);
    g.computeBoundingSphere(); g.boundingSphere.radius *= 1.4; return g;
  }

  /* ---------- materiale: rugosita', metallo e bagliore per vertice; lampo quando colpito; dissolvenza in cenere ---------- */
  const RUMORE_GLSL = `
float hashC(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rumoreC(vec3 x) { vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hashC(i), hashC(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hashC(i + vec3(0.0, 1.0, 0.0)), hashC(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hashC(i + vec3(0.0, 0.0, 1.0)), hashC(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hashC(i + vec3(0.0, 1.0, 1.0)), hashC(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
`;
  // rilievo fine calcolato nel pixel: rumore 3D sulla posizione a riposo (non scivola quando la creatura si muove),
  // niente coordinate di texture e quindi niente stiramenti. Piu' marcato sulle superfici ruvide (osso, pelle), lieve sulla chitina.
  const RILIEVO_GLSL = `
  {
    vec3 pr = vPL * 52.0;
    float hb = (rumoreC(pr) * 0.6 + rumoreC(pr * 2.63 + 7.1) * 0.3 + rumoreC(pr * 6.1 + 3.3) * 0.1) * 0.0016 * mix(0.25, 1.4, vExtra.y);
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1) * faceDirection;
    vec3 gr = sign(det) * (dFdx(hb) * r1 + dFdy(hb) * r2);
    normal = normalize(abs(det) * normal - gr);
  }`;
  function patch(sh) {
    Object.assign(sh.uniforms, this.userData.u);
    sh.vertexShader = 'attribute vec3 extra;\nvarying vec3 vExtra;\nvarying vec3 vPL;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vExtra = extra; vPL = position;');
    sh.fragmentShader = 'uniform float uDiss;\nuniform float uFlash;\nuniform vec3 uBag;\nuniform vec3 uBordo;\nvarying vec3 vExtra;\nvarying vec3 vPL;\n' + RUMORE_GLSL + sh.fragmentShader
      .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n float nDis = rumoreC(vPL * 7.0) * 0.7 + rumoreC(vPL * 21.0) * 0.3; float sDis = uDiss * 1.1 - 0.05;\n if (uDiss > 0.0 && nDis < sDis) discard;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = vExtra.y;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + RILIEVO_GLSL)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = vExtra.z;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += uBag * vExtra.x + uFlash * vec3(0.75, 0.62, 0.5) * (0.3 + vExtra.x);\n if (uDiss > 0.0) totalEmissiveRadiance += uBordo * 2.5 * (1.0 - smoothstep(0.0, 0.08, nDis - sDis));');
  }
  let NMAP = null, TEXL = null, TEXO = null;
  function materiale() {
    if (false) NMAP = mappaNormali(256, (u, v) => { const a = u * 2 * PI, b = v * 2 * PI, X = Math.cos(a) * 2, Y = Math.sin(a) * 2, Z = Math.cos(b) * 2, W = Math.sin(b) * 2; return 0.55 * n3(X * 2 + W, Y * 2, Z * 2) + 0.3 * n3(X * 5, Y * 5 + W * 2, Z * 5) + 0.15 * n3(X * 11, Y * 11, Z * 11 + W); }, 5);
    const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMap: K.env(), envMapIntensity: 0.9 });
    m.userData.u = { uDiss: { value: 0 }, uFlash: { value: 0 }, uBag: { value: new T.Color(0x6dffa0).multiplyScalar(1.4) }, uBordo: { value: new T.Color(0xff8a3a) } };
    m.onBeforeCompile = patch; return m;
  }
  let MOMB = null; const matOmbra = () => MOMB || (MOMB = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  function texLuce() {   // alone morbido per occhi, cristalli e mani
    if (TEXL) return TEXL; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (TEXL = new T.CanvasTexture(c));
  }
  function texOmbra() {   // ombra di contatto sotto i piedi
    if (TEXO) return TEXO; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(0.55, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (TEXO = new T.CanvasTexture(c));
  }

  /* ---------- animazione: aiuti ---------- */
  function chiavi(t, Kc) {   // curva a chiavi [[tempo, valore], ...] con raccordi morbidi
    if (t <= Kc[0][0]) return Kc[0][1];
    for (let i = 1; i < Kc.length; i++) if (t < Kc[i][0]) { const a = Kc[i - 1], b = Kc[i], k = (t - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * k * k * (3 - 2 * k); }
    return Kc[Kc.length - 1][1];
  }
  // passo procedurale: la gamba avanza nella direzione del moto (anche di lato o all'indietro), ginocchio piegato in volo, piede piatto in appoggio
  function gamba(c, g, p, f, A, piega, w, dir) {
    if (w <= 0) return;
    const sn = Math.sin(f), cs = Math.cos(f), volo = Math.max(0, cs), sw = A * sn * w, cd = Math.cos(dir), sd = Math.sin(dir);
    c.rotation.x += -sw * cd; c.rotation.z += sw * sd;
    const kn = (piega * Math.pow(volo, 1.3) + 0.15 * A * Math.max(0, -cs)) * w;
    g.rotation.x += kn; p.rotation.x += sw * cd - kn * 0.7;
  }
  const colpo = (s) => s.hitK * chiavi(s.hitT, [[0, 0], [0.05, 1], [0.12, 0.85], [0.4, 0]]);

  /* ---------- copia di una creatura: ossa, pelle a due dettagli, armi, luci ---------- */
  const CACHE = {}, CR = {};
  function* geometrieG(def) {
    let ms = 0, t0 = performance.now(); const conta = function* (it) { for (;;) { const r = it.next(); if (r.done) return r.value; ms += performance.now() - t0; yield; t0 = performance.now(); } };
    const parti = def.parti().parti;
    const alta = yield* conta(costruisci(parti, def, def.h)), bassa = yield* conta(costruisci(parti, def, def.h * 2.1)), armi = [];
    for (const a of (def.armi || [])) armi.push(yield* conta(costruisci(a.parti().parti, a, a.h, true)));
    ms += performance.now() - t0;
    const G = { alta, bassa, armi, ms, tri: alta.index.count / 3 };
    if (alta.userData.maledetto) G.var = { maledetto: [variante(alta, 'maledetto'), variante(bassa, 'maledetto')] };
    return (CACHE[def.nome] = G);
  }
  function geometrie(def) { if (CACHE[def.nome]) return CACHE[def.nome]; const s0 = SCAD; SCAD = Infinity; const it = geometrieG(def); let r; do r = it.next(); while (!r.done); SCAD = s0; return r.value; }
  function variante(g, nome) { const v = new T.BufferGeometry(); for (const k in g.attributes) v.setAttribute(k, k === 'extra' ? g.userData[nome] : g.attributes[k]); v.setIndex(g.index); v.boundingSphere = g.boundingSphere; return v; }

  function istanza(def, opz) {
    opz = opz || {};
    const G = geometrie(def), root = new T.Group(), ossa = {}, lista = [], restW = {};
    def.ossa.forEach(([n, p, w]) => { const o = new T.Bone(), pw = p ? restW[p] : [0, 0, 0]; o.name = n; o.position.set(w[0] - pw[0], w[1] - pw[1], w[2] - pw[2]); o.userData.r = o.position.clone(); (p ? ossa[p] : root).add(o); ossa[n] = o; restW[n] = w; lista.push(o); });
    root.updateMatrixWorld(true);
    const sk = new T.Skeleton(lista), mat = materiale(), U = mat.userData.u, geo = opz.maledetto && G.var ? G.var.maledetto : [G.alta, G.bassa];
    if (def.bagliore) U.uBag.value.set(def.bagliore).multiplyScalar(1.4);
    const alta = new T.SkinnedMesh(geo[0], mat), bassa = new T.SkinnedMesh(geo[1], mat);
    [alta, bassa].forEach(m => { root.add(m); m.bind(sk); m.receiveShadow = true; });
    // l'ombra la proietta sempre il modello leggero: da vicino resta acceso ma invisibile (non scrive colore ne' profondita')
    alta.castShadow = false; bassa.castShadow = true; bassa.material = matOmbra();
    // luci (occhi, nuclei): aloni additivi attaccati alle ossa, posizioni date nella posa di riposo
    const luci = [];
    const luce = (osso, w, c, s, op, pulsa) => { const sm = new T.SpriteMaterial({ map: texLuce(), color: c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }), sp = new T.Sprite(sm), o = ossa[osso], r = restW[osso]; sp.position.set(w[0] - r[0], w[1] - r[1], w[2] - r[2]); sp.scale.setScalar(s); o.add(sp); luci.push({ sp, op, s, pulsa: pulsa || 0 }); return sp; };
    (def.luci || []).forEach(l => luce(...l));
    if (opz.maledetto && def.luciMaledetto) def.luciMaledetto.forEach(l => luce(...l));
    let ombra = null;
    if (def.ombra) { ombra = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: texOmbra(), transparent: true, depthWrite: false, opacity: 0.8 })); ombra.rotation.x = -PI / 2; ombra.position.y = 0.025; ombra.scale.setScalar(def.ombra); ombra.renderOrder = -1; root.add(ombra); }
    // armi: si orientano nella posa "di presa" (cosi' la direzione e' giusta qualunque sia la catena del braccio)
    const armi = [], armiM = [];
    if (def.armi) {
      if (def.presa) def.presa(ossa); root.updateMatrixWorld(true);
      def.armi.forEach((a, i) => {
        const m = new T.Mesh(G.armi[i], mat), o = ossa[a.osso], qb = o.getWorldQuaternion(new T.Quaternion()), qd = new T.Quaternion().setFromEuler(new T.Euler(a.rot[0], a.rot[1], a.rot[2]));
        m.quaternion.copy(qb.invert().multiply(qd)); const pw = o.getWorldPosition(new T.Vector3()).add(new T.Vector3(a.off[0], a.off[1], a.off[2])); m.position.copy(o.worldToLocal(pw)); m.castShadow = true; o.add(m); armiM.push(m);
        (a.cristalli || []).forEach(c => { const cm = new T.Mesh(new T.OctahedronGeometry(c[3], 0), new T.MeshStandardMaterial({ color: 0x2a6a46, emissive: def.bagliore || 0x6dffa0, emissiveIntensity: 1.1, roughness: 0.2, metalness: 0.1, flatShading: true, transparent: true })); cm.position.set(c[0], c[1], c[2]); cm.scale.set(1, 1, c[4] || 1.6); m.add(cm); armi.push(cm); });
        (a.luci || []).forEach(l => { const sm = new T.SpriteMaterial({ map: texLuce(), color: l[3], transparent: true, opacity: l[5], blending: T.AdditiveBlending, depthWrite: false }), sp = new T.Sprite(sm); sp.position.set(l[0], l[1], l[2]); sp.scale.setScalar(l[4]); m.add(sp); luci.push({ sp, op: l[5], s: l[4], pulsa: l[6] || 0, arma: true }); });
      });
      lista.forEach(o => { o.rotation.set(0, 0, 0); o.position.copy(o.userData.r); });
    }

    const st = { v: 0, vf: 0, vs: 0, dir: 0, fase: 0, A: def.passo.A0, att: null, hitT: 9, hitK: 0, hd: 1, morte: -1, rapida: false, lo: false, t: 0 };
    const prev = new T.Vector3(), cur = new T.Vector3(); let primo = true;
    function anim(t, dt, vel) {
      dt = clamp(dt || 0, 0, 0.05); st.t = t;
      // velocita' vera, misurata dallo spostamento nel mondo: avanti e di lato rispetto a dove guarda
      const e = root.matrixWorld.elements; cur.set(e[12], e[13], e[14]);
      let vf = 0, vs = 0;
      if (opz.tapis || def.tapis) vf = vel || 0;
      else if (!primo && dt > 0) {
        const dx = (cur.x - prev.x) / dt, dz = (cur.z - prev.z) / dt, fl = Math.hypot(e[8], e[10]) || 1, xl = Math.hypot(e[0], e[2]) || 1;
        if (Math.hypot(dx, dz) < 25) { vf = (dx * e[8] + dz * e[10]) / fl; vs = (dx * e[0] + dz * e[2]) / xl; }
      }
      primo = false; prev.copy(cur);
      if (st.morte >= 0) { vf = 0; vs = 0; }
      const k = Math.min(1, dt * 7); st.vf += (vf - st.vf) * k; st.vs += (vs - st.vs) * k;
      st.v = Math.hypot(st.vf, st.vs); if (st.v > 0.05) st.dir = Math.atan2(st.vs, st.vf);
      const P = def.passo; st.A = clamp(P.A0 + P.A1 * st.v, 0, P.Amax);
      st.fase += dt * 2 * PI * st.v / (4 * P.L * Math.sin(Math.max(0.1, st.A)));
      if (st.att) { st.att.t += dt; if (st.att.t >= st.att.d) st.att = null; }
      st.hitT += dt; if (st.morte >= 0) st.morte += dt;
      for (let i = 0; i < lista.length; i++) { const o = lista[i]; o.rotation.set(0, 0, 0); o.position.copy(o.userData.r); }
      def.posa(ossa, st, t, dt);
      // lampo del colpo, dissolvenza della morte, aloni che pulsano
      U.uFlash.value = colpo(st) * 0.8;
      const dis = st.morte < 0 ? 0 : st.rapida ? sstep(0, 0.35, st.morte) : sstep(def.morte, def.morte + (def.dis || 0.9), st.morte);
      U.uDiss.value = dis;
      if (dis > 0) { alta.castShadow = bassa.castShadow = false; if (ombra) ombra.material.opacity = 0.8 * (1 - dis); }
      const ft = def.fervore ? def.fervore(st) : 0;
      for (const l of luci) { const pz = l.pulsa ? 1 + 0.18 * Math.sin(t * l.pulsa) : 1; l.sp.material.opacity = Math.min(1, l.op * (1 - dis) * (1 + ft * 0.6)); l.sp.scale.setScalar(l.s * pz * (1 + ft * 0.25)); }
      for (const c of armi) { c.material.opacity = 1 - dis; c.rotation.z += dt * 1.2; }
      // dettaglio secondo la distanza dall'occhio della camera
      const oc = CR.occhio; if (oc) { const dx = e[12] - oc.x, dy = e[13] - oc.y, dz = e[14] - oc.z, lo = dx * dx + dy * dy + dz * dz > def.lod * def.lod; if (lo !== st.lo) { st.lo = lo; alta.visible = !lo; bassa.material = lo ? mat : matOmbra(); } }
    }
    const att = def.attacchi;
    return {
      root, anim, alt: def.alt, nome: def.nome, proprio: true, ossa, st,
      attacca(k, d) { const a = att[k] || att[Object.keys(att)[0]]; if (st.morte < 0) st.att = { k: att[k] ? k : Object.keys(att)[0], t: 0, d: d || a }; },
      // un punto della creatura nel mondo (ventre, schiena, bocca, punta dell'arma), che segue le ossa
      punto(n, out) {
        const p = def.punti && def.punti[n]; if (!p) return null; out = out || new T.Vector3();
        if (p[0] === 'arma') { const m = armiM[p[1]], q = def.armi[p[1]].punta || [0, 0, 0]; return m ? m.localToWorld(out.set(q[0], q[1], q[2])) : null; }
        const r = restW[p[0]], w = p[1]; return ossa[p[0]].localToWorld(out.set(w[0] - r[0], w[1] - r[1], w[2] - r[2]));
      },
      colpito(f) { if (st.morte >= 0) return; st.hitT = 0; st.hitK = clamp(f == null ? 0.7 : f, 0.25, 1); st.hd = Math.random() < 0.5 ? -1 : 1; },
      muori(rapida) { if (st.morte >= 0) return 0; st.morte = 0; st.att = null; st.rapida = !!rapida; st.hd = Math.random() < 0.5 ? -1 : 1; return rapida ? 0.4 : def.morte + (def.dis || 0.9) + 0.05; },
      libera() { mat.dispose(); luci.forEach(l => l.sp.material.dispose()); if (ombra) { ombra.geometry.dispose(); ombra.material.dispose(); } armi.forEach(c => { c.geometry.dispose(); c.material.dispose(); }); }
    };
  }

  /* =====================================================================
     STRISCIANTE: gobbo e scheletrico, maschera d'osso senza occhi con una fenditura verde, braccia lunghe a falce.
     Cammina curvo; quando corre si butta in avanti e usa le braccia come zampe.
     ===================================================================== */
  const STRISCIANTE = {
    nome: 'Strisciante', alt: 1.35, h: 0.013, bb: [-0.5, -0.02, -0.34, 0.5, 1.38, 0.72], lod: 5, ombra: 1.1, ao: 0.8, uv: 0.22,
    passo: { L: 0.52, A0: 0.25, A1: 0.07, Amax: 0.62 }, morte: 0.75,
    ossa: [['radice', null, [0, 0.62, -0.05]], ['spina', 'radice', [0, 0.74, -0.02]], ['petto', 'spina', [0, 0.92, 0.1]], ['collo', 'petto', [0, 1.02, 0.24]], ['testa', 'collo', [0, 1.1, 0.36]], ['mascella', 'testa', [0, 1.07, 0.41]],
      ...LATI.flatMap(([s, l]) => [['braccio' + l, 'petto', [s * 0.2, 1.0, 0.18]], ['av' + l, 'braccio' + l, [s * 0.31, 0.74, 0.3]], ['mano' + l, 'av' + l, [s * 0.34, 0.52, 0.43]],
        ['coscia' + l, 'radice', [s * 0.12, 0.6, -0.05]], ['stinco' + l, 'coscia' + l, [s * 0.15, 0.36, 0.12]], ['piede' + l, 'stinco' + l, [s * 0.15, 0.12, -0.06]]])],
    parti() {
      const S = Scultura(), P = { dsp: rugaP, rv: 0.72 }, O = { dsp: porosoO, rv: 0.5 };
      // bacino, vita stretta, torace con le costole in rilievo
      S.u(EL([0, 0.63, -0.06], [0.14, 0.085, 0.11]), 'radice', pelleC, Object.assign({ k: 0.04 }, P));
      S.u(CA([0, 0.66, -0.05], [0, 0.84, 0.05], 0.072, 0.09), 'spina', pelleC, Object.assign({ k: 0.05 }, P));
      S.u(EL([0, 0.93, 0.11], [0.16, 0.13, 0.14]), 'petto', pelleC, { k: 0.05, rv: 0.72, rug: 0.012, dsp: (x, y, z, d) => rugaP(x, y, z, d) + 0.0065 * Math.sin((y - 0.93) * 64 + Math.abs(x) * 9) * sstep(0.0, 0.08, z - 0.02) * sstep(1.02, 0.9, y) });
      // la spina dorsale sporge: vertebre e aculei
      const vert = [[0, 0.68, -0.155, 'radice'], [0, 0.77, -0.13, 'spina'], [0, 0.86, -0.08, 'spina'], [0, 0.95, -0.025, 'petto'], [0, 1.02, 0.06, 'petto'], [0, 1.065, 0.16, 'petto']];
      vert.forEach((v, i) => { const p = [v[0], v[1], v[2]]; S.u(SF(p, 0.028 - i * 0.001), v[3], ossoC, Object.assign({ k: 0.02 }, O)); const L = 0.05 + 0.025 * Math.sin(i / 5 * PI); S.u(CA(p, [0, v[1] + L * 0.75, v[2] - L * 0.9 + i * 0.012], 0.016, 0.003), v[3], ossoC, Object.assign({ k: 0.008 }, O)); });
      LATI.forEach(([s]) => {
        S.u(EL([s * 0.11, 0.99, 0.03], [0.07, 0.05, 0.045]), 'petto', ossoC, Object.assign({ k: 0.02 }, O));   // scapole
        S.u(CA([s * 0.04, 0.99, 0.21], [s * 0.17, 1.0, 0.18], 0.018, 0.022), 'petto', ossoC, Object.assign({ k: 0.015 }, O));   // clavicole
        S.u(EL([s * 0.06, 0.6, -0.12], [0.06, 0.05, 0.05]), 'radice', ossoC, Object.assign({ k: 0.03 }, O));   // creste del bacino
      });
      // collo e testa: cranio stretto e lungo, arcate a V sopra le orbite vuote, denti che si incastrano
      S.u(CA([0, 1.0, 0.2], [0, 1.09, 0.35], 0.048, 0.038), 'collo', pelleC, Object.assign({ k: 0.03 }, P));
      S.u(EL([0, 1.16, 0.36], [0.082, 0.085, 0.11]), 'testa', ossoC, Object.assign({ k: 0.03 }, O));
      S.u(CA([0, 1.21, 0.36], [0, 1.235, 0.2], 0.026, 0.006), 'testa', ossoC, Object.assign({ k: 0.02 }, O));
      S.u(EL([0, 1.115, 0.47], [0.06, 0.075, 0.085]), 'testa', ossoC, Object.assign({ k: 0.03 }, O));
      LATI.forEach(([s]) => {
        S.u(CA([0, 1.172, 0.523], [s * 0.072, 1.158, 0.455], 0.02, 0.013), 'testa', ossoC, Object.assign({ k: 0.012 }, O));   // arcata
        S.u(CA([s * 0.035, 1.098, 0.522], [s * 0.074, 1.108, 0.42], 0.017, 0.013), 'testa', ossoC, Object.assign({ k: 0.012 }, O));   // zigomo
        S.s(EL([s * 0.034, 1.137, 0.535], [0.021, 0.016, 0.032]), { col: NERO, k: 0.006 });   // orbita vuota
        catena(S, [[s * 0.06, 1.2, 0.33], [s * 0.105, 1.26, 0.21], [s * 0.115, 1.245, 0.11]], [0.02, 0.01, 0.003], 'testa', ossoC, Object.assign({ k: 0.012 }, O));   // corna all'indietro
      });
      S.s(EL([0, 1.088, 0.552], [0.011, 0.012, 0.02]), { col: NERO, k: 0.004 });
      S.u(EL([0, 1.035, 0.462], [0.054, 0.026, 0.08]), 'mascella', ossoC, Object.assign({ k: 0.012, inf: 0.015 }, O));
      for (let i = -3; i <= 3; i++) {
        const z = 0.538 - Math.abs(i) * 0.013;
        S.u(CA([i * 0.0145, 1.074, z - 0.004], [i * 0.0155, 1.047, z], 0.0075, 0.0015), 'testa', ossoC, { k: 0.003, rv: 0.4, inf: 0.01 });
        S.u(CA([(i + 0.5) * 0.0145, 1.04, z - 0.01], [(i + 0.5) * 0.0155, 1.066, z - 0.006], 0.007, 0.0015), 'mascella', ossoC, { k: 0.003, rv: 0.4, inf: 0.01 });
      }
      // braccia: spalla d'osso, avambraccio con cresta, mano con tre falci
      LATI.forEach(([s, l]) => {
        S.u(SF([s * 0.2, 1.0, 0.18], 0.05), 'braccio' + l, ossoC, Object.assign({ k: 0.03 }, O));
        S.u(CA([s * 0.2, 1.0, 0.18], [s * 0.31, 0.74, 0.3], 0.044, 0.034), 'braccio' + l, pelleC, Object.assign({ k: 0.03 }, P));
        S.u(CA([s * 0.315, 0.755, 0.285], [s * 0.34, 0.8, 0.18], 0.02, 0.003), 'braccio' + l, ossoC, Object.assign({ k: 0.01 }, O));
        S.u(CA([s * 0.31, 0.74, 0.3], [s * 0.34, 0.52, 0.43], 0.037, 0.029), 'av' + l, pelleC, Object.assign({ k: 0.03 }, P));
        S.u(CA([s * 0.345, 0.69, 0.315], [s * 0.36, 0.56, 0.39], 0.013, 0.009), 'av' + l, ossoC, Object.assign({ k: 0.012 }, O));
        S.u(EL([s * 0.345, 0.485, 0.45], [0.034, 0.04, 0.028]), 'mano' + l, pelleC, Object.assign({ k: 0.02 }, P));
        [-1, 0, 1].forEach(f => catena(S, [[s * (0.345 + f * 0.021), 0.455, 0.46], [s * (0.35 + f * 0.03), 0.37, 0.52], [s * (0.356 + f * 0.036), 0.28, 0.5]], [0.012, 0.0075, 0.0015], 'mano' + l, ossoC, { k: 0.006, rv: 0.35 }));
        catena(S, [[s * 0.32, 0.485, 0.47], [s * 0.3, 0.43, 0.51]], [0.009, 0.002], 'mano' + l, ossoC, { k: 0.006, rv: 0.35 });
        // gambe digitigrade: coscia muscolosa, ginocchio a punta, stinco sottile, piede con tre artigli e sperone
        S.u(CA([s * 0.12, 0.6, -0.05], [s * 0.15, 0.36, 0.12], 0.07, 0.044), 'coscia' + l, pelleC, Object.assign({ k: 0.035 }, P));
        S.u(EL([s * 0.14, 0.5, 0.0], [0.055, 0.085, 0.06]), 'coscia' + l, pelleC, Object.assign({ k: 0.03 }, P));
        S.u(SF([s * 0.155, 0.37, 0.15], 0.028), 'coscia' + l, ossoC, Object.assign({ k: 0.015 }, O));
        S.u(CA([s * 0.155, 0.38, 0.165], [s * 0.16, 0.43, 0.21], 0.016, 0.003), 'coscia' + l, ossoC, Object.assign({ k: 0.008 }, O));
        S.u(CA([s * 0.15, 0.36, 0.12], [s * 0.15, 0.12, -0.06], 0.038, 0.027), 'stinco' + l, pelleC, Object.assign({ k: 0.025 }, P));
        S.u(CA([s * 0.15, 0.12, -0.06], [s * 0.16, 0.03, 0.06], 0.027, 0.021), 'piede' + l, pelleC, Object.assign({ k: 0.02 }, P));
        S.u(CA([s * 0.15, 0.12, -0.075], [s * 0.15, 0.085, -0.135], 0.014, 0.003), 'piede' + l, ossoC, Object.assign({ k: 0.008 }, O));
        [-1, 0, 1].forEach(f => S.u(CA([s * (0.16 + f * 0.02), 0.03, 0.06], [s * (0.16 + f * 0.03), 0.014, 0.15], 0.014, 0.004), 'piede' + l, ossoC, { k: 0.008, rv: 0.4 }));
      });
      // perizoma di stracci e cintura di cuoio
      const strappo = (y0) => (x, y, z, d) => Math.max(d + 0.002 * n3(x * 60, y * 60, z * 60), (y0 + 0.035 * n3(x * 28, 1.3, z * 28)) - y);
      S.u(SC([0, 0.5, 0.055], [0.075, 0.1, 0.008], 0.006, [0.22, 0, 0]), 'radice', stoffaC, { k: 0.012, rv: 0.95, forma: true, dsp: strappo(0.415), rug: 0.04 });
      S.u(SC([0, 0.5, -0.165], [0.085, 0.1, 0.008], 0.006, [-0.3, 0, 0]), 'radice', stoffaC, { k: 0.012, rv: 0.95, forma: true, dsp: strappo(0.4), rug: 0.04 });
      S.u(XX((x, y, z) => Math.hypot(Math.hypot(x, (z + 0.055) * 1.22) - 0.135, y - 0.69) - 0.014, [-0.16, 0.67, -0.2, 0.16, 0.71, 0.1]), 'radice', cuoioC, { k: 0.008, rv: 0.6 });
      return S;
    },
    // il Maledetto ha la pelle spaccata da crepe verdi che pulsano
    crepe: (x, y, z, p) => p && p.col === pelleC ? sstep(0.62, 0.8, 1 - Math.abs(n3(x * 9, y * 9, z * 9))) * 0.9 : 0,
    luci: [['testa', [-0.034, 1.137, 0.548], 0x7dffa8, 0.055, 0.8, 7], ['testa', [0.034, 1.137, 0.548], 0x7dffa8, 0.055, 0.8, 7]],
    luciMaledetto: [['petto', [0, 0.92, 0.12], 0x7dffa8, 1.1, 0.28, 9], ['spina', [0, 0.76, 0.0], 0x7dffa8, 0.6, 0.3, 11]],
    attacchi: { artiglio: 0.6 },
    posa(o, s, t) {
      const v = s.v, w = sstep(0.04, 0.5, v), kq = sstep(1.6, 4, v), A = s.A, f = s.fase, d = s.dir, cd = Math.cos(d);
      const resp = Math.sin(t * 2.6), tic = n3(t * 2.3, 0.5, 1.7);
      // fermo: curvo, respira, la testa scatta, le falci fremono
      o.spina.rotation.x += 0.1 + 0.03 * resp; o.petto.rotation.x += 0.05 + 0.025 * resp;
      o.collo.rotation.x -= 0.05; o.testa.rotation.y += 0.3 * n3(t * 0.8, 1.1, 0) + 0.18 * Math.sign(tic) * Math.sqrt(Math.abs(tic)) * (1 - w);
      o.testa.rotation.z += 0.18 * n3(t * 0.6, 2.2, 0); o.testa.rotation.x += 0.1 * n3(t * 0.7, 3.3, 0);
      o.mascella.rotation.x += 0.06 + 0.12 * Math.max(0, Math.sin(t * 1.1)) * (1 - w);
      LATI.forEach(([sg, l]) => {
        o['braccio' + l].rotation.z -= sg * 0.12; o['braccio' + l].rotation.x += -0.1 + 0.06 * Math.sin(t * 1.4 + sg);
        o['av' + l].rotation.x += -0.35 + 0.08 * Math.sin(t * 1.9 + sg * 2); o['mano' + l].rotation.x += 0.15 * n3(t * 3 + sg * 5, 0, 0);
      });
      // passo e corsa a quattro zampe
      gamba(o.cosciaL, o.stincoL, o.piedeL, f, A, 1.1, w, d); gamba(o.cosciaR, o.stincoR, o.piedeR, f + PI, A, 1.1, w, d);
      o.radice.position.y += w * 0.035 * (Math.abs(Math.cos(f)) - 0.6) - 0.08 * kq;
      o.radice.rotation.y += 0.12 * A * Math.sin(f) * w * cd;
      o.spina.rotation.x += 0.32 * kq + 0.08 * w * cd; o.petto.rotation.x += 0.38 * kq;
      o.collo.rotation.x -= 0.42 * kq; o.testa.rotation.x -= 0.3 * kq;
      LATI.forEach(([sg, l]) => {
        const ph = f + (sg > 0 ? PI : 0) + 0.6, sn = Math.sin(ph), cs = Math.cos(ph);
        o['braccio' + l].rotation.x += -0.95 * kq - A * 1.2 * sn * kq + A * 0.6 * Math.sin(f + (sg > 0 ? 0 : PI)) * w * (1 - kq) * cd;
        o['av' + l].rotation.x += -0.55 * Math.max(0, cs) * kq;
      });
      // attacco: balzo in avanti e doppio fendente con le falci, la bocca si spalanca
      if (s.att) {
        const a = s.att.t, l = chiavi(a, [[0, 0], [0.09, 1], [0.26, 0.8], [0.6, 0]]);
        o.radice.position.z += 0.16 * l; o.spina.rotation.x += 0.22 * l; o.petto.rotation.x += 0.1 * l; o.collo.rotation.x -= 0.2 * l; o.testa.rotation.x -= 0.15 * l;
        o.mascella.rotation.x += 0.55 * chiavi(a, [[0, 0], [0.07, 1], [0.35, 0.6], [0.6, 0]]);
        o.braccioR.rotation.x += chiavi(a, [[0, 0], [0.08, -2.4], [0.2, 0.3], [0.6, 0]]); o.braccioR.rotation.z += chiavi(a, [[0, 0], [0.08, -0.5], [0.2, 0.3], [0.6, 0]]);
        o.avR.rotation.x += chiavi(a, [[0, 0], [0.08, -0.9], [0.2, -0.1], [0.6, 0]]);
        o.braccioL.rotation.x += chiavi(a, [[0, 0], [0.16, -2.2], [0.3, 0.3], [0.6, 0]]); o.braccioL.rotation.z += chiavi(a, [[0, 0], [0.16, 0.5], [0.3, -0.3], [0.6, 0]]);
        o.avL.rotation.x += chiavi(a, [[0, 0], [0.16, -0.8], [0.3, -0.1], [0.6, 0]]);
      }
      const h = colpo(s);
      if (h > 0) { o.petto.rotation.x -= 0.5 * h; o.spina.rotation.x -= 0.2 * h; o.testa.rotation.x -= 0.35 * h; o.testa.rotation.z += 0.4 * h * s.hd; o.radice.position.z -= 0.06 * h; o.braccioL.rotation.z += 0.35 * h; o.braccioR.rotation.z -= 0.35 * h; }
      // morte: le gambe cedono, crolla su un fianco tra gli spasmi
      if (s.morte >= 0) {
        const m = s.morte, k1 = sstep(0, 0.3, m), k2 = sstep(0.12, 0.6, m), sp = Math.sin(m * 38) * (1 - k2) * 0.25;
        o.radice.rotation.z += s.hd * 1.42 * k2; o.radice.rotation.x += 0.25 * k2; o.radice.position.y -= 0.44 * k2 + 0.05 * k1;
        LATI.forEach(([sg, l]) => { o['coscia' + l].rotation.x -= 0.9 * k1; o['stinco' + l].rotation.x += 1.3 * k1; o['braccio' + l].rotation.x -= (0.6 + sp) * k1; o['av' + l].rotation.x -= 0.8 * k1; o['braccio' + l].rotation.z += sg * 0.4 * k2; });
        o.testa.rotation.x += 0.5 * k2 + sp; o.mascella.rotation.x += 0.5 * k1; o.spina.rotation.x += 0.3 * k1;
      }
    }
  };

  /* =====================================================================
     NOVIZIO: soldato snello in armatura di chitina e piastre d'osso, cappuccio, elmo liscio con la visiera che brilla.
     Porta un bastone da lancio con un cristallo verde tra tre artigli.
     ===================================================================== */
  const BASTONE = {
    h: 0.0075, bb: [-0.09, -0.09, -0.64, 0.09, 0.09, 0.8], uv: 0.15, ao: 0.4,
    parti() {
      const S = Scultura();
      S.u(CA([0, 0, -0.5], [0, 0, 0.52], 0.017, 0.015), null, chitinaC, { k: 0, rv: 0.45, mt: 0.1, rug: 0.004, dsp: (x, y, z, d) => d + 0.0028 * Math.sin(Math.atan2(y, x) * 3 + z * 38) });
      [-0.32, 0.1, 0.44].forEach(zc => S.u(TO([0, 0, zc], 'z', 0.019, 0.008), null, bronzoC, { k: 0.005, rv: 0.32, mt: 0.9 }));
      S.u(CA([0, 0, -0.09], [0, 0, 0.09], 0.021), null, cuoioC, { k: 0.004, rv: 0.7, rug: 0.003, dsp: (x, y, z, d) => d + 0.0022 * Math.sin(z * 130) });
      S.u(SF([0, 0, 0.52], 0.026), null, bronzoC, { k: 0.008, rv: 0.32, mt: 0.9 });
      for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5, c = Math.cos(a), s = Math.sin(a); catena(S, [[0.018 * c, 0.018 * s, 0.52], [0.058 * c, 0.058 * s, 0.585], [0.052 * c, 0.052 * s, 0.68], [0.02 * c, 0.02 * s, 0.76]], [0.012, 0.01, 0.007, 0.002], null, ossoC, { k: 0.006, rv: 0.45 }); }
      S.u(CA([0, 0, -0.5], [0, 0, -0.62], 0.02, 0.003), null, bronzoC, { k: 0.006, rv: 0.32, mt: 0.9 });
      return S;
    },
    osso: 'manoR', rot: [0.06, 0, 0], off: [0, -0.03, 0.03], cristalli: [[0, 0, 0.645, 0.04, 1.7]], luci: [[0, 0, 0.645, 0x7dffa8, 0.24, 0.65, 6]]
  };
  const presaNovizio = (o) => { o.braccioR.rotation.z += 0.55; o.braccioR.rotation.x -= 0.55; o.avR.rotation.x -= 1.0; };
  const NOVIZIO = {
    nome: 'Novizio', alt: 2.0, h: 0.017, bb: [-0.74, -0.02, -0.34, 0.74, 2.02, 0.34], lod: 7, ombra: 1.2, uv: 0.3,
    passo: { L: 0.88, A0: 0.2, A1: 0.06, Amax: 0.5 }, morte: 1.05, armi: [BASTONE], presa: presaNovizio,
    ossa: [['radice', null, [0, 1.0, 0]], ['tabarda', 'radice', [0, 1.0, 0.15]], ['tabardaD', 'radice', [0, 1.0, -0.14]], ['spina', 'radice', [0, 1.15, 0]], ['petto', 'spina', [0, 1.42, 0.01]], ['collo', 'petto', [0, 1.6, 0]], ['testa', 'collo', [0, 1.7, 0.02]],
      ...LATI.flatMap(([s, l]) => [['braccio' + l, 'petto', [s * 0.21, 1.53, 0]], ['av' + l, 'braccio' + l, [s * 0.4, 1.28, 0.01]], ['mano' + l, 'av' + l, [s * 0.56, 1.06, 0.04]],
        ['coscia' + l, 'radice', [s * 0.11, 0.98, 0]], ['stinco' + l, 'coscia' + l, [s * 0.12, 0.55, 0.03]], ['piede' + l, 'stinco' + l, [s * 0.12, 0.1, -0.01]]])],
    parti() {
      const S = Scultura(), Ch = { rv: 0.38, mt: 0.08, dsp: (x, y, z, d) => d + 0.0015 * n3(x * 70, y * 70, z * 70) }, O = { dsp: porosoO, rv: 0.5 };
      const banda = (fr, a) => (x, y, z, d) => d + a * Math.sin(y * fr) + 0.0015 * n3(x * 70, y * 70, z * 70);   // chitina a segmenti
      // gambe: tuta di chitina, ginocchiere e schinieri d'osso, stivali a punta
      LATI.forEach(([s, l]) => {
        S.u(CA([s * 0.11, 0.98, 0], [s * 0.12, 0.55, 0.03], 0.083, 0.058), 'coscia' + l, chitinaC, Object.assign({ k: 0.04 }, Ch));
        S.u(EL([s * 0.12, 0.57, 0.082], [0.048, 0.056, 0.03]), 'stinco' + l, ossoC, Object.assign({ k: 0.008 }, O));
        S.u(CA([s * 0.12, 0.55, 0.03], [s * 0.12, 0.11, -0.01], 0.057, 0.044), 'stinco' + l, chitinaC, Object.assign({ k: 0.03 }, Ch));
        S.u(GU([s * 0.12, 0.33, 0.02], [0.074, 0.2, 0.07], 0.013, (x, y, z) => 0.035 - z), 'stinco' + l, ossoC, Object.assign({ k: 0.006 }, O));
        S.u(CA([s * 0.12, 0.08, -0.04], [s * 0.12, 0.05, 0.13], 0.05, 0.04), 'piede' + l, chitinaC, Object.assign({ k: 0.025 }, Ch));
        S.u(CA([s * 0.12, 0.05, 0.11], [s * 0.12, 0.03, 0.22], 0.04, 0.01), 'piede' + l, ossoC, Object.assign({ k: 0.012 }, O));
        // fiancali: piastre che pendono dalla cintura e seguono le cosce
        S.u(GU([s * 0.12, 0.88, 0], [0.118, 0.17, 0.118], 0.013, (x, y, z) => Math.max(0.035 - z, y - 0.97)), 'coscia' + l, ossoC, Object.assign({ k: 0.006 }, O));
        S.u(GU([s * 0.12, 0.88, 0], [0.122, 0.165, 0.122], 0.013, (x, y, z) => Math.max(s * 0.12 + 0.055 - s * x, y - 0.97)), 'coscia' + l, chitinaC, Object.assign({ k: 0.006 }, Ch));
        S.u(GU([s * 0.12, 0.88, 0], [0.118, 0.16, 0.118], 0.013, (x, y, z) => Math.max(z + 0.035, y - 0.97)), 'coscia' + l, chitinaC, Object.assign({ k: 0.006 }, Ch));
      });
      // bacino, cintura di bronzo con un piccolo teschio, ventre a segmenti, torace
      S.u(EL([0, 1.0, 0], [0.17, 0.11, 0.12]), 'radice', chitinaC, Object.assign({ k: 0.04 }, Ch));
      S.u(XX((x, y, z) => Math.hypot(Math.hypot(x, z * 1.35) - 0.172, y - 1.06) - 0.021, [-0.2, 1.03, -0.16, 0.2, 1.09, 0.16]), 'radice', bronzoC, { k: 0.01, rv: 0.35, mt: 0.85 });
      S.u(EL([0, 1.05, 0.135], [0.04, 0.045, 0.03]), 'radice', ossoC, Object.assign({ k: 0.01 }, O));
      S.s(SF([-0.016, 1.06, 0.165], 0.011), { col: NERO }); S.s(SF([0.016, 1.06, 0.165], 0.011), { col: NERO });
      S.u(CA([0, 1.06, 0], [0, 1.34, 0.01], 0.13, 0.15), 'spina', chitinaC, { k: 0.05, rv: 0.38, mt: 0.08, rug: 0.006, dsp: banda(95, 0.0028) });
      S.u(EL([0, 1.43, 0.015], [0.21, 0.15, 0.14]), 'petto', chitinaC, Object.assign({ k: 0.05 }, Ch));
      S.u(EL([0, 1.43, 0.088], [0.17, 0.13, 0.09]), 'petto', ossoC, Object.assign({ k: 0.01 }, O));   // pettorale d'osso a lamelle
      [1.37, 1.42, 1.47].forEach(y => S.s(CA([-0.17, y, 0.172], [0.17, y, 0.172], 0.007), { col: NERO, k: 0.004 }));
      S.u(CA([0, 1.32, 0.172], [0, 1.53, 0.165], 0.015, 0.012), 'petto', ossoC, Object.assign({ k: 0.008 }, O));
      S.s(SF([0, 1.44, 0.185], 0.022), { col: VERDE, lu: 1, k: 0.004 });   // nucleo che brilla
      // spallacci a due piastre con aculeo
      LATI.forEach(([s, l]) => {
        S.u(EL([s * 0.25, 1.575, 0], [0.12, 0.08, 0.12]), 'braccio' + l, ossoC, Object.assign({ k: 0.015, inf: 0.05 }, O));
        S.u(EL([s * 0.29, 1.5, 0], [0.1, 0.06, 0.11]), 'braccio' + l, chitinaC, Object.assign({ k: 0.012, inf: 0.05 }, Ch));
        S.u(CA([s * 0.27, 1.62, -0.02], [s * 0.33, 1.77, -0.07], 0.025, 0.004), 'braccio' + l, ossoC, Object.assign({ k: 0.01 }, O));
        // braccia
        S.u(CA([s * 0.21, 1.53, 0], [s * 0.4, 1.28, 0.01], 0.058, 0.048), 'braccio' + l, chitinaC, Object.assign({ k: 0.03 }, Ch));
        S.u(SF([s * 0.4, 1.29, -0.025], 0.04), 'braccio' + l, ossoC, Object.assign({ k: 0.012 }, O));
        S.u(CA([s * 0.4, 1.28, 0.01], [s * 0.56, 1.06, 0.04], 0.05, 0.043), 'av' + l, chitinaC, Object.assign({ k: 0.03 }, Ch));
        S.u(SC([s * 0.49, 1.17, 0.055], [0.04, 0.11, 0.028], 0.015, [0, 0, s * 0.63]), 'av' + l, ossoC, Object.assign({ k: 0.012 }, O));
        S.u(EL([s * 0.588, 1.015, 0.05], [0.045, 0.052, 0.045]), 'mano' + l, chitinaC, Object.assign({ k: 0.02 }, Ch));
        S.u(CA([s * 0.565, 0.985, 0.088], [s * 0.615, 0.99, 0.08], 0.017), 'mano' + l, ossoC, { k: 0.01, rv: 0.5 });
      });
      // tabarda davanti e dietro: pannelli di stoffa che le cosce spingono quando cammina
      const orlo = (y0) => (x, y, z, d) => Math.max(d + 0.004 * Math.sin(x * 45) + 0.0015 * n3(x * 50, y * 50, z * 50), (y0 + 0.04 * n3(x * 22, 5, z * 22)) - y);
      S.u(SC([0, 0.79, 0.158], [0.085, 0.21, 0.01], 0.008, [-0.06, 0, 0]), 'tabarda', stoffaC, { k: 0.015, rv: 0.95, rug: 0.05, forma: true, dsp: orlo(0.6) });
      S.u(SC([0, 0.79, -0.15], [0.1, 0.21, 0.01], 0.008, [0.08, 0, 0]), 'tabardaD', stoffaC, { k: 0.015, rv: 0.95, rug: 0.05, forma: true, dsp: orlo(0.6) });
      // cappuccio a punta, aperto sul davanti (lo stesso taglio dei Guardiani della sala)
      S.u(GU([0, 1.79, -0.01], [0.168, 0.185, 0.172], 0.015, (x, y, z) => Math.max(z - 0.05 + 0.12 * (y - 1.75), 1.6 - y)), 'testa', stoffaC, { k: 0.015, rv: 0.95, rug: 0.01, dsp: (x, y, z, d) => d + 0.004 * Math.sin(Math.atan2(z, x) * 8 + y * 7) });
      S.u(CA([0, 1.88, -0.09], [0, 1.95, -0.27], 0.08, 0.01), 'testa', stoffaC, { k: 0.04, rv: 0.95 });
      // collo, elmo liscio con visiera, cresta, paraguance e mantellina
      S.u(CA([0, 1.56, 0], [0, 1.68, 0.01], 0.062, 0.055), 'collo', chitinaC, Object.assign({ k: 0.03 }, Ch));
      S.u(EL([0, 1.775, 0.02], [0.12, 0.13, 0.13]), 'testa', ossoC, Object.assign({ k: 0.02 }, O));
      S.s(SC([0, 1.765, 0.15], [0.082, 0.012, 0.05], 0.008), { col: VERDE, lu: 1, k: 0.004 });
      S.u(SC([0, 1.9, -0.01], [0.011, 0.05, 0.13], 0.009, [-0.3, 0, 0]), 'testa', ossoC, Object.assign({ k: 0.012 }, O));
      LATI.forEach(([s]) => S.u(EL([s * 0.09, 1.7, 0.07], [0.04, 0.07, 0.06]), 'testa', ossoC, Object.assign({ k: 0.012 }, O)));
      S.u(EL([0, 1.67, 0.09], [0.06, 0.04, 0.05]), 'testa', ossoC, Object.assign({ k: 0.012 }, O));
      S.u(SC([0, 1.27, -0.165], [0.19, 0.27, 0.011], 0.009, [0.1, 0, 0]), 'petto', stoffaC, { k: 0.02, rv: 0.95, rug: 0.05, forma: true, dsp: (x, y, z, d) => Math.max(d + 0.008 * Math.sin(x * 38) + 0.002 * n3(x * 50, y * 50, z * 50), (1.03 + 0.05 * n3(x * 18, 2, z * 18)) - y) });
      return S;
    },
    luci: [['testa', [0, 1.765, 0.17], 0x7dffa8, 0.14, 0.45, 3], ['petto', [0, 1.44, 0.2], 0x7dffa8, 0.12, 0.45, 5]],
    attacchi: { sparo: 0.45 },
    fervore: (s) => s.att ? 1.6 * chiavi(s.att.t, [[0, 0], [0.04, 1], [0.3, 0]]) : 0,
    posa(o, s, t) {
      const v = s.v, w = sstep(0.04, 0.5, v), A = s.A, f = s.fase, d = s.dir, cd = Math.cos(d), sd = Math.sin(d);
      o.petto.rotation.x += 0.02 * Math.sin(t * 1.9); o.collo.rotation.x += 0.03; o.testa.rotation.y += 0.35 * n3(t * 0.5, 4, 0); o.testa.rotation.x += 0.06 * n3(t * 0.4, 5, 0);
      presaNovizio(o); o.avR.rotation.x += 0.04 * Math.sin(t * 1.3);
      o.braccioL.rotation.z -= 0.5; o.braccioL.rotation.x += 0.05; o.avL.rotation.x -= 0.25; o.manoL.rotation.x += 0.1;
      gamba(o.cosciaL, o.stincoL, o.piedeL, f, A, 1.0, w, d); gamba(o.cosciaR, o.stincoR, o.piedeR, f + PI, A, 1.0, w, d);
      o.radice.position.y += w * 0.04 * (Math.abs(Math.cos(f)) - 0.6);
      o.radice.rotation.y += 0.1 * A * Math.sin(f) * w * cd; o.petto.rotation.y -= 0.12 * A * Math.sin(f) * w * cd;
      o.braccioL.rotation.x += A * 0.8 * Math.sin(f) * w * cd;
      o.spina.rotation.x += 0.07 * w * cd; o.radice.rotation.z -= 0.06 * w * sd;
      o.tabarda.rotation.x += Math.min(0, o.cosciaL.rotation.x, o.cosciaR.rotation.x) * 0.9; o.tabardaD.rotation.x += Math.max(0, o.cosciaL.rotation.x, o.cosciaR.rotation.x) * 0.9;
      if (s.att) {   // sparo: il bastone rincula verso l'alto, il busto arretra
        const k = chiavi(s.att.t, [[0, 0], [0.05, 1], [0.45, 0]]);
        o.avR.rotation.x -= 0.45 * k; o.braccioR.rotation.x -= 0.15 * k; o.petto.rotation.x -= 0.1 * k; o.testa.rotation.x -= 0.06 * k;
      }
      const h = colpo(s);
      if (h > 0) { o.petto.rotation.x -= 0.35 * h; o.spina.rotation.x -= 0.15 * h; o.testa.rotation.x -= 0.3 * h; o.testa.rotation.z += 0.3 * h * s.hd; o.radice.position.z -= 0.05 * h; o.braccioL.rotation.z += 0.3 * h; }
      if (s.morte >= 0) {   // morte: cade in ginocchio, poi in avanti
        const m = s.morte, k1 = sstep(0, 0.4, m), k2 = sstep(0.45, 1.0, m);
        o.radice.position.y -= 0.42 * k1 + 0.28 * k2; o.radice.position.z += 0.18 * k2; o.radice.rotation.x += 1.3 * k2;
        LATI.forEach(([sg, l]) => { o['coscia' + l].rotation.x -= 1.3 * k2 - 0.1 * k1; o['stinco' + l].rotation.x += 1.45 * k1; o['piede' + l].rotation.x += 0.3 * k1; o['braccio' + l].rotation.x -= 0.6 * k2; o['braccio' + l].rotation.z += sg * 0.25 * k1; });
        o.testa.rotation.x += 0.35 * k1; o.spina.rotation.x += 0.2 * k1;
      }
    }
  };

  /* =====================================================================
     GUARDACRIPTA: colosso corazzato, spallacci a tre piastre, elmo con corna ricurve, occhio nel petto.
     Mannaia di ferro nella destra, scudo d'osso con anello di luce nella sinistra.
     ===================================================================== */
  const MANNAIA = {
    h: 0.014, bb: [-0.1, -0.5, -0.62, 0.1, 0.22, 1.45], uv: 0.3, ao: 0.6,
    parti() {
      const S = Scultura();
      S.u(CA([0, 0, -0.4], [0, 0, 0.3], 0.034, 0.03), null, cuoioC, { k: 0, rv: 0.7, rug: 0.004, dsp: (x, y, z, d) => d + 0.003 * Math.sin(z * 75 + Math.atan2(y, x)) });
      S.u(SF([0, 0, -0.43], 0.05), null, bronzoC, { k: 0.01, rv: 0.32, mt: 0.9 });
      S.u(CA([0, 0, -0.46], [0, 0, -0.6], 0.034, 0.004), null, bronzoC, { k: 0.008, rv: 0.32, mt: 0.9 });
      S.u(SC([0, -0.02, 0.31], [0.05, 0.1, 0.035], 0.015), null, bronzoC, { k: 0.01, rv: 0.32, mt: 0.9 });
      // lama: piu' spessa sul dorso, sottile sul filo, ventre curvo e punta tagliata
      const fondo = z => -0.38 - 0.07 * Math.sin(clamp((z - 0.34) / 1.04, 0, 1) * PI);
      S.u(XX((x, y, z) => {
        const bot = fondo(z), top = 0.12, dy = Math.max(y - top, bot - y), dz = Math.max(0.34 - z, z - (1.38 - 0.24 * sstep(-0.2, 0.12, y))), th = 0.005 + 0.026 * sstep(bot, top, y), dx = Math.abs(x) - th;
        return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dy, dz), 0);
      }, [-0.04, -0.48, 0.32, 0.04, 0.14, 1.4]), null, (x, y, z) => { const c = ferroC(x, y, z), fil = sstep(-0.2, fondo(z) + 0.01, y); return [mix(c[0], 0.5, fil), mix(c[1], 0.49, fil), mix(c[2], 0.47, fil)]; }, { k: 0.008, rv: 0.42, mt: 0.85, rug: 0.003, dsp: (x, y, z, d) => d + 0.0018 * n3(x * 40, y * 40, z * 40) });
      [0.55, 0.83, 1.12].forEach((z, i) => S.s(SF([0, fondo(z) - 0.006, z], 0.022 + i * 0.006), { k: 0.004 }));   // tacche sul filo
      S.s(CA([-0.1, 0.0, 1.12], [0.1, 0.0, 1.12], 0.045), { k: 0.006, col: [0.15, 0.14, 0.14] });
      S.u(CA([0, 0.12, 0.36], [0, 0.12, 1.2], 0.018, 0.012), null, bronzoC, { k: 0.008, rv: 0.32, mt: 0.9 });
      return S;
    },
    osso: 'manoR', rot: [0.5, 0, 0], off: [0, -0.04, 0.02]
  };
  const SCUDO = {
    h: 0.014, bb: [-0.72, -0.72, -0.14, 0.72, 0.72, 0.28], uv: 0.35, ao: 0.6,
    parti() {
      const S = Scultura();
      S.u(XX((x, y, z) => Math.max(Math.abs(Math.hypot(x, y, z + 0.75) - 0.9) - 0.028, Math.hypot(x, y) - 0.52), [-0.53, -0.53, -0.05, 0.53, 0.53, 0.18]), null, ossoC, { k: 0, rv: 0.5, rug: 0.006, dsp: (x, y, z, d) => d + 0.003 * n3(x * 22, y * 22, z * 22) + 0.0016 * n3(x * 80, y * 80, z * 80) });
      S.u(TO([0, 0, -0.012], 'z', 0.52, 0.036), null, bronzoC, { k: 0.01, rv: 0.35, mt: 0.88 });
      S.u(SF([0, 0, 0.13], 0.1), null, bronzoC, { k: 0.02, rv: 0.3, mt: 0.9 });
      S.u(TO([0, 0, 0.16], 'z', 0.14, 0.014), null, VERDE, { k: 0.006, lu: 1, rv: 0.3 });
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * PI * 2 + 0.26, c = Math.cos(a), s = Math.sin(a);
        S.u(CA([0.52 * c, 0.52 * s, -0.012], [0.7 * c, 0.7 * s, -0.06], 0.04, 0.005), null, ossoC, { k: 0.012, rv: 0.45 });
        S.u(CA([0.17 * c, 0.17 * s, 0.13], [0.47 * c, 0.47 * s, 0.03], 0.02, 0.014), null, ossoC, { k: 0.012, rv: 0.45 });
      }
      return S;
    },
    osso: 'avL', rot: [-0.1, 0.35, 0], off: [0.02, 0.06, 0.24], luci: [[0, 0, 0.18, 0x7dffa8, 0.5, 0.35, 4]]
  };
  const presaGuarda = (o) => { o.braccioR.rotation.z += 0.45; o.braccioR.rotation.x -= 0.25; o.avR.rotation.x -= 0.7; o.braccioL.rotation.z -= 0.4; o.braccioL.rotation.x -= 0.45; o.avL.rotation.x -= 1.1; o.avL.rotation.y += 0.4; };
  const GUARDACRIPTA = {
    nome: 'Guardacripta', alt: 3.2, h: 0.028, bb: [-1.32, -0.02, -0.62, 1.32, 3.24, 0.62], lod: 11, ombra: 2.3, ao: 1.7, uv: 0.45,
    passo: { L: 1.15, A0: 0.18, A1: 0.06, Amax: 0.42 }, morte: 1.35, dis: 1.1, armi: [MANNAIA, SCUDO], presa: presaGuarda,
    ossa: [['radice', null, [0, 1.3, 0]], ['tabarda', 'radice', [0, 1.12, 0.26]], ['spina', 'radice', [0, 1.55, 0]], ['petto', 'spina', [0, 2.0, 0.02]], ['collo', 'petto', [0, 2.42, 0.1]], ['testa', 'collo', [0, 2.55, 0.16]],
      ...LATI.flatMap(([s, l]) => [['braccio' + l, 'petto', [s * 0.62, 2.3, 0]], ['av' + l, 'braccio' + l, [s * 0.92, 1.82, 0.04]], ['mano' + l, 'av' + l, [s * 1.08, 1.36, 0.12]],
        ['coscia' + l, 'radice', [s * 0.26, 1.25, 0]], ['stinco' + l, 'coscia' + l, [s * 0.3, 0.7, 0.08]], ['piede' + l, 'stinco' + l, [s * 0.3, 0.16, -0.02]]])],
    parti() {
      const S = Scultura(), Ch = { rv: 0.36, mt: 0.1, dsp: (x, y, z, d) => d + 0.0025 * n3(x * 45, y * 45, z * 45) }, O = { rv: 0.5, rug: 0.006, dsp: (x, y, z, d) => d + 0.002 * n3(x * 26, y * 26, z * 26) + 0.0006 * n3(x * 90, y * 90, z * 90) };
      const banda = (fr, a) => (x, y, z, d) => d + a * Math.sin(y * fr) + 0.0025 * n3(x * 45, y * 45, z * 45);
      LATI.forEach(([s, l]) => {
        S.u(CA([s * 0.26, 1.25, 0], [s * 0.3, 0.7, 0.08], 0.17, 0.13), 'coscia' + l, chitinaC, Object.assign({ k: 0.06 }, Ch));
        S.u(EL([s * 0.31, 1.0, 0.1], [0.13, 0.2, 0.08]), 'coscia' + l, ossoC, Object.assign({ k: 0.02 }, O));
        S.u(EL([s * 0.3, 0.72, 0.18], [0.11, 0.12, 0.08]), 'stinco' + l, ossoC, Object.assign({ k: 0.02 }, O));
        S.u(CA([s * 0.3, 0.76, 0.24], [s * 0.31, 0.87, 0.36], 0.04, 0.006), 'stinco' + l, ossoC, Object.assign({ k: 0.012 }, O));
        S.u(CA([s * 0.3, 0.7, 0.08], [s * 0.3, 0.16, -0.02], 0.13, 0.1), 'stinco' + l, chitinaC, Object.assign({ k: 0.05 }, Ch));
        S.u(EL([s * 0.3, 0.42, 0.1], [0.1, 0.24, 0.07]), 'stinco' + l, ossoC, Object.assign({ k: 0.02 }, O));
        S.u(CA([s * 0.3, 0.15, -0.09], [s * 0.3, 0.1, 0.18], 0.12, 0.1), 'piede' + l, chitinaC, Object.assign({ k: 0.04 }, Ch));
        S.u(EL([s * 0.3, 0.085, 0.2], [0.12, 0.075, 0.13]), 'piede' + l, ossoC, Object.assign({ k: 0.015 }, O));
        [-1, 0, 1].forEach(f => S.u(CA([s * (0.3 + f * 0.07), 0.06, 0.28], [s * (0.3 + f * 0.085), 0.02, 0.41], 0.035, 0.008), 'piede' + l, ossoC, { k: 0.012, rv: 0.45 }));
      });
      // bacino, cintura, tabarda (pannello davanti che le cosce spingono quando cammina)
      S.u(EL([0, 1.3, 0], [0.36, 0.2, 0.25]), 'radice', chitinaC, Object.assign({ k: 0.06 }, Ch));
      S.u(XX((x, y, z) => Math.hypot(Math.hypot(x, z * 1.4) - 0.36, y - 1.4) - 0.05, [-0.42, 1.34, -0.3, 0.42, 1.46, 0.3]), 'radice', bronzoC, { k: 0.015, rv: 0.35, mt: 0.85 });
      S.u(SC([0, 0.92, 0.28], [0.13, 0.27, 0.014], 0.012, [-0.05, 0, 0]), 'tabarda', stoffaC, { k: 0.02, rv: 0.95, rug: 0.06, forma: true, dsp: (x, y, z, d) => Math.max(d + 0.006 * Math.sin(x * 30) + 0.002 * n3(x * 40, y * 40, z * 40), (0.7 + 0.06 * n3(x * 14, 3, z * 14)) - y) });
      // ventre a segmenti, torace enorme con piastra d'osso e occhio, gobba con creste
      S.u(CA([0, 1.38, 0], [0, 1.85, 0.0], 0.3, 0.36), 'spina', chitinaC, { k: 0.07, rv: 0.36, mt: 0.1, rug: 0.014, dsp: banda(34, 0.011) });
      S.u(EL([0, 2.05, 0.03], [0.5, 0.36, 0.34]), 'petto', chitinaC, Object.assign({ k: 0.07 }, Ch));
      S.u(EL([0, 2.05, 0.14], [0.42, 0.3, 0.25]), 'petto', ossoC, Object.assign({ k: 0.015 }, O));
      [1.94, 2.04, 2.15].forEach((y, i) => S.s(XX((x, yy, z) => Math.hypot(yy - y - 0.04 * Math.cos(x * 3), z - 0.37 + Math.abs(x) * 0.25) - 0.011, [-0.45, y - 0.08, 0.18, 0.45, y + 0.08, 0.42]), { col: NERO, k: 0.006 }));
      S.u(TO([0, 2.08, 0.37], 'z', 0.075, 0.022), 'petto', bronzoC, { k: 0.01, rv: 0.35, mt: 0.85 });
      S.s(EL([0, 2.08, 0.4], [0.055, 0.045, 0.04]), { col: VERDE, lu: 1, k: 0.006 });
      S.u(EL([0, 2.22, -0.17], [0.38, 0.3, 0.24]), 'petto', chitinaC, Object.assign({ k: 0.06 }, Ch));
      for (let i = 0; i < 4; i++) LATI.forEach(([s]) => S.u(CA([s * 0.13, 2.35 - i * 0.13, -0.32 + i * 0.03], [s * 0.16, 2.5 - i * 0.14, -0.55 + i * 0.03], 0.045, 0.006), 'petto', ossoC, Object.assign({ k: 0.015 }, O)));
      // spallacci a tre piastre con aculei, braccia corazzate
      LATI.forEach(([s, l]) => {
        S.u(GU([s * 0.66, 2.34, 0], [0.31, 0.24, 0.31], 0.032, (x, y, z) => 2.25 - y), 'braccio' + l, ossoC, Object.assign({ k: 0.01, inf: 0.07 }, O));
        S.u(GU([s * 0.77, 2.2, 0], [0.27, 0.18, 0.28], 0.028, (x, y, z) => 2.1 - y), 'braccio' + l, ossoC, Object.assign({ k: 0.008, inf: 0.07 }, O));
        S.u(GU([s * 0.85, 2.07, 0], [0.22, 0.14, 0.25], 0.025, (x, y, z) => 1.98 - y), 'braccio' + l, chitinaC, Object.assign({ k: 0.008, inf: 0.07 }, Ch));
        [[0.66, 2.25, 0.287, 0.287], [0.77, 2.1, 0.224, 0.232], [0.85, 1.98, 0.168, 0.19]].forEach(([cx, yc, ax, az]) => S.u(XX((x, y, z) => Math.hypot(Math.hypot(x - s * cx, z * ax / az) - ax, y - yc) - 0.02, [s * cx - ax - 0.03, yc - 0.03, -az - 0.03, s * cx + ax + 0.03, yc + 0.03, az + 0.03].map((v, i) => v)), 'braccio' + l, bronzoC, { k: 0.006, rv: 0.35, mt: 0.85, inf: 0.07 }));   // bordi di bronzo
        for (let i = 0; i < 3; i++) S.u(CA([s * (0.55 + i * 0.12), 2.52 - i * 0.05, -0.05 + i * 0.04], [s * (0.6 + i * 0.17), 2.86 - i * 0.1, -0.15], 0.06, 0.008), 'braccio' + l, ossoC, Object.assign({ k: 0.015 }, O));
        S.u(CA([s * 0.62, 2.3, 0], [s * 0.92, 1.82, 0.04], 0.16, 0.13), 'braccio' + l, chitinaC, Object.assign({ k: 0.05 }, Ch));
        S.u(CA([s * 0.93, 1.85, -0.06], [s * 0.98, 1.9, -0.3], 0.05, 0.006), 'braccio' + l, ossoC, Object.assign({ k: 0.012 }, O));
        S.u(CA([s * 0.92, 1.82, 0.04], [s * 1.08, 1.36, 0.12], 0.14, 0.12), 'av' + l, chitinaC, Object.assign({ k: 0.05 }, Ch));
        S.u(SC([s * 1.03, 1.6, 0.13], [0.1, 0.2, 0.06], 0.04, [0, 0, s * 0.33]), 'av' + l, ossoC, Object.assign({ k: 0.015 }, O));
        S.u(EL([s * 1.115, 1.28, 0.14], [0.1, 0.12, 0.1]), 'mano' + l, chitinaC, Object.assign({ k: 0.03 }, Ch));
        S.u(CA([s * 1.07, 1.2, 0.225], [s * 1.18, 1.215, 0.19], 0.035), 'mano' + l, ossoC, { k: 0.012, rv: 0.5 });
      });
      // collo incassato, elmo con visiera, sopracciglio, paramento della mascella, corna ricurve
      S.u(CA([0, 2.35, 0.06], [0, 2.5, 0.14], 0.13, 0.12), 'collo', chitinaC, Object.assign({ k: 0.05 }, Ch));
      S.u(EL([0, 2.6, 0.18], [0.17, 0.18, 0.19]), 'testa', ossoC, Object.assign({ k: 0.02 }, O));
      S.s(SC([0, 2.58, 0.36], [0.1, 0.016, 0.06], 0.01), { col: VERDE, lu: 1, k: 0.005 });
      S.u(CA([-0.15, 2.665, 0.3], [0.15, 2.665, 0.3], 0.034), 'testa', ossoC, Object.assign({ k: 0.015 }, O));
      S.u(EL([0, 2.5, 0.27], [0.12, 0.07, 0.09]), 'testa', ossoC, Object.assign({ k: 0.015 }, O));
      LATI.forEach(([s]) => catena(S, [[s * 0.14, 2.68, 0.13], [s * 0.32, 2.78, 0.05], [s * 0.42, 2.95, -0.05], [s * 0.44, 3.13, -0.02]], [0.06, 0.045, 0.028, 0.008], 'testa', ossoC, Object.assign({ k: 0.02 }, O)));
      return S;
    },
    luci: [['testa', [0, 2.58, 0.39], 0x7dffa8, 0.32, 0.5, 2.5], ['petto', [0, 2.08, 0.43], 0x7dffa8, 0.28, 0.55, 3.5]],
    attacchi: { fendente: 1.0, lancio: 0.8 },
    fervore: (s) => s.att && s.att.k === 'lancio' ? 1.5 * chiavi(s.att.t, [[0, 0], [0.12, 1], [0.5, 0]]) : 0,
    posa(o, s, t) {
      const v = s.v, w = sstep(0.04, 0.4, v), A = s.A, f = s.fase, d = s.dir, cd = Math.cos(d), sd = Math.sin(d);
      const r = Math.sin(t * 1.3);
      o.petto.rotation.x += 0.035 * r; LATI.forEach(([sg, l]) => { o['braccio' + l].rotation.z -= sg * 0.04 * r; });
      o.testa.rotation.y += 0.25 * n3(t * 0.35, 6, 0); o.testa.rotation.x += 0.05;
      presaGuarda(o); o.avR.rotation.x += 0.05 * r;
      gamba(o.cosciaL, o.stincoL, o.piedeL, f, A, 0.9, w, d); gamba(o.cosciaR, o.stincoR, o.piedeR, f + PI, A, 0.9, w, d);
      o.radice.position.y += w * 0.075 * (Math.abs(Math.cos(f)) - 0.6);
      o.radice.rotation.z += 0.06 * Math.sin(f) * w; o.petto.rotation.z -= 0.04 * Math.sin(f) * w;
      o.radice.rotation.y += 0.08 * Math.sin(f) * w * cd; o.petto.rotation.y -= 0.1 * Math.sin(f) * w * cd;
      o.spina.rotation.x += 0.08 * w * cd; o.radice.rotation.z -= 0.05 * w * sd;
      if (s.att && s.att.k === 'fendente') {   // fendente dall'alto: carica, colpo, passo in avanti
        const a = s.att.t, l = chiavi(a, [[0, 0], [0.26, 1], [0.7, 0.8], [1, 0]]);
        o.braccioR.rotation.x += chiavi(a, [[0, 0], [0.12, -2.7], [0.26, -0.15], [0.6, -0.3], [1, 0]]); o.avR.rotation.x += chiavi(a, [[0, 0], [0.12, -0.6], [0.26, 0.15], [1, 0]]); o.braccioR.rotation.z += chiavi(a, [[0, 0], [0.12, -0.25], [0.26, 0.15], [1, 0]]);
        o.petto.rotation.y += chiavi(a, [[0, 0], [0.12, 0.3], [0.26, -0.25], [1, 0]]); o.petto.rotation.x += chiavi(a, [[0, 0], [0.12, -0.15], [0.26, 0.35], [0.6, 0.25], [1, 0]]); o.spina.rotation.x += 0.15 * l;
        o.radice.position.z += 0.25 * l; o.radice.position.y -= 0.1 * l; o.cosciaL.rotation.x -= 0.35 * l; o.stincoL.rotation.x += 0.3 * l; o.cosciaR.rotation.x += 0.2 * l;
      } else if (s.att) {   // lancio: la mannaia punta il bersaglio e l'occhio nel petto avvampa
        const a = s.att.t;
        o.braccioR.rotation.x += chiavi(a, [[0, 0], [0.15, -1.3], [0.35, -1.1], [0.8, 0]]); o.avR.rotation.x += chiavi(a, [[0, 0], [0.15, 0.5], [0.8, 0]]);
        o.petto.rotation.y += chiavi(a, [[0, 0], [0.15, 0.25], [0.8, 0]]); o.petto.rotation.x -= 0.1 * chiavi(a, [[0, 0], [0.15, 1], [0.8, 0]]);
      }
      const h = colpo(s) * 0.45;
      if (h > 0) { o.petto.rotation.x -= 0.3 * h; o.testa.rotation.x -= 0.25 * h; o.testa.rotation.z += 0.25 * h * s.hd; o.radice.position.z -= 0.05 * h; }
      // tabarda: la spinge in avanti la coscia piu' avanzata, poi oscilla
      o.tabarda.rotation.x += Math.min(0, o.cosciaL.rotation.x, o.cosciaR.rotation.x) * 0.9 + 0.03 * Math.sin(t * 1.7);
      if (s.morte >= 0) {   // morte: crolla in ginocchio e si abbatte in avanti
        const m = s.morte, k1 = sstep(0, 0.45, m), k2 = sstep(0.5, 1.15, m);
        o.radice.position.y -= 0.52 * k1 + 0.45 * k2; o.radice.position.z += 0.3 * k2; o.radice.rotation.x += 1.25 * k2;
        LATI.forEach(([sg, l]) => { o['coscia' + l].rotation.x -= 1.25 * k2 - 0.1 * k1; o['stinco' + l].rotation.x += 1.45 * k1; o['piede' + l].rotation.x += 0.3 * k1; o['braccio' + l].rotation.x -= 0.5 * k2; o['braccio' + l].rotation.z += sg * 0.3 * k1; });
        o.testa.rotation.x += 0.3 * k1; o.spina.rotation.x += 0.15 * k1; o.tabarda.rotation.x -= 0.6 * k2;
      }
    }
  };

  /* =====================================================================
     CANTRICE DEL LUTTO: figura alta che fluttua, veste lunga che si sfrangia in lembi, collare d'osso a ventaglio,
     corona di spine, maschera stretta con gli occhi accesi, braccia lunghissime con dita sottili e mani di luce.
     ===================================================================== */
  const CANTRICE = {
    nome: 'Cantrice del Lutto', alt: 2.45, h: 0.02, bb: [-0.86, -0.02, -0.42, 0.86, 2.3, 0.42], lod: 8, ombra: 0, uv: 0.3, ao: 1.1,
    passo: { L: 1, A0: 0.2, A1: 0, Amax: 0.2 }, morte: 0.55, dis: 1.1, bagliore: 0x8dffb8,
    ossa: [['radice', null, [0, 1.05, 0]], ['veste1', 'radice', [0, 0.85, 0]], ['veste2', 'veste1', [0, 0.5, 0]], ['veste3', 'veste2', [0, 0.2, 0]],
      ['spina', 'radice', [0, 1.2, 0]], ['petto', 'spina', [0, 1.5, 0]], ['collo', 'petto', [0, 1.72, 0]], ['testa', 'collo', [0, 1.85, 0.02]],
      ...LATI.flatMap(([s, l]) => [['braccio' + l, 'petto', [s * 0.2, 1.68, 0]], ['av' + l, 'braccio' + l, [s * 0.45, 1.42, 0.04]], ['mano' + l, 'av' + l, [s * 0.66, 1.2, 0.1]], ['dita' + l, 'mano' + l, [s * 0.69, 1.13, 0.12]]])],
    parti() {
      const S = Scultura(), Ch = { rv: 0.4, mt: 0.08 }, O = { dsp: porosoO, rv: 0.5 }, maschera = tinta(0.3, 0.29, 0.29, 0.12, 9), vesteC = (x, y, z) => { const c = stoffaC(x, y, z), k = mix(0.4, 1, sstep(0, 1.1, y)); return [c[0] * k, c[1] * k, c[2] * k]; };
      const pieghe = (a0) => (x, y, z, d) => d + 0.018 * Math.sin(Math.atan2(z, x) * 13 + y * 2.2 + a0) + 0.003 * n3(x * 30, y * 30, z * 30);
      // veste a tre fasce lungo la catena (cosi' ondeggia), con l'orlo sfrangiato in lembi
      S.u(EL([0, 1.05, 0], [0.18, 0.12, 0.15]), 'radice', vesteC, { k: 0.05, rv: 0.95, rug: 0.02, dsp: pieghe(0) });
      S.u(CA([0, 1.0, 0], [0, 0.6, 0], 0.19, 0.27), 'veste1', vesteC, { k: 0.08, rv: 0.95, rug: 0.022, dsp: pieghe(0.5) });
      S.u(CA([0, 0.6, 0], [0, 0.27, 0], 0.27, 0.33), 'veste2', vesteC, { k: 0.08, rv: 0.95, rug: 0.022, dsp: pieghe(1) });
      S.u(XX((x, y, z) => { const a = Math.atan2(z, x), r = Math.hypot(x, z), R = mix(0.33, 0.3, clamp((0.27 - y) / 0.25, 0, 1)), lembi = 0.5 + 0.5 * Math.sin(a * 11 + 1.5 * n3(x * 5, 0, z * 5)), bot = 0.02 + 0.3 * lembi; return Math.max(r - R, y - 0.3, bot - y); }, [-0.36, 0, -0.36, 0.36, 0.32, 0.36]), 'veste3', vesteC, { k: 0.06, rv: 0.95, rug: 0.03, dsp: pieghe(1.5) });
      S.u(TO([0, 1.12, 0], 'y', 0.16, 0.018), 'radice', bronzoC, { k: 0.01, rv: 0.35, mt: 0.85 });
      // vita sottile, busto con costole d'osso, spalle a punta, collare a ventaglio
      S.u(CA([0, 1.12, 0], [0, 1.35, 0], 0.09, 0.12), 'spina', chitinaC, Object.assign({ k: 0.05 }, Ch));
      S.u(EL([0, 1.47, 0], [0.15, 0.17, 0.11]), 'petto', chitinaC, Object.assign({ k: 0.05 }, Ch));
      for (let i = 0; i < 5; i++) LATI.forEach(([s]) => S.u(CA([s * 0.025, 1.37 + i * 0.045, 0.105 - Math.abs(i - 2) * 0.004], [s * 0.13, 1.355 + i * 0.045, 0.05], 0.012, 0.009), 'petto', ossoC, Object.assign({ k: 0.008 }, O)));
      S.u(CA([0, 1.36, 0.105], [0, 1.6, 0.1], 0.016, 0.013), 'petto', ossoC, Object.assign({ k: 0.008 }, O));
      S.s(SF([0, 1.5, 0.115], 0.018), { col: VERDE, lu: 1, k: 0.004 });
      LATI.forEach(([s, l]) => {
        S.u(EL([s * 0.2, 1.7, 0], [0.08, 0.06, 0.08]), 'braccio' + l, ossoC, Object.assign({ k: 0.015, inf: 0.04 }, O));
        S.u(CA([s * 0.22, 1.73, -0.02], [s * 0.29, 1.93, -0.06], 0.03, 0.004), 'braccio' + l, ossoC, Object.assign({ k: 0.01 }, O));
        // braccia lunghe, manica a campana, mani ossute con dita lunghe
        S.u(CA([s * 0.2, 1.68, 0], [s * 0.45, 1.42, 0.04], 0.034, 0.029), 'braccio' + l, chitinaC, Object.assign({ k: 0.025 }, Ch));
        S.u(XX((x, y, z) => { const d0 = conoTondo(x, y, z, s * 0.44, 1.43, 0.04, s * 0.63, 1.22, 0.11, 0.045, 0.085); return Math.max(Math.abs(d0) - 0.013, -conoTondo(x, y, z, s * 0.66, 1.19, 0.12, s * 0.75, 1.09, 0.15, 0.08, 0.08)); }, [Math.min(s * 0.44, s * 0.75) - 0.13, 1.0, -0.06, Math.max(s * 0.44, s * 0.75) + 0.13, 1.55, 0.25]), 'av' + l, stoffaC, { k: 0.015, rv: 0.95, dsp: (x, y, z, d) => d + 0.004 * n3(x * 30, y * 30, z * 30) });
        S.u(CA([s * 0.45, 1.42, 0.04], [s * 0.66, 1.2, 0.1], 0.027, 0.023), 'av' + l, chitinaC, Object.assign({ k: 0.02 }, Ch));
        S.u(EL([s * 0.68, 1.17, 0.11], [0.026, 0.036, 0.02]), 'mano' + l, ossoC, Object.assign({ k: 0.012 }, O));
        [-1.5, -0.5, 0.5, 1.5].forEach(f => catena(S, [[s * (0.69 + f * 0.003), 1.14, 0.11 + f * 0.012], [s * (0.705 + f * 0.004), 1.07, 0.125 + f * 0.016], [s * (0.71 + f * 0.005), 1.0, 0.14 + f * 0.018]], [0.0085, 0.0068, 0.0025], 'dita' + l, ossoC, { k: 0.005, rv: 0.45 }));
      });
      // collare d'osso curvo dietro la testa, con una fila di spine sul bordo
      S.u(GU([0, 1.8, 0.0], [0.21, 0.24, 0.17], 0.014, (x, y, z) => Math.max(z + 0.035, 1.7 - y)), 'petto', ossoC, Object.assign({ k: 0.012, inf: 0.03 }, O));
      for (let i = -3; i <= 3; i++) { const a = i * 0.36, x = Math.sin(a) * 0.205, z = -Math.cos(a) * 0.15; S.u(CA([x, 1.94 + 0.08 * Math.cos(a), z], [x * 1.2, 2.06 + 0.1 * Math.cos(a) - Math.abs(i) * 0.02, z * 1.2], 0.013, 0.002), 'petto', ossoC, Object.assign({ k: 0.006 }, O)); }
      // testa: maschera stretta con occhi e bocca incisi, cappuccio, corona di spine
      S.u(CA([0, 1.72, 0], [0, 1.8, 0.01], 0.045, 0.04), 'collo', chitinaC, Object.assign({ k: 0.025 }, Ch));
      S.u(EL([0, 1.87, 0.03], [0.085, 0.11, 0.095]), 'testa', maschera, Object.assign({ k: 0.02 }, O));
      LATI.forEach(([s]) => S.s(EL([s * 0.035, 1.89, 0.112], [0.019, 0.011, 0.03]), { col: VERDE, lu: 1, k: 0.004 }));
      S.s(SC([0, 1.8, 0.112], [0.026, 0.0045, 0.03], 0.003), { col: NERO, k: 0.003 });
      S.u(XX((x, y, z) => { const d0 = ellissoide(x, y, z, 0, 1.88, 0, 0.12, 0.14, 0.13); return Math.max(Math.abs(d0) - 0.014, z - 0.035 - 0.15 * (y - 1.82)); }, [-0.14, 1.72, -0.15, 0.14, 2.04, 0.15]), 'testa', stoffaC, { k: 0.012, rv: 0.95, dsp: (x, y, z, d) => d + 0.004 * Math.sin(Math.atan2(z, x) * 9 + y * 6) });
      S.u(TO([0, 2.0, 0.005], 'y', 0.09, 0.012), 'testa', ossoC, Object.assign({ k: 0.008 }, O));
      for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2, c = Math.cos(a), s = Math.sin(a), front = 0.5 + 0.5 * s, L = 0.07 + 0.12 * front; S.u(CA([0.09 * c, 2.0, 0.005 + 0.09 * s], [0.12 * c, 2.0 + L, 0.005 + 0.115 * s], 0.012, 0.002), 'testa', ossoC, Object.assign({ k: 0.006 }, O)); }
      // velo che scende dal cappuccio sulla schiena
      S.u(SC([0, 1.52, -0.17], [0.15, 0.3, 0.01], 0.008, [0.12, 0, 0]), 'petto', stoffaC, { k: 0.02, rv: 0.95, rug: 0.06, forma: true, dsp: (x, y, z, d) => Math.max(d + 0.006 * Math.sin(x * 40), (1.25 + 0.06 * n3(x * 16, 1, z * 16)) - y) });
      return S;
    },
    luci: [['testa', [-0.035, 1.89, 0.125], 0x8dffb8, 0.045, 0.55, 5], ['testa', [0.035, 1.89, 0.125], 0x8dffb8, 0.045, 0.55, 5], ['petto', [0, 1.5, 0.13], 0x8dffb8, 0.12, 0.45, 3],
      ['manoL', [0.7, 1.1, 0.13], 0x8dffb8, 0.45, 0.45, 2.3], ['manoR', [-0.7, 1.1, 0.13], 0x8dffb8, 0.45, 0.45, 2.7],
      ['radice', [0, 1.25, 0], 0x6dffa0, 2.6, 0.13, 1.6], ['veste3', [0, 0.05, 0], 0x6dffa0, 1.3, 0.22, 2.1]],   // alone intorno a lei e luce sotto l'orlo: si vede da lontano
    attacchi: { canto: 0.7 },
    fervore: (s) => s.att ? 1.3 * chiavi(s.att.t, [[0, 0], [0.15, 1], [0.45, 0.6], [0.7, 0]]) : 0,
    posa(o, s, t) {
      const drag = clamp(s.vf * 0.12, -0.3, 0.3), side = clamp(s.vs * 0.12, -0.3, 0.3);
      o.radice.position.y += 0.06 * Math.sin(t * 1.6);
      o.veste1.rotation.x += 0.04 * Math.sin(t * 1.3) - drag * 0.3; o.veste2.rotation.x += 0.07 * Math.sin(t * 1.3 - 0.8) - drag * 0.5; o.veste3.rotation.x += 0.1 * Math.sin(t * 1.3 - 1.6) - drag * 0.6;
      o.veste1.rotation.z += 0.03 * Math.sin(t * 1.1) + side * 0.3; o.veste2.rotation.z += 0.05 * Math.sin(t * 1.1 - 0.9) + side * 0.5; o.veste3.rotation.z += 0.08 * Math.sin(t * 1.1 - 1.8) + side * 0.6;
      o.veste3.rotation.y += 0.1 * Math.sin(t * 0.7);
      o.spina.rotation.x += 0.03 * Math.sin(t * 1.6 + 0.5) + drag * 0.2; o.petto.rotation.x += 0.02 * Math.sin(t * 1.6 + 1);
      o.testa.rotation.z += 0.12 * Math.sin(t * 0.7); o.testa.rotation.x += 0.08 * Math.sin(t * 0.9);
      LATI.forEach(([sg, l]) => {
        o['braccio' + l].rotation.z -= sg * (0.22 + 0.1 * Math.sin(t * 1.2 + sg)); o['braccio' + l].rotation.x += -0.35 + 0.12 * Math.sin(t * 1.5 + sg * 1.3);
        o['av' + l].rotation.x += -0.5 + 0.15 * Math.sin(t * 1.7 + sg); o['mano' + l].rotation.x += 0.2 * Math.sin(t * 2 + sg); o['dita' + l].rotation.x += 0.3 + 0.2 * Math.sin(t * 2.4 + sg * 2);
      });
      if (s.att) {   // canto: le braccia si tendono verso il bersaglio, la testa si rovescia
        const k = chiavi(s.att.t, [[0, 0], [0.15, 1], [0.4, 0.9], [0.7, 0]]);
        LATI.forEach(([sg, l]) => { o['braccio' + l].rotation.x -= 1.1 * k; o['braccio' + l].rotation.z += sg * 0.15 * k; o['av' + l].rotation.x += 0.35 * k; o['dita' + l].rotation.x -= 0.6 * k; });
        o.testa.rotation.x -= 0.3 * k; o.petto.rotation.x -= 0.15 * k; o.radice.position.y += 0.1 * k;
      }
      const h = colpo(s);
      if (h > 0) { o.petto.rotation.x -= 0.4 * h; o.radice.position.z -= 0.12 * h; o.testa.rotation.x -= 0.3 * h; o.testa.rotation.z += 0.3 * h * s.hd; o.veste2.rotation.x += 0.2 * h; o.veste3.rotation.x += 0.3 * h; }
      if (s.morte >= 0) {   // morte: si apre in croce, sale, trema e si disfa in cenere a mezz'aria
        const m = s.morte, k = sstep(0, 0.45, m), tr = Math.sin(m * 30) * 0.08 * k;
        LATI.forEach(([sg, l]) => { o['braccio' + l].rotation.z += sg * 1.0 * k; o['braccio' + l].rotation.x += 0.2 * k + tr; o['dita' + l].rotation.x -= 0.5 * k; });
        o.testa.rotation.x -= 0.6 * k; o.petto.rotation.x -= 0.25 * k + tr; o.radice.position.y += 0.35 * k;
        o.veste2.rotation.x += 0.2 * Math.sin(m * 9) * k; o.veste3.rotation.x += 0.3 * Math.sin(m * 9 - 1) * k;
      }
    }
  };


  /* =====================================================================
     BOSS. Si scolpiscono a misura d'uomo e il gioco li ingrandisce (scala 2.4).
     punti: posizioni da seguire nel gioco (ventre, schiena, bocca, punta del bastone), date nella posa di riposo.
     ===================================================================== */
  const oroC = (x, y, z) => { const n = n3(x * 10, y * 10, z * 10 + 4), vr = clamp(n3(x * 4 + 2, y * 4, z * 4) * 1.4, 0, 1); return [mix(0.86, 0.5, vr) + 0.06 * n, mix(0.64, 0.4, vr) + 0.05 * n, mix(0.26, 0.2, vr) + 0.03 * n]; };
  const AMBRA = [1.0, 0.7, 0.28], ROSSO = [0.95, 0.22, 0.14];
  const ORO = { rv: 0.3, mt: 0.9, dsp: (x, y, z, d) => d + 0.0018 * n3(x * 40, y * 40, z * 40) };

  // Gran Officiante: sacerdote gigante, veste a campana con la stola d'oro, corazza d'oro con la gemma d'ambra,
  // maschera d'osso, mitra alta con l'Occhio Ardente, manto alle spalle, pastorale con la sfera d'ambra
  const PASTORALE = {
    h: 0.014, bb: [-0.26, -0.26, -1.15, 0.26, 0.26, 1.78], uv: 0.2, ao: 0.6,
    parti() {
      const S = Scultura();
      S.u(CA([0, 0, -1.1], [0, 0, 1.2], 0.038, 0.034), null, scuroC, { k: 0, rv: 0.45, mt: 0.2, dsp: (x, y, z, d) => d + 0.004 * Math.sin(Math.atan2(y, x) * 3 + z * 22) });
      [-0.75, -0.2, 0.45, 1.0].forEach(zc => S.u(TO([0, 0, zc], 'z', 0.042, 0.016), null, oroC, Object.assign({ k: 0.008 }, ORO)));
      S.u(CA([0, 0, -0.12], [0, 0, 0.12], 0.046), null, cuoioC, { k: 0.006, rv: 0.7, dsp: (x, y, z, d) => d + 0.003 * Math.sin(z * 90) });
      S.u(EL([0, 0, 1.24], [0.07, 0.07, 0.1]), null, oroC, Object.assign({ k: 0.02 }, ORO));
      // quattro artigli d'oro che stringono la sfera
      for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4, c = Math.cos(a), s = Math.sin(a); catena(S, [[0.05 * c, 0.05 * s, 1.27], [0.16 * c, 0.16 * s, 1.38], [0.19 * c, 0.19 * s, 1.52], [0.13 * c, 0.13 * s, 1.66], [0.05 * c, 0.05 * s, 1.72]], [0.03, 0.026, 0.02, 0.013, 0.004], null, oroC, Object.assign({ k: 0.01 }, ORO)); }
      S.u(CA([0, 0, -1.1], [0, 0, -1.14], 0.04, 0.006), null, oroC, Object.assign({ k: 0.006 }, ORO));
      return S;
    },
    osso: 'manoR', rot: [-PI / 2, 0, 0], off: [0, 0, 0.02], punta: [0, 0, 1.5],
    cristalli: [[0, 0, 1.5, 0.15, 1.15]], luci: [[0, 0, 1.5, 0xffd27a, 1.1, 0.75, 2.2]]
  };
  const presaOfficiante = (o) => { o.braccioR.rotation.z += 0.32; o.braccioR.rotation.x -= 0.35; o.avR.rotation.x -= 0.75; o.avR.rotation.z -= 0.25; };
  const OFFICIANTE = {
    nome: 'Gran Officiante', alt: 3.45, h: 0.03, bb: [-1.12, -0.02, -0.74, 1.12, 3.52, 0.76], lod: 26, ombra: 2.4, ao: 1.8, uv: 0.5,
    passo: { L: 1.2, A0: 0, A1: 0, Amax: 0 }, morte: 2.1, dis: 1.4, bagliore: 0xffc46b, armi: [PASTORALE], presa: presaOfficiante,
    ossa: [['radice', null, [0, 1.2, 0]], ['veste1', 'radice', [0, 1.0, 0]], ['veste2', 'veste1', [0, 0.62, 0]], ['veste3', 'veste2', [0, 0.3, 0]],
      ['spina', 'radice', [0, 1.4, 0]], ['petto', 'spina', [0, 1.85, 0]], ['manto', 'petto', [0, 2.1, -0.28]], ['collo', 'petto', [0, 2.3, 0.02]], ['testa', 'collo', [0, 2.45, 0.05]], ['mitra', 'testa', [0, 2.72, 0.02]],
      ...LATI.flatMap(([s, l]) => [['braccio' + l, 'petto', [s * 0.44, 2.18, 0]], ['av' + l, 'braccio' + l, [s * 0.72, 1.72, 0.06]], ['mano' + l, 'av' + l, [s * 0.88, 1.32, 0.16]], ['dita' + l, 'mano' + l, [s * 0.92, 1.2, 0.19]]])],
    punti: { petto: ['petto', [0, 1.98, 0.36]], occhio: ['mitra', [0, 2.92, 0.14]], bastone: ['arma', 0] },
    parti() {
      const S = Scultura(), Ch = { rv: 0.36, mt: 0.12, dsp: (x, y, z, d) => d + 0.003 * n3(x * 40, y * 40, z * 40) }, O = { rv: 0.5, rug: 0.006, dsp: (x, y, z, d) => d + 0.002 * n3(x * 26, y * 26, z * 26) };
      const vesteC = (x, y, z) => { const c = stoffaC(x, y, z), k = mix(0.45, 1, sstep(0, 1.2, y)); return [c[0] * k, c[1] * k, c[2] * k]; }, maschera = tinta(0.62, 0.56, 0.44, 0.1, 8);
      const pieghe = (a0) => (x, y, z, d) => d + 0.03 * Math.sin(Math.atan2(z, x) * 14 + y * 1.6 + a0) + 0.005 * n3(x * 22, y * 22, z * 22);
      // veste a campana in tre fasce (ondeggia), orlo sfrangiato; stola d'oro sul davanti, cintura e bordo d'oro
      S.u(EL([0, 1.2, 0], [0.36, 0.2, 0.3]), 'radice', vesteC, { k: 0.06, rv: 0.95, rug: 0.03, dsp: pieghe(0) });
      S.u(CA([0, 1.18, 0], [0, 0.72, 0], 0.32, 0.48), 'veste1', vesteC, { k: 0.1, rv: 0.95, rug: 0.035, dsp: pieghe(0.5) });
      S.u(CA([0, 0.72, 0], [0, 0.34, 0], 0.48, 0.6), 'veste2', vesteC, { k: 0.1, rv: 0.95, rug: 0.035, dsp: pieghe(1) });
      S.u(XX((x, y, z) => { const a = Math.atan2(z, x), r = Math.hypot(x, z), R = mix(0.6, 0.66, clamp((0.34 - y) / 0.32, 0, 1)), lembi = 0.5 + 0.5 * Math.sin(a * 13 + 1.5 * n3(x * 4, 0, z * 4)), bot = 0.02 + 0.16 * lembi; return Math.max(r - R, y - 0.36, bot - y); }, [-0.7, 0, -0.7, 0.7, 0.38, 0.7]), 'veste3', vesteC, { k: 0.08, rv: 0.95, rug: 0.04, dsp: pieghe(1.5) });
      S.u(SC([0, 0.96, 0.4], [0.12, 0.25, 0.022], 0.012, [-0.34, 0, 0]), 'veste1', oroC, Object.assign({ k: 0.012 }, ORO));
      S.u(SC([0, 0.55, 0.54], [0.13, 0.2, 0.022], 0.012, [-0.3, 0, 0]), 'veste2', oroC, Object.assign({ k: 0.012 }, ORO));
      S.u(SC([0, 0.2, 0.61], [0.14, 0.17, 0.02], 0.012, [-0.16, 0, 0]), 'veste3', oroC, Object.assign({ k: 0.012 }, ORO));
      [0.98, 0.56].forEach((y, i) => S.s(SC([0, y, i ? 0.565 : 0.425], [0.035, 0.1, 0.02], 0.01, [i ? -0.3 : -0.34, 0, 0]), { col: AMBRA, lu: 0.8, k: 0.006 }));   // glifi d'ambra incisi nella stola
      S.u(TO([0, 1.22, 0], 'y', 0.34, 0.04), 'radice', oroC, Object.assign({ k: 0.015 }, ORO));
      S.u(TO([0, 0.37, 0], 'y', 0.6, 0.03), 'veste2', oroC, Object.assign({ k: 0.012 }, ORO));
      // busto di chitina, corazza d'oro sul petto con la gemma d'ambra in un anello d'osso, costole sotto
      S.u(CA([0, 1.25, 0], [0, 1.7, 0], 0.27, 0.33), 'spina', chitinaC, Object.assign({ k: 0.08 }, Ch));
      S.u(EL([0, 1.95, 0.02], [0.43, 0.36, 0.28]), 'petto', chitinaC, Object.assign({ k: 0.08 }, Ch));
      S.u(GU([0, 1.96, 0.03], [0.45, 0.38, 0.3], 0.03, (x, y, z) => Math.max(0.05 - z, 1.68 - y)), 'petto', oroC, Object.assign({ k: 0.012 }, ORO));
      S.s(EL([0, 1.98, 0.335], [0.085, 0.1, 0.06]), { col: AMBRA, lu: 1, k: 0.008 });
      S.u(TO([0, 1.98, 0.32], 'z', 0.115, 0.024), 'petto', ossoC, Object.assign({ k: 0.01 }, O));
      for (let i = 0; i < 4; i++) LATI.forEach(([s]) => S.u(CA([s * 0.04, 1.42 + i * 0.07, 0.3 - Math.abs(i - 1.5) * 0.006], [s * 0.26, 1.4 + i * 0.07, 0.17], 0.022, 0.016), 'spina', ossoC, Object.assign({ k: 0.012 }, O)));
      // collare alto d'osso dietro la testa, con il ventaglio di spine
      S.u(GU([0, 2.3, -0.02], [0.32, 0.32, 0.25], 0.036, (x, y, z) => Math.max(z + 0.02, 2.14 - y)), 'petto', ossoC, Object.assign({ k: 0.015, inf: 0.05 }, O));
      for (let i = -3; i <= 3; i++) { const a = i * 0.36, x = Math.sin(a) * 0.31, z = -Math.cos(a) * 0.23; S.u(CA([x, 2.5 + 0.1 * Math.cos(a), z], [x * 1.25, 2.68 + 0.12 * Math.cos(a) - Math.abs(i) * 0.03, z * 1.25], 0.022, 0.004), 'petto', ossoC, Object.assign({ k: 0.01 }, O)); }
      // manto che scende dalle spalle, sfrangiato in fondo
      S.u(SC([0, 1.38, -0.34], [0.44, 0.76, 0.036], 0.02, [0.1, 0, 0]), 'manto', stoffaC, { k: 0.04, rv: 0.95, rug: 0.08, forma: true, dsp: (x, y, z, d) => Math.max(d + 0.007 * Math.sin(x * 22), (0.66 + 0.1 * n3(x * 9, 1, z * 9) + 0.06 * Math.abs(Math.sin(x * 11))) - y) });
      LATI.forEach(([s, l]) => {
        // spallacci d'oro a cupola con tre spine d'osso
        S.u(EL([s * 0.47, 2.22, 0], [0.23, 0.17, 0.23]), 'braccio' + l, oroC, Object.assign({ k: 0.03, inf: 0.08 }, ORO));
        S.u(TO([s * 0.47, 2.14, 0], 'y', 0.21, 0.025), 'braccio' + l, ossoC, Object.assign({ k: 0.008 }, O));
        for (let k = 0; k < 3; k++) S.u(CA([s * (0.42 + k * 0.08), 2.34, -0.04 + k * 0.03], [s * (0.5 + k * 0.17), 2.62 - k * 0.07, -0.08 + k * 0.03], 0.035, 0.004), 'braccio' + l, ossoC, Object.assign({ k: 0.01 }, O));
        // maniche larghe, polso di chitina, mano d'osso con dita lunghe
        S.u(CA([s * 0.44, 2.18, 0], [s * 0.72, 1.72, 0.06], 0.12, 0.1), 'braccio' + l, stoffaC, { k: 0.05, rv: 0.95, rug: 0.02, dsp: pieghe(s) });
        S.u(XX((x, y, z) => { const d0 = conoTondo(x, y, z, s * 0.71, 1.74, 0.06, s * 0.86, 1.36, 0.15, 0.1, 0.19); return Math.max(Math.abs(d0) - 0.034, -conoTondo(x, y, z, s * 0.88, 1.32, 0.16, s * 0.95, 1.18, 0.2, 0.16, 0.16)); }, [Math.min(s * 0.71, s * 0.95) - 0.22, 1.1, -0.15, Math.max(s * 0.71, s * 0.95) + 0.22, 1.86, 0.38]), 'av' + l, stoffaC, { k: 0.02, rv: 0.95, dsp: (x, y, z, d) => d + 0.004 * n3(x * 20, y * 20, z * 20) });
        S.u(TO([s * 0.865, 1.355, 0.152], 'y', 0.17, 0.02), 'av' + l, oroC, Object.assign({ k: 0.006 }, ORO));
        S.u(CA([s * 0.74, 1.66, 0.08], [s * 0.88, 1.33, 0.16], 0.055, 0.045), 'av' + l, chitinaC, Object.assign({ k: 0.03 }, Ch));
        S.u(EL([s * 0.9, 1.26, 0.18], [0.06, 0.075, 0.05]), 'mano' + l, ossoC, Object.assign({ k: 0.02 }, O));
        [-1.5, -0.5, 0.5, 1.5].forEach(f => catena(S, [[s * (0.915 + f * 0.004), 1.21, 0.18 + f * 0.022], [s * (0.935 + f * 0.006), 1.1, 0.2 + f * 0.028], [s * (0.94 + f * 0.008), 0.99, 0.22 + f * 0.03]], [0.017, 0.013, 0.005], 'dita' + l, ossoC, { k: 0.008, rv: 0.45 }));
      });
      // testa: maschera d'osso con fessure d'ambra, tentacoli sotto il mento
      S.u(CA([0, 2.26, 0.02], [0, 2.42, 0.05], 0.1, 0.09), 'collo', chitinaC, Object.assign({ k: 0.04 }, Ch));
      S.u(EL([0, 2.55, 0.07], [0.15, 0.19, 0.16]), 'testa', maschera, Object.assign({ k: 0.03 }, O));
      S.u(SC([0, 2.6, 0.2], [0.13, 0.025, 0.03], 0.012, [0, 0, 0]), 'testa', ossoC, Object.assign({ k: 0.02 }, O));
      LATI.forEach(([s]) => S.s(EL([s * 0.062, 2.57, 0.215], [0.034, 0.014, 0.04]), { col: AMBRA, lu: 1, k: 0.006 }));
      S.s(SC([0, 2.45, 0.22], [0.045, 0.008, 0.04], 0.005), { col: NERO, k: 0.005 });
      [-0.08, 0, 0.08].forEach((x, i) => catena(S, [[x, 2.43, 0.17], [x * 1.25, 2.33, 0.2], [x * 1.4, 2.22, 0.19 - i * 0.004], [x * 1.5, 2.12, 0.16]], [0.03, 0.024, 0.016, 0.005], 'testa', pelleC, { k: 0.015, rv: 0.6, dsp: rugaP }));
      // mitra d'oro schiacciata ai lati, con l'Occhio Ardente in un anello d'osso e un ventaglio di punte
      S.u(XX((x, y, z) => Math.max(conoTondo(x, y, z, 0, 2.7, 0.01, 0, 3.32, 0.01, 0.19, 0.035), Math.abs(z - 0.01) - 0.11, 2.67 - y), [-0.2, 2.48, -0.12, 0.2, 3.36, 0.14]), 'mitra', oroC, Object.assign({ k: 0.03 }, ORO));
      S.u(TO([0, 2.72, 0.01], 'y', 0.16, 0.03), 'mitra', ossoC, Object.assign({ k: 0.012 }, O));
      S.s(EL([0, 2.92, 0.12], [0.075, 0.05, 0.04]), { col: AMBRA, lu: 1, k: 0.008 });
      S.u(TO([0, 2.92, 0.11], 'z', 0.09, 0.02), 'mitra', ossoC, Object.assign({ k: 0.008 }, O));
      for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 1.7, x = Math.sin(a) * 0.17, y = 2.95 + Math.cos(a) * 0.12; S.u(CA([x, y, -0.04], [x + Math.sin(a) * 0.28, y + Math.cos(a) * 0.22, -0.07], 0.03, 0.004), 'mitra', bronzoC, Object.assign({ k: 0.01 }, ORO)); }
      return S;
    },
    luci: [['testa', [-0.062, 2.57, 0.24], 0xffd27a, 0.09, 0.6, 5], ['testa', [0.062, 2.57, 0.24], 0xffd27a, 0.09, 0.6, 5], ['petto', [0, 1.98, 0.37], 0xffc46b, 0.42, 0.55, 2.5],
      ['mitra', [0, 2.92, 0.16], 0xfff0b0, 0.55, 0.8, 3], ['manoL', [0.93, 1.15, 0.22], 0xffc46b, 0.5, 0.25, 2.1], ['radice', [0, 1.6, 0], 0xffb347, 3.6, 0.1, 1.4], ['veste3', [0, 0.06, 0], 0xffb347, 1.9, 0.18, 1.8]],
    attacchi: { lancio: 0.9, invoca: 2.0 },
    fervore: (s) => !s.att ? 0 : s.att.k === 'invoca' ? 1.6 * Math.min(sstep(0, 0.6, s.att.t), sstep(s.att.d, s.att.d - 0.5, s.att.t)) : chiavi(s.att.t, [[0, 0], [0.25, 1], [0.6, 0.4], [0.9, 0]]),
    posa(o, s, t) {
      o.radice.position.y += 0.04 * Math.sin(t * 1.1);
      o.veste1.rotation.x += 0.025 * Math.sin(t * 1.0); o.veste2.rotation.x += 0.04 * Math.sin(t * 1.0 - 0.8); o.veste3.rotation.x += 0.06 * Math.sin(t * 1.0 - 1.6);
      o.veste2.rotation.z += 0.03 * Math.sin(t * 0.8 - 0.9); o.veste3.rotation.z += 0.05 * Math.sin(t * 0.8 - 1.8);
      o.manto.rotation.x += 0.05 + 0.04 * Math.sin(t * 0.9 - 1);
      o.spina.rotation.y += 0.08 * Math.sin(t * 0.6); o.petto.rotation.x += 0.02 * Math.sin(t * 1.1 + 1);
      o.testa.rotation.y += 0.12 * Math.sin(t * 0.5); o.testa.rotation.x += 0.05 * Math.sin(t * 0.8);
      presaOfficiante(o); o.avR.rotation.x += 0.05 * Math.sin(t * 0.9);
      o.braccioL.rotation.z -= 0.3 + 0.06 * Math.sin(t * 1.2); o.braccioL.rotation.x -= 0.25 + 0.08 * Math.sin(t * 1.0); o.avL.rotation.x -= 0.55 + 0.1 * Math.sin(t * 1.3); o.ditaL.rotation.x += 0.3 + 0.2 * Math.sin(t * 2);
      if (s.att && s.att.k === 'lancio') {   // alza il pastorale e lo punta in avanti, la sinistra spinge
        const k = chiavi(s.att.t, [[0, 0], [0.25, 1], [0.45, 0.8], [0.9, 0]]), f = chiavi(s.att.t, [[0.2, 0], [0.32, 1], [0.6, 0]]);
        o.braccioR.rotation.x -= 0.7 * k; o.avR.rotation.x += 0.3 * k - 0.5 * f; o.petto.rotation.x += 0.12 * f - 0.08 * k; o.spina.rotation.y -= 0.2 * k;
        o.braccioL.rotation.x -= 0.9 * f; o.avL.rotation.x += 0.3 * f; o.ditaL.rotation.x -= 0.5 * f; o.testa.rotation.x += 0.1 * f;
      } else if (s.att) {   // invoca l'Occhio: braccia al cielo, testa rovesciata, si solleva sull'altare
        const k = Math.min(sstep(0, 0.6, s.att.t), sstep(s.att.d, s.att.d - 0.5, s.att.t)), tr = Math.sin(t * 23) * 0.02 * k;
        LATI.forEach(([sg, l]) => { o['braccio' + l].rotation.x -= (l === 'R' ? 1.6 : 2.3) * k; o['braccio' + l].rotation.z += sg * 0.25 * k; o['av' + l].rotation.x += 0.4 * k; o['dita' + l].rotation.x -= 0.5 * k; });
        o.testa.rotation.x -= 0.35 * k + tr; o.petto.rotation.x -= 0.16 * k; o.radice.position.y += 0.12 * k; o.manto.rotation.x += 0.15 * k;
      }
      const h = colpo(s) * 0.5;
      if (h > 0) { o.petto.rotation.x -= 0.25 * h; o.testa.rotation.x -= 0.2 * h; o.testa.rotation.z += 0.2 * h * s.hd; o.veste2.rotation.x += 0.1 * h; }
      if (s.morte >= 0) {   // morte: trema, si piega in ginocchio, le braccia ricadono, la testa crolla in avanti
        const m = s.morte, k1 = sstep(0, 0.6, m), k2 = sstep(0.6, 1.8, m), tr = Math.sin(m * 28) * 0.05 * (1 - k2);
        o.radice.position.y -= 0.45 * k2; o.radice.rotation.x += 0.15 * k2 + tr;
        o.veste1.rotation.x -= 0.25 * k2; o.veste2.rotation.x += 0.35 * k2; o.veste3.rotation.x += 0.25 * k2;
        LATI.forEach(([sg, l]) => { o['braccio' + l].rotation.x -= 1.4 * k1 * (1 - k2) + 0.3 * k2; o['braccio' + l].rotation.z += sg * 0.4 * k2; o['dita' + l].rotation.x -= 0.4 * k1; });
        o.testa.rotation.x += -0.5 * k1 * (1 - k2) + 0.6 * k2; o.petto.rotation.x += 0.4 * k2 - 0.2 * k1 * (1 - k2);
      }
    }
  };

  // Bruthak: bestia enorme e gobba sulle nocche, sacco d'ambra sul ventre (unico punto debole), corazza di chitina sulla gobba
  // con la pustola rossa (lo Sguardo), cinque occhi, zanne, ceppi di ferro ai polsi
  const BRUTHAK = {
    nome: 'Bruthak', alt: 3.1, h: 0.034, bb: [-1.78, -0.02, -1.12, 1.78, 3.12, 1.34], lod: 24, ombra: 3.6, ao: 2.2, uv: 0.6,
    passo: { L: 1.3, A0: 0, A1: 0, Amax: 0 }, morte: 2.3, dis: 1.5, bagliore: 0xffb347,
    ossa: [['radice', null, [0, 1.05, 0]], ['ventre', 'radice', [0, 1.35, 0.45]], ['spina', 'radice', [0, 1.5, 0]], ['gobba', 'spina', [0, 2.15, -0.2]],
      ['collo', 'gobba', [0, 2.2, 0.42]], ['testa', 'collo', [0, 2.26, 0.72]], ['mascella', 'testa', [0, 2.16, 0.78]],
      ...LATI.flatMap(([s, l]) => [['braccio' + l, 'gobba', [s * 0.95, 2.35, 0.1]], ['av' + l, 'braccio' + l, [s * 1.25, 1.55, 0.35]], ['mano' + l, 'av' + l, [s * 1.3, 0.82, 0.5]],
        ['coscia' + l, 'radice', [s * 0.55, 1.0, -0.05]], ['stinco' + l, 'coscia' + l, [s * 0.7, 0.52, 0.1]], ['piede' + l, 'stinco' + l, [s * 0.72, 0.12, 0.15]]])],
    punti: { ventre: ['ventre', [0, 1.36, 1.0]], schiena: ['gobba', [0, 2.25, -0.95]], bocca: ['mascella', [0, 2.16, 1.2]] },
    parti() {
      const S = Scultura(), pelleC = tinta(0.25, 0.2, 0.19, 0.18, 5), P = { rv: 0.7, rug: 0.012, dsp: rugaP }, Ch = { rv: 0.34, mt: 0.12, dsp: (x, y, z, d) => d + 0.006 * Math.sin(y * 26 + x * 4) + 0.003 * n3(x * 30, y * 30, z * 30) }, O = { rv: 0.5, rug: 0.006, dsp: porosoO };
      const pelleS = tinta(0.16, 0.13, 0.13, 0.2, 5), sacco = (x, y, z) => { const v = 0.5 + 0.5 * n3(x * 14, y * 14, z * 14); return [1.0, 0.55 + 0.2 * v, 0.18 + 0.1 * v]; };
      // gambe corte e grosse, schinieri di chitina, piedi a tre artigli
      LATI.forEach(([s, l]) => {
        S.u(CA([s * 0.55, 1.0, -0.05], [s * 0.7, 0.52, 0.1], 0.36, 0.28), 'coscia' + l, pelleC, Object.assign({ k: 0.12 }, P));
        S.u(CA([s * 0.7, 0.52, 0.1], [s * 0.72, 0.14, 0.15], 0.27, 0.24), 'stinco' + l, pelleC, Object.assign({ k: 0.08 }, P));
        S.u(GU([s * 0.71, 0.36, 0.14], [0.29, 0.26, 0.28], 0.025, (x, y, z) => 0.2 - z), 'stinco' + l, chitinaC, Object.assign({ k: 0.015 }, Ch));
        S.u(EL([s * 0.72, 0.12, 0.3], [0.27, 0.13, 0.33]), 'piede' + l, chitinaC, Object.assign({ k: 0.06 }, Ch));
        [-1, 0, 1].forEach(f => S.u(CA([s * 0.72 + f * 0.15, 0.1, 0.55], [s * 0.72 + f * 0.19, 0.03, 0.74], 0.06, 0.012), 'piede' + l, ossoC, Object.assign({ k: 0.02 }, O)));
      });
      // bacino, ventre enorme con il sacco d'ambra tenuto da cinghie di pelle
      S.u(EL([0, 1.1, -0.05], [0.62, 0.36, 0.46]), 'radice', pelleC, Object.assign({ k: 0.12 }, P));
      S.u(EL([0, 1.35, 0.38], [0.74, 0.64, 0.52]), 'ventre', pelleC, Object.assign({ k: 0.14 }, P));
      S.u(EL([0, 1.36, 0.78], [0.44, 0.44, 0.24]), 'ventre', sacco, { k: 0.06, rv: 0.25, lu: 1, dsp: (x, y, z, d) => d + 0.008 * n3(x * 9, y * 9, z * 9) });
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.3, c = Math.cos(a), s = Math.sin(a); S.u(CA([0.05 * c, 1.36 + 0.05 * s, 1.0], [0.47 * c, 1.36 + 0.47 * s, 0.8], 0.035, 0.05), 'ventre', pelleS, { k: 0.03, rv: 0.75, dsp: rugaP }); }
      S.u(TO([0, 1.36, 0.82], 'z', 0.45, 0.04), 'ventre', pelleS, { k: 0.05, rv: 0.75, dsp: rugaP });
      // petto e gobba: la schiena e' coperta da una corazza di chitina a costoloni, con un buco dove sporge la pustola
      S.u(EL([0, 1.95, 0.32], [0.72, 0.46, 0.42]), 'spina', pelleC, Object.assign({ k: 0.14 }, P));
      S.u(EL([0, 2.12, -0.16], [0.96, 0.7, 0.76]), 'gobba', pelleC, Object.assign({ k: 0.16 }, P));
      const PU = [0, 2.25, -0.88];
      S.u(GU([0, 2.13, -0.17], [1.0, 0.74, 0.8], 0.035, (x, y, z) => Math.max(1.85 - y, z - 0.2, 0.3 - Math.hypot(x - PU[0], y - PU[1], z - PU[2]))), 'gobba', chitinaC, Object.assign({ k: 0.02, inf: 0.08 }, Ch));
      for (let i = 0; i < 6; i++) { const a = -0.5 + i * 0.32, y = 2.12 + 0.76 * Math.cos(a), z = -0.17 - 0.8 * Math.sin(a) * 0.95; if (Math.abs(y - PU[1]) < 0.22 && z < -0.7) continue; S.u(CA([0, y, z], [0, y + 0.26 * Math.cos(a), z - 0.24 * Math.sin(a) - 0.06], 0.07, 0.01), 'gobba', ossoC, Object.assign({ k: 0.02 }, O)); }
      LATI.forEach(([s]) => { for (let i = 0; i < 3; i++) S.u(CA([s * 0.5, 2.62 - i * 0.18, -0.35 - i * 0.12], [s * 0.66, 2.85 - i * 0.2, -0.5 - i * 0.14], 0.05, 0.008), 'gobba', ossoC, Object.assign({ k: 0.015 }, O)); });
      S.u(EL(PU, [0.24, 0.22, 0.16]), 'gobba', ROSSO, { k: 0.05, rv: 0.3, lu: 0.35, dsp: (x, y, z, d) => d + 0.012 * n3(x * 16, y * 16, z * 16) });
      // collo corto, testa larga e bassa: cresta di chitina, cinque occhi d'ambra, mascella d'osso con le zanne
      S.u(CA([0, 2.12, 0.32], [0, 2.26, 0.76], 0.33, 0.28), 'collo', pelleC, Object.assign({ k: 0.1 }, P));
      S.u(EL([0, 2.3, 0.86], [0.38, 0.3, 0.33]), 'testa', pelleS, Object.assign({ k: 0.06 }, P));
      S.u(GU([0, 2.32, 0.88], [0.41, 0.33, 0.36], 0.035, (x, y, z) => Math.max(2.43 - y - 0.12 * Math.abs(x), 0.55 - z)), 'testa', chitinaC, Object.assign({ k: 0.03 }, Ch));
      [[-0.17, 2.38], [0, 2.41], [0.17, 2.38], [-0.085, 2.31], [0.085, 2.31]].forEach(([x, y]) => S.s(SF([x, y, 1.16 - Math.abs(x) * 0.3], 0.04), { col: AMBRA, lu: 1, k: 0.006 }));
      S.u(EL([0, 2.12, 0.98], [0.34, 0.12, 0.25]), 'mascella', ossoC, Object.assign({ k: 0.03 }, O));
      S.s(SC([0, 2.19, 1.13], [0.15, 0.025, 0.07], 0.02), { col: NERO, k: 0.01 });
      LATI.forEach(([s]) => { catena(S, [[s * 0.2, 2.12, 1.14], [s * 0.3, 2.26, 1.24], [s * 0.34, 2.42, 1.22]], [0.06, 0.04, 0.008], 'mascella', ossoC, Object.assign({ k: 0.015 }, O)); for (let i = 0; i < 3; i++) S.u(CA([s * (0.04 + i * 0.045), 2.16, 1.16], [s * (0.04 + i * 0.045), 2.22, 1.18], 0.017, 0.003), 'mascella', ossoC, { k: 0.004, rv: 0.45 }); });
      // braccia da gorilla: spalle enormi con lo spallaccio, avambracci grossi, ceppi di ferro con la catena, pugni con nocche d'osso
      LATI.forEach(([s, l]) => {
        S.u(EL([s * 0.95, 2.35, 0.1], [0.4, 0.36, 0.38]), 'braccio' + l, pelleC, Object.assign({ k: 0.14, inf: 0.12 }, P));
        S.u(GU([s * 0.97, 2.4, 0.08], [0.43, 0.38, 0.41], 0.03, (x, y, z) => 2.36 - y), 'braccio' + l, chitinaC, Object.assign({ k: 0.015 }, Ch));
        S.u(CA([s * 0.95, 2.35, 0.1], [s * 1.25, 1.55, 0.35], 0.33, 0.27), 'braccio' + l, pelleC, Object.assign({ k: 0.1 }, P));
        S.u(CA([s * 1.25, 1.55, 0.35], [s * 1.3, 0.9, 0.48], 0.29, 0.34), 'av' + l, pelleS, Object.assign({ k: 0.08 }, P));
        S.u(TO([s * 1.29, 1.0, 0.46], 'y', 0.34, 0.065), 'av' + l, ferroC, { k: 0.02, rv: 0.55, mt: 0.85 });
        for (let c = 0; c < 4; c++) { const y = 0.88 - c * 0.17, z = 0.13 - c * 0.02; S.u(c % 2 ? TO([s * 1.29, y, z], 'x', 0.09, 0.03) : TO([s * 1.29, y, z], 'z', 0.09, 0.03), 'av' + l, ferroC, { k: 0, rv: 0.55, mt: 0.85 }); }
        S.u(EL([s * 1.3, 0.62, 0.55], [0.31, 0.26, 0.31]), 'mano' + l, pelleS, Object.assign({ k: 0.08 }, P));
        [-1, 0, 1].forEach(f => S.u(CA([s * 1.3 + f * 0.15, 0.62, 0.82], [s * 1.3 + f * 0.17, 0.66, 0.96], 0.06, 0.012), 'mano' + l, ossoC, Object.assign({ k: 0.02 }, O)));
      });
      return S;
    },
    luci: [['ventre', [0, 1.36, 1.05], 0xffb347, 1.5, 0.5, 2.2], ['ventre', [0, 1.36, 1.02], 0xffd27a, 0.6, 0.6, 3.1], ['gobba', [0, 2.25, -1.02], 0xff4a3a, 0.75, 0.75, 4],
      ...[[-0.17, 2.38], [0, 2.41], [0.17, 2.38], [-0.085, 2.31], [0.085, 2.31]].map(([x, y]) => ['testa', [x, y, 1.19 - Math.abs(x) * 0.3], 0xffd27a, 0.1, 0.6, 5]), ['radice', [0, 0.4, 0.3], 0xffb347, 3.8, 0.1, 1.3]],
    attacchi: { lancio: 1.0, pestone: 1.2 },
    fervore: (s) => s.att ? chiavi(s.att.t, [[0, 0], [0.3, 1], [0.7, 0.5], [1.1, 0]]) : 0,
    posa(o, s, t) {
      const r = Math.sin(t * 1.25);   // respiro pesante
      o.radice.position.y += 0.03 * r; o.ventre.scale.setScalar(1 + 0.025 * r); o.ventre.position.z += 0.02 * r;
      o.spina.rotation.x += 0.03 * r; o.gobba.rotation.x -= 0.02 * r;
      o.testa.rotation.y += 0.25 * Math.sin(t * 0.55); o.testa.rotation.x += 0.06 * Math.sin(t * 0.8); o.mascella.rotation.x += 0.05 + 0.05 * Math.sin(t * 1.9);
      LATI.forEach(([sg, l], i) => {
        o['braccio' + l].rotation.x += 0.06 * Math.sin(t * 1.25 + i * PI); o['braccio' + l].rotation.z += sg * 0.04 * r; o['av' + l].rotation.x -= 0.04 * Math.sin(t * 1.25 + i * PI + 0.5);
        o['coscia' + l].rotation.x += 0.03 * Math.sin(t * 1.25 + i * PI);
      });
      if (s.att && s.att.k === 'pestone') {   // pestone: si drizza sulle gambe con i pugni alzati e li sbatte a terra
        const u = chiavi(s.att.t, [[0, 0], [0.45, 1], [0.6, 1], [0.72, -0.25], [1.2, 0]]), su = Math.max(0, u), giu = Math.max(0, -u);
        o.spina.rotation.x -= 0.45 * su - 0.25 * giu; o.gobba.rotation.x -= 0.2 * su; o.radice.position.y += 0.12 * su - 0.1 * giu; o.testa.rotation.x += 0.35 * su; o.mascella.rotation.x += 0.35 * su;
        LATI.forEach(([sg, l]) => { o['braccio' + l].rotation.x -= 2.0 * su - 0.3 * giu; o['braccio' + l].rotation.z -= sg * 0.25 * su; o['av' + l].rotation.x -= 0.6 * su; });
      } else if (s.att) {   // lancio: si tira indietro e spinge la testa in avanti spalancando le fauci
        const k = chiavi(s.att.t, [[0, 0], [0.3, 1], [0.45, -0.6], [1.0, 0]]), a = Math.max(0, k), b = Math.max(0, -k);
        o.spina.rotation.x -= 0.18 * a - 0.15 * b; o.collo.rotation.x += 0.3 * b - 0.15 * a; o.testa.rotation.x -= 0.2 * a; o.mascella.rotation.x += 0.15 * a + 0.55 * b;
        LATI.forEach(([sg, l]) => { o['braccio' + l].rotation.z -= sg * 0.15 * a; o['braccio' + l].rotation.x += 0.2 * b; });
      }
      const h = colpo(s) * 0.4;
      if (h > 0) { o.spina.rotation.x -= 0.2 * h; o.testa.rotation.z += 0.25 * h * s.hd; o.ventre.position.z -= 0.05 * h; }
      if (s.morte >= 0) {   // morte: ruggisce, poi crolla in avanti sui pugni e si affloscia
        const m = s.morte, k1 = sstep(0, 0.6, m), k2 = sstep(0.6, 1.6, m);
        o.testa.rotation.x -= 0.5 * k1 * (1 - k2) - 0.4 * k2; o.mascella.rotation.x += 0.6 * k1;
        o.spina.rotation.x -= 0.3 * k1 * (1 - k2) - 0.5 * k2; o.radice.position.y -= 0.35 * k2; o.radice.position.z += 0.2 * k2;
        LATI.forEach(([sg, l]) => { o['braccio' + l].rotation.z += sg * 0.5 * k2; o['braccio' + l].rotation.x += 0.4 * k2 - 0.6 * k1 * (1 - k2); o['coscia' + l].rotation.x -= 0.7 * k2; o['stinco' + l].rotation.x += 1.0 * k2; o['coscia' + l].rotation.z += sg * 0.2 * k2; });
      }
    }
  };

  // Sfera del soffitto: un grumo di luce fredda chiuso in una gabbia di costole d'osso. Gira piano e pulsa.
  const SFERA = {
    nome: 'Sfera di Luce', alt: 1, h: 0.016, bb: [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5], lod: 13, ombra: 0, ao: 0.5, uv: 0.2,
    passo: { L: 1, A0: 0, A1: 0, Amax: 0 }, morte: 0.1, dis: 0.4, bagliore: 0xbfe9ff, tapis: true,
    ossa: [['radice', null, [0, 0, 0]], ['nucleo', 'radice', [0, 0, 0]]],
    parti() {
      const S = Scultura(), luce = (x, y, z) => { const v = 0.5 + 0.5 * n3(x * 12, y * 12, z * 12); return [0.35 + 0.2 * v, 0.62 + 0.15 * v, 0.95]; };
      S.u(XX((x, y, z) => Math.hypot(x, y, z) - 0.36 - 0.025 * n3(x * 7, y * 7, z * 7), bbS([0, 0, 0], 0.42)), 'nucleo', luce, { k: 0, rv: 0.15, lu: 0.55, rug: 0.03 });
      for (let i = 0; i < 6; i++) {   // costole a meridiano, un po' storte, chiuse in cima e in fondo da due anelli
        const a = i / 6 * PI * 2, pts = [], rs = [];
        for (let k = 0; k <= 6; k++) { const b = -PI / 2 + k / 6 * PI, R = 0.43 + 0.03 * Math.sin(k * 1.7 + i); pts.push([Math.cos(b) * Math.cos(a + 0.12 * Math.sin(b * 2)) * R, Math.sin(b) * R, Math.cos(b) * Math.sin(a + 0.12 * Math.sin(b * 2)) * R]); rs.push(0.02 + 0.008 * Math.cos(b)); }
        catena(S, pts, rs, 'radice', ossoC, { k: 0.015, rv: 0.5, dsp: porosoO });
      }
      [-1, 1].forEach(s => S.u(TO([0, s * 0.4, 0], 'y', 0.12, 0.04), 'radice', bronzoC, { k: 0.02, rv: 0.3, mt: 0.9 }));
      return S;
    },
    luci: [['nucleo', [0, 0, 0], 0xbfe9ff, 1.9, 0.5, 2.4], ['nucleo', [0, 0, 0], 0xffffff, 0.7, 0.55, 3.3]],
    attacchi: { pulsa: 0.5 },
    posa(o, s, t) { o.radice.rotation.y += t * 0.35; o.nucleo.rotation.x += t * 0.5; o.nucleo.scale.setScalar(1 + 0.04 * Math.sin(t * 2.4)); }
  };

  const DEF = { strisciante: STRISCIANTE, novizio: NOVIZIO, guardacripta: GUARDACRIPTA, cantrice: CANTRICE, officiante: OFFICIANTE, bruthak: BRUTHAK, sfera: SFERA };
  Object.keys(DEF).forEach(k => { CR[k] = (opz) => istanza(DEF[k], opz); });
  CR.prepara = (nomi) => (nomi || Object.keys(DEF)).forEach(k => geometrie(DEF[k]));   // costruisce tutto subito
  // costruisce a fette di pochi millisecondi, una creatura dopo l'altra: la pagina intanto resta fluida
  CR.preparaPiano = (nomi, fetta, fine) => {
    const coda = (nomi || Object.keys(DEF)).filter(k => !CACHE[DEF[k].nome]); let it = null;
    const passo = () => {
      SCAD = performance.now() + (fetta || 8);
      while (performance.now() < SCAD) {
        if (!it) { if (!coda.length) { SCAD = Infinity; if (fine) fine(); return; } const k = coda.shift(); if (CACHE[DEF[k].nome]) continue; it = geometrieG(DEF[k]); }
        if (it.next().done) it = null;
      }
      SCAD = Infinity; setTimeout(passo, 0);
    };
    passo();
  };
  CR.pronte = () => Object.keys(DEF).every(k => CACHE[DEF[k].nome]);
  CR.info = () => Object.keys(DEF).map(k => { const G = CACHE[DEF[k].nome]; return G ? { nome: k, ms: Math.round(G.ms), tri: G.tri, triBassa: G.bassa.index.count / 3 } : { nome: k }; });
  CR.occhio = null;   // la posizione della camera, per scegliere il dettaglio
  CR._def = DEF;
  B.CreatureRaid = CR;
})();
