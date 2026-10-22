/* =====================================================================
   THE BORG 3D - IL MODELLO DEL GO-KART (DEMO)
   Un kart da gara verosimile, disegnato da codice: telaio a tubi, gomme slick
   con cerchi oro, musetto e fianchi carenati con grafiche e numero, sedile
   a guscio, motore con filtro dell'aria, marmitta, volante e il pilota seduto.
   Tutti i kart sono uguali, cambia solo il colore.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, mesh = B.mesh;
  const PI = Math.PI;
  const phong = (c, sh, sp) => new T.MeshPhongMaterial({ color: new T.Color(c), shininess: sh || 70, specular: new T.Color(sp || 0x777777) });
  const hex = (x, cx, cy, r) => { x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + PI / 6; i ? x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.86) : x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.86); } x.closePath(); };

  function texNumero(n) {
    const [cv, x] = B.tela(128, 128); hex(x, 64, 64, 60); x.fillStyle = '#f6b81a'; x.fill(); x.lineWidth = 6; x.strokeStyle = '#2a2230'; x.stroke();
    x.font = 'bold 84px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#17141d'; x.fillText(String(n), 64, 70);
    return B.tex(cv);
  }
  function texFianco(flip, n) {
    const [cv, x] = B.tela(256, 96);
    x.save(); if (flip) { x.translate(256, 0); x.scale(-1, 1); }
    const poly = (pts, col) => { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fillStyle = col; x.fill(); };
    poly([[0, 96], [40, 20], [120, 8], [88, 96]], '#fbfaf7'); poly([[96, 96], [140, 14], [200, 10], [160, 96]], '#17141d'); poly([[168, 96], [206, 24], [256, 20], [256, 96]], '#fbfaf7');
    poly([[0, 70], [30, 40], [60, 40], [34, 96], [0, 96]], 'rgba(0,0,0,0)');
    x.restore();
    const cx = flip ? 52 : 204; hex(x, cx, 48, 40); x.fillStyle = '#f6b81a'; x.fill(); x.lineWidth = 5; x.strokeStyle = '#2a2230'; x.stroke();
    x.font = 'bold 56px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#17141d'; x.fillText(String(n), cx, 52);
    return B.tex(cv);
  }
  function texCasco(c1, c2, p) {
    const [cv, x] = B.tela(256, 128); x.fillStyle = c1; x.fillRect(0, 0, 256, 128);
    if (p === 1) { x.fillStyle = c2; x.fillRect(52, 0, 24, 128); x.fillRect(180, 0, 24, 128); x.fillStyle = '#ffffff'; x.fillRect(46, 0, 5, 128); x.fillRect(77, 0, 5, 128); }
    else if (p === 2) { x.fillStyle = c2; x.beginPath(); x.moveTo(0, 128); x.lineTo(0, 78); for (let i = 0; i < 8; i++) { x.lineTo(i * 32 + 16, 60); x.lineTo(i * 32 + 32, 78); } x.lineTo(256, 128); x.fill(); x.fillStyle = '#17141d'; x.fillRect(0, 96, 256, 6); }
    else if (p === 3) { x.fillStyle = c2; x.fillRect(0, 64, 256, 64); x.fillStyle = '#ffffff'; x.fillRect(0, 60, 256, 5); }
    else { x.fillStyle = c2; x.fillRect(0, 84, 256, 10); }
    return B.tex(cv);
  }
  function texSchiena(c2, scritta) {
    const [cv, x] = B.tela(256, 224); x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(0, 0, 256, 224);
    x.fillStyle = '#ffffff'; x.fillRect(10, 20, 236, 10); x.fillRect(10, 194, 236, 10); x.fillStyle = c2; x.fillRect(10, 34, 236, 6);
    x.font = 'bold 54px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 8; x.strokeStyle = '#17141d'; x.strokeText('BORGOPIA', 128, 112); x.fillStyle = '#ffffff'; x.fillText('BORGOPIA', 128, 112);
    return B.tex(cv);
  }
  function lathePneu(R, w) {
    const r0 = R * 0.52, s = w * 0.5, c = Math.min(0.14, w * 0.2);
    const pts = [[r0, -s], [R - c, -s], [R - 0.02, -s + c * 0.7], [R, -s + c * 1.6], [R, s - c * 1.6], [R - 0.02, s - c * 0.7], [R - c, s], [r0, s]].map(p => new T.Vector2(p[0], p[1]));
    const g = new T.LatheGeometry(pts, 28); g.rotateZ(PI / 2); return g;
  }

  function creaKartModello(o) {
    const colore = o.colore, numero = o.numero || 1, g = new T.Group();
    const vern = phong(colore, 100, 0x999999), bianco = phong('#f7f5f1', 100, 0x888888), nero = phong('#1a1920', 50, 0x333333), carbon = phong('#25232d', 40, 0x333333), oro = phong('#d9a52a', 140, 0xffe6a0), cromo = phong('#d4dae6', 160, 0xffffff), argento = phong('#a9b0be', 120, 0xeeeeee), gomma = phong('#1c1b20', 20, 0x222222);
    const add = (geo, mat, x, y, z, o) => { o = o || {}; const m = mesh(geo, mat, { x, y, z, l: o.l === undefined ? 0 : o.l }); if (o.r) m.rotation.set(o.r[0], o.r[1], o.r[2]); if (o.s) m.scale.set(o.s[0], o.s[1], o.s[2]); (o.p || g).add(m); return m; };
    const tubo = (r, len, mat, x, y, z, asse) => add(new T.CylinderGeometry(r, r, len, 8), mat, x, y, z, { l: 0, r: asse === 'x' ? [0, 0, PI / 2] : asse === 'z' ? [PI / 2, 0, 0] : [0, 0, 0] });
    const capsula = (r, len, mat, x, y, z, asse, s) => add(new T.CapsuleGeometry(r, len, 6, 16), mat, x, y, z, { r: asse === 'x' ? [0, 0, PI / 2] : asse === 'z' ? [PI / 2, 0, 0] : [0, 0, 0], s });

    /* telaio a tubi, pianale, assali */
    [-1, 1].forEach(sd => tubo(0.07, 3.1, vern, sd * 0.62, 0.38, 0.35, 'z'));
    [-1.1, -0.2, 0.7, 1.5].forEach(z => tubo(0.06, 1.3, vern, 0, 0.4, z, 'x'));
    add(new T.BoxGeometry(1.15, 0.06, 2.1), carbon, 0, 0.33, 0.45, { l: 0.01 });
    tubo(0.095, 3.0, oro, 0, 0.64, -1.0, 'x'); tubo(0.045, 2.1, cromo, 0, 0.5, 1.32, 'x');

    /* ruote: gomma slick, cerchio oro, mozzo cromato */
    const ruote = [];
    [[-1.3, 0.64, -1.0, 0.64, 0.82, 0.4], [1.3, 0.64, -1.0, 0.64, 0.82, 0.4], [-1.18, 0.5, 1.32, 0.5, 0.52, 0.31], [1.18, 0.5, 1.32, 0.5, 0.52, 0.31]].forEach((p, i) => {
      const gr = new T.Group(); gr.position.set(p[0], p[1], p[2]); g.add(gr); const sp = new T.Group(); gr.add(sp);
      const pn = mesh(lathePneu(p[3], p[4]), gomma, { l: 0 }); sp.add(pn);
      const rim = mesh(new T.CylinderGeometry(p[5], p[5], p[4] + 0.04, 18), oro, { l: 0 }); rim.rotation.z = PI / 2; sp.add(rim);
      const mz = mesh(new T.CylinderGeometry(p[5] * 0.4, p[5] * 0.4, p[4] + 0.1, 12), cromo, { l: 0 }); mz.rotation.z = PI / 2; sp.add(mz);
      const dado = mesh(new T.BoxGeometry(p[4] + 0.08, 0.07, p[5] * 1.6), nero, { l: 0 }); sp.add(dado);
      ruote.push({ g: gr, w: sp, ant: i >= 2 });
    });

    /* fianchi carenati con grafica e numero */
    [-1, 1].forEach(sd => {
      capsula(0.27, 1.1, vern, sd * 0.98, 0.52, 0.12, 'z', [1, 0.86, 1]);
      add(new T.BoxGeometry(0.46, 0.34, 0.1), nero, sd * 0.98, 0.5, 0.82, { l: 0 });
      const dec = new T.Mesh(new T.PlaneGeometry(1.5, 0.5), new T.MeshBasicMaterial({ map: texFianco(sd < 0, numero), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      dec.position.set(sd * 1.255, 0.53, 0.12); dec.rotation.y = sd * PI / 2; g.add(dec);
    });

    /* musetto e paraurti anteriore */
    capsula(0.3, 0.55, bianco, 0, 0.78, 1.36, 'z', [1.05, 0.85, 1]).rotation.x = PI / 2 + 0.34;
    add(new T.BoxGeometry(0.1, 0.05, 1.0), vern, 0, 1.0, 1.36, { l: 0, r: [0.34, 0, 0] });
    const pl = new T.Mesh(new T.PlaneGeometry(0.46, 0.46), new T.MeshBasicMaterial({ map: texNumero(numero), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); pl.position.set(0, 1.045, 1.26); pl.rotation.x = -PI / 2 + 0.34; g.add(pl);
    
    capsula(0.15, 1.9, vern, 0, 0.4, 2.1, 'x');
    add(new T.BoxGeometry(2.0, 0.09, 0.5), bianco, 0, 0.3, 2.0, { l: 0.012 }); [-1, 1].forEach(sd => { add(new T.BoxGeometry(0.62, 0.09, 0.42), nero, sd * 1.15, 0.3, 1.9, { l: 0.012, r: [0, -sd * 0.55, 0] }); capsula(0.12, 0.35, vern, sd * 1.15, 0.42, 1.95, 'x'); });
    tubo(0.035, 0.7, cromo, -0.32, 0.55, 1.78, 'z'); tubo(0.035, 0.7, cromo, 0.32, 0.55, 1.78, 'z');

    /* paraurti posteriore con numero */
    capsula(0.14, 1.7, vern, 0, 0.5, -1.78, 'x');
    add(new T.BoxGeometry(1.4, 0.1, 0.4), nero, 0, 0.3, -1.72, { l: 0.01 }); add(new T.BoxGeometry(2.1, 0.1, 0.26), vern, 0, 0.34, -1.68, { l: 0.01 });
    const pr = new T.Mesh(new T.PlaneGeometry(0.8, 0.8), new T.MeshBasicMaterial({ map: texNumero(numero), transparent: true, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); pr.position.set(0, 0.85, -1.66); pr.rotation.y = PI; g.add(pr);
    add(new T.BoxGeometry(0.95, 0.5, 0.06), vern, 0, 0.85, -1.63, { l: 0.012 }); tubo(0.05, 0.5, vern, -0.45, 0.62, -1.62); tubo(0.05, 0.5, vern, 0.45, 0.62, -1.62);

    /* sedile a guscio */
    add(new T.BoxGeometry(0.84, 0.1, 0.78), carbon, 0, 0.5, -0.32, { l: 0.012 });
    add(new T.BoxGeometry(0.88, 0.95, 0.14), carbon, 0, 0.98, -0.72, { l: 0.012, r: [-0.2, 0, 0] });
    [-1, 1].forEach(sd => { add(new T.BoxGeometry(0.1, 0.52, 0.78), carbon, sd * 0.45, 0.72, -0.4, { l: 0.01 }); add(new T.BoxGeometry(0.07, 0.07, 0.8), vern, sd * 0.47, 0.99, -0.4, { l: 0 }); });
    add(new T.BoxGeometry(0.92, 0.08, 0.16), vern, 0, 1.46, -0.8, { l: 0.01, r: [-0.2, 0, 0] });

    /* motore, filtro aria, ingranaggio, marmitta */
    add(new T.BoxGeometry(0.5, 0.5, 0.6), argento, 0.78, 0.66, -0.98, { l: 0.015 });
    add(new T.BoxGeometry(0.46, 0.18, 0.5), vern, 0.78, 1.0, -0.98, { l: 0.015 });
    for (let i = 0; i < 4; i++) add(new T.BoxGeometry(0.54, 0.035, 0.52), cromo, 0.78, 0.86 + i * 0.04 - 0.04, -0.98, { l: 0 });
    tubo(0.17, 0.4, nero, 1.12, 0.82, -0.7, 'x'); add(new T.SphereGeometry(0.19, 12, 8), nero, 1.35, 0.82, -0.7, { l: 0.015, s: [0.45, 1, 1] });
    tubo(0.22, 0.05, oro, 0.62, 0.64, -1.0, 'x'); tubo(0.07, 0.8, nero, 0.2, 0.74, -0.92, 'x');
    tubo(0.16, 1.3, argento, -0.5, 0.74, -1.25, 'z'); tubo(0.17, 0.25, nero, -0.5, 0.74, -1.95, 'z'); tubo(0.09, 0.7, nero, -0.2, 0.76, -0.75, 'x');
    const f1 = new T.Mesh(new T.ConeGeometry(0.15, 1.0, 8), new T.MeshBasicMaterial({ color: 0xffa21a })); f1.rotation.x = -PI / 2; f1.position.set(-0.5, 0.74, -2.55); f1.visible = false; g.add(f1);
    const f2 = new T.Mesh(new T.ConeGeometry(0.07, 0.7, 8), new T.MeshBasicMaterial({ color: 0xfff1a8 })); f2.rotation.x = -PI / 2; f2.position.set(-0.5, 0.74, -2.4); f2.visible = false; g.add(f2);

    /* serbatoio, piantone e volante */
    add(new T.BoxGeometry(0.34, 0.3, 0.46), argento, 0, 0.66, 0.85, { l: 0.015 });
    tubo(0.04, 1.0, cromo, 0, 0.88, 0.82).rotation.x = -0.62;
    const volOut = new T.Group(); volOut.position.set(0, 1.28, 0.5); volOut.rotation.x = -0.96; g.add(volOut);
    const vol = new T.Group(); volOut.add(vol);
    vol.add(mesh(new T.TorusGeometry(0.31, 0.058, 8, 22), nero, { l: 0.012 }));
    [[-0.75], [0.75]].forEach(a => { const gp = mesh(new T.TorusGeometry(0.31, 0.066, 8, 8, 0.8), vern, { l: 0 }); gp.rotation.z = a[0] + (a[0] < 0 ? 0 : 0) + PI / 2 - 0.4; vol.add(gp); });
    const ragg = mesh(new T.BoxGeometry(0.58, 0.06, 0.04), nero, { l: 0 }); vol.add(ragg); const ragg2 = mesh(new T.BoxGeometry(0.06, 0.3, 0.04), nero, { l: 0 }); ragg2.position.y = -0.15; vol.add(ragg2);
    const mozzo = mesh(new T.CylinderGeometry(0.08, 0.08, 0.06, 10), cromo, { l: 0 }); mozzo.rotation.x = PI / 2; vol.add(mozzo);

    /* ombra a terra */
    const om = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshBasicMaterial({ color: 0x1a2a10, transparent: true, opacity: 0.22, depthWrite: false })); om.rotation.x = -PI / 2; om.scale.set(1.65, 2.6, 1); om.position.set(0, 0.07, 0); g.add(om);

    /* pilota: tuta, guanti, casco integrale con visiera */
    const T1 = o.tuta[0], T2 = o.tuta[1], suit = phong(T1, 50, 0x555555), suit2 = phong(T2, 60, 0x666666), guanto = phong('#17141d', 40, 0x444444);
    const membro = (a, b, r, mat) => { const A = new T.Vector3(...a), Bv = new T.Vector3(...b), d = Bv.clone().sub(A), L = d.length(), m = new T.Mesh(new T.CapsuleGeometry(r, Math.max(0.01, L - 2 * r), 4, 10), mat); m.position.copy(A.clone().add(Bv).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; g.add(m); return m; };
    membro([0.17, 0.78, -0.42], [0.2, 0.9, 0.38], 0.13, suit); membro([-0.17, 0.78, -0.42], [-0.2, 0.9, 0.38], 0.13, suit);        // cosce
    membro([0.2, 0.9, 0.38], [0.2, 0.55, 1.02], 0.11, suit); membro([-0.2, 0.9, 0.38], [-0.2, 0.55, 1.02], 0.11, suit);            // stinchi
    [-1, 1].forEach(sd => { const sc = new T.Mesh(new T.CapsuleGeometry(0.1, 0.18, 4, 8), phong('#1c1a22', 30)); sc.position.set(sd * 0.2, 0.52, 1.1); sc.rotation.x = PI / 2; g.add(sc); });   // scarpe
    const tors = new T.Mesh(new T.CapsuleGeometry(0.27, 0.55, 6, 14), suit); tors.position.set(0, 1.18, -0.5); tors.rotation.x = -0.25; tors.scale.set(1.28, 1, 0.85); tors.castShadow = true; g.add(tors);
    const sch = new T.Mesh(new T.PlaneGeometry(0.7, 0.62), new T.MeshBasicMaterial({ map: texSchiena(T2, o.tuta[2]), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); sch.position.set(0, 1.22, -0.86); sch.rotation.y = PI; sch.rotation.x = 0.25; g.add(sch);
    [-1, 1].forEach(sd => { const sp = new T.Mesh(new T.SphereGeometry(0.16, 12, 10), suit2); sp.position.set(sd * 0.42, 1.38, -0.5); g.add(sp);
      membro([sd * 0.42, 1.36, -0.5], [sd * 0.55, 1.1, -0.02], 0.1, suit); membro([sd * 0.55, 1.1, -0.02], [sd * 0.27, 1.24, 0.48], 0.09, suit);
      const fa = new T.Mesh(new T.TorusGeometry(0.1, 0.03, 6, 12), suit2); fa.position.set(sd * 0.41, 1.17, 0.23); fa.rotation.y = PI / 2; fa.rotation.x = 0.4; g.add(fa);
      const gu = new T.Mesh(new T.SphereGeometry(0.115, 10, 8), guanto); gu.position.set(sd * 0.27, 1.24, 0.5); g.add(gu); });
    const cas = new T.Group(); cas.position.set(0, 1.86, -0.6); g.add(cas);
    const cm = new T.MeshPhongMaterial({ map: texCasco(o.casco.c1, o.casco.c2, o.casco.p), shininess: 130, specular: new T.Color(0xffffff) });
    const sh = new T.Mesh(new T.SphereGeometry(0.37, 28, 20), cm); sh.scale.set(1, 1.04, 1.12); sh.castShadow = true; cas.add(sh);
    const vis = new T.Mesh(new T.SphereGeometry(0.378, 20, 10, PI / 2 - 0.95, 1.9, PI * 0.36, PI * 0.2), new T.MeshPhongMaterial({ color: 0x0c1830, shininess: 200, specular: 0xaaccff })); vis.scale.set(1, 1.04, 1.12); cas.add(vis);
    const mento = new T.Mesh(new T.BoxGeometry(0.34, 0.16, 0.2), cm); mento.position.set(0, -0.3, 0.3); cas.add(mento);
    const alt = new T.Mesh(new T.BoxGeometry(0.34, 0.06, 0.16), phong(o.casco.c2, 60)); alt.position.set(0, 0.08, -0.43); alt.rotation.x = 0.3; cas.add(alt);
    const col = new T.Mesh(new T.CylinderGeometry(0.17, 0.2, 0.2, 12), suit2); col.position.set(0, -0.36, -0.05); cas.add(col);

    /* ---- unisce le parti fisse in poche mesh (molto piu' veloce da disegnare) ---- */
    const dinamici = new Set([f1, f2, vol, cas]); ruote.forEach(r => { dinamici.add(r.g); dinamici.add(r.w); });
    g.updateMatrixWorld(true);
    const contenitori = [g, vol, cas]; ruote.forEach(r => { contenitori.push(r.g, r.w); });
    const contenitoreDi = o => { for (let p = o.parent; p; p = p.parent) if (p === g || dinamici.has(p)) return p; return null; };
    const kmat = q => q.type + (q.color ? q.color.getHex() : '') + (q.map ? q.map.uuid : '') + (q.transparent ? 't' + q.opacity : '') + (q.shininess || '') + (q.side || 0) + (q.polygonOffset ? 'p' : '') + (q.depthWrite === false ? 'd' : '') + (q.emissive ? q.emissive.getHex() : '');
    const daUnire = new Map(); contenitori.forEach(c => daUnire.set(c, new Map()));
    const tutti = []; g.traverse(o => { if (o.isMesh && !dinamici.has(o)) tutti.push(o); });
    tutti.forEach(o => { const c = contenitoreDi(o); if (!c || !daUnire.has(c) || o.visible === false || o.isSkinnedMesh) return; const k = kmat(o.material), mp = daUnire.get(c); if (!mp.has(k)) mp.set(k, []); mp.get(k).push(o); });
    const inv = new T.Matrix4(), rel = new T.Matrix4(), nm = new T.Matrix3(), v = new T.Vector3();
    daUnire.forEach((mp, c) => {
      inv.copy(c.matrixWorld).invert();
      mp.forEach(lista => {
        if (lista.length < 2) return;
        const P = [], N = [], U = [], I = []; let off = 0;
        lista.forEach(o => {
          const ge = o.geometry, pos = ge.attributes.position, nor = ge.attributes.normal, uv = ge.attributes.uv; rel.multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(rel);
          for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(rel); P.push(v.x, v.y, v.z); if (nor) { v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); } else N.push(0, 1, 0); if (uv) U.push(uv.getX(i), uv.getY(i)); else U.push(0, 0); }
          if (ge.index) for (let i = 0; i < ge.index.count; i++) I.push(ge.index.getX(i) + off); else for (let i = 0; i < pos.count; i++) I.push(i + off);
          off += pos.count;
        });
        const mg = new T.BufferGeometry(); mg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); mg.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); mg.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); mg.setIndex(I);
        const me = new T.Mesh(mg, lista[0].material); me.castShadow = lista[0].castShadow; me.receiveShadow = lista[0].receiveShadow; me.renderOrder = lista[0].renderOrder; c.add(me);
        lista.forEach(o => { if (o.parent) o.parent.remove(o); o.geometry.dispose(); });
      });
    });
    return { g, ruote, fiamme: [f1, f2], volante: vol, casco: cas };
  }
  B.creaKartModello = creaKartModello;
})();
