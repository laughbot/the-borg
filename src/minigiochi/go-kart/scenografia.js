/* =====================================================================
   THE BORG 3D - SCENOGRAFIA DEL GO-KART (DEMO)
   Tutto disegnato da codice: prato e asfalto con texture, montagne, nuvole,
   lago con paperelle, tribune con spettatori, cartelloni, lampioni, alberi,
   cespugli, sassi, fiori e colline. Le particelle (polvere, fumo, scintille,
   coriandoli) sono qui. Il gioco vero e proprio e' in kart.js.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M;
  const PI = Math.PI, rand = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const gm = () => M('#fff').gradientMap;
  const toon = (col, o) => new T.MeshToonMaterial(Object.assign({ color: new T.Color(col), gradientMap: gm() }, o || {}));

  let TE = null;
  const TEMI = [
    { nome: 'Prato', erba: '#72b856', lamaA: 'rgba(130,210,95,.55)', lamaB: 'rgba(60,140,55,.45)', colline: ['#6fb257', '#62a64f', '#78bb5e'], monti: ['#8196c4', '#7388b8', '#8b9fcb'], chioma: ['#5cc05a', '#7bd05a', '#4aaa52', '#e0a23a', '#e07a8a'], cesp: ['#4aaa52', '#5cc05a', '#3a9a58'], pini1: ['#2f8a4f', '#3a9a58', '#2a7d48'], pini2: ['#3a9a58', '#46a864'], fiori: ['#ff7aa8', '#ffe05a', '#ffffff', '#ff5a5a', '#b48aff'], cielo: ['#4f9be0', '#d6efff'], fog: 0xd6ecff, bordo: '#8ccf6a', luce: 0xfff2d8, emi: 0x7a9a68 },
    { nome: 'Deserto', erba: '#d9b46a', lamaA: 'rgba(245,215,150,.5)', lamaB: 'rgba(190,140,70,.4)', colline: ['#d49a5a', '#c98a4a', '#dca867'], monti: ['#b5694a', '#a65a3e', '#c27a58'], chioma: ['#9a9a4a', '#b0a44e', '#8a8a40'], cesp: ['#a89a4a', '#b8a850', '#98863e'], pini1: ['#4a8a3a', '#5a9a44', '#3f7a34'], pini2: ['#5a9a44', '#6aaa50'], fiori: ['#ff9a4a', '#ffd24a', '#ff6a5a'], cielo: ['#3b8fe0', '#ffe9c0'], fog: 0xf6e2bc, bordo: '#e0c080', luce: 0xffe2b0, emi: 0xb8905a },
    { nome: 'Neve', erba: '#eef4fa', lamaA: 'rgba(255,255,255,.75)', lamaB: 'rgba(170,200,230,.5)', colline: ['#e4eef8', '#d6e4f2', '#f0f6fc'], monti: ['#7c90b8', '#6a80a8', '#8aa0c8'], chioma: ['#cfe0ea', '#bcd2e2', '#dbe9f2'], cesp: ['#d8e6f0', '#c4d8e6', '#e4eef6'], pini1: ['#2f6a5a', '#3a7a68', '#2a5a4c'], pini2: ['#3a7a68', '#468a76'], fiori: ['#9ad0ff', '#ffffff', '#c8e4ff'], cielo: ['#8fb0d8', '#eef6ff'], fog: 0xe6f0fa, bordo: '#dfeaf5', luce: 0xf2f6ff, emi: 0x9ab0c8 },
    { nome: 'Autodromo', erba: '#9a9a5a', lamaA: 'rgba(190,190,120,.5)', lamaB: 'rgba(110,110,60,.45)', colline: ['#8a8a52', '#7a7a48', '#9a9a60'], monti: ['#7d8296', '#6f7488', '#8b90a4'], chioma: ['#7a6a3a', '#9a7a3a', '#8a8a3a', '#a05a2a'], cesp: ['#6a7a3a', '#7a8a44', '#5a6a34'], pini1: ['#3a5a3a', '#2f4f33', '#3a6040'], pini2: ['#4a6a44', '#3f5f3c'], fiori: ['#d8d8b0', '#ffffff'], cielo: ['#6aa0d8', '#e8f0f8'], fog: 0xe0e8ee, bordo: '#8a8a52', luce: 0xfff0e0, emi: 0x8a8a60 }
  ];
  function texErba() {
    const [cv, x] = B.tela(256, 256); x.fillStyle = TE.erba; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) if (i % 2) { x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(0, i * 32, 256, 32); }
    for (let i = 0; i < 2600; i++) { x.fillStyle = Math.random() < 0.5 ? TE.lamaA : TE.lamaB; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 4 + Math.random() * 5); }
    for (let i = 0; i < 90; i++) { x.fillStyle = pick(['rgba(255,240,150,.7)', 'rgba(255,255,255,.7)', 'rgba(255,170,200,.7)']); x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 1.6, 0, 7); x.fill(); }
    const t = B.tex(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(60, 60); return t;
  }
  function texAsfalto() {
    const [cv, x] = B.tela(128, 256); x.fillStyle = '#4b5068'; x.fillRect(0, 0, 128, 256);
    x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(26, 0, 22, 256); x.fillRect(80, 0, 22, 256);
    for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.12)'; x.fillRect(Math.random() * 128, Math.random() * 256, 1.5, 1.5); }
    for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(20,20,30,.22)'; x.lineWidth = 1.5; x.beginPath(); const y = Math.random() * 256; x.moveTo(Math.random() * 128, y); x.lineTo(Math.random() * 128, y + 18); x.stroke(); }
    const t = B.tex(cv); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  function texScacchi() {
    const [cv, x] = B.tela(128, 32); for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#15121f'; x.fillRect(i * 8, j * 8, 8, 8); }
    return B.tex(cv);
  }
  function texCartello(testo, c1, c2) {
    const [cv, x] = B.tela(512, 160); const g = x.createLinearGradient(0, 0, 512, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
    B.rr(x, 4, 4, 504, 152, 22); x.fillStyle = g; x.fill(); x.lineWidth = 8; x.strokeStyle = '#fff8e8'; x.stroke();
    x.font = 'bold 76px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 12; x.strokeStyle = 'rgba(20,10,40,.85)'; x.strokeText(testo, 256, 84); x.fillStyle = '#fff8e8'; x.fillText(testo, 256, 84);
    return B.tex(cv);
  }
  function texPallino() {
    const [cv, x] = B.tela(64, 64); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return B.tex(cv);
  }

  /* ---------- scenografia ---------- */
  function scenografia(scena, P, C) {
    TE = C.tema || TEMI[0];
    const N = C.N, MEZZA = C.MEZZA, MURO = C.MURO, anim = [];
    const mt = new T.Matrix4(), q = new T.Quaternion(), ye = new T.Vector3(0, 1, 0), sc = new T.Vector3(), po = new T.Vector3(), cc = new T.Color();
    const yawAt = i => Math.atan2(P.tan[i].x, P.tan[i].z);
    const dist = (x, z) => { let d = 1e9; for (let j = 0; j < N; j += 2) { const dd = (x - P.sp[j].x) ** 2 + (z - P.sp[j].z) ** 2; if (dd < d) d = dd; } return Math.sqrt(d); };

    // prato con texture + colline lontane
    const prato = new T.Mesh(new T.PlaneGeometry(900, 900), toon('#ffffff', { map: texErba() })); prato.rotation.x = -PI / 2; prato.position.y = -0.05; scena.add(prato);
    for (let i = 0, n = 0; i < 80 && n < 14; i++) {
      const a = rand(0, 6.283), r = rand(100, 190), x = Math.cos(a) * r, z = Math.sin(a) * r; if (dist(x, z) < 45) continue;
      const sx = rand(24, 46), sy = rand(7, 15), h = new T.Mesh(new T.SphereGeometry(1, 18, 10), toon(pick(TE.colline))); h.scale.set(sx, sy, rand(24, 46)); h.position.set(x, -sy * 0.28, z); scena.add(h); n++;
    }
    // montagne con la neve all'orizzonte
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * 6.283 + rand(-0.15, 0.15), r = rand(300, 360), rr = rand(60, 110), h = rand(70, 130), g = new T.Group();
      const m = new T.Mesh(new T.ConeGeometry(rr, h, 7), toon(pick(TE.monti))); m.position.y = h / 2 - 2; g.add(m);
      const cap = new T.Mesh(new T.ConeGeometry(rr * 0.34, h * 0.34, 7), toon('#ffffff')); cap.position.y = h * 0.83 - 2; g.add(cap);
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); scena.add(g);
    }
    // sole e nuvole
    const sole = new T.Mesh(new T.CircleGeometry(20, 28), new T.MeshBasicMaterial({ color: 0xfff3c0, fog: false })); sole.position.set(-170, 150, -270); sole.lookAt(0, 20, 0); scena.add(sole);
    const alo = new T.Mesh(new T.CircleGeometry(38, 28), new T.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.25, fog: false })); alo.position.copy(sole.position); alo.lookAt(0, 20, 0); scena.add(alo);
    const nuv = [];
    for (let i = 0; i < 16; i++) {
      const g = new T.Group(), n = 3 + (i % 3);
      for (let k = 0; k < n; k++) { const b = new T.Mesh(new T.IcosahedronGeometry(rand(5, 10), 1), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.93 })); b.position.set((k - n / 2) * 8, rand(-1, 2), rand(-3, 3)); b.scale.y = 0.55; g.add(b); }
      g.position.set(rand(-300, 300), rand(60, 100), rand(-300, 300)); g.userData.v = rand(1, 3); scena.add(g); nuv.push(g);
    }
    anim.push((t, dt) => nuv.forEach(g => { g.position.x += g.userData.v * dt; if (g.position.x > 320) g.position.x = -320; }));

    // asfalto con texture, linee di bordo e traguardo a scacchi
    const as = C.nastro(P, -MEZZA, MEZZA, 0.02, () => [1, 1, 1], null, texAsfalto(), 70);
    scena.add(as);
    [-1, 1].forEach(s => scena.add(C.nastro(P, s * (MEZZA - 0.5), s * (MEZZA - 0.22), 0.06, () => [1, 1, 1])));
    const tr0 = new T.Group(); tr0.position.set(P.sp[0].x, 0.07, P.sp[0].z); tr0.rotation.y = yawAt(0);
    const sc0 = new T.Mesh(new T.PlaneGeometry(2 * MEZZA, 2.6), new T.MeshBasicMaterial({ map: texScacchi() })); sc0.rotation.x = -PI / 2; tr0.add(sc0); scena.add(tr0);
    // fila di caselle di partenza dipinte
    P.griglia.forEach(s => { const i = (N + s[0]) % N, c = P.sp[i], n = P.nor[i], l = new T.Mesh(new T.PlaneGeometry(3, 0.25), new T.MeshBasicMaterial({ color: 0xf4efe6 })); l.rotation.x = -PI / 2; l.rotation.z = -yawAt(i) + PI / 2; l.position.set(c.x + n.x * s[1], 0.065, c.z + n.z * s[1]); scena.add(l); });

    // lago con paperelle nell'infield
    let lago = null;
    for (const c of [[0, -14], [-6, -12], [8, -12], [-14, -10], [10, -6]]) { if (dist(c[0], c[1]) > 26) { lago = c; break; } }
    if (lago) {
      const riva = new T.Mesh(new T.CircleGeometry(1, 40), toon('#eadba0')); riva.rotation.x = -PI / 2; riva.scale.set(17, 11, 1); riva.position.set(lago[0], 0.0, lago[1]); scena.add(riva);
      const acqua = new T.Mesh(new T.CircleGeometry(1, 40), new T.MeshToonMaterial({ color: 0x3aa3e6, gradientMap: gm(), emissive: new T.Color(0x1d6fb0), emissiveIntensity: 0.5 })); acqua.rotation.x = -PI / 2; acqua.scale.set(15, 9, 1); acqua.position.set(lago[0], 0.03, lago[1]); scena.add(acqua);
      const onde = []; for (let i = 0; i < 9; i++) { const o = new T.Mesh(new T.RingGeometry(0.9, 1.1, 18), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })); o.rotation.x = -PI / 2; o.position.set(lago[0] + rand(-9, 9), 0.05, lago[1] + rand(-4.5, 4.5)); o.userData.f = rand(0, 6); scena.add(o); onde.push(o); }
      const paper = []; for (let i = 0; i < 3; i++) { const d = new T.Group(); const c1 = new T.Mesh(new T.SphereGeometry(0.5, 10, 8), toon('#ffd94a')); c1.scale.set(1, 0.8, 1.3); d.add(c1); const t1 = new T.Mesh(new T.SphereGeometry(0.3, 10, 8), toon('#ffd94a')); t1.position.set(0, 0.5, 0.5); d.add(t1); const bc = new T.Mesh(new T.ConeGeometry(0.12, 0.3, 6), toon('#ff8a2a')); bc.rotation.x = PI / 2; bc.position.set(0, 0.5, 0.85); d.add(bc); d.userData.f = i * 2.1; scena.add(d); paper.push(d); }
      anim.push(t => { onde.forEach(o => { const s = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.6 + o.userData.f)); o.scale.set(s * 1.4, s * 1.4, 1); o.material.opacity = 0.45 * (1 - s); });
        paper.forEach(d => { const a = t * 0.25 + d.userData.f; d.position.set(lago[0] + Math.cos(a) * 8, 0.1 + Math.sin(t * 2 + d.userData.f) * 0.05, lago[1] + Math.sin(a) * 4); d.rotation.y = -a + PI / 2 + 0.3; }); });
    }
    const inLago = (x, z) => (lago && ((x - lago[0]) / 20) ** 2 + ((z - lago[1]) / 14) ** 2 < 1) || dist(x, z) < MURO + 1.0;   // vale anche per "troppo vicino alla pista"

    // tribuna con spettatori (rialzi, tettoia, striscioni)
    function tribuna(i, lung) {
      const c = P.sp[i], n = P.nor[i]; let sg = 1;
      if (dist(c.x - n.x * (MURO + 5), c.z - n.z * (MURO + 5)) < MURO + 4.5 || inLago(c.x - n.x * (MURO + 9), c.z - n.z * (MURO + 9))) { sg = -1; if (dist(c.x + n.x * (MURO + 5), c.z + n.z * (MURO + 5)) < MURO + 4.5 || inLago(c.x + n.x * (MURO + 9), c.z + n.z * (MURO + 9))) return; }
      const g = new T.Group(); g.position.set(c.x - n.x * sg * (MURO + 5), 0, c.z - n.z * sg * (MURO + 5)); g.rotation.y = yawAt(i) + (sg < 0 ? PI : 0); scena.add(g);
      const cols = ['#c8553d', '#e0a43a', '#3b78e8', '#e0449a', '#34b57a'];
      for (let t = 0; t < 5; t++) { const b = new T.Mesh(new T.BoxGeometry(1.7, 1 + t * 0.9, lung), toon(t % 2 ? '#d8d0e0' : '#b8aed0')); b.position.set(t * 1.7, (1 + t * 0.9) / 2, 0); g.add(b); const st = new T.Mesh(new T.BoxGeometry(0.15, 0.3, lung), toon(cols[t])); st.position.set(t * 1.7 - 0.8, 1 + t * 0.9 + 0.05, 0); g.add(st); }
      const tet = new T.Mesh(new T.BoxGeometry(9, 0.3, lung + 1.5), toon('#d9453b')); tet.position.set(4, 7.4, 0); tet.rotation.z = 0.12; g.add(tet);
      [-1, 1].forEach(s => { [0.2, 8].forEach(xx => { const p = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 7.4, 6), toon('#e8e2f0')); p.position.set(xx, 3.7, s * (lung / 2 + 0.3)); g.add(p); }); });
      const nsp = Math.floor(lung * 3.4), cap = new T.InstancedMesh(new T.SphereGeometry(0.3, 8, 6), toon('#ffffff'), nsp), cor = new T.InstancedMesh(new T.CapsuleGeometry(0.26, 0.4, 3, 6), toon('#ffffff'), nsp), base = [];
      for (let k = 0; k < nsp; k++) { const t = Math.floor(rand(0, 5)), z = rand(-lung / 2 + 0.6, lung / 2 - 0.6), y = 1 + t * 0.9; base.push([t * 1.7 + 0.1, y + 0.6, z, rand(0, 6)]); cap.setColorAt(k, cc.set(pick(['#f2c9a0', '#e8b088', '#c98a62', '#8a5a3a', '#f6d8b8']))); cor.setColorAt(k, cc.set(pick(['#e05a6d', '#3b78e8', '#ffd36a', '#34b57a', '#ffffff', '#8a5ac4']))); }
      g.add(cap); g.add(cor);
      anim.push(t => { for (let k = 0; k < nsp; k++) { const b = base[k], j = Math.max(0, Math.sin(t * 5 + b[3])) * 0.35; mt.makeTranslation(b[0], b[1] + 0.55 + j, b[2]); cap.setMatrixAt(k, mt); mt.makeTranslation(b[0], b[1] + j * 0.6, b[2]); cor.setMatrixAt(k, mt); } cap.instanceMatrix.needsUpdate = true; cor.instanceMatrix.needsUpdate = true; });
    }
    tribuna(0, 26); tribuna(250, 16);

    // cartelloni pubblicitari, lampioni, bandierine
    const tx = [['THE BORG', '#7a2fd6', '#e0449a'], ['SALA GIOCHI', '#e0443a', '#ffb23a'], ['NEGOZIO TCG', '#1a6bd6', '#3ac4e0'], ['GO-KART', '#2aa86a', '#9fe04a'], ['CAFFETTERIA', '#c8553d', '#ffd36a'], ['BIBLIOTECA', '#3f7a6a', '#8fe0c0'], ['TURBO!', '#e8453b', '#ffd36a'], ['BORGO', '#3b5fc4', '#9fc4ff']];
    for (let k = 0; k < 14; k++) {
      const i = (30 + k * 33) % N; if (i > N - 20 || i < 20) continue; const side = k % 2 ? 1 : -1, c = P.sp[i], n = P.nor[i], x = c.x + n.x * side * (MURO + 3.4), z = c.z + n.z * side * (MURO + 3.4); if (inLago(x, z)) continue;
      const g = new T.Group(), t = tx[k % tx.length]; g.position.set(x, 0, z);
      const pan = new T.Mesh(new T.PlaneGeometry(8, 2.5), new T.MeshBasicMaterial({ map: texCartello(t[0], t[1], t[2]), side: T.DoubleSide })); pan.position.y = 2.8; g.add(pan);
      [-3.4, 3.4].forEach(xx => { const p = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 2.6, 6), toon('#2c2431')); p.position.set(xx, 1.3, 0); g.add(p); });
      g.lookAt(c.x, 0, c.z); scena.add(g);
    }
    for (let i = 10; i < N; i += 44) {
      const side = (i / 44 | 0) % 2 ? 1 : -1, c = P.sp[i], n = P.nor[i], x = c.x + n.x * side * (MURO + 6.5), z = c.z + n.z * side * (MURO + 6.5); if (inLago(x, z)) continue;
      const g = new T.Group(); g.position.set(x, 0, z); const p = new T.Mesh(new T.CylinderGeometry(0.14, 0.2, 7, 6), toon('#4a4358')); p.position.y = 3.5; g.add(p);
      const br = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 1.6), toon('#4a4358')); br.position.set(0, 7, side * 0.7); g.add(br);
      const bu = new T.Mesh(new T.SphereGeometry(0.45, 8, 6), new T.MeshBasicMaterial({ color: 0xfff1b0 })); bu.position.set(0, 6.8, side * 1.5); g.add(bu); scena.add(g);
    }
    const nbn = 70, ban = new T.InstancedMesh(new T.ConeGeometry(0.42, 0.9, 3), new T.MeshBasicMaterial({ side: T.DoubleSide }), nbn);
    for (let k = 0; k < nbn; k++) { const i = (N - 40 + Math.floor(k / 2) * 2 + 480) % N, s = k % 2 ? 1 : -1, c = P.sp[i], n = P.nor[i]; q.setFromAxisAngle(new T.Vector3(1, 0, 0), PI); mt.compose(po.set(c.x + n.x * s * (MURO + 1.1), 3.4 + Math.sin(k) * 0.12, c.z + n.z * s * (MURO + 1.1)), q, sc.set(1, 1, 1)); ban.setMatrixAt(k, mt); ban.setColorAt(k, cc.set(pick(['#e05a6d', '#ffd36a', '#3b78e8', '#34b57a', '#ffffff', '#8a5ac4']))); }
    scena.add(ban);
    // fune delle bandierine e pali
    for (let k = 0; k < 14; k++) { const i = (N - 40 + k * 6) % N, c = P.sp[i], n = P.nor[i]; [-1, 1].forEach(s => { const p = new T.Mesh(new T.CylinderGeometry(0.07, 0.09, 3.6, 6), toon('#e8e2f0')); p.position.set(c.x + n.x * s * (MURO + 1.1), 1.8, c.z + n.z * s * (MURO + 1.1)); scena.add(p); }); }

    // vegetazione: pini, alberi tondi, cespugli, sassi, fiori
    function libera(x, z, d) { return dist(x, z) > d && !inLago(x, z) && Math.hypot(x - P.sp[0].x, z - P.sp[0].z) > 40 && Math.hypot(x - P.sp[250].x, z - P.sp[250].z) > 26; }
    function raccogli(n, d, ar, tent) { const o = []; for (let i = 0; i < tent && o.length < n; i++) { const x = rand(-ar, ar), z = rand(-ar * 0.9, ar * 0.9); if (libera(x, z, d)) o.push([x, z, rand(0.8, 1.7), rand(0, 6)]); } return o; }
    const pini = raccogli(95, 16, 105, 900), tondi = raccogli(60, 16, 105, 900), cesp = raccogli(110, 11.5, 90, 900), sassi = raccogli(45, 11, 100, 700), fiori = raccogli(420, 10.5, 100, 2500);
    const inst = (geo, mat, arr, f) => { const m = new T.InstancedMesh(geo, mat, Math.max(1, arr.length)); arr.forEach((p, i) => f(p, i, m)); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; scena.add(m); return m; };
    const put = (m, i, x, y, z, sx, sy, sz, ry) => { q.setFromAxisAngle(ye, ry || 0); mt.compose(po.set(x, y, z), q, sc.set(sx, sy, sz)); m.setMatrixAt(i, mt); };
    inst(new T.CylinderGeometry(0.35, 0.5, 2.2, 6), toon('#7a4f2f'), pini, (p, i, m) => put(m, i, p[0], p[2], p[1], p[2], p[2], p[2]));
    inst(new T.ConeGeometry(2.2, 4.6, 8), toon('#ffffff'), pini, (p, i, m) => { put(m, i, p[0], p[2] * 4.0, p[1], p[2], p[2], p[2], p[3]); m.setColorAt(i, cc.set(pick(TE.pini1))); });
    inst(new T.ConeGeometry(1.6, 3.6, 8), toon('#ffffff'), pini, (p, i, m) => { put(m, i, p[0], p[2] * 6.3, p[1], p[2], p[2], p[2], p[3]); m.setColorAt(i, cc.set(pick(TE.pini2))); });
    inst(new T.CylinderGeometry(0.4, 0.55, 3, 6), toon('#8a5a36'), tondi, (p, i, m) => put(m, i, p[0], p[2] * 1.5, p[1], p[2], p[2], p[2]));
    inst(new T.IcosahedronGeometry(2.4, 1), toon('#ffffff'), tondi, (p, i, m) => { put(m, i, p[0], p[2] * 4.2, p[1], p[2], p[2] * 0.9, p[2]); m.setColorAt(i, cc.set(pick(TE.chioma))); });
    inst(new T.IcosahedronGeometry(1, 1), toon('#ffffff'), cesp, (p, i, m) => { put(m, i, p[0], 0.5 * p[2], p[1], p[2], p[2] * 0.7, p[2]); m.setColorAt(i, cc.set(pick(TE.cesp))); });
    inst(new T.DodecahedronGeometry(1, 0), toon('#9a9aa8'), sassi, (p, i, m) => put(m, i, p[0], 0.3 * p[2], p[1], p[2] * 0.9, p[2] * 0.6, p[2] * 0.9, p[3]));
    inst(new T.IcosahedronGeometry(0.2, 0), toon('#ffffff'), fiori, (p, i, m) => { put(m, i, p[0], 0.2, p[1], 1, 1, 1); m.setColorAt(i, cc.set(pick(TE.fiori))); });

    // vele di bandiera turbo lungo la pista: archetti luminosi sopra le pedane
    (P.turbo || []).forEach(tu => { const g = new T.Group(); g.position.set(tu.x, 0, tu.z); g.rotation.y = yawAt(tu.i); [-1, 1].forEach(s => { const p = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 4.2, 6), toon('#ffd36a')); p.position.set(s * (MEZZA + 0.6), 2.1, 0); g.add(p); }); scena.add(g); });

    // portale di partenza con striscione a scacchi e semaforo
    const lamp = [], matOff = '#3a1010';
    {
      const c = P.sp[16], n = P.nor[16], g = new T.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = yawAt(16); scena.add(g);
      const W = MEZZA + 1.6, metal = toon('#cfd3dc');
      [-1, 1].forEach(sg => { const p = new T.Mesh(new T.BoxGeometry(0.45, 6.6, 0.45), metal); p.position.set(sg * W, 3.3, 0); g.add(p); const b = new T.Mesh(new T.BoxGeometry(1.2, 0.3, 1.2), toon('#555a66')); b.position.set(sg * W, 0.15, 0); g.add(b); });
      const tr = new T.Mesh(new T.BoxGeometry(W * 2 + 0.6, 0.5, 0.5), metal); tr.position.y = 6.6; g.add(tr);
      const ban = new T.Mesh(new T.PlaneGeometry(W * 2 - 0.4, 1.7), new T.MeshBasicMaterial({ map: texScacchi(), side: T.DoubleSide })); ban.material.map.repeat && ban.material.map.repeat.set(8, 1); ban.position.set(0, 5.45, 0); g.add(ban);
      const rb = new T.Mesh(new T.PlaneGeometry(W * 2 - 0.4, 0.5), new T.MeshBasicMaterial({ color: 0xd9302a, side: T.DoubleSide })); rb.position.set(0, 4.35, 0); g.add(rb);
      const box = new T.Mesh(new T.BoxGeometry(5.2, 1.1, 0.5), toon('#16161c')); box.position.set(0, 7.4, 0); g.add(box);
      for (let k = 0; k < 5; k++) { const m = new T.MeshBasicMaterial({ color: new T.Color(matOff) }); const l = new T.Mesh(new T.SphereGeometry(0.34, 14, 10), m); l.position.set(-2 + k, 7.4, 0); l.scale.z = 1.6; g.add(l); lamp.push(m); }
    }
    function semaforo(st) { // st: 0..3 = luci rosse accese, 4 = verde, -1 = spento
      lamp.forEach((m, k) => { if (st < 0) m.color.set(matOff); else if (st >= 4) m.color.set(k >= 3 ? '#2cff5a' : matOff); else m.color.set(k < Math.min(st, 3) ? '#ff2a1a' : matOff); });
      lamp.forEach((m, k) => { if (st >= 4) m.color.set(k === 3 || k === 4 ? '#2cff5a' : k === 0 || k === 1 || k === 2 ? '#2cff5a' : matOff); });
    }
    semaforo(-1);

    // torre di controllo
    let torre = null;
    {
      let side = 1, i = 10, c, n, x = 0, z = 0, ok = false;
      for (let ii = 10; ii < N - 30 && !ok; ii += 12) for (const off of [MURO + 9, MURO + 13]) for (const sd of [1, -1]) {
        if (ok) break; const cc = P.sp[ii], nn = P.nor[ii], xx = cc.x + nn.x * sd * off, zz = cc.z + nn.z * sd * off;
        if (!inLago(xx, zz) && dist(xx, zz) > MURO + 6.5 && Math.hypot(xx - P.sp[0].x, zz - P.sp[0].z) < 140) { ok = true; i = ii; side = sd; c = cc; n = nn; x = xx; z = zz; }
      }
      if (ok) { torre = { x, z };
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = yawAt(i) + (side > 0 ? -PI / 2 : PI / 2); scena.add(g);
      const wall = toon('#e9e6df'), glass = new T.MeshPhongMaterial({ color: 0x24344a, shininess: 90, specular: 0x88aacc });
      const b1 = new T.Mesh(new T.BoxGeometry(7, 3, 5), wall); b1.position.y = 1.5; g.add(b1);
      const b2 = new T.Mesh(new T.BoxGeometry(5.6, 2.6, 4.4), wall); b2.position.y = 4.3; g.add(b2);
      const gl = new T.Mesh(new T.BoxGeometry(5.7, 1.3, 4.5), glass); gl.position.y = 4.55; g.add(gl);
      const tt = new T.Mesh(new T.BoxGeometry(6.4, 0.4, 5.2), toon('#d9302a')); tt.position.y = 5.8; g.add(tt);
      const tt2 = new T.Mesh(new T.BoxGeometry(7.4, 0.35, 5.6), toon('#d9302a')); tt2.position.y = 3.05; g.add(tt2);
      for (let k = -2; k <= 2; k++) { const w = new T.Mesh(new T.BoxGeometry(1, 1.1, 0.1), glass); w.position.set(k * 1.3, 1.6, 2.52); g.add(w); }
      const mast = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 3.5, 6), toon('#999')); mast.position.set(2.4, 7.5, 0); g.add(mast);
      const fl = new T.Mesh(new T.PlaneGeometry(1.6, 1), new T.MeshBasicMaterial({ map: texScacchi(), side: T.DoubleSide })); fl.position.set(3.2, 8.8, 0); g.add(fl);
      anim.push(t => { fl.rotation.y = Math.sin(t * 3) * 0.3; });
      }
    }

    // bandiere a penna e torri faro
    for (let k = 0; k < 10; k++) {
      const i = (k * 48 + 20) % N, side = k % 2 ? 1 : -1, c = P.sp[i], n = P.nor[i], x = c.x + n.x * side * (MURO + 2.2), z = c.z + n.z * side * (MURO + 2.2); if (inLago(x, z)) continue;
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rand(0, 6); scena.add(g);
      const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 5, 6), toon('#e8e8ee')); pole.position.y = 2.5; g.add(pole);
      const fg = new T.PlaneGeometry(0.7, 3.4, 1, 6), fm = new T.Mesh(fg, new T.MeshToonMaterial({ color: new T.Color(pick(['#e8321e', '#ffd21a', '#2f6fe8', '#ffffff'])), gradientMap: gm(), side: T.DoubleSide })); fm.position.set(0.1, 3.2, 0); g.add(fm);
      anim.push(t => { const p = fg.attributes.position; for (let v = 0; v < p.count; v++) { const y = p.getY(v); p.setZ(v, Math.sin(t * 3 + y * 1.6 + k) * 0.12 * (1.7 - y) * 0.6); } p.needsUpdate = true; });
    }
    for (let k = 0; k < 4; k++) {
      const i = (k * 120 + 90) % N, side = k % 2 ? -1 : 1, c = P.sp[i], n = P.nor[i], x = c.x + n.x * side * (MURO + 5), z = c.z + n.z * side * (MURO + 5); if (inLago(x, z)) continue;
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = yawAt(i) + (side > 0 ? PI / 2 : -PI / 2); scena.add(g);
      const p = new T.Mesh(new T.CylinderGeometry(0.15, 0.25, 11, 6), toon('#9aa0ac')); p.position.y = 5.5; g.add(p);
      const hd = new T.Mesh(new T.BoxGeometry(3, 1.1, 0.5), toon('#2a2d38')); hd.position.y = 11.2; g.add(hd);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) { const l = new T.Mesh(new T.CircleGeometry(0.2, 8), new T.MeshBasicMaterial({ color: 0xfff6d0 })); l.position.set(-0.9 + a * 0.9, 11.0 + b * 0.4, 0.26); hd.add(l); l.position.y -= 11.2; l.position.z = 0.26; }
    }
    return { anim, semaforo, torre, dist };
  }

  /* ---------- particelle ---------- */
  function particelle(scena) {
    const NP = 220, pos = new Float32Array(NP * 3), col = new Float32Array(NP * 4), vel = new Float32Array(NP * 3), vita = new Float32Array(NP), vmax = new Float32Array(NP), grav = new Float32Array(NP);
    for (let i = 0; i < NP; i++) pos[i * 3 + 1] = -100;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 4));
    const m = new T.PointsMaterial({ size: 1.5, map: texPallino(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
    const pt = new T.Points(g, m); pt.frustumCulled = false; scena.add(pt); let cur = 0;
    return {
      emetti(x, y, z, vx, vy, vz, r, gg, b, v, gr) { const i = cur; cur = (cur + 1) % NP; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; col[i * 4] = r; col[i * 4 + 1] = gg; col[i * 4 + 2] = b; vita[i] = vmax[i] = v; grav[i] = gr || 0; },
      aggiorna(dt) { for (let i = 0; i < NP; i++) { if (vita[i] <= 0) { col[i * 4 + 3] = 0; continue; } vita[i] -= dt; vel[i * 3 + 1] -= grav[i] * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; col[i * 4 + 3] = Math.max(0, vita[i] / vmax[i]) * 0.85; } g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; }
    };
  }
  B.KartDecor = { scenografia, particelle, temi: TEMI };
})();
