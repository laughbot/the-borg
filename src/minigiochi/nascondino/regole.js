/* =====================================================================
   THE BORG - NASCONDINO TRASFORMISTA: le regole (senza grafica).
   Il cortile, gli oggetti in cui ci si puo' trasformare, come si
   dividono i ruoli, chi vince e quanti Starlight si prendono.
   E' tutto qui perche' si possa provare da solo (test/nascondino.test.mjs)
   e perche' online tutti i telefoni dispongano gli oggetti allo stesso modo
   (stesso seme = stesso cortile).
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3 = window.B3 || {};

  // il cortile: 40 x 28 metri, centro in 0,0
  const AX = 20, AZ = 14;
  const TEMPI = { nascondi: 30, cerca: 150, fischio: 25, stordito: 2 };
  const GITTATA = 2.4;                 // quanto lontano arriva il tocco del cercatore (oltre il bordo dell'oggetto)

  // gli oggetti del borgo in cui ci si trasforma: r = ingombro a terra, h = altezza
  const FORME = [
    { id: 'vaso', nome: 'Vaso di fiori', r: 0.4, h: 0.9 },
    { id: 'cassa', nome: 'Cassa', r: 0.5, h: 0.9 },
    { id: 'barile', nome: 'Barile', r: 0.42, h: 1.05 },
    { id: 'panchina', nome: 'Panchina', r: 0.75, h: 0.85 },
    { id: 'lampione', nome: 'Lampione', r: 0.28, h: 3.1 },
    { id: 'cespuglio', nome: 'Cespuglio', r: 0.62, h: 1.0 },
    { id: 'zucca', nome: 'Zucca', r: 0.42, h: 0.6 },
    { id: 'secchio', nome: 'Secchio', r: 0.28, h: 0.5 },
    { id: 'sacco', nome: 'Sacco di grano', r: 0.36, h: 0.75 }
  ];

  // costruzioni fisse del cortile (non ci si trasforma, fanno da muro e da riparo)
  //   b = rettangolo (centro x,z, larghezza w, profondita' d), c = cerchio (raggio r)
  const STRUTTURE = [
    { t: 'c', tipo: 'fontana', x: 0, z: 0, r: 2.3 },
    { t: 'b', tipo: 'casa', x: -14.5, z: -10, w: 7, d: 4.5 },
    { t: 'b', tipo: 'casa', x: 14.5, z: -10, w: 7, d: 4.5 },
    { t: 'b', tipo: 'casa', x: -14.5, z: 10, w: 7, d: 4.5 },
    { t: 'b', tipo: 'casa', x: 14.5, z: 10, w: 7, d: 4.5 },
    { t: 'b', tipo: 'bancarella', x: -6.5, z: -6.5, w: 3.2, d: 1.6 },
    { t: 'b', tipo: 'bancarella', x: 6.5, z: 6.5, w: 3.2, d: 1.6 },
    { t: 'b', tipo: 'bancarella', x: 7, z: -7.5, w: 1.6, d: 3.2 },
    { t: 'b', tipo: 'bancarella', x: -7, z: 7.5, w: 1.6, d: 3.2 },
    { t: 'b', tipo: 'carro', x: 0, z: -10.5, w: 3.6, d: 1.8 },
    { t: 'b', tipo: 'muretto', x: 0, z: 10.5, w: 5, d: 0.6 },
    { t: 'c', tipo: 'albero', x: -18, z: 0, r: 0.75 },
    { t: 'c', tipo: 'albero', x: 18, z: 0, r: 0.75 },
    { t: 'c', tipo: 'albero', x: -10, z: 1.5, r: 0.75 },
    { t: 'c', tipo: 'albero', x: 10, z: -1.5, r: 0.75 },
    { t: 'c', tipo: 'pozzo', x: -2, z: 6.5, r: 1.0 }
  ];

  /* numeri casuali ripetibili: stesso seme, stessa sequenza (anche su telefoni diversi) */
  function caso(seme) {
    let a = (seme >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* un punto e' libero se sta nel cortile e non tocca le costruzioni (r = ingombro) */
  function libero(x, z, r) {
    if (Math.abs(x) > AX - r || Math.abs(z) > AZ - r) return false;
    for (const s of STRUTTURE) {
      if (s.t === 'b') {
        const cx = Math.max(s.x - s.w / 2, Math.min(x, s.x + s.w / 2)), cz = Math.max(s.z - s.d / 2, Math.min(z, s.z + s.d / 2));
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return false;
      } else if ((x - s.x) * (x - s.x) + (z - s.z) * (z - s.z) < (r + s.r) * (r + s.r)) return false;
    }
    return true;
  }

  /* dove stanno gli oggetti veri: a gruppetti (come in un borgo vero), mai uno sopra l'altro.
     Ogni oggetto: { i (indice), f (indice in FORME), x, z, y (rotazione) } */
  function disponi(seme, quanti) {
    const R = caso(seme), out = [], N = quanti || 58;
    const vuoto = (x, z, r) => libero(x, z, r + 0.15) && out.every(o => Math.hypot(o.x - x, o.z - z) > r + FORME[o.f].r + 0.45);
    let giri = 0;
    while (out.length < N && giri++ < 400) {
      // un gruppetto: 1-3 forme vicine (barili con casse, vasi con cespugli...)
      const cx = (R() * 2 - 1) * (AX - 1.5), cz = (R() * 2 - 1) * (AZ - 1.5), forme = [];
      const k = 1 + Math.floor(R() * 3); for (let i = 0; i < k; i++) forme.push(Math.floor(R() * FORME.length));
      const n = 2 + Math.floor(R() * 4), giro = R() * 6.283;
      for (let j = 0; j < n && out.length < N; j++) {
        const f = forme[j % forme.length], r = FORME[f].r, a = giro + j * 1.9 + R() * 0.6, d = j ? 1 + R() * 1.6 : 0;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!vuoto(x, z, r)) continue;
        // le panchine e i lampioni stanno dritti, il resto un po' come capita
        const y = FORME[f].id === 'panchina' ? Math.round(R() * 4) * Math.PI / 2 : R() * 6.283;
        out.push({ i: out.length, f, x: +x.toFixed(2), z: +z.toFixed(2), y: +y.toFixed(2) });
      }
    }
    return out;
  }

  /* quanti cercatori: 1 fino a 4 giocatori, 2 fino a 7, poi 3 */
  const quantiCercatori = n => (n <= 4 ? 1 : n <= 7 ? 2 : 3);

  /* ruoli: id -> 1 cercatore, 0 nascosto. Stesso seme e stessi id = stessi ruoli */
  function ruoli(ids, seme) {
    const l = ids.map(String).sort(), R = caso(seme ^ 0x5bd1e995);
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = l[i]; l[i] = l[j]; l[j] = t; }
    const n = quantiCercatori(l.length), out = {};
    l.forEach((id, i) => { out[id] = i < n ? 1 : 0; });
    return out;
  }

  /* chi ha vinto: 'cercatori' se non resta nessuno nascosto, 'nascosti' se finisce il tempo, altrimenti null */
  function esito(nascostiRimasti, tempoRimasto) {
    if (nascostiRimasti <= 0) return 'cercatori';
    if (tempoRimasto <= 0) return 'nascosti';
    return null;
  }

  /* quanto e' andata (per B.Eco.premioGioco): da 0.6 (partecipazione) a 1.5 (vittoria)
     o = { eraNascosto, trovato, vinto, resistito (0..1 della ricerca passata prima di essere trovato), online } */
  function premio(o) {
    let k;
    if (o.eraNascosto) k = o.trovato ? 0.6 + 0.5 * Math.max(0, Math.min(1, o.resistito || 0)) : 1.5;
    else k = o.vinto ? 1.3 : 0.7;
    return +(k * (o.online ? 1.2 : 1)).toFixed(2);
  }

  /* cosa tocca il cercatore: l'oggetto (vero o finto) piu' adatto davanti a lui.
     io = { x, z, yaw }, candidati = [{ x, z, r }]; davanti = entro 70 gradi; attaccato = sempre */
  function bersaglio(io, candidati, gittata) {
    const G = gittata || GITTATA; let best = null, bv = Infinity;
    for (const c of candidati) {
      const dx = c.x - io.x, dz = c.z - io.z, d = Math.hypot(dx, dz), bordo = d - (c.r || 0);
      if (bordo > G) continue;
      let ang = Math.abs(Math.atan2(dx, dz) - io.yaw) % (2 * Math.PI); if (ang > Math.PI) ang = 2 * Math.PI - ang;
      if (ang > 1.22 && bordo > 0.6) continue;
      const v = bordo + ang * 1.1;
      if (v < bv) { bv = v; best = c; }
    }
    return best;
  }

  B.NascondinoRegole = { AX, AZ, TEMPI, GITTATA, FORME, STRUTTURE, caso, libero, disponi, quantiCercatori, ruoli, esito, premio, bersaglio };
})();
