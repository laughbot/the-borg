/* =====================================================================
   THE BORG - FRONTE DELLA COMETA: le armi (modelli e suoni).
   - inMano(id): l'arma vista in prima persona, con pezzi che si muovono
     (otturatore, caricatore che esce in ricarica, pompa, leva dell'otturatore).
   - sagoma(id): l'arma semplice in mano agli altri soldati (pochi pezzi).
   - suoni: spari, colpo a segno, testa, eliminazione, ricarica, esplosioni,
     tutto sintetizzato (nessun file). Rispetta il tasto degli effetti del borgo.
   Il davanti dell'arma e' verso -z; la bocca della canna e' in 'bocca' (z negativa).
   Forme e nomi sono nostri: niente copie di armi di altri giochi.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, PI = Math.PI;

  /* ---------- materiali con riflessi (le armi si vedono da vicino) ---------- */
  const cache = {};
  function mp(c, lucido, em) {
    const k = c + '/' + lucido + '/' + (em || 0); if (cache[k]) return cache[k];
    return (cache[k] = new T.MeshPhongMaterial({ color: c, specular: new T.Color(0x202020).lerp(new T.Color(0xc0c8d6), lucido), shininess: 8 + lucido * 90, emissive: em || 0 }));
  }
  const MET = () => mp(0x2b2e35, 0.75), MET2 = () => mp(0x464a53, 0.85), POL = () => mp(0x1d1f24, 0.15), ORO = () => mp(0xd9a441, 0.9, 0x3a2a08), AZZ = () => mp(0x7ad8ff, 0.4, 0x2a6f88);
  function pz(g, geo, mat, x, y, z) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; }
  const blocco = (g, w, h, d, mat, x, y, z) => pz(g, new T.BoxGeometry(w, h, d), mat, x, y, z);
  const tubo = (g, r, len, mat, x, y, z, seg) => { const m = pz(g, new T.CylinderGeometry(r, r, len, seg || 14), mat, x, y, z); m.rotation.x = PI / 2; return m; };
  function profilo(g, punti, spessore, mat, x, smusso) {   // profilo laterale [[z, y], ...] estruso sull'asse x
    const sh = new T.Shape(); punti.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]))); sh.closePath();
    const b = smusso === undefined ? 0.005 : smusso;
    const geo = new T.ExtrudeGeometry(sh, { depth: spessore, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
    geo.translate(0, 0, -spessore / 2); geo.rotateY(-PI / 2); geo.computeVertexNormals();
    const m = new T.Mesh(geo, mat); m.position.x = x || 0; g.add(m); return m;
  }
  function slitta(g, z0, z1, y) { blocco(g, 0.032, 0.01, z1 - z0, MET(), 0, y, (z0 + z1) / 2); for (let z = z0 + 0.012; z < z1; z += 0.026) blocco(g, 0.04, 0.009, 0.012, MET2(), 0, y + 0.009, z); }
  function grilletto(g, z, y) { const t = pz(g, new T.TorusGeometry(0.032, 0.006, 6, 16, PI), MET(), 0, y, z); t.rotation.set(0, PI / 2, PI); blocco(g, 0.012, 0.034, 0.01, MET2(), 0, y + 0.004, z - 0.004).rotation.x = 0.35; }
  function olografico(g, y, z) {   // mirino a punto rosso: il punto e' azzurro, il colore della cometa
    const o = new T.Group(); o.position.set(0, y, z); g.add(o);
    [-1, 1].forEach(s => blocco(o, 0.008, 0.055, 0.09, MET(), s * 0.027, 0.028, 0));
    blocco(o, 0.062, 0.008, 0.09, MET(), 0, 0.058, 0); blocco(o, 0.062, 0.014, 0.09, MET(), 0, 0.004, 0);
    pz(o, new T.PlaneGeometry(0.048, 0.045), new T.MeshPhongMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.22, shininess: 120, specular: 0xffffff }), 0, 0.032, -0.03);
    pz(o, new T.SphereGeometry(0.0042, 8, 6), new T.MeshBasicMaterial({ color: 0x7ad8ff }), 0, 0.032, -0.032);
    return o;
  }
  function cannocchiale(g, y, z, len, r) {
    const o = new T.Group(); o.position.set(0, y, z); g.add(o);
    tubo(o, r, len, MET(), 0, 0, 0); tubo(o, r * 1.4, len * 0.22, MET(), 0, 0, -len * 0.5); tubo(o, r * 1.3, len * 0.18, MET(), 0, 0, len * 0.5);
    [-len * 0.25, len * 0.25].forEach(zz => blocco(o, r * 1.3, r * 1.7, 0.02, MET2(), 0, -r * 1.4, zz));
    pz(o, new T.CircleGeometry(r * 1.2, 18), new T.MeshPhongMaterial({ color: 0x223a5a, shininess: 140, specular: 0xffffff, emissive: 0x06121e }), 0, 0, -len * 0.62).rotation.y = PI;
    return o;
  }
  const scatto = (s, dt, colpo, dur) => { if (colpo) s.k = dur; s.k = Math.max(0, (s.k || 0) - dt); return s.k / dur; };
  const fuori = r => (r <= 0 ? 0 : r < 0.32 ? r / 0.32 : r < 0.62 ? 1 : Math.max(0, (1 - r) / 0.38));   // caricatore: esce, resta fuori, rientra

  /* ---------- modelli in prima persona ---------- */
  const MODELLI = {
    // Falco: fucile d'assalto. Fusto scuro, astina verde oliva, filetto d'oro della Milizia.
    falco() {
      const g = new T.Group(), oliva = mp(0x5a5f44, 0.3);
      profilo(g, [[-0.2, 0.07], [0.27, 0.07], [0.3, 0.05], [0.3, -0.035], [0.12, -0.055], [0.03, -0.075], [-0.09, -0.075], [-0.2, -0.045]], 0.07, MET());
      profilo(g, [[0.29, 0.05], [0.47, 0.03], [0.52, 0.03], [0.53, -0.1], [0.5, -0.112], [0.43, -0.05], [0.3, -0.03]], 0.056, oliva);   // calcio
      profilo(g, [[0.06, -0.06], [0.12, -0.06], [0.17, -0.21], [0.15, -0.228], [0.095, -0.228], [0.05, -0.085]], 0.062, POL());     // impugnatura
      grilletto(g, 0.035, -0.083);
      const car = new T.Group(); g.add(car); profilo(car, [[-0.065, -0.07], [0.0, -0.07], [0.035, -0.2], [0.01, -0.27], [-0.07, -0.258], [-0.085, -0.12]], 0.046, MET2());
      profilo(g, [[-0.49, 0.052], [-0.19, 0.052], [-0.19, -0.042], [-0.47, -0.042], [-0.49, -0.025]], 0.068, oliva);   // astina
      for (let i = 0; i < 5; i++) [-1, 1].forEach(s => blocco(g, 0.006, 0.045, 0.022, POL(), s * 0.037, 0.006, -0.25 - i * 0.045));
      [-1, 1].forEach(s => blocco(g, 0.004, 0.01, 0.3, ORO(), s * 0.037, -0.028, 0.05));
      tubo(g, 0.015, 0.2, MET2(), 0, 0.012, -0.58); tubo(g, 0.023, 0.06, MET(), 0, 0.012, -0.66, 8);
      slitta(g, -0.46, 0.25, 0.076); olografico(g, 0.09, -0.02);
      const leva = blocco(g, 0.05, 0.018, 0.03, MET2(), 0, 0.055, 0.24);
      const s = {};
      return { root: g, bocca: -0.7, anim(t, dt, i) { const k = scatto(s, dt, i.colpo, 0.06), r = fuori(i.ric); leva.position.z = 0.24 + k * 0.035; car.position.y = -r * 0.26; car.position.z = r * 0.05; car.rotation.x = r * 0.4; } };
    },
    // Vespa: mitraglietta corta con calcio a filo e caricatore dritto. Nero e giallo vespa.
    vespa() {
      const g = new T.Group(), giallo = mp(0xf2c230, 0.35);
      profilo(g, [[-0.16, 0.065], [0.17, 0.065], [0.19, 0.04], [0.19, -0.05], [-0.02, -0.06], [-0.16, -0.05]], 0.068, MET());
      profilo(g, [[0.04, -0.05], [0.1, -0.05], [0.14, -0.2], [0.12, -0.215], [0.075, -0.215], [0.03, -0.07]], 0.058, POL());
      grilletto(g, 0.015, -0.07);
      const car = new T.Group(); g.add(car); blocco(car, 0.04, 0.24, 0.05, MET2(), 0, -0.17, -0.06); blocco(car, 0.044, 0.02, 0.055, giallo, 0, -0.29, -0.06);
      [-1, 1].forEach(s => { tubo(g, 0.006, 0.26, MET2(), s * 0.025, 0.02, 0.32); }); blocco(g, 0.06, 0.08, 0.012, POL(), 0, -0.01, 0.45);   // calcio a filo
      tubo(g, 0.026, 0.2, POL(), 0, 0.005, -0.27); tubo(g, 0.013, 0.08, MET2(), 0, 0.005, -0.41);
      blocco(g, 0.072, 0.01, 0.25, giallo, 0, -0.045, 0.0);
      slitta(g, -0.14, 0.16, 0.07); olografico(g, 0.084, 0.0);
      const ot = blocco(g, 0.012, 0.02, 0.04, MET2(), 0.04, 0.03, 0.08);
      const s = {};
      return { root: g, bocca: -0.45, anim(t, dt, i) { const k = scatto(s, dt, i.colpo, 0.045), r = fuori(i.ric); ot.position.z = 0.08 + k * 0.03; car.position.y = -r * 0.28; car.rotation.x = r * 0.25; } };
    },
    // Bufera: fucile a pompa. Legno caldo, tubo serbatoio sotto la canna, pompa che scorre a ogni colpo.
    bufera() {
      const g = new T.Group(), legno = mp(0x7a4a2a, 0.3), legnoS = mp(0x5a341e, 0.2);
      profilo(g, [[-0.1, 0.06], [0.2, 0.06], [0.22, 0.03], [0.22, -0.05], [-0.1, -0.05]], 0.07, MET());
      profilo(g, [[0.2, 0.045], [0.5, 0.0], [0.53, -0.01], [0.54, -0.14], [0.5, -0.15], [0.3, -0.07], [0.2, -0.05]], 0.06, legno);
      grilletto(g, 0.08, -0.06);
      tubo(g, 0.018, 0.6, MET2(), 0, 0.03, -0.38); tubo(g, 0.016, 0.48, MET(), 0, -0.012, -0.32);
      blocco(g, 0.008, 0.012, 0.56, MET(), 0, 0.052, -0.38);
      const pompa = new T.Group(); g.add(pompa); profilo(pompa, [[-0.42, 0.0], [-0.22, 0.0], [-0.22, -0.045], [-0.42, -0.045]], 0.066, legnoS, 0, 0.01);
      for (let i = 0; i < 6; i++) blocco(pompa, 0.07, 0.004, 0.01, legno, 0, -0.022, -0.4 + i * 0.03);
      pz(g, new T.SphereGeometry(0.006, 8, 6), ORO(), 0, 0.06, -0.66);
      const s = {};
      return { root: g, bocca: -0.68, anim(t, dt, i) { const k = scatto(s, dt, i.colpo, 0.45), r = fuori(i.ric), p = k > 0.25 ? Math.sin((1 - (k - 0.25) / 0.75) * PI) : 0; pompa.position.z = p * 0.09; g.rotation.z = r * 0.35; } };
    },
    // Aquila: fucile di precisione color sabbia, cannocchiale lungo e otturatore a leva.
    aquila() {
      const g = new T.Group(), sabbia = mp(0xb59a6a, 0.3), sabbiaS = mp(0x8f7750, 0.25);
      profilo(g, [[-0.2, 0.06], [0.24, 0.06], [0.26, 0.03], [0.26, -0.05], [-0.2, -0.05]], 0.066, MET());
      profilo(g, [[0.24, 0.05], [0.5, 0.05], [0.56, 0.02], [0.57, -0.13], [0.52, -0.14], [0.36, -0.08], [0.26, -0.06]], 0.06, sabbia);
      blocco(g, 0.05, 0.03, 0.16, sabbiaS, 0, 0.07, 0.43);   // appoggia guancia
      profilo(g, [[0.1, -0.05], [0.15, -0.05], [0.2, -0.19], [0.18, -0.205], [0.13, -0.205], [0.08, -0.07]], 0.056, sabbia);
      grilletto(g, 0.06, -0.07);
      profilo(g, [[-0.62, 0.035], [-0.2, 0.045], [-0.2, -0.05], [-0.6, -0.035]], 0.06, sabbia);
      tubo(g, 0.014, 0.42, MET2(), 0, 0.012, -0.78); tubo(g, 0.022, 0.07, MET(), 0, 0.012, -1.0, 8);
      const car = new T.Group(); g.add(car); blocco(car, 0.04, 0.1, 0.07, MET2(), 0, -0.08, -0.03);
      cannocchiale(g, 0.12, -0.05, 0.36, 0.026);
      [-1, 1].forEach(s => blocco(g, 0.008, 0.008, 0.2, MET(), s * 0.02, -0.06, -0.5));   // bipiede chiuso
      const leva = new T.Group(); leva.position.set(0.04, 0.04, 0.16); g.add(leva); blocco(leva, 0.04, 0.012, 0.012, MET2(), 0.02, 0, 0); pz(leva, new T.SphereGeometry(0.012, 10, 8), MET2(), 0.045, 0, 0);
      const s = {};
      return { root: g, bocca: -1.04, anim(t, dt, i) { const k = scatto(s, dt, i.colpo, 1.1), r = fuori(i.ric), b = k > 0.2 && k < 0.85 ? Math.sin((k - 0.2) / 0.65 * PI) : 0; leva.rotation.z = -b * 1.2; leva.position.z = 0.16 + b * 0.06; car.position.y = -r * 0.2; } };
    },
    // Tuono: mitragliatrice con cassetta di munizioni sotto, maniglia e scudo forato sulla canna.
    tuono() {
      const g = new T.Group(), verde = mp(0x4c5a3a, 0.3);
      profilo(g, [[-0.22, 0.08], [0.25, 0.08], [0.28, 0.05], [0.28, -0.06], [-0.22, -0.06]], 0.09, MET());
      profilo(g, [[0.27, 0.05], [0.5, 0.04], [0.53, -0.12], [0.48, -0.13], [0.3, -0.06]], 0.06, verde);
      profilo(g, [[0.08, -0.06], [0.14, -0.06], [0.18, -0.21], [0.16, -0.226], [0.11, -0.226], [0.07, -0.08]], 0.062, POL());
      grilletto(g, 0.05, -0.08);
      const car = new T.Group(); g.add(car); blocco(car, 0.11, 0.12, 0.13, verde, 0.01, -0.12, -0.06); blocco(car, 0.112, 0.012, 0.132, ORO(), 0.01, -0.07, -0.06);
      tubo(g, 0.034, 0.36, MET(), 0, 0.02, -0.4); for (let i = 0; i < 6; i++) [-1, 1].forEach(s => pz(g, new T.CircleGeometry(0.007, 8), POL(), s * 0.035, 0.02, -0.26 - i * 0.05).rotation.y = s * PI / 2);
      tubo(g, 0.017, 0.12, MET2(), 0, 0.02, -0.64); tubo(g, 0.026, 0.05, MET(), 0, 0.02, -0.71, 8);
      const man = new T.Group(); man.position.set(0, 0.13, -0.02); g.add(man); blocco(man, 0.02, 0.012, 0.16, MET2(), 0, 0, 0); [-0.07, 0.07].forEach(z => blocco(man, 0.016, 0.05, 0.012, MET2(), 0, -0.025, z));
      [-1, 1].forEach(s => blocco(g, 0.01, 0.01, 0.24, MET(), s * 0.022, -0.04, -0.5));
      const ot = blocco(g, 0.014, 0.024, 0.04, MET2(), 0.05, 0.03, 0.06);
      const s = {};
      return { root: g, bocca: -0.74, anim(t, dt, i) { const k = scatto(s, dt, i.colpo, 0.06), r = fuori(i.ric); ot.position.z = 0.06 + k * 0.03; car.position.y = -r * 0.22; car.position.x = r * 0.08; g.rotation.z = r * 0.25; } };
    },
    // Saetta: fucile a raffica compatto (caricatore dietro l'impugnatura), grigio e azzurro, mirino lungo.
    saetta() {
      const g = new T.Group(), grigio = mp(0x8a9098, 0.45);
      profilo(g, [[-0.28, 0.07], [0.32, 0.07], [0.36, 0.045], [0.38, -0.08], [0.2, -0.095], [-0.05, -0.085], [-0.28, -0.05]], 0.084, grigio);
      blocco(g, 0.07, 0.15, 0.016, POL(), 0, -0.045, 0.385);
      profilo(g, [[-0.08, -0.08], [-0.02, -0.08], [0.03, -0.23], [0.01, -0.245], [-0.045, -0.245], [-0.09, -0.095]], 0.064, POL());
      grilletto(g, -0.09, -0.1);
      const car = new T.Group(); g.add(car); profilo(car, [[0.2, -0.09], [0.29, -0.09], [0.3, -0.21], [0.21, -0.21]], 0.048, MET2());
      [-1, 1].forEach(s => blocco(g, 0.004, 0.014, 0.42, AZZ(), s * 0.044, 0.0, 0.02));
      tubo(g, 0.015, 0.14, MET2(), 0, 0.01, -0.35); tubo(g, 0.024, 0.04, MET(), 0, 0.01, -0.43, 8);
      cannocchiale(g, 0.115, -0.02, 0.2, 0.02);
      const ot = blocco(g, 0.02, 0.02, 0.05, AZZ(), 0.046, 0.04, 0.18);
      const s = {};
      return { root: g, bocca: -0.46, anim(t, dt, i) { const k = scatto(s, dt, i.colpo, 0.05), r = fuori(i.ric); ot.position.z = 0.18 + k * 0.03; car.position.y = -r * 0.24; car.position.z = r * 0.05; car.rotation.x = -r * 0.3; } };
    },
    // Grillo: pistola con carrello che scorre a ogni colpo e un grillo inciso d'oro.
    grillo() {
      const g = new T.Group();
      const carr = new T.Group(); g.add(carr); profilo(carr, [[-0.17, 0.045], [0.06, 0.045], [0.07, 0.03], [0.07, -0.005], [-0.17, -0.005]], 0.05, MET2());
      for (let i = 0; i < 5; i++) blocco(carr, 0.054, 0.03, 0.004, MET(), 0, 0.02, 0.02 + i * 0.009);
      blocco(carr, 0.002, 0.012, 0.03, ORO(), 0.026, 0.02, -0.08);
      profilo(g, [[-0.15, -0.005], [0.04, -0.005], [0.07, -0.16], [0.05, -0.18], [0.0, -0.18], [-0.01, -0.03], [-0.15, -0.025]], 0.046, POL());
      grilletto(g, -0.04, -0.035);
      const car = new T.Group(); g.add(car); blocco(car, 0.03, 0.03, 0.04, MET(), 0, -0.19, 0.03);
      blocco(g, 0.008, 0.014, 0.008, MET(), 0, 0.054, -0.16); blocco(g, 0.02, 0.012, 0.008, MET(), 0, 0.052, 0.05);
      const s = {};
      return { root: g, bocca: -0.18, anim(t, dt, i) { const k = scatto(s, dt, i.colpo, 0.08), r = fuori(i.ric); carr.position.z = k * 0.05; car.position.y = -r * 0.18; g.rotation.z = r * 0.4; } };
    }
  };
  // dove sta in mano in prima persona (x a destra, y in basso, z avanti) e quanto e' grande
  const POSA = {
    // mira = altezza della linea di mira nel modello (per centrare il mirino quando si mira)
    falco: { x: 0.21, y: -0.2, z: -0.58, s: 0.6, mira: 0.122 }, vespa: { x: 0.2, y: -0.19, z: -0.5, s: 0.66, mira: 0.116 },
    bufera: { x: 0.21, y: -0.19, z: -0.58, s: 0.6, mira: 0.064 }, aquila: { x: 0.22, y: -0.21, z: -0.6, s: 0.56, mira: 0.12 },
    tuono: { x: 0.22, y: -0.215, z: -0.6, s: 0.58, mira: 0.088 }, saetta: { x: 0.21, y: -0.2, z: -0.55, s: 0.62, mira: 0.115 },
    grillo: { x: 0.19, y: -0.17, z: -0.42, s: 0.8, mira: 0.061 }
  };
  function inMano(id) { const f = MODELLI[id] || MODELLI.falco, m = f(); m.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); m.posa = POSA[id] || POSA.falco; m.id = id; return m; }

  /* ---------- l'arma in mano agli altri: pochi pezzi ---------- */
  const SAGOME = { falco: [0.62, 0.08, 0.04, '#5a5f44'], vespa: [0.42, 0.08, 0.03, '#f2c230'], bufera: [0.7, 0.07, 0.03, '#7a4a2a'], aquila: [0.95, 0.07, 0.03, '#b59a6a'], tuono: [0.72, 0.11, 0.045, '#4c5a3a'], saetta: [0.6, 0.1, 0.035, '#8a9098'], grillo: [0.22, 0.07, 0.025, '#2b2e35'] };
  function sagoma(id) {
    const [L, H, r, c] = SAGOME[id] || SAGOME.falco, g = new T.Group();
    g.add(B.mesh(new T.BoxGeometry(0.07, H, L * 0.55), B.M('#2b2e35'), { z: -L * 0.12, cast: false, recv: false, lb: 0.012 }));
    g.add(B.mesh(new T.BoxGeometry(0.06, H * 0.9, L * 0.3), B.M(c), { y: -0.01, z: L * 0.28, cast: false, recv: false }));
    const canna = B.mesh(new T.CylinderGeometry(r * 0.5, r * 0.5, L * 0.45, 6), B.M('#1d1f24'), { z: -L * 0.55, cast: false, recv: false }); canna.rotation.x = PI / 2; g.add(canna);
    if (id !== 'grillo') g.add(B.mesh(new T.BoxGeometry(0.04, 0.12, 0.05), B.M('#1d1f24'), { y: -H, z: -L * 0.05, cast: false, recv: false }));
    g.userData.bocca = -L * 0.78; return g;
  }

  /* ---------- suoni (sintetizzati) ---------- */
  let ac = null, mst = null, rum = null;
  function audio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    ac = new A(); mst = ac.createGain(); mst.gain.value = 0.6; mst.connect(ac.destination);
    rum = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate); const d = rum.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }
  const muti = () => !ac || (B.Audio && B.Audio.effettiMuti && B.Audio.effettiMuti());
  function uscita(pan) { if (pan === undefined || !ac.createStereoPanner) return mst; const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(mst); return p; }
  function rumore(out, t, tipo, f, q, v, dur) {
    const n = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = rum;
    fl.type = tipo; fl.frequency.value = f; if (q) fl.Q.value = q;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(fl); fl.connect(g); g.connect(out); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.02);
  }
  function tono(out, t, f0, f1, v, dur, forma) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = forma || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  const SPARI = {
    leggero: (o, t, v, l) => { rumore(o, t, 'bandpass', l ? 900 : 1700, 0.9, 0.3 * v, 0.07); tono(o, t, 260, 90, 0.18 * v, 0.06); },
    medio: (o, t, v, l) => { rumore(o, t, 'bandpass', l ? 600 : 1100, 0.7, 0.36 * v, 0.11); tono(o, t, 170, 55, 0.3 * v, 0.1); rumore(o, t + 0.02, 'lowpass', 500, 0, 0.08 * v, 0.25); },
    pesante: (o, t, v, l) => { rumore(o, t, 'lowpass', l ? 500 : 900, 0, 0.5 * v, 0.22); tono(o, t, 120, 40, 0.42 * v, 0.2); rumore(o, t + 0.05, 'lowpass', 350, 0, 0.12 * v, 0.6); },
    pompa: (o, t, v, l) => { rumore(o, t, 'lowpass', l ? 600 : 1200, 0, 0.55 * v, 0.28); tono(o, t, 140, 45, 0.4 * v, 0.18); if (!l) { rumore(o, t + 0.32, 'bandpass', 2400, 4, 0.08 * v, 0.05); rumore(o, t + 0.45, 'bandpass', 2000, 4, 0.08 * v, 0.05); } }
  };
  const S = {
    sblocca() { audio(); },
    // tipo di sparo, volume 0..1, pan -1..1, lontano = suono smorzato
    sparo(tipo, vol, pan, lontano) { if (muti() || vol < 0.02) return; (SPARI[tipo] || SPARI.medio)(uscita(pan), ac.currentTime, vol, lontano); },
    colpito() { if (muti()) return; rumore(mst, ac.currentTime, 'highpass', 3200, 0, 0.12, 0.035); },
    testa() { if (muti()) return; const t = ac.currentTime; tono(mst, t, 1900, 1850, 0.12, 0.12, 'triangle'); tono(mst, t, 2850, 2800, 0.06, 0.1); },
    elimina() { if (muti()) return; const t = ac.currentTime; tono(mst, t, 880, 870, 0.12, 0.09, 'triangle'); tono(mst, t + 0.08, 1320, 1310, 0.12, 0.14, 'triangle'); },
    ferito(pan) { if (muti()) return; const t = ac.currentTime, o = uscita(pan); rumore(o, t, 'lowpass', 400, 0, 0.3, 0.12); tono(o, t, 90, 50, 0.25, 0.12); },
    ricarica() { if (muti()) return; const t = ac.currentTime; rumore(mst, t + 0.05, 'bandpass', 2600, 5, 0.12, 0.04); rumore(mst, t + 0.55, 'bandpass', 1800, 5, 0.16, 0.05); rumore(mst, t + 0.75, 'bandpass', 3200, 6, 0.1, 0.03); },
    vuoto() { if (muti()) return; rumore(mst, ac.currentTime, 'bandpass', 3800, 8, 0.1, 0.03); },
    esplosione(vol, pan) { if (muti() || vol < 0.02) return; const t = ac.currentTime, o = uscita(pan); rumore(o, t, 'lowpass', 700, 0, 0.7 * vol, 0.9); tono(o, t, 80, 30, 0.6 * vol, 0.5); rumore(o, t + 0.1, 'lowpass', 250, 0, 0.3 * vol, 1.2); },
    lancio() { if (muti()) return; rumore(mst, ac.currentTime, 'bandpass', 900, 1.5, 0.1, 0.15); },
    calcio() { if (muti()) return; const t = ac.currentTime; rumore(mst, t, 'lowpass', 900, 0, 0.3, 0.1); tono(mst, t, 160, 70, 0.25, 0.08); },
    cambio() { if (muti()) return; const t = ac.currentTime; rumore(mst, t, 'bandpass', 2200, 4, 0.08, 0.05); rumore(mst, t + 0.18, 'bandpass', 3000, 5, 0.07, 0.04); },
    raccogli() { if (muti()) return; const t = ac.currentTime; tono(mst, t, 660, 660, 0.08, 0.08, 'triangle'); tono(mst, t + 0.07, 990, 990, 0.08, 0.1, 'triangle'); },
    cattura(nostra) { if (muti()) return; const t = ac.currentTime, n = nostra ? [72, 76, 79, 84] : [72, 69, 65, 60]; n.forEach((m, i) => tono(mst, t + i * 0.09, 440 * Math.pow(2, (m - 69) / 12), 440 * Math.pow(2, (m - 69) / 12), 0.1, 0.2, 'triangle')); },
    bip(alto) { if (muti()) return; tono(mst, ac.currentTime, alto ? 1500 : 1100, alto ? 1500 : 1100, 0.07, 0.06, 'square'); },
    serie() { if (muti()) return; const t = ac.currentTime; [67, 71, 74, 79].forEach((m, i) => tono(mst, t + i * 0.1, 440 * Math.pow(2, (m - 69) / 12), 440 * Math.pow(2, (m - 69) / 12), 0.11, 0.28, 'sawtooth')); },
    buio() { if (muti()) return; const t = ac.currentTime; tono(mst, t, 70, 55, 0.18, 0.4, 'sawtooth'); },
    avviso() { if (muti()) return; const t = ac.currentTime; [0, 0.18].forEach(d => tono(mst, t + d, 740, 740, 0.08, 0.14, 'triangle')); }
  };

  B.FronteArmi = { inMano, sagoma, POSA, suoni: S };
})();
