/* La Cripta del Re Senza Luce: ambienti scolpiti (area campione: la Sala dei Sigilli).
   Tutto e' generato nel codice: superfici con rumore a piu' livelli, figure scolpite con campi di distanza (SDF),
   modanature estruse lungo curve, materiali PBR con colori per vertice. Nessun file o libreria esterna. */
(function () {
  const B = window.B3 = window.B3 || {}, T = B.T || window.THREE, PI = Math.PI;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, mix = (a, b, k) => a + (b - a) * k, sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- rumore (gradiente 3D, seme fisso: la sala e' sempre uguale) ---------- */
  const perm = new Uint8Array(512); { let s = 1337; const p = []; for (let i = 0; i < 256; i++) p[i] = i; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  let semeR = 7; const rnd = (a, b) => { semeR = (semeR * 16807) % 2147483647; return a + (semeR / 2147483647) * (b - a); };
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function grad(h, x, y, z) { const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
  function n3(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255; x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z), A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, Bb = perm[X + 1] + Y, BA = perm[Bb] + Z, BB = perm[Bb + 1] + Z;
    return mix(mix(mix(grad(perm[AA] & 15, x, y, z), grad(perm[BA] & 15, x - 1, y, z), u), mix(grad(perm[AB] & 15, x, y - 1, z), grad(perm[BB] & 15, x - 1, y - 1, z), u), v),
      mix(mix(grad(perm[AA + 1] & 15, x, y, z - 1), grad(perm[BA + 1] & 15, x - 1, y, z - 1), u), mix(grad(perm[AB + 1] & 15, x, y - 1, z - 1), grad(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
  }
  function fbm(x, y, z, o) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < (o || 4); i++) { s += a * n3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; }
  function ridged(x, y, z, o) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < (o || 3); i++) { s += a * (1 - Math.abs(n3(x * f + 11, y * f, z * f))); f *= 2.1; a *= 0.5; } return s; }

  /* ---------- geometria: unione, colori, coordinate di texture a proiezione ---------- */
  // ogni pezzo diventa non indicizzato con position/normal/color/uv; uv per proiezione sull'asse dominante (densita' uniforme)
  function prepara(geo, colFn, scalaUV) {
    let g = geo.index ? geo.toNonIndexed() : geo; if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, N = p.count, C = new Float32Array(N * 3), U = new Float32Array(N * 2), s = 1 / (scalaUV || 3);
    for (let i = 0; i < N; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i), ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      if (ay >= ax && ay >= az) { U[i * 2] = x * s; U[i * 2 + 1] = z * s; } else if (ax >= az) { U[i * 2] = z * s; U[i * 2 + 1] = y * s; } else { U[i * 2] = x * s; U[i * 2 + 1] = y * s; }
      const c = colFn ? colFn(x, y, z, nx, ny, nz) : [1, 1, 1]; C[i * 3] = c[0]; C[i * 3 + 1] = c[1]; C[i * 3 + 2] = c[2];
    }
    g.setAttribute('color', new T.BufferAttribute(C, 3)); g.setAttribute('uv', new T.BufferAttribute(U, 2)); return g;
  }
  function unisci(geos) {
    let n = 0; geos.forEach(g => n += g.attributes.position.count);
    const P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), C = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
    geos.forEach(g => { P.set(g.attributes.position.array, o * 3); Nn.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); });
    const G = new T.BufferGeometry(); G.setAttribute('position', new T.BufferAttribute(P, 3)); G.setAttribute('normal', new T.BufferAttribute(Nn, 3)); G.setAttribute('color', new T.BufferAttribute(C, 3)); G.setAttribute('uv', new T.BufferAttribute(U, 2));
    G.computeBoundingSphere(); return G;
  }
  // un "cesto" per materiale: ci si mettono pezzi gia' posizionati, alla fine diventa una sola mesh
  let GEO = null, GEO_G = null, GEO_T = null;   // le geometrie della sala in costruzione, fatte una volta sola (la sala si ricostruisce a ogni tentativo)
  const CACHE = {};   // una voce per sala
  function cesto(nome, colFn, scalaUV) {
    const lista = [];
    return {
      lista,
      metti(geo, x, y, z, rx, ry, rz, sx, sy, sz, col) {
        if (GEO) return;
        const m = new T.Matrix4().compose(new T.Vector3(x || 0, y || 0, z || 0), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(sx || 1, sy || sx || 1, sz || sx || 1));
        if (geo.index && !geo.attributes.normal) geo.computeVertexNormals(); const g = (geo.index ? geo.toNonIndexed() : geo.clone()); if (!g.attributes.normal) g.computeVertexNormals(); g.applyMatrix4(m);
        lista.push(prepara(g, col || colFn, scalaUV)); return g;
      },
      mesh(mat, deposito) { const G = GEO ? GEO[nome] : unisci(lista); if (deposito) deposito[nome] = G; const m = new T.Mesh(G, mat); m.matrixAutoUpdate = false; return m; }
    };
  }

  /* ---------- texture di dettaglio: mappe di rilievo disegnate al volo ---------- */
  function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function mappaNormali(S, altezza, forza) {   // altezza(u, v) in [0,1] periodica -> normal map tassellabile
    const H = new Float32Array(S * S); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) H[j * S + i] = altezza(i / S, j / S);
    const [cv, x] = tela(S, S), im = x.createImageData(S, S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const hl = H[j * S + ((i + S - 1) % S)], hr = H[j * S + ((i + 1) % S)], hu = H[((j + S - 1) % S) * S + i], hd = H[((j + 1) % S) * S + i];
      let nx = (hl - hr) * forza, ny = (hu - hd) * forza, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
      const k = (j * S + i) * 4; im.data[k] = (nx * 0.5 + 0.5) * 255; im.data[k + 1] = (ny * 0.5 + 0.5) * 255; im.data[k + 2] = (nz * 0.5 + 0.5) * 255; im.data[k + 3] = 255;
    }
    x.putImageData(im, 0, 0); const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
  }
  const tile = (f, u, v, r) => {   // rumore periodico su un toro: la texture si ripete senza cuciture
    const a = u * 2 * PI, b = v * 2 * PI; return f(Math.cos(a) * r, Math.sin(a) * r, Math.cos(b) * r + Math.sin(b) * r * 0.7 + 50);
  };
  let MAT = null, AMB_ENV = null;
  function materiali(leggera) {
    if (MAT) return MAT;
    const nRoccia = mappaNormali(256, (u, v) => { const a = u * 2 * PI, b = v * 2 * PI, X = Math.cos(a) * 1.6, Y = Math.sin(a) * 1.6, Z = Math.cos(b) * 1.6, W = Math.sin(b) * 1.6; return 0.6 * ridged(X + W * 0.3, Y + Z * 0.2, Z + 3, 4) + 0.4 * fbm(X * 3, Y * 3 + W, Z * 3, 3); }, 9);
    const nPietra = mappaNormali(256, (u, v) => { const a = u * 2 * PI, b = v * 2 * PI; return 0.5 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, Math.cos(b) * 3 + Math.sin(b) * 2, 4) + 0.15 * n3(Math.cos(a) * 12, Math.sin(a) * 12, Math.cos(b) * 12); }, 4);
    const nBronzo = mappaNormali(128, (u, v) => { const a = u * 2 * PI, b = v * 2 * PI; return 0.4 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, Math.cos(b) * 2, 3); }, 3);
    // riflessi per il metallo: un cubo di ambiente dipinto (buio sopra, bagliori caldi dei fuochi ai lati, freddo dal basso)
    const amb = (() => { const facce = [0, 1, 2, 3, 4, 5].map(i => { const [cv, x] = tela(64, 64); const g = x.createLinearGradient(0, 0, 0, 64); if (i === 2) { g.addColorStop(0, '#2a2c38'); g.addColorStop(1, '#3a3c48'); } else if (i === 3) { g.addColorStop(0, '#4a4036'); g.addColorStop(1, '#3a3229'); } else { g.addColorStop(0, '#30323e'); g.addColorStop(0.5, '#5a4a3a'); g.addColorStop(0.68, '#b07a44'); g.addColorStop(1, '#4a3e32'); } x.fillStyle = g; x.fillRect(0, 0, 64, 64); if (i !== 2 && i !== 3) { const r = x.createRadialGradient(20 + i * 6, 40, 0, 20 + i * 6, 40, 16); r.addColorStop(0, 'rgba(255,190,110,.9)'); r.addColorStop(1, 'rgba(255,190,110,0)'); x.fillStyle = r; x.fillRect(0, 0, 64, 64); } return cv; }); const t = new T.CubeTexture(facce); t.needsUpdate = true; return t; })();
    const std = (o) => new T.MeshStandardMaterial(Object.assign({ vertexColors: true }, o));
    AMB_ENV = amb;
    MAT = {
      roccia: std({ roughness: 0.96, metalness: 0, normalMap: nRoccia, normalScale: new T.Vector2(1.1, 1.1) }),
      pietra: std({ roughness: 0.82, metalness: 0, normalMap: nPietra, normalScale: new T.Vector2(0.7, 0.7) }),
      lastre: std({ roughness: 0.72, metalness: 0, normalMap: nPietra, normalScale: new T.Vector2(1.0, 1.0) }),
      bronzo: std({ roughness: 0.38, metalness: 0.85, normalMap: nBronzo, normalScale: new T.Vector2(0.4, 0.4), envMap: amb, envMapIntensity: 1.6 }),
      cristallo: new T.MeshStandardMaterial({ color: 0x3a8fb0, emissive: 0x2aa6d8, emissiveIntensity: 0.75, roughness: 0.15, metalness: 0.2, flatShading: true, envMap: amb, envMapIntensity: 1.2 }),
      buio: new T.MeshBasicMaterial({ color: 0x020203 }),
      malta: new T.MeshStandardMaterial({ color: 0x0e0d0f, roughness: 1 })
    };
    return MAT;
  }

  /* ---------- scultura con campi di distanza (surface nets) ---------- */
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const sfera = (x, y, z, cx, cy, cz, r) => Math.hypot(x - cx, y - cy, z - cz) - r;
  const ellissoide = (x, y, z, cx, cy, cz, rx, ry, rz) => { const k0 = Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz), k1 = Math.hypot((x - cx) / (rx * rx), (y - cy) / (ry * ry), (z - cz) / (rz * rz)); return k1 < 1e-6 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1; };
  function conoTondo(px, py, pz, ax, ay, az, bx, by, bz, r1, r2) {   // cono con estremi sferici tra a e b
    const bax = bx - ax, bay = by - ay, baz = bz - az, l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
    const pax = px - ax, pay = py - ay, paz = pz - az, y = pax * bax + pay * bay + paz * baz, z = y - l2;
    const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y, x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
  }
  const toroY = (x, y, z, cx, cy, cz, R, r) => Math.hypot(Math.hypot(x - cx, z - cz) - R, y - cy) - r;
  function scolpisci(sdf, x0, y0, z0, x1, y1, z1, h) {
    const nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1, sxy = nx * ny;
    const V = new Float32Array(nx * ny * nz);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) V[i + nx * j + sxy * k] = sdf(x0 + i * h, y0 + j * h, z0 + k * h);
    const cid = new Int32Array(nx * ny * nz).fill(-1), pos = [];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], co = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], cv = new Float32Array(8);
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      let m = 0; for (let c = 0; c < 8; c++) { const v = V[(i + co[c][0]) + nx * (j + co[c][1]) + sxy * (k + co[c][2])]; cv[c] = v; if (v < 0) m |= 1 << c; }
      if (m === 0 || m === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of E) { const va = cv[a], vb = cv[b]; if ((va < 0) === (vb < 0)) continue; const t = va / (va - vb); sx += co[a][0] + (co[b][0] - co[a][0]) * t; sy += co[a][1] + (co[b][1] - co[a][1]) * t; sz += co[a][2] + (co[b][2] - co[a][2]) * t; n++; }
      cid[i + nx * j + sxy * k] = pos.length / 3; pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
    }
    const idx = [], st = [1, nx, sxy];
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const p = i + nx * j + sxy * k, v0 = V[p];
      for (let d = 0; d < 3; d++) {
        const v1 = V[p + st[d]]; if ((v0 < 0) === (v1 < 0)) continue;
        const u = st[(d + 1) % 3], w = st[(d + 2) % 3], a = cid[p], b = cid[p - u], c = cid[p - u - w], e = cid[p - w];
        if (a < 0 || b < 0 || c < 0 || e < 0) continue;
        if (v0 < 0) idx.push(a, b, c, a, c, e); else idx.push(a, c, b, a, e, c);
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const N = new Float32Array(pos.length), e2 = h * 0.5;   // normali dal gradiente del campo: superficie liscia
    for (let i = 0; i < pos.length; i += 3) { const x = pos[i], y = pos[i + 1], z = pos[i + 2]; let gx = sdf(x + e2, y, z) - sdf(x - e2, y, z), gy = sdf(x, y + e2, z) - sdf(x, y - e2, z), gz = sdf(x, y, z + e2) - sdf(x, y, z - e2); const L = Math.hypot(gx, gy, gz) || 1; N[i] = gx / L; N[i + 1] = gy / L; N[i + 2] = gz / L; }
    g.setAttribute('normal', new T.BufferAttribute(N, 3)); return g;
  }

  /* ---------- profili e modanature ---------- */
  function archiAcuto(L, hImp, hChiave, n) {   // arco acuto: due archi di cerchio da x=-L e x=+L (quota hImp) che si incontrano in chiave
    const H = hChiave - hImp, R = (L * L + H * H) / (2 * L), cx = R - L, a1 = Math.atan2(H, L - R), sx = [], m = Math.floor(n / 2);
    for (let i = 0; i <= m; i++) { const a = mix(PI, a1, i / m); sx.push(new T.Vector3(-L + R + Math.cos(a) * R - 0 * cx, hImp + Math.sin(a) * R, 0)); }
    const dx = sx.slice(0, -1).reverse().map(p => new T.Vector3(-p.x, p.y, 0));
    return sx.concat(dx);
  }
  function modanatura(punti, profilo, chiuso) {   // estrude un profilo (lista [x, y]) lungo una polilinea nel piano xy
    const sh = new T.Shape(); profilo.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]));
    const path = new T.CatmullRomCurve3(punti, !!chiuso, 'centripetal');
    return new T.ExtrudeGeometry(sh, { steps: Math.max(8, punti.length * 2), bevelEnabled: false, extrudePath: path });
  }
  function lastraTonda(w, d, sp, r, smusso, leggero) {   // lastra dagli spigoli tondi con bordo smussato, faccia di sopra a y=0
    r = Math.min(r, w / 2.2, d / 2.2); const sh = new T.Shape(), x0 = -w / 2 + smusso, z0 = -d / 2 + smusso, x1 = w / 2 - smusso, z1 = d / 2 - smusso, rr = Math.max(0.01, r - smusso);
    sh.moveTo(x0 + rr, z0); sh.lineTo(x1 - rr, z0); sh.quadraticCurveTo(x1, z0, x1, z0 + rr); sh.lineTo(x1, z1 - rr); sh.quadraticCurveTo(x1, z1, x1 - rr, z1); sh.lineTo(x0 + rr, z1); sh.quadraticCurveTo(x0, z1, x0, z1 - rr); sh.lineTo(x0, z0 + rr); sh.quadraticCurveTo(x0, z0, x0 + rr, z0);
    const g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.01, sp - smusso * 2), bevelEnabled: true, bevelThickness: smusso, bevelSize: smusso, bevelSegments: leggero ? 1 : 2, curveSegments: leggero ? 1 : 3 });
    g.rotateX(PI / 2); g.translate(0, -smusso, 0); return g;
  }
  function tornioModulato(prof, seg, mod) {   // tornio con raggio modulato dall'angolo (scanalature, lobi)
    const P = [], idx = [], nr = prof.length;
    for (let i = 0; i <= seg; i++) { const a = i / seg * 2 * PI; for (let j = 0; j < nr; j++) { const [r, y] = prof[j], k = mod ? mod(a, y, r) : 1; P.push(Math.cos(a) * r * k, y, Math.sin(a) * r * k); } }
    for (let i = 0; i < seg; i++) for (let j = 0; j < nr - 1; j++) { const a = i * nr + j, b = (i + 1) * nr + j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // superficie a rilievo: piano w x h con suddivisioni, spostato lungo +z da rilievo(x, y)
  function rilievo(w, h, sx, sy, f) {
    const g = new T.PlaneGeometry(w, h, sx, sy), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, f(x, y)); }
    g.computeVertexNormals(); return g;
  }

  // colori minerali: grigio freddo, strati caldi, cavita' scure
  const COL = { roccia: [0.27, 0.265, 0.28], rocciaC: [0.36, 0.32, 0.28], pietra: [0.50, 0.47, 0.44], pietraS: [0.38, 0.36, 0.35], bronzo: [0.55, 0.38, 0.2], verderame: [0.24, 0.42, 0.36] };
  const colRoccia = (x, y, z, nx, ny, nz) => {
    const f = fbm(x * 0.09, y * 0.09, z * 0.09, 3), band = 0.5 + 0.5 * Math.sin(y * 0.55 + f * 4), k = 0.62 + 0.55 * (f + 0.5) * 0.8;
    let r = mix(COL.roccia[0], COL.rocciaC[0], band * 0.6) * k, g = mix(COL.roccia[1], COL.rocciaC[1], band * 0.6) * k, b = mix(COL.roccia[2], COL.rocciaC[2], band * 0.6) * k;
    const up = clamp(ny, 0, 1) * 0.12; r += up; g += up; b += up * 0.9;   // le sporgenze prendono polvere chiara
    const alto = 1 - 0.75 * sstep(22, 46, y), basso = 1 - 0.6 * sstep(-4, -30, y);
    return [r * alto * basso, g * alto * basso, (b * alto * basso) + (y < -8 ? 0.03 : 0)];
  };
  const colPietra = (x, y, z, nx, ny, nz) => { const f = fbm(x * 0.35 + 3, y * 0.35, z * 0.35, 3), k = 0.82 + f * 0.5, sporco = 1 - 0.35 * sstep(1.5, 0, y) * (0.5 + f); return [COL.pietra[0] * k * sporco, COL.pietra[1] * k * sporco, COL.pietra[2] * k * sporco]; };
  const colBronzo = (x, y, z) => { const f = sstep(0.05, 0.35, fbm(x * 0.8, y * 0.8, z * 0.8, 3)); return [mix(COL.bronzo[0], COL.verderame[0], f), mix(COL.bronzo[1], COL.verderame[1], f), mix(COL.bronzo[2], COL.verderame[2], f)]; };

  /* =====================================================================
     LA SALA DEI SIGILLI
     Terrazza scolpita sospesa su una voragine dentro la montagna:
     ovest balaustra sul baratro con la cascata; est un canale d'acqua e la parete della citta' scavata,
     da cui arrivano i nemici sui ponti; nord la facciata con la porta sigillata e i due Guardiani.
     Le posizioni di gioco (piastre, totem, pilastri, porta) sono quelle di sempre.
     ===================================================================== */
  function salaSigilli(ctx) {
    const { scena, ostacoli, leggera } = ctx, M = materiali(leggera); semeR = 7; GEO = CACHE.sigilli || null;
    const R = { fuochi: [], agg: null, ombre: !leggera };
    const C = !!GEO, roccia = cesto('r', colRoccia, 4), pietra = cesto('p', colPietra, 2.5), lastre = cesto('l', null, 2), bronzo = cesto('b', colBronzo, 1.5), cristalli = cesto('c', () => [1, 1, 1], 1), ombra = cesto('o', colPietra, 2.5);
    // luci della scena: le toglie e mette le sue
    scena.children.filter(o => o.isLight).forEach(o => scena.remove(o));
    scena.background = new T.Color(0x05060a); scena.fog = new T.FogExp2(0x0a0c12, 0.016);
    scena.add(new T.HemisphereLight(0x5a6482, 0x2a2018, 1.15));
    ctx.lim.x0 = -23.6; ctx.lim.x1 = 23.6; ctx.lim.z0 = -32; ctx.lim.z1 = 18; delete ctx.lim.ell;

    /* --- 1. la caverna: un unico guscio di roccia che sale fino a una volta che sparisce nel buio --- */
    if (!C) {
      const CP = [[0, 22], [14, 22], [25.5, 19], [26, 4], [25.5, -18], [23, -35.5], [0, -36.5], [-24, -36], [-36, -40], [-48, -26], [-50, -6], [-47, 13], [-35, 24], [-18, 23]].map(p => new T.Vector3(p[0], 0, p[1]));
      const curva = new T.CatmullRomCurve3(CP, true, 'centripetal'), NU = leggera ? 180 : 280, NV = leggera ? 56 : 84, Y0 = -62, Y1 = 52, cx = -10, cz = -7;
      const P = [], col = [], idx = [];
      for (let j = 0; j <= NV; j++) {
        const y = Y0 + (Y1 - Y0) * j / NV, s = y < 20 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((y - 20) / 33, 2)));
        for (let i = 0; i <= NU; i++) {
          const q = curva.getPointAt((i % NU) / NU); let x = cx + (q.x - cx) * Math.max(s, 0.02), z = cz + (q.z - cz) * Math.max(s, 0.02);
          let ox = q.x - cx, oz = q.z - cz; const L = Math.hypot(ox, oz) || 1; ox /= L; oz /= L;
          const f = fbm(x * 0.05, y * 0.05, z * 0.05, 4), r = ridged(x * 0.11, y * 0.07, z * 0.11, 3), strato = (y / 3.4 + f * 1.4) % 1;
          const d = Math.max(0.3, 3.2 * f + 2.4 * r + 0.9 * (strato < 0 ? strato + 1 : strato) - 1.2);   // gradoni naturali, sporgenze e rientranze
          const up = s < 1 ? (1 - s) : 0; x += ox * d * (1 - up * 0.5); z += oz * d * (1 - up * 0.5);
          P.push(x, y + (up > 0 ? -d * up * 0.8 : 0), z);
        }
      }
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
      // il guscio si guarda da dentro: se le facce puntano fuori le giro
      { const n = g.attributes.normal, k = Math.floor(NV / 2) * (NU + 1) + 5, px = P[k * 3] - cx, pz = P[k * 3 + 2] - cz; if (n.getX(k) * px + n.getZ(k) * pz > 0) { for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); g.setIndex(idx.map((v, q) => q % 3 === 1 ? idx[q + 1] : q % 3 === 2 ? idx[q - 1] : v)); } }
      roccia.lista.push(prepara(g, colRoccia, 4));
    }

    /* --- 2. la terrazza: lastre vere, ognuna diversa, con un cerchio radiale al centro --- */
    const TX0 = -21, TX1 = 21, TZ0 = -33.2, TZ1 = 21.5, CX = 0, CZ = -8, RC = 9.4;
    {
      const malta = new T.Mesh(new T.PlaneGeometry(TX1 - TX0, TZ1 - TZ0), M.malta); malta.rotation.x = -PI / 2; malta.position.set(0, -0.07, (TZ0 + TZ1) / 2); malta.receiveShadow = true; scena.add(malta);
      if (!C) {
      const colLastra = () => { const k = rnd(0.7, 1.15), w = rnd(-0.03, 0.03); return [0.37 * k + w, 0.345 * k, 0.32 * k - w]; };
      const posa = (geo, x, z, ry) => { const c = colLastra(); const usura = (px, py, pz, nx, ny) => { const f = fbm(px * 0.7, 0, pz * 0.7, 4) * 0.45 + fbm(px * 3.1, 1, pz * 3.1, 2) * 0.18, e = ny > 0.9 ? 1 : 0.6; return [c[0] * (e + f), c[1] * (e + f), c[2] * (e + f)]; }; lastre.metti(geo, x, rnd(-0.02, 0.012), z, rnd(-0.008, 0.008), ry || 0, rnd(-0.008, 0.008), 1, 1, 1, usura); };
      // anelli di lastre a settore attorno al centro
      const anelli = [[0, 1.6, 1], [1.7, 3.6, 10], [3.7, 5.6, 16], [5.7, 7.5, 22], [7.6, RC, 28]];
      anelli.forEach(([r0, r1, n], ia) => {
        if (n === 1) { const g = new T.CylinderGeometry(r1 - 0.05, r1, 0.2, 28); g.translate(0, -0.1, 0); posa(g, CX, CZ, 0); return; }
        const off = ia * 0.37; for (let i = 0; i < n; i++) {
          const a0 = off + i / n * 2 * PI + 0.012, a1 = off + (i + 1) / n * 2 * PI - 0.012, sh = new T.Shape(), K = 6;
          for (let k = 0; k <= K; k++) { const a = mix(a0, a1, k / K); k ? sh.lineTo(Math.cos(a) * (r1 - 0.04), Math.sin(a) * (r1 - 0.04)) : sh.moveTo(Math.cos(a) * (r1 - 0.04), Math.sin(a) * (r1 - 0.04)); }
          for (let k = K; k >= 0; k--) { const a = mix(a0, a1, k / K); sh.lineTo(Math.cos(a) * (r0 + 0.04), Math.sin(a) * (r0 + 0.04)); }
          const g = new T.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 1, curveSegments: 2 }); g.rotateX(PI / 2); g.translate(0, -0.035, 0);
          posa(g, CX, CZ, 0);
        }
      });
      // anello di bronzo intarsiato che separa il cerchio dal resto
      bronzo.metti(new T.TorusGeometry(RC + 0.14, 0.11, 6, 96), CX, -0.02, CZ, PI / 2, 0, 0, 1, 1, 0.45);
      // il resto: corsi di lastre rettangolari di lunghezza variabile, sfalsati
      for (let z = TZ0 + 0.1, riga = 0; z < TZ1 - 0.2; riga++) {
        const dz = rnd(0.9, 1.35); let x = TX0 + 0.05 + (riga % 2) * rnd(0.3, 0.8);
        while (x < TX1 - 0.3) {
          const dx = Math.min(rnd(1.1, 2.4), TX1 - 0.05 - x), cxl = x + dx / 2, czl = z + dz / 2;
          const dc = Math.hypot(cxl - CX, czl - CZ); x += dx;
          if (dc < RC + 0.9 + Math.max(dx, dz) * 0.5) { if (dc < RC + 0.35) continue; }
          if (dc < RC + 1.4) continue;
          if (dx < 0.35) continue;
          posa(lastraTonda(dx - 0.07, dz - 0.07, 0.16, rnd(0.05, 0.25), 0.035, true), cxl, czl, 0);
        }
        z += dz;
      }
      // fascia di riempimento attorno al cerchio: lastre a settore piu' strette (nessun buco tra cerchio e corsi)
      for (let i = 0; i < 40; i++) { const a0 = i / 40 * 2 * PI + 0.01, a1 = (i + 1) / 40 * 2 * PI - 0.01, sh = new T.Shape(), r0 = RC + 0.3, r1 = RC + 1.4 + Math.abs(Math.sin(i * 1.7)) * 0.4; sh.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0); for (let k = 0; k <= 4; k++) { const a = mix(a0, a1, k / 4); sh.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); } sh.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0); const g = new T.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 2 }); g.rotateX(PI / 2); g.translate(0, -0.03, 0); posa(g, CX, CZ, 0); }
      }
    }

    /* --- 3. bordi: ovest balaustra sul baratro, est canale d'acqua; muri di sostegno a conci --- */
    const conci = (lw, lh, prof) => (x, y) => {   // rilievo di muratura: conci sfalsati con giunti e facce irregolari
      const riga = Math.floor(y / lh), xx = x / lw + (riga % 2) * 0.5, fx = xx - Math.floor(xx), fy = y / lh - riga, id = Math.floor(xx) * 7.3 + riga * 3.1;
      const g = Math.min(sstep(0, 0.06, fx), sstep(0, 0.06, 1 - fx), sstep(0, 0.12, fy), sstep(0, 0.12, 1 - fy));
      return (g - 1) * prof + g * (0.05 * n3(id, 0.5, 0.3) + 0.04 * fbm(x * 0.9, y * 0.9, id, 2));
    };
    if (!C) {
      // ovest: parete della terrazza che precipita nel baratro (conci in alto, roccia viva sotto)
      const h = 64, g = rilievo(TZ1 - TZ0 + 6, h, 90, 90, (x, y) => { const yy = h / 2 - y; const muro = conci(2.2, 0.9, 0.12)(x, y); const rocc = 1.6 * fbm(x * 0.12, yy * 0.12, 4, 4) + 1.2 * ridged(x * 0.2, yy * 0.15, 9, 3); const k = sstep(2.2, 5.0, yy); return mix(muro, rocc - 1.2, k); });
      g.translate(0, -h / 2, 0); g.rotateY(-PI / 2); roccia.metti(g, TX0 - 0.15, 0, (TZ0 + TZ1) / 2, 0, 0, 0, 1, 1, 1, (x, y, z, nx, ny, nz) => y > -2.4 ? colPietra(x, y, z) : colRoccia(x, y, z, nx, ny, nz));
      // est: muro del canale
      const g2 = rilievo(TZ1 - TZ0 + 6, 5, 110, 14, conci(1.8, 0.8, 0.1)); g2.translate(0, -2.5, 0); g2.rotateY(PI / 2); pietra.metti(g2, TX1 + 0.15, 0, (TZ0 + TZ1) / 2);
      const g3 = rilievo(TZ1 - TZ0 + 6, 5, 110, 14, conci(1.8, 0.8, 0.1)); g3.translate(0, -2.5, 0); g3.rotateY(-PI / 2); pietra.metti(g3, 25.4, 0.2, (TZ0 + TZ1) / 2);
      // fondo del canale e acqua che scorre verso sud
      const fondo = new T.PlaneGeometry(4.6, TZ1 - TZ0 + 6, 8, 60); fondo.rotateX(-PI / 2); roccia.metti(fondo, 23.2, -3.4, (TZ0 + TZ1) / 2);
    }
    // balaustra: zoccolo modanato, colonnine tornite, corrimano; pilastrini con bracieri. Gli spazi sono i ponti a est
    const varchiEst = [[-11.6, -8.4], [0.4, 3.6]];
    const balaustrino = tornioModulato([[0.17, 0], [0.17, 0.08], [0.11, 0.14], [0.09, 0.22], [0.15, 0.42], [0.17, 0.52], [0.12, 0.66], [0.08, 0.74], [0.11, 0.8], [0.15, 0.86], [0.15, 0.9]], 8);
    const balaustrinoL = tornioModulato([[0.17, 0], [0.1, 0.16], [0.16, 0.46], [0.08, 0.74], [0.15, 0.86], [0.15, 0.9]], 6);
    function balaustra(x, z0, z1, verso, varchi) {
      const prof = [[0, 0], [0.5, 0], [0.5, 0.12], [0.42, 0.18], [0.42, 0.3], [0, 0.3]].map(p => [p[0] - 0.25, p[1]]);
      const tratti = []; let a = z0; (varchi || []).forEach(v => { tratti.push([a, v[0]]); a = v[1]; }); tratti.push([a, z1]);
      tratti.forEach(([za, zb]) => {
        if (zb - za < 1) return; const L = zb - za, zc = (za + zb) / 2;
        const zoc = lastraTonda(0.62, L, 0.34, 0.08, 0.05); pietra.metti(zoc, x, 0.34, zc);
        const cor = lastraTonda(0.4, L, 0.14, 0.06, 0.04); pietra.metti(cor, x, 1.32, zc);
        for (let zz = za + 0.45; zz < zb - 0.3; zz += 0.42) pietra.metti(balaustrino, x, 0.34, zz, 0, 0, 0, 1.0, 1.08, 1.0);
        for (let zz = za; zz <= zb + 0.01; zz += Math.max(1, L / Math.max(1, Math.round(L / 7)))) {   // pilastrini
          const p = lastraTonda(0.78, 0.78, 1.6, 0.1, 0.06); pietra.metti(p, x, 1.6, clamp(zz, za + 0.39, zb - 0.39));
          pietra.metti(lastraTonda(0.95, 0.95, 0.16, 0.12, 0.05), x, 1.72, clamp(zz, za + 0.39, zb - 0.39));
        }
        for (let zz = za; zz <= zb; zz += 0.55) ostacoli.push({ x: x + verso * 0.05, z: zz, r: 0.42, h: 1.4 });
      });
    }
    balaustra(TX0 + 0.3, TZ0 + 1.2, TZ1 - 3.3, -1); balaustra(TX1 - 0.3, TZ0 + 1.2, TZ1 - 3.3, 1, varchiEst);
    // bracieri di bronzo sui pilastrini (le sole luci calde vere sono quattro)
    const fiamma = (() => { const [cv, x] = tela(64, 128), gr = x.createRadialGradient(32, 96, 2, 32, 82, 54); gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.3, 'rgba(255,186,90,.95)'); gr.addColorStop(0.65, 'rgba(225,96,32,.4)'); gr.addColorStop(1, 'rgba(200,50,10,0)'); x.fillStyle = gr; x.beginPath(); x.moveTo(32, 2); x.quadraticCurveTo(64, 72, 46, 114); x.quadraticCurveTo(32, 126, 18, 114); x.quadraticCurveTo(0, 72, 32, 2); x.fill(); return new T.CanvasTexture(cv); })();
    const punto = (() => { const [cv, x] = tela(64, 64), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(cv); })();
    const sprite = (tx, col, sx, sy, op, add) => { const s = new T.Sprite(new T.SpriteMaterial({ map: tx, color: col, transparent: true, opacity: op, depthWrite: false, blending: add === false ? T.NormalBlending : T.AdditiveBlending, fog: true })); s.scale.set(sx, sy, 1); return s; };
    const coppa = tornioModulato([[0.08, 0], [0.18, 0.05], [0.12, 0.2], [0.18, 0.32], [0.55, 0.5], [0.62, 0.62], [0.56, 0.64], [0.2, 0.52]], 20, (a, y) => y > 0.45 ? 1 + 0.05 * Math.cos(a * 8) : 1);
    function braciere(x, y, z, luce) {
      bronzo.metti(coppa, x, y, z);
      const brace = new T.Mesh(new T.IcosahedronGeometry(0.36, 1), new T.MeshBasicMaterial({ color: 0xff8a3a })); brace.position.set(x, y + 0.56, z); brace.scale.y = 0.4; scena.add(brace);
      const f = sprite(fiamma, 0xffffff, 0.9, 1.8, 1), a = sprite(punto, 0xff9a4a, 3.4, 3.4, 0.4); f.position.set(x, y + 1.3, z); a.position.set(x, y + 1.0, z); scena.add(f, a);
      let l = null; if (luce) { l = new T.PointLight(0xff9a52, 2.6, 26, 1.6); l.position.set(x, y + 1.4, z); scena.add(l); }
      R.fuochi.push({ f, a, l, fase: rnd(0, 6) });
    }
    [[-1, -24], [-1, 9.6], [1, -24], [1, 9.6]].forEach(([s, z]) => braciere(s * (TX1 - 0.3), 1.88, z, true));
    [[-1, -8], [1, -15], [-1, 16]].forEach(([s, z]) => braciere(s * (TX1 - 0.3), 1.88, z, false));

    /* --- 4. i due ponti sul canale e gli archi della citta' scavata a est --- */
    const profArco = [[-0.55, -0.7], [0.55, -0.7], [0.55, -0.35], [0.7, -0.2], [0.7, 0.2], [0.5, 0.35], [0.5, 0.7], [-0.5, 0.7], [-0.5, 0.35], [-0.7, 0.2], [-0.7, -0.2], [-0.55, -0.35]];
    function portaleArco(cx, cz, ry, L, hImp, hCh, prof, sc, y0) {
      y0 = y0 || 0;   // archivolto con modanatura + stipiti a colonna scanalata
      const pts = archiAcuto(L, hImp, hCh, 40).map(p => new T.Vector3(p.x, p.y, 0));
      const g = modanatura(pts, prof.map(p => [p[0] * sc, p[1] * sc])); pietra.metti(g, cx, y0, cz, 0, ry, 0);
      [-1, 1].forEach(s => { const fus = tornioModulato([[0.42 * sc, 0], [0.42 * sc, 0.3], [0.34 * sc, 0.45], [0.3 * sc, 0.7], [0.28 * sc, hImp - 0.6], [0.36 * sc, hImp - 0.3], [0.4 * sc, hImp]], 24, a => 1 - 0.07 * Math.pow(0.5 + 0.5 * Math.cos(a * 12), 2)); const v = new T.Vector3(s * L, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), ry); pietra.metti(fus, cx + v.x, y0, cz + v.z); });
      const buio = new T.Shape(); pts.forEach((p, i) => i ? buio.lineTo(p.x * 0.97, p.y) : buio.moveTo(p.x * 0.97, p.y)); buio.lineTo(L * 0.97, 0); buio.lineTo(-L * 0.97, 0);
      const b = new T.Mesh(new T.ShapeGeometry(buio, 8), M.buio); b.position.set(cx, y0, cz); b.rotation.y = ry; return b;
    }
    varchiEst.forEach(([za, zb]) => {
      const zc = (za + zb) / 2;
      // ponte: impalcato curvo con parapetti bassi
      pietra.metti(lastraTonda(4.8, 3.2, 0.5, 0.2, 0.06), 23.4, 0.0, zc);
      { const pts = archiAcuto(1.5, -3.4, -0.6, 16); pietra.metti(modanatura(pts, [[-1.5, -0.3], [1.5, -0.3], [1.5, 0.3], [-1.5, 0.3]]), 23.4, 0, zc, 0, PI / 2, 0); }   // arco sotto il ponte
      [-1, 1].forEach(s => { pietra.metti(lastraTonda(4.6, 0.36, 0.55, 0.1, 0.05), 23.4, 0.55, zc + s * 1.42); for (let xx = 21.2; xx < 25.7; xx += 0.55) ostacoli.push({ x: xx, z: zc + s * 1.65, r: 0.4, h: 0.9 }); });
      scena.add(portaleArco(25.5, zc, -PI / 2, 2.0, 3.6, 6.0, profArco, 0.75));
    });
    // facciate della citta' scavata nella parete est: tre ordini di logge con nicchie, cornicioni su mensole e balaustre
    for (let piano = 0; piano < 3; piano++) {
      const y = 7.5 + piano * 7.2, x = 25.2;
      pietra.metti(lastraTonda(2.2, TZ1 - TZ0 - 4, 0.6, 0.2, 0.08), x - 0.6, y, (TZ0 + TZ1) / 2 - 1);
      for (let z = TZ0 + 3; z < TZ1 - 4; z += 1.6) pietra.metti(tornioModulato([[0.05, 0], [0.32, 0.05], [0.28, 0.35], [0.12, 0.55], [0.05, 0.6]], 8), x - 1.15, y - 1.2, z, PI, 0, 0, 1, 1.2, 1);
      for (let z = TZ0 + 4, i = 0; z < TZ1 - 6; z += 4.4, i++) {
        scena.add(portaleArco(x + 0.3, z, -PI / 2, 1.1, 2.6 - piano * 0.3, 4.0 - piano * 0.3, profArco, 0.42, y));
        const lucina = ((i * 7 + piano * 3) % 5) === 0; if (lucina) { const s = sprite(punto, 0xffb070, 1.6, 1.6, 0.5); s.position.set(x - 0.2, y + 1.2, z); scena.add(s); }
      }
      for (let z = TZ0 + 3.4; z < TZ1 - 5; z += 0.5) pietra.metti(balaustrinoL, x - 1.5, y, z, 0, 0, 0, 0.9, 0.9, 0.9);
      pietra.metti(lastraTonda(0.3, TZ1 - TZ0 - 8, 0.12, 0.05, 0.03), x - 1.5, y + 0.95, (TZ0 + TZ1) / 2 - 1);
    }
    if (!C) { const muro = (x, y) => { let h = conci(2.4, 1.2, 0.12)(x + 30, y + 30); [-24, -12, 0, 12].forEach(c => { if (Math.abs(x - c) < 0.9) h += 0.5; }); return h + 0.9 * sstep(26, 34, y) * (fbm(x * 0.15, y * 0.15, 2, 3) + 0.4); };
      const ge = rilievo(TZ1 - TZ0 + 8, 40, 100, 80, muro); ge.translate(0, 17, 0); ge.rotateY(-PI / 2); pietra.metti(ge, 26.1, 0, (TZ0 + TZ1) / 2 - 1);
      const gs = rilievo(52, 30, 110, 60, conci(2.6, 1.3, 0.12)); gs.translate(0, 12, 0); gs.rotateY(PI); pietra.metti(gs, 0, 0, TZ1 + 0.4); }
    // scala scolpita che sale dal canale al primo ordine
    for (let i = 0; i < 18; i++) { const top = -2.6 + i * 0.42 + 0.38; pietra.metti(lastraTonda(1.8, 0.64, top + 3.4, 0.06, 0.05), 25.0, top, -27 + i * 0.6); }

    /* --- 5. la facciata nord: parete scolpita a rilievo con lesene, fregio di glifi e nicchie --- */
    const glifi = (() => {   // fregio: occhi, fiamme e onde (disegno originale) letto come mappa di altezza
      const W = 1024, H = 64, [cv, x] = tela(W, H); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 5;
      for (let i = 0; i < 16; i++) {
        const cx = i * 64 + 32; x.save(); x.translate(cx, 32);
        if (i % 2) { x.beginPath(); x.ellipse(0, 0, 22, 12, 0, 0, 2 * PI); x.stroke(); x.beginPath(); x.arc(0, 0, 5, 0, 2 * PI); x.fill(); x.beginPath(); x.moveTo(-26, 0); x.lineTo(-30, -14); x.moveTo(26, 0); x.lineTo(30, -14); x.stroke(); }
        else { x.beginPath(); x.moveTo(0, 22); x.quadraticCurveTo(-16, 4, 0, -24); x.quadraticCurveTo(16, 4, 0, 22); x.stroke(); x.beginPath(); x.moveTo(-24, 26); x.quadraticCurveTo(-12, 16, 0, 26); x.quadraticCurveTo(12, 16, 24, 26); x.stroke(); }
        x.restore();
      }
      x.fillRect(0, 0, W, 4); x.fillRect(0, H - 4, W, 4);
      const d = x.getImageData(0, 0, W, H).data; return (u, v) => { const i = clamp(Math.floor(u * W), 0, W - 1), j = clamp(Math.floor(v * H), 0, H - 1); return d[(j * W + i) * 4] / 255; };
    })();
    if (!C) {
      const W = 56, Hh = 74, yb = -30, f = (x, y0) => {
        const y = y0 + Hh / 2 + yb; let h = conci(3.1, 1.55, 0.14)(x + 40, y + 40) * 0.8;
        const lesena = [-17.5, -9.5, 9.5, 17.5].reduce((m, c) => Math.max(m, sstep(1.5, 1.1, Math.abs(x - c))), 0);
        if (y > 0 && y < 30) h += lesena * (0.75 - 0.06 * Math.pow(0.5 + 0.5 * Math.cos((x * 2 * PI) / 0.55), 2));
        if (y > 15.4 && y < 18.2) { const u = ((x + 28) / 56 * 3) % 1; h += 0.5 + 0.35 * glifi(u < 0 ? u + 1 : u, 1 - (y - 15.4) / 2.8); }
        if (y > 18.2 && y < 18.8) h += 0.75; if (y > 14.8 && y < 15.4) h += 0.6;
        [-13.5, 13.5].forEach(c => { const dx = Math.abs(x - c), top = 20 + 6 + Math.sqrt(Math.max(0, 1 - dx * dx / 4)) * 2; if (dx < 2 && y > 20 && y < top) h -= 0.9 * sstep(2, 1.6, dx) * sstep(20, 20.4, y) * sstep(top, top - 0.4, y); });
        if (Math.abs(x) < 8.8 && y < 14) h -= 0.6;   // incasso del portale
        const k = sstep(30, 38, y) + sstep(-1, -6, y) + sstep(23, 28, Math.abs(x)); return mix(h, 1.8 * fbm(x * 0.12, y * 0.12, 5, 4) + 1.4 * ridged(x * 0.2, y * 0.2, 8, 3) - 0.8, clamp(k, 0, 1));
      };
      const g = rilievo(W, Hh, leggera ? 130 : 180, leggera ? 150 : 210, f); g.translate(0, Hh / 2 + yb, 0);
      roccia.metti(g, 0, 0, TZ0 - 0.6, 0, 0, 0, 1, 1, 1, (x, y, z, nx, ny, nz) => (y > 30 || y < -2 || Math.abs(x) > 24) ? colRoccia(x, y, z, nx, ny, nz) : colPietra(x, y + 2, z));
    }
    // il portale: tre archivolti acuti uno dentro l'altro, stipiti a colonne, il sigillo tondo di bronzo
    [[6.4, 0.55], [7.4, 0.62], [8.3, 0.7]].forEach(([L, sc], i) => { const b = portaleArco(0, TZ0 + 0.3 - i * 0.35, 0, L, 7, 14 + i * 1.1, profArco, sc * 1.25); if (i === 0) scena.add(b); });
    ostacoli.push({ x: -7, z: -31, r: 1.3, h: 14 }, { x: 7, z: -31, r: 1.3, h: 14 });
    const porta = new T.Group(); porta.position.set(0, 6, -31.0); porta.userData.mobile = 1; scena.add(porta);
    const runaTex = (() => { const [cv, x] = tela(512, 512); x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(256, 256, 200, 0, 7); x.stroke(); x.lineWidth = 6; x.beginPath(); x.arc(256, 256, 170, 0, 7); x.stroke(); for (let i = 0; i < 24; i++) { const a = i / 24 * 2 * PI; x.save(); x.translate(256 + Math.cos(a) * 185, 256 + Math.sin(a) * 185); x.rotate(a); x.fillStyle = '#fff'; x.fillRect(-3, -9, 6, 18); x.restore(); } x.lineWidth = 9; x.beginPath(); x.ellipse(256, 256, 90, 52, 0, 0, 7); x.stroke(); x.beginPath(); x.arc(256, 256, 24, 0, 7); x.fillStyle = '#fff'; x.fill(); x.beginPath(); x.moveTo(256, 120); x.lineTo(256, 160); x.moveTo(256, 352); x.lineTo(256, 392); x.moveTo(120, 256); x.lineTo(150, 256); x.moveTo(362, 256); x.lineTo(392, 256); x.stroke(); const t = new T.CanvasTexture(cv); return t; })();
    const runa = new T.MeshStandardMaterial({ color: 0x5e4a34, metalness: 0.8, roughness: 0.42, envMap: AMB_ENV, envMapIntensity: 1.0, emissive: 0xffc86a, emissiveMap: runaTex, emissiveIntensity: 0.1 });
    {
      const disco = tornioModulato([[0, 0.5], [2.6, 0.5], [2.9, 0.38], [4.4, 0.38], [4.6, 0.55], [5.2, 0.55], [5.6, 0.3], [5.7, 0], [0, 0]], 64);
      const pd = prepara(disco, colBronzo, 1.5); const md = new T.Mesh(pd, M.bronzo); md.rotation.x = PI / 2; md.castShadow = true; porta.add(md);
      const fr = new T.Mesh(new T.CircleGeometry(5.1, 64), runa); fr.position.z = 0.56; porta.add(fr);
      for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI, b = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), M.bronzo); b.position.set(Math.cos(a) * 5.3, Math.sin(a) * 5.3, 0.55); b.geometry = prepara(b.geometry, colBronzo, 1); porta.add(b); }
    }
    const luceRuna = new T.PointLight(0xffc070, 0.0, 26, 1.6); luceRuna.position.set(0, 7, -27); scena.add(luceRuna);

    /* --- 6. i due Guardiani colossali: figure incappucciate scolpite (campo di distanza), spada di bronzo puntata a terra --- */
    {
      const sdf = (x, y, z) => {
        const a = Math.atan2(z, x), pieghe = 0.075 * Math.sin(a * 11 + y * 0.45) * clamp((5.2 - y) / 5, 0, 1) + 0.03 * Math.sin(a * 23 - y);
        let d = conoTondo(x, y, z, 0, 0.45, 0, 0, 4.8, 0, 1.5, 0.86) - pieghe;
        d = smin(d, ellissoide(x, y, z, 0, 5.05, -0.02, 1.22, 0.78, 0.72), 0.45);
        d = smin(d, ellissoide(x, y, z, 0, 3.1, -0.55, 1.45, 3.1, 0.55), 0.5);   // mantello
        [-1, 1].forEach(s => {
          d = smin(d, sfera(x, y, z, s * 1.02, 5.28, 0, 0.5), 0.22);
          d = smin(d, conoTondo(x, y, z, s * 1.05, 5.15, 0.05, s * 0.72, 4.35, 0.5, 0.36, 0.3), 0.15);
          d = smin(d, conoTondo(x, y, z, s * 0.72, 4.35, 0.5, s * 0.24, 4.5, 0.88, 0.3, 0.4), 0.12);
          d = smin(d, sfera(x, y, z, s * 0.13, 4.56, 0.98, 0.21), 0.08);
        });
        d = smin(d, sfera(x, y, z, 0, 6.05, -0.06, 0.66), 0.3);
        d = smin(d, conoTondo(x, y, z, 0, 6.05, -0.12, 0, 6.82, -0.42, 0.6, 0.1), 0.25);   // punta del cappuccio
        d = smax(d, -sfera(x, y, z, 0, 5.98, 0.52, 0.45), 0.08);   // il volto e' un vuoto
        d = smin(d, toroY(x, y, z, 0, 3.95, 0, 1.0, 0.09), 0.04);   // cintura
        return d + 0.022 * fbm(x * 3.2, y * 3.2, z * 3.2, 2);
      };
      const h = leggera ? 0.1 : 0.072, geoG = GEO_G || (GEO_G = prepara(scolpisci(sdf, -2.1, 0, -1.4, 2.1, 7.3, 1.6, h), (x, y, z, nx, ny) => { const f = fbm(x * 1.6, y * 1.6, z * 1.6, 3), k = 0.86 + f * 0.4, sporco = 1 - 0.3 * clamp(-ny, 0, 1); const v = 1 - 0.85 * sstep(0.62, 0.3, Math.hypot(x, y - 5.98, z - 0.3)); return [0.47 * k * sporco * v, 0.45 * k * sporco * v, 0.43 * k * sporco * v]; }, 1.2));
      const lama = new T.Shape(); lama.moveTo(0, 0); lama.quadraticCurveTo(0.2, 0.6, 0.15, 3.3); lama.lineTo(0, 3.5); lama.lineTo(-0.15, 3.3); lama.quadraticCurveTo(-0.2, 0.6, 0, 0);
      const gl = new T.ExtrudeGeometry(lama, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 6 });
      [-1, 1].forEach(s => {
        const x0 = s * 15.2, z0 = -29.6, S = 2.0, ry = -s * 0.12;
        const m = new T.Mesh(geoG, M.pietra); m.position.set(x0, 2.1, z0); m.scale.setScalar(S); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; scena.add(m);
        // basamento a gradoni modanati
        pietra.metti(lastraTonda(5.2, 5.2, 0.5, 0.5, 0.12), x0, 0.5, z0); pietra.metti(lastraTonda(4.4, 4.4, 1.3, 0.4, 0.1), x0, 1.8, z0); pietra.metti(lastraTonda(4.8, 4.8, 0.32, 0.45, 0.1), x0, 2.12, z0);
        const fr = rilievo(4.0, 1.0, 60, 12, (x, y) => 0.08 + 0.12 * glifi(((x + 2) / 4 * 0.25 + 0.5) % 1, 1 - (y + 0.5))); pietra.metti(fr, x0, 1.15, z0 + 2.21);
        ostacoli.push({ x: x0, z: z0, r: 2.6, h: 16 });
        // spada: lama capovolta tra le mani, elsa tornita
        const sp = gl.clone(); sp.rotateZ(PI); sp.translate(0, 0.02, -0.02);
        const v = new T.Vector3(0, 0, 0.98 * S).applyAxisAngle(new T.Vector3(0, 1, 0), ry);
        bronzo.metti(sp, x0 + v.x, 2.1 + 4.4 * S, z0 + v.z + 0.12, 0, ry, 0, S * 1.25, S * 1.25, S);
        bronzo.metti(new T.CylinderGeometry(0.06, 0.06, 1.6, 8), x0 + v.x, 2.1 + 4.4 * S + 0.2, z0 + v.z + 0.12, 0, ry, PI / 2, S, S, S);
        bronzo.metti(tornioModulato([[0, 0], [0.12, 0.05], [0.07, 0.3], [0.09, 0.9], [0.16, 1.0], [0, 1.15]], 10), x0 + v.x, 2.1 + 4.45 * S, z0 + v.z + 0.12, 0, 0, 0, S, S, S);
        // aureola di bronzo a raggi dietro la testa e occhi accesi nel buio del cappuccio
        const hx = x0 - Math.sin(ry) * 0.75 * S, hz = z0 - Math.cos(ry) * 0.75 * S;
        bronzo.metti(new T.TorusGeometry(1.15, 0.07, 8, 48), hx, 2.1 + 6.1 * S, hz, 0, ry, 0, S, S, S);
        for (let i = 0; i < 14; i++) { const a = i / 14 * 2 * PI, c = new T.ConeGeometry(0.06, 0.55, 6); c.translate(0, 1.42, 0); c.rotateZ(a); bronzo.metti(c, hx, 2.1 + 6.1 * S, hz, 0, ry, 0, S, S, S); }
        { const w = new T.Vector3(0, 0, 0.36 * S).applyAxisAngle(new T.Vector3(0, 1, 0), ry), vu = new T.Mesh(new T.SphereGeometry(0.4 * S, 16, 12), M.buio); vu.position.set(x0 + w.x, 2.1 + 5.98 * S, z0 + w.z); scena.add(vu); }   // il vuoto sotto il cappuccio
        [-1, 1].forEach(e => { const o = sprite(punto, 0x8fe3ff, 0.55, 0.55, 0.9); const w = new T.Vector3(e * 0.17 * S, 0, 0.42 * S).applyAxisAngle(new T.Vector3(0, 1, 0), ry); o.position.set(x0 + w.x, 2.1 + 5.98 * S, z0 + w.z); scena.add(o); });
      });
    }

    /* --- 7. totem: obelischi a quattro lobi con fasce di bronzo e un cristallo in cima --- */
    const totem = [];
    [-1, 1].forEach(s => {
      const x = s * 12, z = -9;
      pietra.metti(lastraTonda(3.0, 3.0, 0.5, 0.6, 0.1), x, 0.5, z); pietra.metti(lastraTonda(2.4, 2.4, 0.4, 0.5, 0.08), x, 0.9, z);
      const fus = tornioModulato([[0.9, 0], [0.82, 0.3], [0.78, 2.0], [0.62, 6.0], [0.56, 7.0], [0.72, 7.25], [0.72, 7.6], [0.4, 7.9], [0, 8.0]], 40, (a, y) => 1 + 0.16 * Math.pow(Math.abs(Math.cos(a * 2)), 3) - 0.035 * Math.pow(0.5 + 0.5 * Math.cos(a * 16), 3) * (y > 0.4 && y < 6.8 ? 1 : 0));
      ombra.metti(fus, x, 0.9, z, 0, PI / 4);
      [1.6, 3.6, 5.6].forEach(y => bronzo.metti(tornioModulato([[0.84 - y * 0.03, -0.12], [0.9 - y * 0.03, -0.06], [0.9 - y * 0.03, 0.06], [0.84 - y * 0.03, 0.12]], 40, a => 1 + 0.16 * Math.pow(Math.abs(Math.cos(a * 2)), 3)), x, 0.9 + y, z, 0, PI / 4));
      for (let k = 0; k < 4; k++) { const a = k / 4 * 2 * PI + PI / 4, c = new T.ConeGeometry(0.12, 1.3, 6); c.translate(0, 0.65, 0); c.rotateZ(-0.6); bronzo.metti(c, x + Math.cos(a) * 0.62, 8.0, z + Math.sin(a) * 0.62, 0, -a, 0); }
      const cima = new T.Mesh(new T.OctahedronGeometry(1, 0), M.cristallo); cima.position.set(x, 8.7, z); cima.scale.set(0.45, 0.95, 0.45); scena.add(cima);
      const al = sprite(punto, 0x7fe6ff, 4, 4, 0.45); al.position.set(x, 8.7, z); scena.add(al);
      ostacoli.push({ x, z, r: 1.5, h: 9 }); totem.push({ cima, a: new T.Vector3(x, 8.7, z) });
    });

    /* --- 8. colonne monumentali (i ripari dall'Occhio) con archi acuti che reggono una crociera --- */
    const colonna = tornioModulato((() => { const P = [[1.75, 0], [1.75, 0.5], [1.55, 0.62], [1.62, 0.8], [1.4, 1.0], [1.3, 1.25]]; for (let i = 0; i <= 12; i++) { const y = 1.3 + i / 12 * 20; P.push([1.2 * (1 - 0.07 * Math.pow(i / 12, 1.4)), y]); } P.push([1.25, 21.5], [1.55, 22.3], [1.9, 23.0], [2.0, 23.4], [2.0, 23.8], [0, 23.8]); return P; })(), 48,
      (a, y) => (y > 1.3 && y < 21.3) ? 1 - 0.06 * Math.pow(0.5 + 0.5 * Math.cos(a * 18), 2) : (y > 23 ? 1 + 0.12 * Math.pow(Math.abs(Math.cos(a * 2)), 4) : 1));
    const PIL = [[-6, 6], [6, 6], [-6, -18], [6, -18]];
    PIL.forEach(([x, z]) => {
      pietra.metti(lastraTonda(3.7, 3.7, 0.45, 0.4, 0.1), x, 0.45, z); ombra.metti(colonna, x, 0.45, z);
      bronzo.metti(new T.TorusGeometry(1.24, 0.09, 8, 48), x, 2.4, z, PI / 2, 0, 0);
      ostacoli.push({ x, z, r: 1.85, h: 16 });
    });
    const profCost = [[-0.8, -1.2], [0.8, -1.2], [0.8, -0.6], [1.0, -0.4], [1.0, 0.2], [0.7, 0.5], [0.7, 1.2], [-0.7, 1.2], [-0.7, 0.5], [-1.0, 0.2], [-1.0, -0.4], [-0.8, -0.6]];
    [[0, 6, 0, 6], [0, -18, 0, 6], [-6, -6, PI / 2, 12], [6, -6, PI / 2, 12]].forEach(([x, z, ry, L]) => { const pts = archiAcuto(L, 24.2, 24.2 + L * 1.1, 36); pietra.metti(modanatura(pts, profCost), x, 0, z, 0, ry, 0); });

    /* --- 9. la voragine a ovest: pinnacoli che salgono dal buio, cascata, nebbia --- */
    [[-33, -18, 3.2, 30], [-40, 4, 4.5, 40], [-30, 14, 2.4, 22], [-42, -30, 3.6, 34]].forEach(([x, z, r, h]) => {
      const P = []; for (let i = 0; i <= 14; i++) { const k = i / 14; P.push([r * (1.1 - 0.75 * Math.pow(k, 1.4)) * (1 + 0.15 * Math.sin(i * 2.1)), -62 + k * (h + 62)]); } P.push([0, h + 0.4]);
      const g = tornioModulato(P, 18, (a, y) => 1 + 0.25 * fbm(Math.cos(a) * 2, y * 0.08, Math.sin(a) * 2, 3)); roccia.metti(g, x, 0, z);
      if (h > 25) pietra.metti(lastraTonda(r * 1.3, r * 1.3, 0.6, r * 0.6, 0.12), x, h + 0.5, z);   // rovine di un ripiano in cima
    });
    const nuvola = (() => { const S = 256, [cv, x] = tela(S, S), im = x.createImageData(S, S); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const v = tile((a, b, c) => fbm(a, b, c, 4), i / S, j / S, 1.4) * 0.5 + 0.5, k = (j * S + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = clamp((v - 0.35) * 2.2, 0, 1) * 255; } x.putImageData(im, 0, 0); const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })();
    const nebbie = [];
    [[-8, 0.5, 0x7d8aa8], [-17, 0.42, 0x5d6a88], [-30, 0.5, 0x3a4560]].forEach(([y, op, c], i) => { const t = nuvola.clone(); t.needsUpdate = true; t.repeat.set(2 + i, 2 + i); const m = new T.Mesh(new T.PlaneGeometry(110, 110), new T.MeshBasicMaterial({ map: t, color: c, transparent: true, opacity: op, depthWrite: false })); m.rotation.x = -PI / 2; m.position.set(-30, y, -6); scena.add(m); nebbie.push({ t, v: 0.004 + i * 0.002 }); });
    const fondoLuce = new T.Mesh(new T.PlaneGeometry(120, 120), new T.MeshBasicMaterial({ color: 0x1b3550 })); fondoLuce.rotation.x = -PI / 2; fondoLuce.position.set(-30, -55, -6); scena.add(fondoLuce);
    const acquaTex = (() => { const [cv, x] = tela(128, 256); x.fillStyle = '#000'; x.fillRect(0, 0, 128, 256); for (let i = 0; i < 260; i++) { const px = rnd(0, 128), w = rnd(1, 4), l = rnd(20, 90), py = rnd(0, 256); x.fillStyle = 'rgba(255,255,255,' + rnd(0.15, 0.6) + ')'; x.fillRect(px, py, w, l); x.fillRect(px, py - 256, w, l); } const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })();
    const cascate = [];
    [[-48.4, -8, 7, 1.0], [-47.6, -8, 4.5, 0.7]].forEach(([x, z, w, op], i) => {
      const t = acquaTex.clone(); t.needsUpdate = true; t.repeat.set(1.5, 3);
      const g = new T.PlaneGeometry(w, 88, 6, 40), p = g.attributes.position; for (let k = 0; k < p.count; k++) { const yy = p.getY(k); p.setZ(k, Math.pow(Math.max(0, (44 - yy) / 88), 0.5) * 1.8 * (i + 1) * 0.6 + Math.cos(p.getX(k) / w * PI) * 0.4); }
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: t, color: 0xb8d8ff, transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); m.rotation.y = PI / 2; m.position.set(x + 1.6, -12, z); scena.add(m); cascate.push({ t, v: 0.9 + i * 0.35 });
    });
    const spruzzi = []; for (let i = 0; i < (leggera ? 6 : 14); i++) { const s = sprite(punto, 0xcfe4ff, rnd(5, 10), rnd(4, 8), 0.22, false); s.position.set(-45 + rnd(-1, 2), -7 + rnd(-1, 2), -8 + rnd(-4, 4)); scena.add(s); spruzzi.push({ s, y0: s.position.y, f: rnd(0, 6) }); }
    // canale a est: acqua che scorre
    const canaleT = acquaTex.clone(); canaleT.needsUpdate = true; canaleT.repeat.set(1, 12);
    const canale = new T.Mesh(new T.PlaneGeometry(4.2, TZ1 - TZ0 + 6), new T.MeshStandardMaterial({ color: 0x1d3a4a, roughness: 0.15, metalness: 0.3, emissive: 0x0a2030, emissiveMap: canaleT, transparent: true, opacity: 0.9 })); canale.rotation.x = -PI / 2; canale.position.set(23.3, -2.2, (TZ0 + TZ1) / 2); scena.add(canale);

    /* --- 10. cristalli freddi nelle crepe e il pozzo di luce dalla volta --- */
    const gruppoCristalli = (x, y, z, s, n) => { for (let i = 0; i < n; i++) { const g = new T.OctahedronGeometry(0.3, 0); g.scale(1, rnd(2.5, 4.5), 1); cristalli.metti(g, x + rnd(-0.6, 0.6) * s, y + rnd(0, 0.4) * s, z + rnd(-0.6, 0.6) * s, rnd(-0.5, 0.5), rnd(0, 3), rnd(-0.5, 0.5), s, s, s); } const a = sprite(punto, 0x5fd8ff, 4 * s, 4 * s, 0.35); a.position.set(x, y + s, z); scena.add(a); };
    [[25.7, 2.6, -30, 1.1, 6], [25.7, 0.2, 14, 0.9, 5], [-21.5, -3, -26, 1.2, 6], [-21.5, -4, 4, 1.0, 5], [19.6, 0, -33.2, 1.0, 6], [-19.6, 0, -33.2, 1.0, 5]].forEach(c => gruppoCristalli(...c));
    const luceFredda = new T.PointLight(0x6fd0ff, 1.6, 34, 1.5); luceFredda.position.set(-30, 4, -10); scena.add(luceFredda);
    const spot = new T.SpotLight(0xd0d6ee, 1.15, 90, 0.34, 0.8, 1.2); spot.position.set(3, 46, -4); spot.target.position.set(0, 0, -8); scena.add(spot, spot.target);
    if (R.ombre) { spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.camera.near = 18; spot.shadow.camera.far = 60; spot.shadow.bias = -0.0008; spot.shadow.normalBias = 0.04; }
    {   // fascio di luce: cono aperto che sfuma ai bordi
      const g = new T.CylinderGeometry(1.8, 8.5, 46, 32, 1, true); g.translate(0, -23, 0);
      const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { c: { value: new T.Color(0x9fb6ff) } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = uv.y; gl_Position = projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 c; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(vN, vV)), 2.2); float a = f * 0.13 * smoothstep(0.0, 0.35, vY) * smoothstep(1.0, 0.85, vY); gl_FragColor = vec4(c * a, a); }' });
      const fascio = new T.Mesh(g, mat); fascio.position.copy(spot.position); fascio.lookAt(spot.target.position); fascio.rotateX(-PI / 2); scena.add(fascio);
      const crepa = sprite(punto, 0xdfe8ff, 7, 7, 0.9); crepa.position.set(3, 45, -4); scena.add(crepa);
    }
    // polvere sospesa nel fascio
    let polvere = null;
    if (!leggera) {
      const n = 260, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rnd(0, 2 * PI), r = Math.sqrt(rnd(0, 1)) * 7, y = rnd(0.5, 30); pos[i * 3] = 1.5 + Math.cos(a) * r * (0.3 + y / 40); pos[i * 3 + 1] = y; pos[i * 3 + 2] = -7 + Math.sin(a) * r * (0.3 + y / 40); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
      polvere = new T.Points(g, new T.PointsMaterial({ map: punto, color: 0xcfd8ff, size: 0.09, transparent: true, opacity: 0.65, depthWrite: false, blending: T.AdditiveBlending })); scena.add(polvere);
    }

    /* --- 11. ingresso a sud: galleria con la saracinesca di bronzo calata alle spalle --- */
    scena.add(portaleArco(0, TZ1 - 0.6, PI, 3.6, 5.2, 9.4, profArco, 0.9));
    for (let i = -6; i <= 6; i++) bronzo.metti(new T.CylinderGeometry(0.07, 0.07, 8.6, 6), i * 0.55, 3.9, TZ1 - 0.9);
    for (let j = 0; j < 6; j++) bronzo.metti(new T.CylinderGeometry(0.06, 0.06, 7.2, 6), 0, 0.8 + j * 1.4, TZ1 - 0.95, 0, 0, PI / 2);

    /* --- le piastre: dischi di pietra a filo del pavimento con l'anello di bronzo e il cuore che cambia colore --- */
    R.piastra = (x, z, r, nome) => {
      const g = new T.Group(); g.position.set(x, 0, z); scena.add(g);
      const base = new T.Mesh(prepara(tornioModulato([[r + 0.6, -0.1], [r + 0.6, 0.02], [r + 0.45, 0.08], [r + 0.1, 0.08], [r, 0.05], [0, 0.05]], 48), colPietra, 2), M.pietra); base.receiveShadow = true; g.add(base);
      const mat = new T.MeshStandardMaterial({ color: 0x3b4a5a, emissive: 0x0a1220, roughness: 0.5, metalness: 0.2 }); const cuore = new T.Mesh(new T.CylinderGeometry(r - 0.05, r - 0.05, 0.04, 48), mat); cuore.position.y = 0.07; g.add(cuore);
      const an = new T.Mesh(prepara(new T.TorusGeometry(r + 0.22, 0.07, 8, 64), colBronzo, 1), M.bronzo); an.rotation.x = PI / 2; an.position.y = 0.09; g.add(an);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI, k = new T.Mesh(new T.OctahedronGeometry(0.1, 0), M.cristallo); k.position.set(Math.cos(a) * (r + 0.42), 0.12, Math.sin(a) * (r + 0.42)); g.add(k); }
      return { x, z, r, nome, g, mat, col(c, e) { mat.color.setHex(c); mat.emissive.setHex(e === undefined ? 0 : e); } };
    };

    /* --- montaggio: un disegno per materiale --- */
    const dep = {}, mR = roccia.mesh(M.roccia, dep), mP = pietra.mesh(M.pietra, dep), mL = lastre.mesh(M.lastre, dep), mB = bronzo.mesh(M.bronzo, dep), mC = cristalli.mesh(M.cristallo, dep), mO = ombra.mesh(M.pietra, dep); if (!GEO) GEO = CACHE.sigilli = dep;
    mO.castShadow = true; mO.receiveShadow = true; mB.castShadow = false; mL.receiveShadow = true; mP.receiveShadow = true; mR.receiveShadow = false; mB.receiveShadow = true;
    scena.add(mR, mP, mL, mB, mC, mO);

    R.porta = porta; R.runa = runa; R.totem = totem;
    R.ingressi = varchiEst.map(([za, zb]) => ({ x: 23.0, z: (za + zb) / 2, y: 0, dx: -1, dz: 0, w: 0.9 }));   // i nemici arrivano dai ponti sul canale
    R.agg = (dt, t) => {
      for (const f of R.fuochi) { const k = 0.86 + Math.sin(t * 13 + f.fase) * 0.07 + Math.sin(t * 7.3 + f.fase * 2) * 0.07; f.f.scale.set(0.9 * (1.9 - k), 1.8 * k, 1); f.a.material.opacity = 0.3 + k * 0.12; if (f.l) f.l.intensity = 2.6 * k; }
      nebbie.forEach(n => { n.t.offset.x += n.v * dt; n.t.offset.y += n.v * 0.6 * dt; });
      cascate.forEach(c => { c.t.offset.y += c.v * dt; }); canaleT.offset.y -= 0.25 * dt;
      spruzzi.forEach(s => { s.s.position.y = s.y0 + Math.sin(t * 0.7 + s.f) * 0.8; s.s.material.opacity = 0.16 + 0.08 * Math.sin(t * 1.3 + s.f); });
      if (polvere) polvere.rotation.y = t * 0.01;
      luceRuna.intensity = runa.emissiveIntensity * 1.8;
    };
    return R;
  }

  /* =====================================================================
     IL SANTUARIO DEI GLIFI
     Pianta dell'incontro come nella mappa originale: sala lunga sotto una volta a costoloni,
     piastra centrale sul pavimento, a sinistra una terrazza alta, a destra un balcone basso
     (tutti e due con gradinate), quattro grandi pilastri di glifi che fanno da riparo,
     in fondo l'altare sotto una testa colossale scolpita nella roccia con l'Occhio sospeso.
     I nemici entrano da quattro porte vere: due sulle terrazze e due a livello del pavimento.
     ===================================================================== */
  let TX2 = null;   // texture del santuario, fatte una volta
  function texSantuario() {
    if (TX2) return TX2;
    const punto = (() => { const [cv, x] = tela(64, 64), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(cv); })();
    // fuoco freddo: cuore bianco, corpo verde chiaro, bordi verde scuro
    const fiamma = (() => { const [cv, x] = tela(64, 128), gr = x.createRadialGradient(32, 96, 2, 32, 82, 54); gr.addColorStop(0, 'rgba(240,255,240,1)'); gr.addColorStop(0.3, 'rgba(150,255,170,.95)'); gr.addColorStop(0.65, 'rgba(40,190,90,.4)'); gr.addColorStop(1, 'rgba(10,120,40,0)'); x.fillStyle = gr; x.beginPath(); x.moveTo(32, 2); x.quadraticCurveTo(64, 72, 46, 114); x.quadraticCurveTo(32, 126, 18, 114); x.quadraticCurveTo(0, 72, 32, 2); x.fill(); return new T.CanvasTexture(cv); })();
    const fiammaR = (() => { const [cv, x] = tela(64, 128), gr = x.createRadialGradient(32, 96, 2, 32, 82, 54); gr.addColorStop(0, 'rgba(255,248,225,1)'); gr.addColorStop(0.3, 'rgba(255,150,70,.95)'); gr.addColorStop(0.65, 'rgba(200,50,20,.45)'); gr.addColorStop(1, 'rgba(150,20,5,0)'); x.fillStyle = gr; x.beginPath(); x.moveTo(32, 2); x.quadraticCurveTo(64, 72, 46, 114); x.quadraticCurveTo(32, 126, 18, 114); x.quadraticCurveTo(0, 72, 32, 2); x.fill(); return new T.CanvasTexture(cv); })();
    // glifi: occhi, falci, fiamme e spirali (disegno originale), 16 per striscia; letti anche come mappa di altezza (sfumata)
    const W = 1024, H = 64, [cv, x] = tela(W, H); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 7; x.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      x.save(); x.translate(i * 64 + 32, 32); const t = i % 4;
      if (t === 0) { x.beginPath(); x.ellipse(0, 0, 20, 11, 0, 0, 2 * PI); x.stroke(); x.beginPath(); x.arc(0, 0, 5, 0, 2 * PI); x.fill(); x.beginPath(); x.moveTo(0, -12); x.lineTo(0, -24); x.moveTo(0, 12); x.lineTo(0, 24); x.stroke(); }
      else if (t === 1) { x.beginPath(); x.arc(4, 0, 18, PI * 0.6, PI * 1.4); x.stroke(); x.beginPath(); x.moveTo(-16, -18); x.lineTo(12, 18); x.stroke(); x.beginPath(); x.arc(14, -14, 4, 0, 2 * PI); x.fill(); }
      else if (t === 2) { x.beginPath(); x.moveTo(0, 24); x.quadraticCurveTo(-18, 2, 0, -24); x.quadraticCurveTo(18, 2, 0, 24); x.stroke(); x.beginPath(); x.moveTo(-22, 24); x.lineTo(22, 24); x.stroke(); }
      else { x.beginPath(); for (let k = 0; k < 40; k++) { const a = k / 40 * 4 * PI, r = 2 + k * 0.5; k ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(r, 0); } x.stroke(); x.beginPath(); x.moveTo(-24, -22); x.lineTo(-14, -22); x.moveTo(14, 22); x.lineTo(24, 22); x.stroke(); }
      x.restore();
    }
    const d = x.getImageData(0, 0, W, H).data, px = (i, j) => d[(clamp(j, 0, H - 1) * W + ((i % W) + W) % W) * 4] / 255;
    const glifi = (u, v) => { const i = Math.floor(u * W), j = Math.floor(v * H); let s = 0; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) s += px(i + a * 2, j + b * 2); return s / 25; };
    const glifiTex = new T.CanvasTexture(cv); glifiTex.wrapS = T.RepeatWrapping;
    // un glifo solo, per il segno che si accende sopra le piastre
    const segno = (() => { const [c2, y] = tela(128, 128); y.drawImage(cv, 0, 0, 64, 64, 0, 0, 128, 128); return new T.CanvasTexture(c2); })();
    return (TX2 = { punto, fiamma, fiammaR, glifi, glifiTex, segno });
  }

  const sprite = (tx, col, sx, sy, op, add) => { const s = new T.Sprite(new T.SpriteMaterial({ map: tx, color: col, transparent: true, opacity: op, depthWrite: false, blending: add === false ? T.NormalBlending : T.AdditiveBlending, fog: true })); s.scale.set(sx, sy, 1); return s; };
  const archTop = (dx, L, imp, H) => { const Rr = (L * L + H * H) / (2 * L), q = Math.abs(dx) + Rr - L; return q > Rr ? -1e9 : imp + Math.sqrt(Rr * Rr - q * q); };
  const conci = (lw, lh, prof) => (x, y) => {
    const riga = Math.floor(y / lh), xx = x / lw + (riga % 2) * 0.5, fx = xx - Math.floor(xx), fy = y / lh - riga, id = Math.floor(xx) * 7.3 + riga * 3.1;
    const g = Math.min(sstep(0, 0.06, fx), sstep(0, 0.06, 1 - fx), sstep(0, 0.12, fy), sstep(0, 0.12, 1 - fy));
    return (g - 1) * prof + g * (0.05 * n3(id, 0.5, 0.3) + 0.04 * fbm(x * 0.9, y * 0.9, id, 2));
  };
  const scuro = (f, a, b) => (x, y, z, nx, ny, nz) => { const c = f(x, y, z, nx, ny, nz), k = 1 - 0.78 * sstep(a, b, y); return [c[0] * k, c[1] * k, c[2] * k]; };

  // attrezzi comuni alle sale: lastre, archi, bracieri. k = { scena, M, TX, R, ostacoli, pietra, lastre, bronzo, C, fuoco }
  function kitSala(k) {
    const { scena, M, TX, R, ostacoli, pietra, lastre, bronzo, C } = k;
    const colLastra = () => { const k = rnd(0.7, 1.15), w = rnd(-0.03, 0.03); return [0.36 * k + w, 0.335 * k, 0.30 * k - w]; };
    const posa = (geo, x, y, z) => { const c = colLastra(); const usura = (px, py, pz, nx, ny) => { const f = fbm(px * 0.7, py, pz * 0.7, 4) * 0.45 + fbm(px * 3.1, 1, pz * 3.1, 2) * 0.18, e = ny > 0.9 ? 1 : 0.6; return [c[0] * (e + f), c[1] * (e + f), c[2] * (e + f)]; }; lastre.metti(geo, x, y + rnd(-0.02, 0.012), z, rnd(-0.008, 0.008), 0, rnd(-0.008, 0.008), 1, 1, 1, usura); };
    function pavimenta(x0, x1, z0, z1, y, salta) {
      for (let z = z0 + 0.05, riga = 0; z < z1 - 0.2; riga++) {
        const dz = Math.min(rnd(0.9, 1.35), z1 - 0.05 - z); let x = x0 + 0.05 + (riga % 2) * rnd(0.3, 0.8);
        while (x < x1 - 0.3) { const dx = Math.min(rnd(1.1, 2.4), x1 - 0.05 - x), cx = x + dx / 2, cz = z + dz / 2; x += dx; if (dx < 0.35 || dz < 0.35 || (salta && salta(cx, cz, dx, dz))) continue; posa(lastraTonda(dx - 0.07, dz - 0.07, 0.16, rnd(0.05, 0.25), 0.035, true), cx, y, cz); }
        z += dz;
      }
    }
    function settori(cx, cz, r0, r1, n, off) {
      for (let i = 0; i < n; i++) {
        const a0 = off + i / n * 2 * PI + 0.012, a1 = off + (i + 1) / n * 2 * PI - 0.012, sh = new T.Shape(), K = 6;
        for (let k = 0; k <= K; k++) { const a = mix(a0, a1, k / K); k ? sh.lineTo(Math.cos(a) * (r1 - 0.04), Math.sin(a) * (r1 - 0.04)) : sh.moveTo(Math.cos(a) * (r1 - 0.04), Math.sin(a) * (r1 - 0.04)); }
        for (let k = K; k >= 0; k--) { const a = mix(a0, a1, k / K); sh.lineTo(Math.cos(a) * (r0 + 0.04), Math.sin(a) * (r0 + 0.04)); }
        const g = new T.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 1, curveSegments: 2 }); g.rotateX(PI / 2); g.translate(0, -0.035, 0); posa(g, cx, 0, cz);
      }
    }
    const profArco = [[-0.55, -0.7], [0.55, -0.7], [0.55, -0.35], [0.7, -0.2], [0.7, 0.2], [0.5, 0.35], [0.5, 0.7], [-0.5, 0.7], [-0.5, 0.35], [-0.7, 0.2], [-0.7, -0.2], [-0.55, -0.35]];
    function arcata(cx, cz, ry, L, hImp, hCh, sc, y0) {
      const pts = archiAcuto(L, hImp, hCh, 40).map(p => new T.Vector3(p.x, p.y, 0));
      if (!C) pietra.metti(modanatura(pts, profArco.map(p => [p[0] * sc, p[1] * sc])), cx, y0, cz, 0, ry, 0);
      if (!C) [-1, 1].forEach(s => { const fus = tornioModulato([[0.42 * sc, 0], [0.42 * sc, 0.3], [0.34 * sc, 0.45], [0.3 * sc, 0.7], [0.28 * sc, hImp - 0.6], [0.36 * sc, hImp - 0.3], [0.4 * sc, hImp]], 24, a => 1 - 0.07 * Math.pow(0.5 + 0.5 * Math.cos(a * 12), 2)); const v = new T.Vector3(s * L, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), ry); pietra.metti(fus, cx + v.x, y0, cz + v.z); });
      const buio = new T.Shape(); pts.forEach((p, i) => i ? buio.lineTo(p.x * 0.97, p.y) : buio.moveTo(p.x * 0.97, p.y)); buio.lineTo(L * 0.97, 0); buio.lineTo(-L * 0.97, 0);
      const b = new T.Mesh(new T.ShapeGeometry(buio, 8), M.buio); b.position.set(cx, y0, cz); b.rotation.y = ry; return b;
    }
    const coppa = tornioModulato([[0.08, 0], [0.18, 0.05], [0.12, 0.2], [0.18, 0.32], [0.55, 0.5], [0.62, 0.62], [0.56, 0.64], [0.2, 0.52]], 20, (a, y) => y > 0.45 ? 1 + 0.05 * Math.cos(a * 8) : 1);
    const stelo = tornioModulato([[0.35, 0], [0.35, 0.12], [0.16, 0.25], [0.11, 0.6], [0.14, 0.9], [0.09, 1.2], [0.2, 1.3], [0, 1.32]], 14);
    const F = k.fuoco === 'rosso' ? { tx: TX.fiammaR, brace: 0xffa060, alo: 0xff7a3a, luce: 0xff8a4a } : { tx: TX.fiamma, brace: 0x9dffb5, alo: 0x6dff96, luce: 0x8affa8 };
    function braciere(x, y, z, luce) {
      bronzo.metti(stelo, x, y, z); bronzo.metti(coppa, x, y + 1.3, z);
      const brace = new T.Mesh(new T.IcosahedronGeometry(0.36, 1), new T.MeshBasicMaterial({ color: F.brace })); brace.position.set(x, y + 1.86, z); brace.scale.y = 0.4; scena.add(brace);
      const f = sprite(F.tx, 0xffffff, 0.9, 1.8, 1), a = sprite(TX.punto, F.alo, 3.4, 3.4, 0.35); f.position.set(x, y + 2.6, z); a.position.set(x, y + 2.3, z); scena.add(f, a);
      let l = null; if (luce) { l = new T.PointLight(F.luce, 2.2, 24, 1.6); l.position.set(x, y + 2.7, z); scena.add(l); }
      R.fuochi.push({ f, a, l, fase: rnd(0, 6) }); ostacoli.push({ x, z, r: 0.5, h: y + 1.9 });
    }
    return { posa, pavimenta, settori, arcata, braciere };
  }

  function santuarioGlifi(ctx) {
    const { scena, ostacoli, piani, leggera } = ctx, M = materiali(leggera), TX = texSantuario(); semeR = 23; GEO = CACHE.glifi || null;
    const R = { fuochi: [], agg: null, ombre: !leggera, porte: [] };
    const C = !!GEO, roccia = cesto('r', colRoccia, 4), pietra = cesto('p', colPietra, 2.5), lastre = cesto('l', null, 2), bronzo = cesto('b', colBronzo, 1.5), ombra = cesto('o', colPietra, 2.5);
    const volta = cesto('v', null, 3);
    const { posa, pavimenta, settori, arcata, braciere } = kitSala({ scena, M, TX, R, ostacoli, pietra, lastre, bronzo, C, fuoco: 'verde' });
    scena.children.filter(o => o.isLight).forEach(o => scena.remove(o));
    scena.background = new T.Color(0x060504); scena.fog = new T.FogExp2(0x0b0907, 0.015);
    scena.add(new T.HemisphereLight(0x70665a, 0x241c16, 1.15));
    const X1 = 23.6, Z0 = -31.6, Z1 = 16.8, IMP = 19, CHIAVE = 37;
    Object.assign(ctx.lim, { x0: -22.8, x1: 22.8, z0: -31, z1: 16 }); delete ctx.lim.ell;
    const COST = []; for (let z = -28.4; z < 16; z += 6.4) COST.push(z);   // costoloni della volta, lesene sulle pareti
    const CAMPATE = COST.slice(0, -1).map((z, i) => (z + COST[i + 1]) / 2);
    const PORTE = [{ s: -1, z: -12.4, y: 2.0 }, { s: 1, z: -12.4, y: 1.2 }, { s: -1, z: 6.8, y: 0 }, { s: 1, z: 6.8, y: 0 }];
    const PL = 1.9, PIMP = 3.6, PCH = 6.2;   // porte: semiluce, imposta, chiave (sopra la soglia)
    const TER = [{ s: -1, y: 2.0, xi: 11, zf: -5 }, { s: 1, y: 1.2, xi: 11, zf: -5 }];   // terrazza alta a sinistra, balcone basso a destra
    const DAIS = { x: 0, z: -22, r: 5.6 }, CC = { x: 0, z: -3, r: 5.4 };

    /* --- 1. piani di gioco: pavimento, terrazza e balcone a gradoni (0,4 m per gradino) --- */
    piani.push({ x0: -X1, x1: X1, z0: Z0, z1: Z1, y: 0 });
    TER.forEach(t => { t.n = Math.round(t.y / 0.4) - 1; for (let k = 0; k <= t.n; k++) { const off = (t.n - k) * 0.5, xin = t.xi - off; piani.push(t.s < 0 ? { x0: -X1, x1: -xin, z0: Z0, z1: t.zf + off, y: 0.4 * (k + 1) } : { x0: xin, x1: X1, z0: Z0, z1: t.zf + off, y: 0.4 * (k + 1) }); } });
    const sottoTerrazza = (cx, cz, dx, dz) => TER.some(t => { const off = t.n * 0.5; return Math.abs(cx) - dx / 2 >= t.xi - off - 0.02 && Math.sign(cx) === t.s && cz + dz / 2 <= t.zf + off + 0.02; });

    /* --- 2. pavimento: lastre a corsi sfalsati, cerchio a settori attorno alla piastra centrale e all'altare --- */
    const malta = new T.Mesh(new T.PlaneGeometry(2 * X1, Z1 - Z0), M.malta); malta.rotation.x = -PI / 2; malta.position.set(0, -0.07, (Z0 + Z1) / 2); malta.receiveShadow = true; scena.add(malta);
    if (!C) {
      [[0, 1.6, 1], [1.7, 3.5, 10], [3.6, CC.r, 18]].forEach(([r0, r1, n], ia) => { if (n === 1) { const g = new T.CylinderGeometry(r1 - 0.05, r1, 0.2, 28); g.translate(0, -0.1, 0); posa(g, CC.x, 0, CC.z); } else settori(CC.x, CC.z, r0, r1, n, ia * 0.37); });
      settori(CC.x, CC.z, CC.r + 0.3, CC.r + 1.6, 36, 0.1); settori(DAIS.x, DAIS.z, DAIS.r + 0.1, DAIS.r + 1.5, 32, 0);
      pavimenta(-X1 + 0.3, X1 - 0.3, Z0 + 0.3, Z1 - 0.3, 0, (cx, cz, dx, dz) => sottoTerrazza(cx, cz, dx, dz) || Math.hypot(cx - CC.x, cz - CC.z) < CC.r + 1.4 || Math.hypot(cx - DAIS.x, cz - DAIS.z) < DAIS.r + 1.3);
      TER.forEach(t => pavimenta(t.s < 0 ? -X1 + 0.3 : t.xi, t.s < 0 ? -t.xi : X1 - 0.3, Z0 + 0.3, t.zf, t.y));
    }
    bronzo.metti(new T.TorusGeometry(CC.r + 0.17, 0.11, 6, 96), CC.x, -0.02, CC.z, PI / 2, 0, 0, 1, 1, 0.45);

    /* --- 3. terrazza e balcone: corpo di pietra, gradinate sui due lati che guardano la sala, bordo di bronzo --- */
    TER.forEach(t => {
      const w = X1 - t.xi, cx = t.s * (t.xi + w / 2), cz = (Z0 + t.zf) / 2;
      pietra.metti(lastraTonda(w, t.zf - Z0, t.y, 0.1, 0.05), cx, t.y - 0.02, cz);
      for (let k = 0; k < t.n; k++) {
        const off = (t.n - k) * 0.5, xin = t.xi - off, h = 0.4 * (k + 1), zf = t.zf + off;
        pietra.metti(lastraTonda(0.56, zf - Z0, h, 0.04, 0.04, true), t.s * (xin + 0.25), h, (Z0 + zf) / 2);   // gradino verso il centro
        pietra.metti(lastraTonda(X1 - xin, 0.56, h, 0.04, 0.04, true), t.s * (xin + X1) / 2, h, zf - 0.25);   // gradino verso sud
      }
      // listello di bronzo sullo spigolo della terrazza e pilastrini agli angoli
      bronzo.metti(new T.CylinderGeometry(0.06, 0.06, t.zf - Z0, 8), t.s * (t.xi + 0.02), t.y + 0.02, cz, PI / 2, 0, 0);
      bronzo.metti(new T.CylinderGeometry(0.06, 0.06, w, 8), cx, t.y + 0.02, t.zf - 0.02, 0, 0, PI / 2);
    });

    /* --- 4. pareti: conci, lesene scanalate sotto ogni costolone, archi ciechi, porte, fregio di glifi --- */
    const DC = z => { let m = 1e9; for (const c of COST) m = Math.min(m, Math.abs(z - c)); return m; };
    const fregio = (u, y, y0) => { let h = 0; if (y > y0 && y < y0 + 1.6) h += 0.35 + 0.3 * TX.glifi(((u % 24) + 24) % 24 / 24, 1 - (y - y0) / 1.6); if ((y > y0 - 0.4 && y < y0) || (y > y0 + 1.6 && y < y0 + 2.0)) h += 0.55; return h; };
    const parete = s => (z, y) => {
      let h = conci(2.3, 1.05, 0.1)(z + 60, y + 60) * 0.9;
      const pil = y < IMP + 0.5 ? sstep(0.95, 0.7, DC(z)) : 0;
      if (y < 1.1) h = Math.max(h, 0.28);   // zoccolo
      let zb = null; for (const c of CAMPATE) if (Math.abs(z - c) < 3.2) zb = c;
      if (zb !== null) {
        const p = PORTE.find(p => p.s === s && Math.abs(p.z - zb) < 0.1), dx = z - zb;
        if (p) { const top = archTop(dx, PL + 0.3, p.y + PIMP, PCH - PIMP); if (y > p.y - 0.05 && y < top) h = -0.9; }
        else { const top = archTop(dx, 2.1, 9, 5); if (y > 2.6 && y < top) h -= 0.45 * sstep(0, 0.15, y - 2.6) * sstep(0, 0.15, top - y) * sstep(2.1, 1.9, Math.abs(dx)); }
      }
      h += fregio(z, y, 15.2);
      return mix(h, 0.75 - 0.06 * Math.pow(0.5 + 0.5 * Math.cos(z * 2 * PI / 0.5), 2), pil);
    };
    if (!C) {
      const W = Z1 - Z0, H = IMP + 1, zc = (Z0 + Z1) / 2;
      [-1, 1].forEach(s => {
        const f = parete(s), g = rilievo(W, H, leggera ? 150 : 200, leggera ? 64 : 90, (xl, yl) => f(s < 0 ? zc - xl : zc + xl, yl + H / 2));
        g.translate(0, H / 2, 0); g.rotateY(s < 0 ? PI / 2 : -PI / 2); pietra.metti(g, s * X1, 0, zc, 0, 0, 0, 1, 1, 1, scuro(colPietra, 12, 22));
      });
      // parete di fondo: grande arco cieco dietro la testa, fregio, roccia viva sopra la volta
      const fondo = (x, y) => { let h = conci(2.6, 1.2, 0.12)(x + 60, y + 60) * 0.9; const top = archTop(x, 10.5, 11, 15); if (y < top) h -= 0.8 * sstep(10.5, 10.1, Math.abs(x)) * sstep(top, top - 0.4, y); h += Math.abs(x) > 11 ? fregio(x, y, 15.2) : 0; if (y > IMP + 2) h = mix(h, 1.6 * fbm(x * 0.12, y * 0.12, 3, 4) - 0.6, sstep(IMP + 2, IMP + 8, y)); return h; };
      const gb = rilievo(2 * X1, CHIAVE + 1, leggera ? 140 : 190, leggera ? 110 : 150, (x, y) => fondo(x, y + (CHIAVE + 1) / 2)); gb.translate(0, (CHIAVE + 1) / 2, 0); pietra.metti(gb, 0, 0, Z0, 0, 0, 0, 1, 1, 1, scuro(colPietra, 14, 30));
      // parete d'ingresso
      const fronte = (x, y) => { let h = conci(2.6, 1.2, 0.12)(x + 30, y + 30) * 0.9; h += fregio(x, y, 15.2); const top = archTop(x, 3.7, 5.2, 4.2); if (y < top + 0.6 && Math.abs(x) < 4.6) h -= 0.6; return h; };
      const gf = rilievo(2 * X1, CHIAVE + 1, leggera ? 120 : 160, leggera ? 90 : 120, (x, y) => fronte(x, y + (CHIAVE + 1) / 2)); gf.translate(0, (CHIAVE + 1) / 2, 0); gf.rotateY(PI); pietra.metti(gf, 0, 0, Z1, 0, 0, 0, 1, 1, 1, scuro(colPietra, 14, 30));
    }
    // strisce di glifi accesi nel fregio delle pareti lunghe
    const glifoMat = new T.MeshBasicMaterial({ map: TX.glifiTex, color: 0xffb35a, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, fog: true });
    { const t = TX.glifiTex.clone(); t.needsUpdate = true; t.repeat.set((Z1 - Z0) / 24, 1); glifoMat.map = t;
      [-1, 1].forEach(s => { const m = new T.Mesh(new T.PlaneGeometry(Z1 - Z0, 1.6), glifoMat); m.rotation.y = s < 0 ? PI / 2 : -PI / 2; m.position.set(s * (X1 - 0.7), 16.0, (Z0 + Z1) / 2); scena.add(m); }); }

    /* --- 5. la volta: botte acuta che sparisce nel buio, costoloni sulle lesene, pendenti scolpiti --- */
    if (!C) {
      const pts = archiAcuto(X1 + 0.2, IMP, CHIAVE, 72), NZ = leggera ? 60 : 96, P = [], idx = [], N = pts.length;
      for (let j = 0; j <= NZ; j++) {
        const z = Z0 + (Z1 - Z0) * j / NZ;
        pts.forEach(p => { const dx = p.x, dy = p.y - IMP + 6, L = Math.hypot(dx, dy) || 1, d = 0.5 * fbm(p.x * 0.18, p.y * 0.18, z * 0.18, 3) + 0.25 * ridged(p.x * 0.4, p.y * 0.4, z * 0.4, 2); P.push(p.x + dx / L * d, p.y + dy / L * d, z); });
      }
      for (let j = 0; j < NZ; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i, b = a + N; idx.push(a, a + 1, b, a + 1, b + 1, b); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
      { const n = g.attributes.normal, k = Math.floor(NZ / 2) * N + Math.floor(N / 2); if (n.getY(k) > 0) { for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); g.setIndex(idx.map((v, q) => q % 3 === 1 ? idx[q + 1] : q % 3 === 2 ? idx[q - 1] : v)); } }
      volta.lista.push(prepara(g, scuro(colRoccia, 22, 34), 4));
    }
    const profCost = [[-0.5, -0.8], [0.5, -0.8], [0.5, -0.4], [0.65, -0.25], [0.65, 0.15], [0.45, 0.35], [0.45, 0.8], [-0.45, 0.8], [-0.45, 0.35], [-0.65, 0.15], [-0.65, -0.25], [-0.5, -0.4]];
    const pendente = C ? null : tornioModulato([[0, 0], [0.05, 0.1], [0.16, 0.9], [0.32, 1.5], [0.28, 1.8], [0.42, 2.2], [0.35, 2.5], [0, 2.7]], 12, (a, y) => 1 + 0.18 * Math.pow(Math.abs(Math.cos(a * 2)), 3));
    COST.forEach(z => {
      if (!C) volta.metti(modanatura(archiAcuto(X1 - 0.6, IMP, CHIAVE - 0.7, 48), profCost), 0, 0, z, 0, 0, 0, 1, 1, 1, scuro(colPietra, 20, 34));
      [-0.62, 0, 0.62].forEach(k => { const x = k * (X1 - 2), top = archTop(x, X1 - 0.6, IMP, CHIAVE - 0.7 - IMP) - 0.8; volta.metti(pendente, x, top + 0.2, z, PI, 0, 0, 1.4, 1.4, 1.4, scuro(colPietra, 20, 34)); });
    });
    volta.metti(lastraTonda(1.0, Z1 - Z0, 0.7, 0.2, 0.08), 0, CHIAVE - 0.6, (Z0 + Z1) / 2, 0, 0, 0, 1, 1, 1, scuro(colPietra, 20, 34));

    /* --- 6. porte dei nemici: archi acuti con stipiti a colonna, buio dentro, una bruma verde che si accende quando arrivano --- */
    PORTE.forEach(p => {
      const b = arcata(p.s * (X1 - 0.35), p.z, p.s < 0 ? PI / 2 : -PI / 2, PL, PIMP, PCH, 0.62, p.y); b.position.x = p.s * (X1 + 0.85); scena.add(b);
      if (p.y > 0) pietra.metti(lastraTonda(1.6, 2 * PL + 0.4, 0.3, 0.1, 0.05), p.s * (X1 + 0.2), p.y, p.z);   // soglia
      const bruma = sprite(TX.punto, 0x7dffa0, 4.2, 5.2, 0.12); bruma.position.set(p.s * (X1 - 0.2), p.y + 2.4, p.z); scena.add(bruma);
      R.porte.push({ bruma, k: 0 });
    });
    R.ingressi = PORTE.map(p => ({ x: p.s * 22.1, z: p.z, y: p.y, dx: -p.s, dz: 0, w: 1.2 }));
    R.varco = i => { const p = R.porte[i]; if (p) p.k = 1; };
    // ingresso dei Custodi a sud, con la grata di bronzo calata alle spalle
    scena.add(arcata(0, Z1 - 0.5, PI, 3.4, 5.2, 9.0, 0.9, 0));
    for (let i = -6; i <= 6; i++) bronzo.metti(new T.CylinderGeometry(0.07, 0.07, 8.6, 6), i * 0.52, 3.9, Z1 - 0.8);
    for (let j = 0; j < 6; j++) bronzo.metti(new T.CylinderGeometry(0.06, 0.06, 7.0, 6), 0, 0.8 + j * 1.4, Z1 - 0.85, 0, 0, PI / 2);

    /* --- 7. i quattro pilastri di glifi: fusto a sei lobi, tre fasce di glifi incisi che brillano nei solchi --- */
    const PIL = [[-6, -9], [6, -9], [-12, 2], [12, 2]], FASCE = [3.0, 9.4, 15.6], HF = 1.0;
    const profPil = (() => { const P = [[1.8, 0], [1.8, 0.5], [1.55, 0.68], [1.62, 0.85], [1.42, 1.05]]; let y = 1.3; while (y < 19) { const inF = FASCE.some(f => y > f - 0.2 && y < f + HF + 0.2); P.push([1.38 - 0.12 * (y / 19), y]); y += inF ? 0.07 : 0.6; } P.push([1.25, 19.2], [1.55, 19.7], [1.85, 20.2], [1.95, 20.5], [1.95, 20.9], [0, 20.9]); return P; })();
    const inFascia = y => FASCE.find(f => y > f && y < f + HF);
    const fusto = C ? null : tornioModulato(profPil, leggera ? 96 : 128, (a, y) => {
      const f = inFascia(y); if (f !== undefined) return 1 - 0.032 * TX.glifi(a / (2 * PI), 1 - (y - f) / HF);
      if (FASCE.some(f => (y > f - 0.2 && y <= f) || (y >= f + HF && y < f + HF + 0.2))) return 1.06;   // cordoni
      return (y > 1.3 && y < 19.2) ? 1 + 0.1 * Math.pow(Math.abs(Math.cos(a * 3)), 3) - 0.04 * Math.pow(0.5 + 0.5 * Math.cos(a * 24), 3) : 1;
    });
    const fuocoGlifi = new T.MeshBasicMaterial({ color: 0xffb04a, fog: true }), fasce = cesto('f', () => [1, 1, 1], 1);
    PIL.forEach(([x, z]) => {
      pietra.metti(lastraTonda(4.2, 4.2, 0.5, 0.5, 0.12), x, 0.5, z); ombra.metti(fusto, x, 0.5, z);
      FASCE.forEach(f => { const r = 1.38 - 0.12 * ((f + HF / 2) / 19); fasce.metti(new T.CylinderGeometry(r * 0.985, r * 0.985, HF, 48, 1, true), x, 0.5 + f + HF / 2, z); });
      for (let k = 0; k < 6; k++) { const a = k / 6 * 2 * PI, c = new T.ConeGeometry(0.14, 1.6, 6); c.translate(0, 0.8, 0); c.rotateZ(-0.5); bronzo.metti(c, x + Math.cos(a) * 1.4, 21.4, z + Math.sin(a) * 1.4, 0, -a, 0); }
      const a = sprite(TX.punto, 0xffb04a, 3, 3, 0.35); a.position.set(x, 22, z); scena.add(a);
      ostacoli.push({ x, z, r: 1.75, h: 22 });
    });
    R.pilastri = PIL;

    /* --- 8. l'altare a gradoni e la testa colossale scolpita nella parete, con l'Occhio sospeso davanti --- */
    {
      const alt = C ? null : tornioModulato([[5.6, 0], [5.6, 0.36], [5.45, 0.42], [4.95, 0.45], [4.95, 0.82], [4.8, 0.88], [4.35, 0.9], [4.35, 1.16], [4.2, 1.2], [0, 1.2]], 64, (a, y) => y < 0.4 ? 1 + 0.025 * Math.pow(0.5 + 0.5 * Math.cos(a * 16), 3) : 1);
      pietra.metti(alt, DAIS.x, 0, DAIS.z);
      bronzo.metti(new T.TorusGeometry(4.0, 0.1, 6, 64), DAIS.x, 1.2, DAIS.z, PI / 2, 0, 0, 1, 1, 0.5);
      const sdfT = (x, y, z) => {
        let d = ellissoide(x, y, z, 0, 4.4, 0.2, 2.1, 2.3, 1.7);
        d = smin(d, ellissoide(x, y, z, 0, 2.6, 0.6, 1.55, 1.3, 1.4), 0.6);
        d = smin(d, ellissoide(x, y, z, 0, 1.3, 0.9, 1.2, 0.85, 1.05), 0.45);
        d = smin(d, conoTondo(x, y, z, -1.8, 4.05, 1.25, 1.8, 4.05, 1.25, 0.36, 0.36), 0.35);   // arcata delle sopracciglia
        d = smin(d, conoTondo(x, y, z, 0, 5.0, 1.15, 0, 7.6, -0.7, 0.32, 0.05), 0.35);   // cresta
        [-1, 1].forEach(s => {
          d = smin(d, conoTondo(x, y, z, s * 1.35, 5.6, 0.25, s * 2.9, 7.3, -1.0, 0.45, 0.05), 0.3);   // corna a falce
          d = smin(d, conoTondo(x, y, z, s * 0.75, 6.2, 0.4, s * 1.05, 7.4, -0.6, 0.26, 0.04), 0.18);
          d = smin(d, conoTondo(x, y, z, s * 1.9, 3.1, 0.1, s * 3.6, 0.2, -0.6, 0.55, 1.0), 0.6);   // spalle che entrano nella roccia
          d = smax(d, -ellissoide(x, y, z, s * 0.8, 3.55, 1.6, 0.55, 0.42, 0.6), 0.12);   // orbite
        });
        d = smax(d, -conoTondo(x, y, z, 0, 2.6, 1.75, 0, 3.0, 1.95, 0.12, 0.22), 0.06);   // naso
        d = smax(d, -ellissoide(x, y, z, 0, 1.8, 1.8, 0.95, 0.2, 0.5), 0.08);   // bocca
        return d + 0.03 * n3(x * 2.6, y * 2.6, z * 2.6);
      };
      const h = leggera ? 0.13 : 0.1, geoT = GEO_T || (GEO_T = prepara(scolpisci(sdfT, -4.6, -0.5, -1.4, 4.6, 7.9, 3.0, h), (x, y, z, nx, ny) => { const f = fbm(x * 1.4, y * 1.4, z * 1.4, 3), k = 0.82 + f * 0.45, sporco = 1 - 0.35 * clamp(-ny, 0, 1), occhi = 1 - 0.85 * Math.max(sstep(0.62, 0.3, Math.hypot(Math.abs(x) - 0.8, y - 3.55, (z - 1.5) * 0.8)), sstep(0.5, 0.2, Math.hypot(x * 0.5, (y - 1.8) * 2, z - 1.7))); return [0.46 * k * sporco * occhi, 0.43 * k * sporco * occhi, 0.40 * k * sporco * occhi]; }, 1.2));
      const S = 2.4, testa = new T.Mesh(geoT, M.pietra); testa.position.set(0, -0.6, Z0 + 1.1 * S); testa.scale.setScalar(S); testa.castShadow = true; testa.receiveShadow = true; scena.add(testa);
      [-1, 1].forEach(s => { const o = sprite(TX.punto, 0x8affa8, 2.2, 1.6, 0.55); o.position.set(s * 0.8 * S, -0.6 + 3.5 * S, Z0 + 1.1 * S + 1.2 * S); scena.add(o); });
      ostacoli.push({ x: 0, z: -29.6, r: 4.2, h: 30 }, { x: -6, z: -30.2, r: 2.6, h: 30 }, { x: 6, z: -30.2, r: 2.6, h: 30 });
      // cornice dell'Occhio: anello di bronzo a raggi, appeso con quattro catene alla volta
      const O = new T.Vector3(0, 11.2, -22.5);   // sopra e dietro l'Officiante (deve combaciare con OCC in raid-oryx.js)
      bronzo.metti(new T.TorusGeometry(1.5, 0.12, 10, 48), O.x, O.y, O.z - 0.1);
      bronzo.metti(new T.TorusGeometry(1.85, 0.06, 8, 48), O.x, O.y, O.z - 0.15);
      for (let i = 0; i < 16; i++) { const a = i / 16 * 2 * PI, c = new T.ConeGeometry(0.08, i % 2 ? 0.7 : 1.3, 6); c.translate(0, 1.6 + (i % 2 ? 0.35 : 0.65), 0); bronzo.metti(c, O.x, O.y, O.z - 0.1, 0, 0, a); }
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const a = new T.Vector3(O.x + sx * 1.3, O.y + 1.0, O.z + sz * 0.3), b = new T.Vector3(sx * 7, CHIAVE - 3, O.z + sz * 3), d = b.clone().sub(a), L = d.length(), c = new T.CylinderGeometry(0.05, 0.05, L, 6); c.translate(0, L / 2, 0); c.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize())); bronzo.metti(c, a.x, a.y, a.z); });
      R.luceOcchio = new T.PointLight(0xffe2a0, 0.6, 30, 1.5); R.luceOcchio.position.copy(O).add(new T.Vector3(0, 0, 1.5)); scena.add(R.luceOcchio);
    }

    /* --- 9. bracieri di fuoco freddo: sulle terrazze vicino alle porte e ai lati dell'altare --- */
    braciere(-21.2, 2.0, -16.6, true); braciere(-21.2, 2.0, -8.2, false); braciere(21.2, 1.2, -16.6, true); braciere(21.2, 1.2, -8.2, false);
    braciere(-6.6, 0, -19, true); braciere(6.6, 0, -19, true);
    [[-21.6, 3.2], [21.6, 3.2], [-21.6, 10.4], [21.6, 10.4]].forEach(([x, z]) => braciere(x, 0, z, false));

    /* --- 10. luce dall'alto: una fenditura nella volta, fascio con polvere sospesa --- */
    const spot = new T.SpotLight(0xd8d2c0, 1.1, 90, 0.36, 0.8, 1.2); spot.position.set(2, CHIAVE - 1, -6); spot.target.position.set(0, 0, -8); scena.add(spot, spot.target);
    if (R.ombre) { spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.camera.near = 14; spot.shadow.camera.far = 60; spot.shadow.bias = -0.0008; spot.shadow.normalBias = 0.04; }
    {
      const g = new T.CylinderGeometry(1.6, 8.0, CHIAVE - 2, 32, 1, true); g.translate(0, -(CHIAVE - 2) / 2, 0);
      const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { c: { value: new T.Color(0xc8b896) } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = uv.y; gl_Position = projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 c; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(vN, vV)), 2.2); float a = f * 0.12 * smoothstep(0.0, 0.35, vY) * smoothstep(1.0, 0.85, vY); gl_FragColor = vec4(c * a, a); }' });
      const fascio = new T.Mesh(g, mat); fascio.position.copy(spot.position); fascio.lookAt(spot.target.position); fascio.rotateX(-PI / 2); scena.add(fascio);
      const crepa = sprite(TX.punto, 0xf0e6d0, 6, 6, 0.8); crepa.position.copy(spot.position); scena.add(crepa);
    }
    let polvere = null;
    if (!leggera) {
      const n = 240, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rnd(0, 2 * PI), r = Math.sqrt(rnd(0, 1)) * 6.5, y = rnd(0.5, 28); pos[i * 3] = 1 + Math.cos(a) * r * (0.3 + y / 40); pos[i * 3 + 1] = y; pos[i * 3 + 2] = -7.5 + Math.sin(a) * r * (0.3 + y / 40); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
      polvere = new T.Points(g, new T.PointsMaterial({ map: TX.punto, color: 0xe0d4b8, size: 0.09, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending })); scena.add(polvere);
    }

    /* --- le piastre: disco di pietra a filo del piano, anello di bronzo, un glifo sospeso che si accende --- */
    R.piastra = (x, z, r, nome, y) => {
      y = y || 0; const g = new T.Group(); g.position.set(x, y, z); scena.add(g);
      const base = new T.Mesh(prepara(tornioModulato([[r + 0.6, -0.1], [r + 0.6, 0.02], [r + 0.45, 0.08], [r + 0.1, 0.08], [r, 0.05], [0, 0.05]], 48), colPietra, 2), M.pietra); base.receiveShadow = true; g.add(base);
      const mat = new T.MeshStandardMaterial({ color: 0x3b4a5a, emissive: 0x0a1220, roughness: 0.5, metalness: 0.2 }); const cuore = new T.Mesh(new T.CylinderGeometry(r - 0.05, r - 0.05, 0.04, 48), mat); cuore.position.y = 0.07; g.add(cuore);
      const an = new T.Mesh(prepara(new T.TorusGeometry(r + 0.22, 0.07, 8, 64), colBronzo, 1), M.bronzo); an.rotation.x = PI / 2; an.position.y = 0.09; g.add(an);
      const segno = sprite(TX.segno, 0xffd27a, 1.9, 1.9, 0), alo = sprite(TX.punto, 0xffc46b, r * 2.6, r * 2.6, 0); segno.position.y = 2.7; alo.position.y = 2.7; g.add(segno, alo);
      const hsl = {};
      return { x, z, r, nome, y, g, mat, col(c, e) { mat.color.setHex(c); mat.emissive.setHex(e === undefined ? 0 : e); new T.Color(e || 0).getHSL(hsl); const k = clamp((hsl.l - 0.1) * 6, 0, 0.9); segno.material.opacity = k; segno.material.color.setHex(c); alo.material.opacity = k * 0.5; } };
    };

    /* --- montaggio: un disegno per materiale --- */
    const dep = {}, mR = roccia.mesh(M.roccia, dep), mP = pietra.mesh(M.pietra, dep), mL = lastre.mesh(M.lastre, dep), mB = bronzo.mesh(M.bronzo, dep), mO = ombra.mesh(M.pietra, dep), mV = volta.mesh(M.roccia, dep), mF = fasce.mesh(fuocoGlifi, dep); if (!GEO) GEO = CACHE.glifi = dep;
    mO.castShadow = true; mO.receiveShadow = true; mL.receiveShadow = true; mP.receiveShadow = true; mB.receiveShadow = true;
    scena.add(mR, mP, mL, mB, mO, mV, mF);

    R.agg = (dt, t) => {
      for (const f of R.fuochi) { const k = 0.86 + Math.sin(t * 13 + f.fase) * 0.07 + Math.sin(t * 7.3 + f.fase * 2) * 0.07; f.f.scale.set(0.9 * (1.9 - k), 1.8 * k, 1); f.a.material.opacity = 0.28 + k * 0.12; if (f.l) f.l.intensity = 2.2 * k; }
      fuocoGlifi.color.setHSL(0.09, 1, 0.5 + 0.08 * Math.sin(t * 1.7)); glifoMat.opacity = 0.45 + 0.12 * Math.sin(t * 1.3);
      R.porte.forEach(p => { p.k = Math.max(0, p.k - dt * 0.6); p.bruma.material.opacity = 0.1 + 0.05 * Math.sin(t * 2 + p.bruma.position.z) + p.k * 0.7; });
      if (R.occhio) R.luceOcchio.intensity = 0.6 + Math.max(0, R.occhio.scale.x - 0.4) * 2.2;
      if (polvere) polvere.rotation.y = t * 0.01;
    };
    return R;
  }

  /* =====================================================================
     LA FOSSA DI BRUTHAK
     Pianta come nella mappa originale: si entra dall'alto, da un bordo rialzato che corre lungo tutto il lato sud,
     e si scende nella fossa dove sta Bruthak. Ai lati due tribune a gradoni salgono fino alle pareti,
     dal soffitto pendono tre sfere appese a grandi uncini di bronzo, in fondo il reliquiario dalle sei coppe.
     I nemici entrano da quattro porte: due sulle tribune e due in fondo, ai lati del reliquiario.
     ===================================================================== */
  function fossaBruthak(ctx) {
    const { scena, ostacoli, piani, leggera } = ctx, M = materiali(leggera), TX = texSantuario(); semeR = 41; GEO = CACHE.fossa || null;
    const R = { fuochi: [], agg: null, ombre: !leggera, porte: [] };
    const C = !!GEO, pietra = cesto('p', colPietra, 2.5), lastre = cesto('l', null, 2), bronzo = cesto('b', colBronzo, 1.5), ombra = cesto('o', colPietra, 2.5), volta = cesto('v', null, 3);
    const { pavimenta, settori, arcata, braciere } = kitSala({ scena, M, TX, R, ostacoli, pietra, lastre, bronzo, C, fuoco: 'rosso' });
    scena.children.filter(o => o.isLight).forEach(o => scena.remove(o));
    scena.background = new T.Color(0x070404); scena.fog = new T.FogExp2(0x0d0706, 0.014);
    scena.add(new T.HemisphereLight(0x76605a, 0x241410, 1.15));
    const X1 = 23.6, Z0 = -27.6, Z1 = 20.8, IMP = 20, CHIAVE = 40, Y = 2.4, LIP = 11, XI = 19.6, N = Math.round(Y / 0.4) - 1;
    Object.assign(ctx.lim, { x0: -22.8, x1: 22.8, z0: -27, z1: 20 }); delete ctx.lim.ell;
    const COST = []; for (let z = Z0 + 3.2; z < Z1 - 1; z += 6.4) COST.push(z);
    const CAMPATE = COST.slice(0, -1).map((z, i) => (z + COST[i + 1]) / 2);
    const PORTE = [{ s: -1, z: CAMPATE[2], y: Y }, { s: 1, z: CAMPATE[2], y: Y }];
    const PORTE_FONDO = [-11, 11], PL = 1.9, PIMP = 3.6, PCH = 6.2, FOSSA = { x: 0, z: -6, r: 6.6 };
    const SFERE = [[-11, -3], [11, -3], [0, 4]];

    /* --- 1. piani: la fossa, il bordo d'ingresso e le due tribune, a gradini da 0,4 m --- */
    piani.push({ x0: -X1, x1: X1, z0: Z0, z1: Z1, y: 0 });
    for (let k = 0; k <= N; k++) {
      const off = (N - k) * 0.5, y = 0.4 * (k + 1);
      piani.push({ x0: -X1, x1: X1, z0: LIP - off, z1: Z1, y });
      piani.push({ x0: -X1, x1: -XI + off, z0: Z0, z1: Z1, y }, { x0: XI - off, x1: X1, z0: Z0, z1: Z1, y });
    }
    const sottoGradoni = (cx, cz, dx, dz) => cz - dz / 2 >= LIP - N * 0.5 - 0.02 || Math.abs(cx) - dx / 2 >= XI - N * 0.5 - 0.02;

    /* --- 2. pavimento della fossa e cerchio di pietra scura dove sta Bruthak --- */
    const malta = new T.Mesh(new T.PlaneGeometry(2 * X1, Z1 - Z0), M.malta); malta.rotation.x = -PI / 2; malta.position.set(0, -0.07, (Z0 + Z1) / 2); malta.receiveShadow = true; scena.add(malta);
    if (!C) {
      pavimenta(-X1 + 0.3, X1 - 0.3, Z0 + 0.3, LIP, 0, (cx, cz, dx, dz) => sottoGradoni(cx, cz, dx, dz) || Math.hypot(cx - FOSSA.x, cz - FOSSA.z) < FOSSA.r + 2.4);
      settori(FOSSA.x, FOSSA.z, FOSSA.r + 1.0, FOSSA.r + 2.6, 40, 0.2);
      [[0, 1.4, 1], [1.5, 3.4, 9], [3.5, 5.2, 15], [5.3, FOSSA.r, 21]].forEach(([r0, r1, n], ia) => {
        if (n === 1) { const g = new T.CylinderGeometry(r1, r1, 0.2, 24); g.translate(0, -0.12, 0); lastre.metti(g, FOSSA.x, 0, FOSSA.z, 0, 0, 0, 1, 1, 1, () => [0.14, 0.12, 0.12]); return; }
        for (let i = 0; i < n; i++) {   // lastre scure, consumate, leggermente piu' basse: il fondo dove mangia Bruthak
          const a0 = ia * 0.3 + i / n * 2 * PI + 0.015, a1 = ia * 0.3 + (i + 1) / n * 2 * PI - 0.015, sh = new T.Shape();
          for (let q = 0; q <= 5; q++) { const a = mix(a0, a1, q / 5); q ? sh.lineTo(Math.cos(a) * (r1 - 0.04), Math.sin(a) * (r1 - 0.04)) : sh.moveTo(Math.cos(a) * (r1 - 0.04), Math.sin(a) * (r1 - 0.04)); }
          for (let q = 5; q >= 0; q--) { const a = mix(a0, a1, q / 5); sh.lineTo(Math.cos(a) * (r0 + 0.04), Math.sin(a) * (r0 + 0.04)); }
          const g = new T.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 2 }); g.rotateX(PI / 2);
          const c = rnd(0.55, 0.8); lastre.metti(g, FOSSA.x, -0.05, FOSSA.z, 0, 0, 0, 1, 1, 1, (x, y, z) => { const f = 0.6 + fbm(x * 0.8, 0, z * 0.8, 3) * 0.5; return [0.2 * c * f, 0.17 * c * f, 0.16 * c * f]; });
        }
      });
      // le tribune: piano di sopra lastricato
      pavimenta(-X1 + 0.3, X1 - 0.3, LIP, Z1 - 0.3, Y);
      [-1, 1].forEach(s => pavimenta(s < 0 ? -X1 + 0.3 : XI, s < 0 ? -XI : X1 - 0.3, Z0 + 0.3, LIP, Y));
    }
    [FOSSA.r + 0.1, FOSSA.r + 1.0].forEach((r, i) => bronzo.metti(new T.TorusGeometry(r, i ? 0.1 : 0.14, 6, 96), FOSSA.x, -0.02, FOSSA.z, PI / 2, 0, 0, 1, 1, 0.45));
    for (let i = 0; i < 18; i++) { const a = i / 18 * 2 * PI, c = new T.ConeGeometry(0.16, 0.9, 6); c.translate(0, 0.45, 0); bronzo.metti(c, FOSSA.x + Math.cos(a) * (FOSSA.r + 0.55), 0, FOSSA.z + Math.sin(a) * (FOSSA.r + 0.55), Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); }   // denti del bordo, piegati verso fuori

    /* --- 3. gradinate: corpo di pietra sotto le tribune, gradini sui lati che guardano la fossa --- */
    pietra.metti(lastraTonda(2 * X1, Z1 - LIP, Y, 0.1, 0.05), 0, Y - 0.02, (LIP + Z1) / 2);
    [-1, 1].forEach(s => pietra.metti(lastraTonda(X1 - XI, LIP - Z0, Y, 0.1, 0.05), s * (XI + X1) / 2, Y - 0.02, (Z0 + LIP) / 2));
    for (let k = 0; k < N; k++) {
      const off = (N - k) * 0.5, h = 0.4 * (k + 1), zf = LIP - off, xi = XI - off;
      pietra.metti(lastraTonda(2 * xi, 0.56, h, 0.04, 0.04, true), 0, h, zf + 0.25);   // gradino verso la fossa, lato sud
      [-1, 1].forEach(s => pietra.metti(lastraTonda(0.56, zf + 0.5 - Z0, h, 0.04, 0.04, true), s * (xi + 0.25), h, (Z0 + zf + 0.5) / 2));
    }
    // listelli di bronzo sugli spigoli delle tribune
    bronzo.metti(new T.CylinderGeometry(0.06, 0.06, 2 * XI, 8), 0, Y + 0.02, LIP + 0.02, 0, 0, PI / 2);
    [-1, 1].forEach(s => bronzo.metti(new T.CylinderGeometry(0.06, 0.06, LIP - Z0, 8), s * (XI - 0.02), Y + 0.02, (Z0 + LIP) / 2, PI / 2, 0, 0));

    /* --- 4. pareti: conci, lesene sotto i costoloni, logge cieche, porte sulle tribune e in fondo --- */
    const DC = z => { let m = 1e9; for (const c of COST) m = Math.min(m, Math.abs(z - c)); return m; };
    const fregio = (u, y, y0) => { let h = 0; if (y > y0 && y < y0 + 1.6) h += 0.35 + 0.3 * TX.glifi(((u % 24) + 24) % 24 / 24, 1 - (y - y0) / 1.6); if ((y > y0 - 0.4 && y < y0) || (y > y0 + 1.6 && y < y0 + 2.0)) h += 0.55; return h; };
    const parete = s => (z, y) => {
      let h = conci(2.3, 1.05, 0.1)(z + 60, y + 60) * 0.9;
      const pil = y < IMP + 0.5 ? sstep(0.95, 0.7, DC(z)) : 0;
      if (y < Y + 1.0) h = Math.max(h, 0.28);
      let zb = null; for (const c of CAMPATE) if (Math.abs(z - c) < 3.2) zb = c;
      if (zb !== null) {
        const p = PORTE.find(p => p.s === s && Math.abs(p.z - zb) < 0.1), dx = z - zb;
        if (p) { const top = archTop(dx, PL + 0.3, p.y + PIMP, PCH - PIMP); if (y > p.y - 0.05 && y < top) h = -0.9; }
        else { const top = archTop(dx, 2.1, 10, 4.6); if (y > Y + 2.2 && y < top) h -= 0.45 * sstep(0, 0.15, y - Y - 2.2) * sstep(0, 0.15, top - y) * sstep(2.1, 1.9, Math.abs(dx)); }
      }
      h += fregio(z, y, 16.2);
      return mix(h, 0.75 - 0.06 * Math.pow(0.5 + 0.5 * Math.cos(z * 2 * PI / 0.5), 2), pil);
    };
    if (!C) {
      const W = Z1 - Z0, H = IMP + 1, zc = (Z0 + Z1) / 2;
      [-1, 1].forEach(s => {
        const f = parete(s), g = rilievo(W, H, leggera ? 150 : 200, leggera ? 64 : 90, (xl, yl) => f(s < 0 ? zc - xl : zc + xl, yl + H / 2));
        g.translate(0, H / 2, 0); g.rotateY(s < 0 ? PI / 2 : -PI / 2); pietra.metti(g, s * X1, 0, zc, 0, 0, 0, 1, 1, 1, scuro(colPietra, 12, 24));
      });
      // fondo: grande nicchia del reliquiario, porte ai lati, roccia viva in alto
      const fondo = (x, y) => {
        let h = conci(2.6, 1.2, 0.12)(x + 60, y + 60) * 0.9; const top = archTop(x, 6.5, 12, 11); if (y < top) h -= 1.0 * sstep(6.5, 6.1, Math.abs(x)) * sstep(top, top - 0.4, y);
        PORTE_FONDO.forEach(px => { const t = archTop(x - px, PL + 0.3, PIMP, PCH - PIMP); if (y < t) h = -0.9; });
        if (Math.abs(x) > 7) h += fregio(x, y, 16.2); if (y > IMP + 2) h = mix(h, 1.6 * fbm(x * 0.12, y * 0.12, 3, 4) - 0.6, sstep(IMP + 2, IMP + 8, y)); return h;
      };
      const gb = rilievo(2 * X1, CHIAVE + 1, leggera ? 140 : 190, leggera ? 110 : 150, (x, y) => fondo(x, y + (CHIAVE + 1) / 2)); gb.translate(0, (CHIAVE + 1) / 2, 0); pietra.metti(gb, 0, 0, Z0, 0, 0, 0, 1, 1, 1, scuro(colPietra, 14, 32));
      const fronte = (x, y) => { let h = conci(2.6, 1.2, 0.12)(x + 30, y + 30) * 0.9; h += fregio(x, y, 16.2); const top = archTop(x, 3.7, Y + 5.2, 4.2); if (y > Y && y < top + 0.6 && Math.abs(x) < 4.6) h -= 0.6; return h; };
      const gf = rilievo(2 * X1, CHIAVE + 1, leggera ? 120 : 160, leggera ? 90 : 120, (x, y) => fronte(x, y + (CHIAVE + 1) / 2)); gf.translate(0, (CHIAVE + 1) / 2, 0); gf.rotateY(PI); pietra.metti(gf, 0, 0, Z1, 0, 0, 0, 1, 1, 1, scuro(colPietra, 14, 32));
    }
    const glifoMat = new T.MeshBasicMaterial({ map: TX.glifiTex.clone(), color: 0xff7a3a, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, fog: true });
    glifoMat.map.needsUpdate = true; glifoMat.map.repeat.set((Z1 - Z0) / 24, 1);
    [-1, 1].forEach(s => { const m = new T.Mesh(new T.PlaneGeometry(Z1 - Z0, 1.6), glifoMat); m.rotation.y = s < 0 ? PI / 2 : -PI / 2; m.position.set(s * (X1 - 0.7), 17.0, (Z0 + Z1) / 2); scena.add(m); });

    /* --- 5. volta acuta a costoloni, con i tre grandi uncini che reggono le sfere --- */
    if (!C) {
      const pts = archiAcuto(X1 + 0.2, IMP, CHIAVE, 72), NZ = leggera ? 60 : 96, P = [], idx = [], NP = pts.length;
      for (let j = 0; j <= NZ; j++) {
        const z = Z0 + (Z1 - Z0) * j / NZ;
        pts.forEach(p => { const dx = p.x, dy = p.y - IMP + 6, L = Math.hypot(dx, dy) || 1, d = 0.5 * fbm(p.x * 0.18, p.y * 0.18, z * 0.18, 3) + 0.25 * ridged(p.x * 0.4, p.y * 0.4, z * 0.4, 2); P.push(p.x + dx / L * d, p.y + dy / L * d, z); });
      }
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NP - 1; i++) { const a = j * NP + i, b = a + NP; idx.push(a, a + 1, b, a + 1, b + 1, b); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
      { const n = g.attributes.normal, k = Math.floor(NZ / 2) * NP + Math.floor(NP / 2); if (n.getY(k) > 0) { for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); g.setIndex(idx.map((v, q) => q % 3 === 1 ? idx[q + 1] : q % 3 === 2 ? idx[q - 1] : v)); } }
      volta.lista.push(prepara(g, scuro(colRoccia, 22, 36), 4));
      const profCost = [[-0.5, -0.8], [0.5, -0.8], [0.5, -0.4], [0.65, -0.25], [0.65, 0.15], [0.45, 0.35], [0.45, 0.8], [-0.45, 0.8], [-0.45, 0.35], [-0.65, 0.15], [-0.65, -0.25], [-0.5, -0.4]];
      COST.forEach(z => volta.metti(modanatura(archiAcuto(X1 - 0.6, IMP, CHIAVE - 0.7, 48), profCost), 0, 0, z, 0, 0, 0, 1, 1, 1, scuro(colPietra, 20, 36)));
      volta.metti(lastraTonda(1.0, Z1 - Z0, 0.7, 0.2, 0.08), 0, CHIAVE - 0.6, (Z0 + Z1) / 2, 0, 0, 0, 1, 1, 1, scuro(colPietra, 20, 36));
    }
    const voltaY = x => archTop(x, X1 - 0.6, IMP, CHIAVE - 0.7 - IMP) - 1.2;
    SFERE.forEach(([x, z]) => {
      // catena dalla volta fino all'uncino, poi l'uncino a quattro artigli che tiene la sfera (la sfera e' del gioco, a quota 12)
      const top = voltaY(x), L = top - 13.6;
      for (let i = 0; i < Math.floor(L / 0.55); i++) bronzo.metti(new T.TorusGeometry(0.2, 0.05, 6, 12), x, 13.8 + i * 0.55, z, 0, i % 2 ? PI / 2 : 0, 0);
      bronzo.metti(tornioModulato([[0, 0], [0.5, 0.05], [0.42, 0.25], [0.18, 0.4], [0.14, 0.9], [0, 1.0]], 16), x, 12.9, z);
      for (let k = 0; k < 4; k++) { const t = new T.TorusGeometry(1.05, 0.08, 6, 16, PI * 0.72); t.rotateZ(-PI * 0.22); bronzo.metti(t, x, 12, z, 0, k / 4 * 2 * PI, 0); }
    });

    /* --- 6. porte: sulle tribune ai lati e in fondo, ai lati del reliquiario --- */
    PORTE.forEach(p => {
      const b = arcata(p.s * (X1 - 0.35), p.z, p.s < 0 ? PI / 2 : -PI / 2, PL, PIMP, PCH, 0.62, p.y); b.position.x = p.s * (X1 + 0.85); scena.add(b);
      pietra.metti(lastraTonda(1.6, 2 * PL + 0.4, 0.3, 0.1, 0.05), p.s * (X1 + 0.2), p.y, p.z);
      const bruma = sprite(TX.punto, 0xff8a5a, 4.2, 5.2, 0.12); bruma.position.set(p.s * (X1 - 0.2), p.y + 2.4, p.z); scena.add(bruma); R.porte.push({ bruma, k: 0 });
    });
    PORTE_FONDO.forEach(px => {
      const b = arcata(px, Z0 + 0.35, 0, PL, PIMP, PCH, 0.62, 0); b.position.z = Z0 - 0.85; scena.add(b);
      const bruma = sprite(TX.punto, 0xff8a5a, 4.2, 5.2, 0.12); bruma.position.set(px, 2.4, Z0 + 0.2); scena.add(bruma); R.porte.push({ bruma, k: 0 });
    });
    R.ingressi = PORTE.map(p => ({ x: p.s * 22.1, z: p.z, y: p.y, dx: -p.s, dz: 0, w: 1.2 })).concat(PORTE_FONDO.map(px => ({ x: px, z: -26.4, y: 0, dx: 0, dz: 1, w: 1.2 })));
    R.varco = i => { const p = R.porte[i]; if (p) p.k = 1; };
    // ingresso dei Custodi: in alto, sul bordo sud, con la grata calata
    scena.add(arcata(0, Z1 - 0.5, PI, 3.4, 5.2, 9.0, 0.9, Y));
    for (let i = -6; i <= 6; i++) bronzo.metti(new T.CylinderGeometry(0.07, 0.07, 8.6, 6), i * 0.52, Y + 3.9, Z1 - 0.8);
    for (let j = 0; j < 6; j++) bronzo.metti(new T.CylinderGeometry(0.06, 0.06, 7.0, 6), 0, Y + 0.8 + j * 1.4, Z1 - 0.85, 0, 0, PI / 2);

    /* --- 7. quattro colonne a lobi ai piedi delle tribune, con anelli di bronzo (riparo dalle sfere) --- */
    const PIL = [[-14.5, -18], [14.5, -18], [-14.5, 4], [14.5, 4]];
    const fusto = C ? null : tornioModulato((() => { const P = [[1.8, 0], [1.8, 0.5], [1.55, 0.68], [1.62, 0.85], [1.42, 1.05]]; for (let i = 0; i <= 14; i++) P.push([1.38 - 0.12 * i / 14, 1.3 + i / 14 * 17.9]); P.push([1.25, 19.2], [1.55, 19.7], [1.85, 20.2], [1.95, 20.5], [1.95, 20.9], [0, 20.9]); return P; })(), leggera ? 64 : 96,
      (a, y) => (y > 1.3 && y < 19.2) ? 1 + 0.1 * Math.pow(Math.abs(Math.cos(a * 3)), 3) - 0.04 * Math.pow(0.5 + 0.5 * Math.cos(a * 24), 3) : 1);
    PIL.forEach(([x, z]) => {
      pietra.metti(lastraTonda(4.2, 4.2, 0.5, 0.5, 0.12), x, 0.5, z); ombra.metti(fusto, x, 0.5, z);
      [2.6, 9.0, 15.4].forEach(y => bronzo.metti(new T.TorusGeometry(1.45 - y * 0.006, 0.12, 8, 48), x, y, z, PI / 2, 0, 0));
      for (let k = 0; k < 6; k++) { const a = k / 6 * 2 * PI, c = new T.ConeGeometry(0.14, 1.6, 6); c.translate(0, 0.8, 0); c.rotateZ(-0.5); bronzo.metti(c, x + Math.cos(a) * 1.4, 21.4, z + Math.sin(a) * 1.4, 0, -a, 0); }
      ostacoli.push({ x, z, r: 1.75, h: 22 });
    });

    /* --- 8. il reliquiario in fondo: stele di bronzo e pietra con sei coppe vuote, nella grande nicchia --- */
    {
      const zr = Z0 + 2.4;
      pietra.metti(lastraTonda(7, 4.4, 0.9, 0.5, 0.12), 0, 0.9, zr); pietra.metti(lastraTonda(5.6, 3.6, 0.6, 0.4, 0.1), 0, 1.5, zr);
      if (!C) ombra.metti(tornioModulato([[1.6, 0], [1.4, 0.4], [1.1, 1.0], [1.0, 6.5], [1.3, 7.0], [1.3, 7.4], [0.7, 8.4], [0.35, 10.6], [0, 11.2]], 48, (a, y) => 1 + 0.14 * Math.pow(Math.abs(Math.cos(a * 2)), 3)), 0, 1.5, zr);
      const vuoto = new T.MeshStandardMaterial({ color: 0x1a0d08, emissive: 0xff7a2a, emissiveIntensity: 0.25, roughness: 0.4 });
      for (let i = 0; i < 6; i++) {
        const y = 3.0 + (i % 3) * 1.7, x = i < 3 ? -1.25 : 1.25;
        bronzo.metti(tornioModulato([[0.1, -0.3], [0.5, -0.12], [0.62, 0.1], [0.55, 0.14], [0.2, 0]], 16), x, 1.5 + y, zr + 0.5);
        const o = new T.Mesh(new T.SphereGeometry(0.42, 14, 10), vuoto); o.position.set(x, 1.5 + y + 0.2, zr + 0.5); scena.add(o);
      }
      ostacoli.push({ x: 0, z: zr, r: 3.0, h: 13 });
    }

    /* --- 9. bracieri rossi: due sul bordo d'ingresso, due per tribuna, due ai lati della fossa --- */
    braciere(-8, Y, 17.6, true); braciere(8, Y, 17.6, true);
    [-1, 1].forEach(s => { braciere(s * 21.4, Y, CAMPATE[2] - 3.4, s < 0); braciere(s * 21.4, Y, CAMPATE[2] + 3.4, s > 0); braciere(s * 21.4, Y, 6, false); });
    braciere(-6, 0, -22, false); braciere(6, 0, -22, false);

    /* --- 10. luce: fenditura nella volta sopra la fossa, polvere --- */
    const spot = new T.SpotLight(0xe0ccb8, 1.15, 90, 0.42, 0.8, 1.2); spot.position.set(2, CHIAVE - 1, -5); spot.target.position.set(0, 0, -6); scena.add(spot, spot.target);
    if (R.ombre) { spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.camera.near = 14; spot.shadow.camera.far = 60; spot.shadow.bias = -0.0008; spot.shadow.normalBias = 0.04; }
    {
      const g = new T.CylinderGeometry(1.6, 9.0, CHIAVE - 2, 32, 1, true); g.translate(0, -(CHIAVE - 2) / 2, 0);
      const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: { c: { value: new T.Color(0xd0a890) } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = uv.y; gl_Position = projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 c; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(vN, vV)), 2.2); float a = f * 0.11 * smoothstep(0.0, 0.35, vY) * smoothstep(1.0, 0.85, vY); gl_FragColor = vec4(c * a, a); }' });
      const fascio = new T.Mesh(g, mat); fascio.position.copy(spot.position); fascio.lookAt(spot.target.position); fascio.rotateX(-PI / 2); scena.add(fascio);
      const crepa = sprite(TX.punto, 0xf0d8c0, 6, 6, 0.8); crepa.position.copy(spot.position); scena.add(crepa);
    }
    let polvere = null;
    if (!leggera) {
      const n = 260, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rnd(0, 2 * PI), r = Math.sqrt(rnd(0, 1)) * 8, y = rnd(0.5, 30); pos[i * 3] = 1 + Math.cos(a) * r * (0.3 + y / 40); pos[i * 3 + 1] = y; pos[i * 3 + 2] = -5.5 + Math.sin(a) * r * (0.3 + y / 40); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
      polvere = new T.Points(g, new T.PointsMaterial({ map: TX.punto, color: 0xe8c8b0, size: 0.09, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending })); scena.add(polvere);
    }
    // luce fredda delle pozze: una sola, la mette il gioco dove cade la sfera
    R.lucePozza = new T.PointLight(0x9fd8ff, 0, 16, 1.6); R.lucePozza.position.set(0, 2, 0); scena.add(R.lucePozza);

    /* --- montaggio --- */
    const dep = {}, mP = pietra.mesh(M.pietra, dep), mL = lastre.mesh(M.lastre, dep), mB = bronzo.mesh(M.bronzo, dep), mO = ombra.mesh(M.pietra, dep), mV = volta.mesh(M.roccia, dep); if (!GEO) GEO = CACHE.fossa = dep;
    mO.castShadow = true; mO.receiveShadow = true; mL.receiveShadow = true; mP.receiveShadow = true; mB.receiveShadow = true;
    scena.add(mP, mL, mB, mO, mV);
    R.sfere = SFERE; R.pilastri = PIL; R.quota = Y;
    R.agg = (dt, t) => {
      for (const f of R.fuochi) { const k = 0.86 + Math.sin(t * 13 + f.fase) * 0.07 + Math.sin(t * 7.3 + f.fase * 2) * 0.07; f.f.scale.set(0.9 * (1.9 - k), 1.8 * k, 1); f.a.material.opacity = 0.28 + k * 0.12; if (f.l) f.l.intensity = 2.2 * k; }
      glifoMat.opacity = 0.42 + 0.1 * Math.sin(t * 1.3);
      R.porte.forEach(p => { p.k = Math.max(0, p.k - dt * 0.6); p.bruma.material.opacity = 0.1 + 0.05 * Math.sin(t * 2 + p.bruma.position.z) + p.k * 0.7; });
      if (polvere) polvere.rotation.y = t * 0.01;
    };
    return R;
  }

  B.AmbientiRaid = { salaSigilli, santuarioGlifi, fossaBruthak, _geo: () => [GEO, GEO_G], _kit: { n3, fbm, ridged, smin, smax, ellissoide, conoTondo, mappaNormali, materiali, env: () => (materiali(), AMB_ENV) } };
})();
