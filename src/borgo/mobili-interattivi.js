/* =====================================================================
   THE BORG 3D - MOBILI INTERATTIVI (come in Habbo: i mobili fanno qualcosa)
   Si toccano, oppure si usa il pulsante quando sei vicino:
   - lampada e lanterna: accendi / spegni la luce
   - dado gigante: lo lanci, tutti vedono lo stesso numero
   - teletrasporto: ne servono due, entri in uno ed esci dall'altro
   - jukebox: due dischi per la stanza (B.Audio.jukebox)
   - frigorifero: ti da' una bibita in mano
   - TV: tre canali; cabinato arcade: fa partire un minigioco
   - trampolino: ci cammini sopra e rimbalzi (altezza in arredi.js, "salta")
   - cartello: il padrone di casa ci scrive, chi visita lo legge
   Lo stato (luce spenta, disco, canale, scritta, faccia del dado) resta salvato
   con il mobile (s) e arriva agli amici in visita insieme alla casa.
   Con gli amici: B.MobInt.rete(e) manda l'azione (online.js la mette nella
   presenza come "mo"), B.MobInt.daRete(e, nick) applica quella di un amico.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, PI = Math.PI;
  if (!B.ARREDI || !B.Arredo) return;
  const MI = B.MobInt = {};
  let app = null;
  const box = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), M(col), { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
  const cil = (g, r1, r2, h, col, x, y, z, seg) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 14), M(col), { x, y, z, l: 0.018 }); g.add(m); return m; };
  const ora = () => performance.now() / 1000;
  const stato = g => g.userData.s || {};
  const pulito = (t, n) => String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯]/g, '').trim().slice(0, n);
  const toast = t => app && app.G.emetti('toast', t);
  const sfx = (k, v) => { if (B.Audio && B.Audio.sfx) B.Audio.sfx(k, v); };

  /* ---------- facce del dado (disegnate una volta) ---------- */
  let facce = null;
  function faccia(n) {
    const [cv, x] = B.tela(64, 64); x.fillStyle = '#fbf3dc'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#c9b9a8'; x.lineWidth = 4; x.strokeRect(2, 2, 60, 60);
    const P = { 1: [[32, 32]], 2: [[18, 18], [46, 46]], 3: [[16, 16], [32, 32], [48, 48]], 4: [[18, 18], [46, 18], [18, 46], [46, 46]], 5: [[17, 17], [47, 17], [32, 32], [17, 47], [47, 47]], 6: [[18, 15], [46, 15], [18, 32], [46, 32], [18, 49], [46, 49]] };
    x.fillStyle = n === 1 ? '#c4453b' : '#2a1a2e'; P[n].forEach(p => { x.beginPath(); x.arc(p[0], p[1], n === 1 ? 9 : 6, 0, 7); x.fill(); });
    return new T.MeshToonMaterial({ map: B.tex(cv), gradientMap: M('#fff').gradientMap });
  }
  // ordine delle facce di BoxGeometry: +x, -x, +y, -y, +z, -z
  const NUM_FACCIA = [3, 4, 1, 6, 2, 5];
  const GIRA = { 1: [0, 0], 6: [PI, 0], 2: [-PI / 2, 0], 5: [PI / 2, 0], 3: [0, PI / 2], 4: [0, -PI / 2] };   // rotazione x, z per avere n in alto

  /* ---------- i nuovi mobili del negozio ---------- */
  const NUOVI = [
    { id: 'dado', nome: 'Dado gigante', prezzo: 50, usa: 'dado', w: 0.9, d: 0.9, f(g) {
      if (!facce) facce = NUM_FACCIA.map(faccia);
      const perno = new T.Group(); perno.position.y = 0.3; g.add(perno);
      const c = mesh(new T.BoxGeometry(0.6, 0.6, 0.6), facce, { lb: 0.02 }); perno.add(c);
      const gira = n => { const r = GIRA[n] || GIRA[1]; c.rotation.set(r[0], 0, r[1]); };
      let vista = 0;
      g.userData.anim = () => {
        const s = stato(g), L = g.userData.lancio, t = ora();
        if (L && t - L.t0 < 0.9) { const u = (t - L.t0) / 0.9; perno.position.y = 0.3 + Math.sin(u * PI) * 0.9; c.rotation.set(t * 17, t * 11, t * 13); vista = 0; return; }
        if (L) { g.userData.lancio = null; perno.rotation.y = L.yaw; }
        perno.position.y = 0.3; if (vista !== (s.v || 1)) { vista = s.v || 1; gira(vista); }
      };
    } },
    { id: 'tele', nome: 'Teletrasporto', prezzo: 150, usa: 'tele', pad: true, w: 1.2, d: 1.2, f(g) {
      cil(g, 0.6, 0.62, 0.1, '#3b2f5c', 0, 0.05, 0, 24);
      const anello = new T.Mesh(new T.TorusGeometry(0.5, 0.05, 8, 28), new T.MeshBasicMaterial({ color: 0x5fd8ff })); anello.rotation.x = PI / 2; anello.position.y = 0.11; g.add(anello);
      const dentro = new T.Mesh(new T.CircleGeometry(0.44, 24), new T.MeshBasicMaterial({ color: 0x8a5cff, transparent: true })); dentro.rotation.x = -PI / 2; dentro.position.y = 0.105; g.add(dentro);
      const pz = [], mp = new T.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.85 });
      for (let i = 0; i < 6; i++) { const p = new T.Mesh(new T.SphereGeometry(0.035, 6, 5), mp); g.add(p); pz.push(p); }
      g.userData.anim = () => {
        const t = ora(), f = g.userData.lampo && t - g.userData.lampo < 0.6 ? 1 - (t - g.userData.lampo) / 0.6 : 0;
        pz.forEach((p, i) => { const u = (t * 0.45 + i / pz.length) % 1, a = i * 1.05 + t; p.position.set(Math.cos(a) * 0.4, 0.15 + u * (1.4 + f * 1.5), Math.sin(a) * 0.4); p.scale.setScalar(1 + f * 2); });
        anello.scale.setScalar(1 + f * 0.5); dentro.material.opacity = 0.75 + Math.sin(t * 3) * 0.15; dentro.material.color.setHex(f > 0.2 ? 0xd9f6ff : 0x8a5cff);
      };
    } },
    { id: 'jukebox', nome: 'Jukebox', prezzo: 260, usa: 'juke', w: 1.1, d: 0.7, f(g) {
      box(g, 1.0, 1.25, 0.6, '#8a3a2a', 0, 0.625, 0);
      const cupola = mesh(new T.CylinderGeometry(0.5, 0.5, 0.6, 20, 1, false, 0, PI), M('#a8472f'), { l: 0.018 }); cupola.rotation.z = PI / 2; cupola.rotation.y = PI / 2; cupola.position.y = 1.25; g.add(cupola);
      box(g, 0.7, 0.38, 0.04, '#2a1a2e', 0, 0.98, 0.3, 0); box(g, 0.66, 0.3, 0.02, '#f2c76e', 0, 0.98, 0.32, 0);
      box(g, 0.7, 0.32, 0.04, '#3a2a22', 0, 0.42, 0.3, 0);
      for (let i = 0; i < 5; i++) box(g, 0.6, 0.025, 0.02, '#c9a36a', 0, 0.3 + i * 0.06, 0.33, 0);
      const neon = ['#ff6fae', '#7fe6ff', '#ffd36a'].map((c, i) => { const n = new T.Mesh(new T.BoxGeometry(0.06, 1.1, 0.06), B.Mluce(c, 0.6)); n.position.set((i - 1) * 0.45 + (i === 1 ? 0 : 0), 0.62, 0.31); if (i === 1) { n.scale.set(9, 0.06, 1); n.position.y = 1.2; } g.add(n); return n; });
      const note = [], mn = new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true });
      for (let i = 0; i < 4; i++) { const q = new T.Group(); q.add(new T.Mesh(new T.SphereGeometry(0.06, 8, 6), mn)); const st = new T.Mesh(new T.BoxGeometry(0.02, 0.18, 0.02), mn); st.position.set(0.05, 0.09, 0); q.add(st); q.visible = false; g.add(q); note.push(q); }
      g.userData.anim = () => {
        const s = stato(g), t = ora(), on = !!s.j;
        neon.forEach((n, i) => { n.material.emissiveIntensity = on ? 1 + Math.sin(t * 6 + i * 2) * 0.6 : 0.25; });
        note.forEach((q, i) => { q.visible = on; if (!on) return; const u = (t * 0.5 + i / note.length) % 1; q.position.set(Math.sin(t * 2 + i * 1.7) * 0.35, 1.6 + u * 1.3, 0.1); mn.opacity = 0.9; q.scale.setScalar(1 - u * 0.5); });
      };
    } },
    { id: 'frigo', nome: 'Frigorifero', prezzo: 160, usa: 'frigo', w: 0.9, d: 0.8, f(g) {
      box(g, 0.85, 1.9, 0.7, '#dfe8ee', 0, 0.95, -0.03);
      const perno = new T.Group(); perno.position.set(-0.42, 0, 0.33); g.add(perno);
      const anta = box(perno, 0.84, 1.2, 0.06, '#eef4f7', 0.42, 0.62, 0.03); box(perno, 0.06, 0.4, 0.06, '#9aa8b2', 0.76, 0.75, 0.09, 0);
      const alta = box(g, 0.84, 0.62, 0.06, '#eef4f7', 0, 1.56, 0.36); box(g, 0.06, 0.25, 0.06, '#9aa8b2', 0.34, 1.5, 0.42, 0);
      [['#e05a6d', -0.2, 1.7], ['#4aa3a0', 0.05, 1.62], ['#f2c76e', -0.1, 0.9]].forEach(q => box(q[2] < 1.2 ? anta : alta, 0.1, 0.1, 0.03, q[0], q[2] < 1.2 ? q[1] : q[1], q[2] < 1.2 ? 0.28 : 0.02, 0.04, 0));
      const dentro = new T.Mesh(new T.PlaneGeometry(0.76, 1.1), B.Mluce('#fff8e0', 0.6)); dentro.position.set(0, 0.62, 0.325); g.add(dentro);
      g.userData.anim = () => { const t0 = g.userData.apri, t = ora(); const u = t0 && t - t0 < 1.4 ? Math.sin(Math.min(1, (t - t0) / 1.4) * PI) : 0; perno.rotation.y = -u * 1.6; dentro.visible = u > 0.05; };
    } },
    { id: 'trampolino', nome: 'Trampolino', prezzo: 140, usa: 'salto', pad: true, salta: 0.32, w: 1.8, d: 1.8, f(g) {
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; box(g, 0.07, 0.3, 0.07, '#4a4a5a', Math.cos(a) * 0.78, 0.15, Math.sin(a) * 0.78, 0.01); }
      const bordo = mesh(new T.TorusGeometry(0.8, 0.08, 8, 30), M('#3b8fe0'), { l: 0.015 }); bordo.rotation.x = PI / 2; bordo.position.y = 0.32; g.add(bordo);
      const tela = new T.Mesh(new T.CircleGeometry(0.74, 28), M('#22222e')); tela.rotation.x = -PI / 2; tela.position.y = 0.31; g.add(tela);
      const anello = new T.Mesh(new T.RingGeometry(0.3, 0.36, 28), M('#f2c76e')); anello.rotation.x = -PI / 2; anello.position.y = 0.315; g.add(anello);
    } },
    { id: 'cartello', nome: 'Cartello', prezzo: 30, usa: 'cartello', w: 1.0, d: 0.4, f(g) {
      cil(g, 0.05, 0.06, 1.25, '#7b5037', 0, 0.62, 0, 8); cil(g, 0.22, 0.26, 0.06, '#5c3822', 0, 0.03, 0, 12);
      box(g, 0.95, 0.6, 0.06, '#c98c5b', 0, 1.3, 0.04);
      const [cv, cx] = B.tela(256, 160), tx = B.tex(cv), mat = new T.MeshBasicMaterial({ map: tx });
      const fr = new T.Mesh(new T.PlaneGeometry(0.88, 0.54), mat); fr.position.set(0, 1.3, 0.075); g.add(fr);
      const re = new T.Mesh(new T.PlaneGeometry(0.88, 0.54), mat); re.position.set(0, 1.3, 0.005); re.rotation.y = PI; g.add(re);
      let scritto = null;
      g.userData.anim = () => {
        const t = stato(g).t || 'Benvenuti!'; if (t === scritto) return; scritto = t;
        cx.fillStyle = '#f4e3c3'; cx.fillRect(0, 0, 256, 160); cx.strokeStyle = '#a96f44'; cx.lineWidth = 6; cx.strokeRect(3, 3, 250, 154);
        cx.fillStyle = '#3a2216'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        // va a capo da solo, al massimo tre righe
        let fs = 34, righe = [];
        for (; fs >= 20; fs -= 2) {
          cx.font = '800 ' + fs + 'px system-ui, sans-serif'; righe = []; let r = '';
          t.split(/\s+/).forEach(p => { const prova = r ? r + ' ' + p : p; if (cx.measureText(prova).width > 228 && r) { righe.push(r); r = p; } else r = prova; }); if (r) righe.push(r);
          if (righe.length <= 3 && righe.every(q => cx.measureText(q).width <= 236)) break;
        }
        righe.slice(0, 3).forEach((q, i, l) => cx.fillText(q, 128, 80 + (i - (l.length - 1) / 2) * fs * 1.15));
        tx.needsUpdate = true;
      };
      g.userData.anim();
    } }
  ];
  NUOVI.forEach(a => { if (!B.ARREDI.find(q => q.id === a.id)) B.ARREDI.push(a); });

  // un regalo, una volta sola, per provarli subito (anche chi gioca gia')
  let regalo = false;
  try { if (localStorage.getItem('borg_mobint_v1') !== '1' && B.Eco) { B.Eco.regala('dado'); B.Eco.regala('cartello'); localStorage.setItem('borg_mobint_v1', '1'); regalo = true; } } catch (e) { /* ok */ }

  /* ---------- schermo della TV: tre canali disegnati col canvas ---------- */
  const NOTIZIE = 'TG del Borgo · Aperta la ruota panoramica in piazza · Record di pesca al laghetto · Belinverse 2: nuove carte al negozio TCG · Stasera musica al Belvedere · ';
  function disegnaTv(cx, ch, t) {
    const W = 192, H = 120;
    if (ch === 1) {
      cx.fillStyle = '#1d3a7a'; cx.fillRect(0, 0, W, H); cx.fillStyle = '#c4453b'; cx.fillRect(0, 0, W, 26);
      cx.fillStyle = '#fff'; cx.font = '800 17px system-ui, sans-serif'; cx.textAlign = 'left'; cx.fillText('TG BORGO', 8, 19);
      cx.fillStyle = '#f2c76e'; cx.beginPath(); cx.arc(56, 66, 20, 0, 7); cx.fill(); cx.fillStyle = '#3a2216'; cx.fillRect(36, 86, 40, 14);
      cx.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 3; i++) cx.fillRect(96, 46 + i * 14, 80 - i * 18, 6);
      cx.fillStyle = '#0d1a3a'; cx.fillRect(0, H - 20, W, 20); cx.fillStyle = '#fff'; cx.font = '700 13px system-ui, sans-serif';
      const w = cx.measureText(NOTIZIE).width, x = -((t * 40) % w); cx.fillText(NOTIZIE, x, H - 6); cx.fillText(NOTIZIE, x + w, H - 6);
    } else if (ch === 2) {
      cx.fillStyle = '#8fd3f4'; cx.fillRect(0, 0, W, H); cx.fillStyle = '#69b86f'; cx.fillRect(0, 84, W, 36);
      cx.fillStyle = '#fff'; [[30, 24], [120, 18], [160, 34]].forEach((c, i) => { const x = (c[0] + t * (8 + i * 4)) % (W + 40) - 20; cx.beginPath(); cx.arc(x, c[1], 10, 0, 7); cx.arc(x + 12, c[1] + 2, 8, 0, 7); cx.fill(); });
      const u = Math.abs(Math.sin(t * 3)), bx = 96 + Math.sin(t * 1.3) * 60, by = 80 - u * 52;
      cx.fillStyle = 'rgba(0,0,0,.2)'; cx.beginPath(); cx.ellipse(bx, 86, 14 - u * 5, 4, 0, 0, 7); cx.fill();
      cx.fillStyle = '#e05a6d'; cx.beginPath(); cx.arc(bx, by, 12, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(bx - 4, by - 4, 4, 0, 7); cx.fill();
    } else {
      cx.fillStyle = '#241a30'; cx.fillRect(0, 0, W, H); const col = ['#ff6fae', '#7fe6ff', '#ffd36a', '#9be27f', '#c58bd6'];
      for (let i = 0; i < 12; i++) { const h = 14 + Math.abs(Math.sin(t * (3 + i * 0.7) + i)) * 70; cx.fillStyle = col[i % col.length]; cx.fillRect(10 + i * 14.5, 104 - h, 10, h); }
      cx.fillStyle = '#fff'; cx.font = '800 15px system-ui, sans-serif'; cx.textAlign = 'center'; cx.fillText('♪ BORG MUSIC ♪', W / 2, 20);
    }
  }

  /* ---------- lattina in mano (frigorifero) ---------- */
  let lattina = null, tLattina = 0;
  function bibita() {
    const io = app.io; if (!io.av) return;
    if (!lattina) { lattina = new T.Group(); lattina.add(mesh(new T.CylinderGeometry(0.07, 0.07, 0.2, 12), M(['#e05a6d', '#3b8fe0', '#69b86f'][Math.floor(Math.random() * 3)]), { l: 0.01 })); lattina.add(mesh(new T.CylinderGeometry(0.06, 0.07, 0.02, 12), M('#c8c2d0'), { y: 0.11 })); }
    io.av.root.add(lattina); lattina.position.set(0.26, 0.85, 0.28);
    clearTimeout(tLattina); tLattina = setTimeout(() => { if (lattina && lattina.parent) lattina.parent.remove(lattina); }, 9000);
  }

  /* ---------- finestrelle: cabinato e cartello ---------- */
  const css = document.createElement('style');
  css.textContent = `
#mi-ov{position:fixed;inset:0;z-index:400;display:none;align-items:center;justify-content:center;background:rgba(20,12,30,.55);padding:16px;box-sizing:border-box}
#mi-ov.on{display:flex}
#mi-ov .bx{width:min(340px,100%);border-radius:20px;background:#2f2342;color:#fbf3dc;box-shadow:0 10px 30px rgba(0,0,0,.45);padding:16px;font:600 15px system-ui,sans-serif;text-align:center;display:flex;flex-direction:column;gap:10px}
#mi-ov .bx b{font-size:17px}
#mi-ov button{border:0;border-radius:14px;padding:12px;font:800 15px system-ui,sans-serif;color:#241a33;background:#f2c76e;cursor:pointer}
#mi-ov button.sec{background:rgba(255,255,255,.12);color:#fbf3dc}
#mi-ov input{border:2px solid #f2c76e;border-radius:12px;padding:11px 12px;font:600 16px system-ui,sans-serif;background:#fbf3dc;color:#2a1a2e;outline:none}
#mi-ov small{opacity:.7}`;
  document.head.appendChild(css);
  let ov = null;
  function finestra(html) {
    if (!ov) { ov = document.createElement('div'); ov.id = 'mi-ov'; document.body.appendChild(ov); ov.addEventListener('click', e => { if (e.target === ov) chiudi(); }); }
    ov.innerHTML = '<div class="bx">' + html + '</div>'; ov.classList.add('on'); if (app && app.joy) app.joy.x = app.joy.y = 0;
    return ov.firstChild;
  }
  function chiudi() { if (ov) ov.classList.remove('on'); }
  MI.chiudi = chiudi;
  function cabinato() {
    const bx = finestra('<div style="font-size:30px">🕹️</div><b>A cosa giochi?</b><button data-g="kart">🏎️ Go-Kart</button><button data-g="paintball">🎯 Paintball</button><button data-g="raid">⚔️ La Cripta (raid)</button><button class="sec" data-g="">Annulla</button>');
    bx.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { chiudi(); if (b.dataset.g) app.usaPorta({ gioco: b.dataset.g }); }));
  }
  function scriviCartello(attuale, fatto) {
    const bx = finestra('<div style="font-size:30px">📋</div><b>Cosa scrivi sul cartello?</b><input maxlength="40" enterkeyhint="done"><small>Lo leggono gli amici che vengono a trovarti</small><button>Scrivi</button><button class="sec">Annulla</button>');
    const inp = bx.querySelector('input'), [ok, no] = bx.querySelectorAll('button');
    inp.value = attuale || ''; setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) { /* ok */ } }, 50);
    // il cartello lo leggono gli altri: passa dallo stesso filtro della chat
    const salva = () => {
      const t = pulito(inp.value, 40), r = t && window.FiltroChat ? window.FiltroChat.controlla(t) : { ok: true, testo: t };
      if (!r.ok) { toast(r.avviso); return; }
      inp.blur(); chiudi(); fatto(r.testo || 'Benvenuti!');
    };
    ok.addEventListener('click', salva); inp.addEventListener('keydown', e => { if (e.key === 'Enter') salva(); if (e.key === 'Escape') chiudi(); });
    no.addEventListener('click', () => { inp.blur(); chiudi(); });
  }

  /* ---------- cosa fa ogni tipo di mobile ----------
     testo: la scritta del pulsante; fai: l'azione (ritorna il valore da applicare e mandare agli amici,
     undefined se resta solo a me); applica: cambia il mobile; stato: si salva; valida: per le azioni degli amici */
  const intero = (v, a, b) => (typeof v === 'number' && isFinite(v) ? Math.max(a, Math.min(b, Math.round(v))) : undefined);
  const ATT = {
    luce: {
      testo: m => (m.s.off ? 'Accendi la luce' : 'Spegni la luce'),
      fai: m => (m.s.off ? 0 : 1),
      applica(st, m, v) {
        if (v) m.s.off = 1; else delete m.s.off;
        const L = st.m.lampade, i = L.indexOf(m.lampada);
        if (v && i >= 0) L.splice(i, 1); if (!v && i < 0 && m.lampada) L.push(m.lampada);
        luceVista(m); if (app.stanza() === st && app.assegnaLuci) app.assegnaLuci(); sfx('pop', 0.5);
      },
      stato: true, valida: v => (v ? 1 : 0)
    },
    dado: {
      testo: () => 'Lancia il dado',
      fai: () => 1 + Math.floor(Math.random() * 6),
      applica(st, m, v, daRete) {
        m.s.v = v; m.g.userData.lancio = { t0: ora(), yaw: Math.random() * PI * 2 }; sfx('colpo', 0.4);
        if (!daRete) setTimeout(() => app.mostraBolla(app.io, '🎲 ' + v, 3.5), 900);
      },
      bolla: v => ({ testo: '🎲 ' + v, dopo: 0.9 }),
      stato: true, valida: v => intero(v, 1, 6)
    },
    tele: {
      testo: () => 'Teletrasportati',
      fai(m, st) {
        const io = app.io, tutti = st.pezzi.filter(q => q.a.usa === 'tele');
        if (tutti.length < 2) { toast('Ti serve un secondo teletrasporto: mettine due nella stanza'); return; }
        if (Math.hypot(io.x - m.x, io.z - m.z) > 1.4) { toast('Sali sul teletrasporto per usarlo'); return; }
        const dove = tutti[(tutti.indexOf(m) + 1) % tutti.length];
        m.g.userData.lampo = dove.g.userData.lampo = ora(); sfx('pop', 0.8);
        setTimeout(() => { io.x = dove.x; io.z = dove.z; io.y = dove.y; io.vx = io.vz = 0; sfx('pop', 0.8); }, 350);
      }
    },
    juke: {
      testo: m => (!m.s.j ? 'Accendi il jukebox' : m.s.j === 1 ? 'Cambia disco' : 'Spegni il jukebox'),
      fai: m => ((m.s.j | 0) >= 2 ? 0 : (m.s.j | 0) + 1),
      applica(st, m, v, daRete) {
        if (v) m.s.j = v; else delete m.s.j; musica();
        if (daRete) return;
        if (v && B.Audio && B.Audio.musicaMuta && B.Audio.musicaMuta()) toast('Il jukebox suona: accendi la musica 🎵 per sentirlo');
        else toast(v === 1 ? '🎵 Disco: Borgo Disco' : v === 2 ? '🎵 Disco: Sera al Belvedere' : 'Jukebox spento');
      },
      stato: true, valida: v => intero(v, 0, 2)
    },
    frigo: {
      testo: () => 'Prendi una bibita',
      fai: () => 1,
      applica(st, m, v, daRete) { m.g.userData.apri = ora(); if (!daRete) { setTimeout(() => { bibita(); app.mostraBolla(app.io, '🥤 Glu glu!', 3); sfx('pop', 0.6); }, 500); } },
      bolla: () => ({ testo: '🥤 Glu glu!', dopo: 0.5 }),
      valida: () => 1
    },
    tv: {
      testo: m => (!m.s.tv ? 'Accendi la TV' : m.s.tv < 3 ? 'Cambia canale' : 'Spegni la TV'),
      fai: m => ((m.s.tv | 0) + 1) % 4,
      applica(st, m, v) { if (v) m.s.tv = v; else delete m.s.tv; sfx('pop', 0.4); },
      stato: true, valida: v => intero(v, 0, 3)
    },
    arcade: { testo: () => 'Gioca al cabinato', fai() { cabinato(); } },
    salto: { testo: () => 'Salta!', fai() { toast('Salici sopra e rimbalzi! 🤸'); } },
    cartello: {
      testo: (m, st) => (st.id === 'casa' ? 'Scrivi sul cartello' : 'Leggi il cartello'),
      fai(m, st) {
        if (st.id !== 'casa') { toast('📋 ' + (m.s.t || 'Benvenuti!')); return; }
        scriviCartello(m.s.t, t => esegui(st, m, t));
      },
      applica(st, m, v) { m.s.t = v; },
      stato: true, valida: (v, st, nick) => (st.id === 'ospite' && String(nick).toLowerCase() === String(st.ospite).toLowerCase() ? cartelloPulito(pulito(v, 40)) : undefined)
    }
  };

  const cartelloPulito = t => (t && window.FiltroChat ? window.FiltroChat.ricevuto(t) : t) || 'Benvenuti!';
  function luceVista(m) {
    const p = m.g.userData.paralume; if (!p) return; const mt = p.material;
    if (!p.userData.col) p.userData.col = mt.color.getHex();
    mt.color.setHex(m.s.off ? 0x8f8577 : p.userData.col); if (mt.emissive) { if (p.userData.em === undefined) p.userData.em = mt.emissive.getHex(); mt.emissive.setHex(m.s.off ? 0x000000 : p.userData.em); }
  }
  function musica() {
    if (!app || !B.Audio || !B.Audio.jukebox) return;
    const st = app.stanza(); let j = 0;
    if (st && st.pezzi && (st.id === 'casa' || st.id === 'ospite')) st.pezzi.forEach(m => { if (m.a.usa === 'juke' && m.s.j > j) j = m.s.j; });
    B.Audio.jukebox(j);
  }

  /* ---------- collegare un mobile posato alla sua stanza ---------- */
  MI.collega = function (st, m) {
    const a = m.a, A = ATT[a.usa]; if (!A) return;
    const h = a.pad ? 0.5 : 1.6, p = new T.Mesh(new T.BoxGeometry(a.w, h, a.d), new T.MeshBasicMaterial()); p.visible = false; p.position.y = h / 2; m.g.add(p);
    const az = { fn: () => usa(st, m), nome: a.nome }; Object.defineProperty(az, 'testo', { get: () => A.testo(m, st) });
    const tc = { obj: p, tipo: 'mobile', fn: az.fn }; st.toccabili.push(tc); m.refs = [[st.toccabili, tc]];
    if (a.usa !== 'salto') {     // vicino al mobile compare il pulsante (sul teletrasporto ci devi salire)
      const sd = { x: m.x, z: m.z, y: m.y, yt: m.y, r: a.pad ? a.w / 2 : Math.max(a.w, a.d) / 2 + 0.9, usa: true, azione: az };
      st.sedili.push(sd); m.refs.push([st.sedili, sd]);
    }
    if (a.usa === 'luce') {
      luceVista(m);
      // le luci delle case si riaccendono la sera (atmosfera): una lampada spenta resta spenta
      const p2 = m.g.userData.paralume; m.g.userData.anim = () => { if (m.s.off && p2) p2.material.emissiveIntensity = 0.04; };
    }
    if (a.usa === 'tv') {
      const sc = m.g.userData.schermo; let cv = null, cx = null, tx = null, ult = 0, acceso = -1;
      m.g.userData.anim = () => {
        const ch = m.s.tv | 0;
        if (ch !== acceso) { acceso = ch; if (ch && !cv) { [cv, cx] = B.tela(192, 120); tx = B.tex(cv); } sc.material.map = ch ? tx : null; sc.material.color.setHex(ch ? 0xffffff : 0x1c2230); sc.material.needsUpdate = true; ult = 0; }
        if (!ch) return; const t = ora(); if (t - ult < 0.08) return; ult = t; disegnaTv(cx, ch, t); tx.needsUpdate = true;
      };
    }
  };
  MI.scollega = function (st, m) {
    (m.refs || []).forEach(r => { const i = r[0].indexOf(r[1]); if (i >= 0) r[0].splice(i, 1); });
    m.refs = null; if (m.a.usa === 'juke' && m.s.j) setTimeout(musica, 0);
  };
  const indice = (st, m) => (st.id === 'casa' ? st.pezzi.indexOf(m) : m.i);
  function esegui(st, m, v) {
    const k = m.a.usa, A = ATT[k];
    if (A.applica) A.applica(st, m, v, false);
    if (A.stato && st.id === 'casa' && B.Arredo.salva) B.Arredo.salva();
    if (A.valida && MI.rete) MI.rete({ i: indice(st, m), id: m.id, k, v });
    if (app.portaVicina) app.G.emetti('porta', app.portaVicina());    // il pulsante cambia scritta (Accendi / Spegni...)
  }
  function usa(st, m) {
    if (B.Arredo.attivo || !st.pezzi || st.pezzi.indexOf(m) < 0) return;
    const v = ATT[m.a.usa].fai(m, st); if (v !== undefined) esegui(st, m, v);
  }
  // l'azione di un amico che e' nella stessa casa (ritorna il fumetto da mostrare sul suo avatar)
  MI.daRete = function (e, nick) {
    const st = app && app.stanza(); if (!st || !st.pezzi || (st.id !== 'casa' && st.id !== 'ospite')) return null;
    const m = st.id === 'casa' ? st.pezzi[e.i] : st.pezzi.find(q => q.i === e.i);
    const A = ATT[e.k]; if (!m || m.id !== e.id || m.a.usa !== e.k || !A || !A.valida) return null;
    const v = A.valida(e.v, st, nick); if (v === undefined) return null;
    A.applica(st, m, v, true);
    if (A.stato && st.id === 'casa' && B.Arredo.salva) B.Arredo.salva();
    if (app.portaVicina) app.G.emetti('porta', app.portaVicina());
    return A.bolla ? A.bolla(v) : null;
  };
  // stato salvato con il mobile (anche quello che arriva da un amico): solo valori conosciuti
  MI.statoDa = function (s) {
    const o = {}; if (!s || typeof s !== 'object') return o;
    if (s.off) o.off = 1; const v = intero(s.v, 1, 6); if (v) o.v = v; const j = intero(s.j, 0, 2); if (j) o.j = j; const tv = intero(s.tv, 0, 3); if (tv) o.tv = tv;
    if (typeof s.t === 'string') { const t = pulito(s.t, 40); if (t) o.t = t; }
    return o;
  };
  MI.stanza = function (st) { if (app && st === app.stanza()) musica(); if (st && st.id !== 'casa' && st.id !== 'ospite') chiudi(); };
  MI.init = function (a) {
    app = a;
    if (regalo) app.G.su('avvio', () => setTimeout(() => toast('🎁 Regalo: un Dado gigante e un Cartello! Ad Arredamenti ci sono mobili nuovi che si usano'), 4500));
  };
})();
