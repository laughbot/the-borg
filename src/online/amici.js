/* =====================================================================
   ONLINE CON GLI AMICI
   Chi ha il link di The Borg aperto nello stesso momento si vede: avatar,
   posizione, emote e messaggi della chat passano dalla "stanza" del link
   (capacita' room di claude.ai). Tutto viaggia nella presenza di ognuno
   (niente argomenti riservati: va bene anche per chi puo' solo guardare).
   Fuori da claude.ai si gioca con un codice nel link (?amici=CODICE):
   i telefoni si collegano tra loro (PeerJS, lib/peerjs.min.js); il primo
   arrivato fa da padrone di casa e gira a tutti la presenza degli altri.
   Nei minigiochi (kart, paintball, raid, carte) la presenza porta anche lo stato di
   gioco (k = B.Kart/Paintball/Raid/Belinverse.rete()): chi gioca nello stesso momento
   gioca con gli altri.
   Con un server di gioco (?server= o B3.SERVER) la stanza del codice vive sul
   server Nakama (B3.stanzaNakama, cartella server/ del repo) al posto di PeerJS.
   Senza codice e fuori da claude.ai non cambia niente.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, G = window.Gioco, PI = Math.PI;
  const CODICE = (new URLSearchParams(location.search).get('amici') || (location.hash.match(/amici=([^&]+)/) || [])[1] || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
  // server di gioco Nakama: ?server=host:porta per le prove, poi B3.SERVER quando c'e' quello vero; senza, si resta su PeerJS
  const SERVER = (new URLSearchParams(location.search).get('server') || B.SERVER || '').trim();
  if (!B.app || !(CODICE ? (SERVER ? B.stanzaNakama : window.Peer) : window.claude && window.claude.use)) return;
  const app = B.app, amici = new Map();   // peer -> amico
  const angDiff = (a, b) => { let d = (b - a) % (2 * PI); if (d > PI) d -= 2 * PI; if (d < -PI) d += 2 * PI; return d; };
  const testo = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯]/g, '').slice(0, n);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const LOOK = ['pelle', 'stile', 'capelli', 'occhi', 'giacca', 'dettagli', 'abito', 'pantaloni', 'stivali', 'accessorio'];
  const lookDa = l => { const o = {}; LOOK.forEach(k => { o[k] = Math.max(0, Math.min(40, Math.round(num(l && l[k], 0)))); }); return o; };
  // minigiochi online: ognuno da' il suo stato (rete) e riceve quello degli amici (amico)
  const GIOCHI = { kart: () => B.Kart, paintball: () => B.Paintball, raid: () => B.Raid, carte: () => B.Belinverse };
  const aiGiochi = (peer, nick, pr) => Object.keys(GIOCHI).forEach(n => { const m = GIOCHI[n](); if (m && m.amico) m.amico(peer, nick, pr && pr.s === n ? pr.k : null, pr ? lookDa(pr.look) : null); });
  let room = null, nMsg = 0, nEm = 0, ultimo = '', tInvio = 0, nInvio = 0, prec = null;

  /* ---------- dove sono: le stanze pubbliche per nome, le case come "casa:<proprietario>" ---------- */
  const mioNick = () => (G.stato.giocatore && G.stato.giocatore.nick) || '';
  function luogo() {
    const st = app.stanza();
    if (st.id === 'casa') return 'casa:' + mioNick();
    if (st.id === 'ospite') return 'casa:' + st.ospite;
    return st.pubblica ? st.id : 'casa';
  }
  const stessoLuogo = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

  /* ---------- quello che mando io ---------- */
  function mia() {
    const io = app.io, st = app.stanza(), gioco = G.stato.giocatore;
    if (!gioco || !io.av) return null;
    const dove = (B.Raid && B.Raid.attivo) ? 'raid' : (B.Paintball && B.Paintball.attivo) ? 'paintball' : (B.Kart && B.Kart.attivo) ? 'kart' : (B.Belinverse && B.Belinverse.attivo) ? 'carte' : luogo();
    return { v: 1, nick: testo(gioco.nick, 20), look: lookDa(gioco.look), s: dove, x: +io.x.toFixed(2), z: +io.z.toFixed(2), y: +io.y.toFixed(2), r: +io.yaw.toFixed(2),
      vel: +Math.hypot(io.vx, io.vz).toFixed(2), sed: io.seduto ? (io.seduto.dorme ? 2 : 1) : 0, bk: io.bici ? 1 : 0, k: GIOCHI[dove] && GIOCHI[dove]().rete ? GIOCHI[dove]().rete() : null,
      mc: B.Mercato && B.Mercato.annunciRete ? B.Mercato.annunciRete() : null, mo: mieiMo.length ? { l: mieiMo } : undefined };
  }
  // q = numero progressivo (chi riceve scarta gli aggiornamenti vecchi arrivati in ritardo),
  // t = il mio orologio in ms e vx/vz = la velocita' vera tra un invio e l'altro: chi mi vede
  // ricostruisce il percorso senza scatti e, se un aggiornamento tarda, mi fa proseguire nella stessa direzione
  function invia(extra) {
    if (!room) return; const p = mia(); if (!p) return;
    const k = JSON.stringify(p);
    if (k === ultimo && !extra) return; ultimo = k;
    const ora = performance.now();
    let vx = 0, vz = 0;
    if (prec && ora - prec.t > 20 && ora - prec.t < 400) { vx = (app.io.x - prec.x) / (ora - prec.t) * 1000; vz = (app.io.z - prec.z) / (ora - prec.t) * 1000; if (Math.hypot(vx, vz) > 20) vx = vz = 0; }
    prec = { t: ora, x: app.io.x, z: app.io.z };
    p.vx = +vx.toFixed(2); p.vz = +vz.toFixed(2); p.q = ++nInvio; p.t = Math.round(ora);
    room.presence(Object.assign(p, extra || {})).catch(() => { });
  }

  /* ---------- gli amici ---------- */
  function crea(peer, pr) {
    // come gli abitanti: pezzi uniti e niente ombra, se no ogni amico pesa sul telefono quanto mezza piazza
    const look = lookDa(pr.look), av = B.unisciAvatar ? B.unisciAvatar(B.creaAvatar(look)) : B.creaAvatar(look);
    av.root.traverse(q => { if (q.isMesh) { q.castShadow = false; q.receiveShadow = false; } });
    const nick = testo(pr.nick, 20) || 'Amico';
    const et = B.etichetta(nick, { sfondo: '#7fd6a4', colore: '#163322', altezza: 0.38 }); et.position.y = 2.52; av.root.add(et);
    app.scene.add(av.root);
    const a = { peer, av, nick, lookK: JSON.stringify(look), x: num(pr.x, 0), z: num(pr.z, 0), y: num(pr.y, 0), r: num(pr.r, 0), vel: 0, bolla: null, durBolla: 0, nMsg: pr.msg ? pr.msg.n : 0, nEm: pr.em ? pr.em.n : 0, nDm: maxDm(pr), nEv: maxN(pr.ev), nMo: maxN(pr.mo), pr, q: null, off: null, buf: [], bk: null, vis: false };
    noti.set(nick.toLowerCase(), { nick, look });
    amici.set(peer, a); return a;
  }
  function togli(peer) { aiGiochi(peer, null, null); const a = amici.get(peer); if (!a) return; bici(a, false); app.scene.remove(a.av.root); B.liberaAvatar(a.av); amici.delete(peer); }
  // la bici dell'amico: la stessa che usa lui, montata sotto il suo avatar
  function bici(a, on) {
    if (on && !a.bk && app.creaBici) { a.bk = app.creaBici(); a.av.root.add(a.bk); }
    else if (!on && a.bk) { a.av.root.remove(a.bk); a.bk.traverse(q => { if (q.isMesh) { q.geometry.dispose(); q.material.dispose(); } }); a.bk = null; }
    a.av.bicT = on ? 1 : 0;
  }
  /* ---------- il percorso dell'amico ----------
     Ogni aggiornamento diventa un punto (con l'ora di chi lo manda, riportata sul mio orologio);
     l'avatar viene mostrato un attimo indietro nel tempo (RITARDO), cosi' c'e' quasi sempre un punto
     prima e uno dopo e il movimento resta continuo anche se la rete arriva a singhiozzo.
     Se i punti finiscono, l'amico prosegue per poco nella sua direzione invece di fermarsi. */
  const RITARDO = 0.2, AVANTI = 0.4;
  function punto(a, pr) {
    const ora = performance.now() / 1000, tm = typeof pr.t === 'number' ? pr.t / 1000 : null;
    let t = ora;
    if (tm != null) { const o = ora - tm; a.off = a.off == null || o < a.off || o - a.off > 3 ? o : a.off + (o - a.off) * 0.01; t = tm + a.off; }
    const p = { t, x: num(pr.x, a.x), z: num(pr.z, a.z), y: num(pr.y, a.y), r: num(pr.r, a.r), vx: num(pr.vx, 0), vz: num(pr.vz, 0) }, b = a.buf, u = b[b.length - 1];
    if (u && (p.t <= u.t || Math.hypot(p.x - u.x, p.z - u.z) > 6)) b.length = 0;   // salto (porta, teletrasporto) o orologio ripartito: si riparte da qui
    else if (u && p.t - u.t > 0.25) b.push(Object.assign({}, u, { t: p.t - 0.1, vx: 0, vz: 0 }));   // era fermo: riparte da li', non scivola dal punto vecchio
    b.push(p); if (b.length > 30) b.splice(0, b.length - 30);
  }
  function dove(a, ora) {
    const b = a.buf, rt = ora - RITARDO;
    if (!b.length) return null;
    while (b.length > 2 && b[1].t <= rt) b.shift();
    const p0 = b[0];
    if (rt <= p0.t) return { x: p0.x, z: p0.z, y: p0.y, r: p0.r, v: Math.hypot(p0.vx, p0.vz) };
    if (b.length > 1 && rt <= b[1].t) {
      const p1 = b[1], f = (rt - p0.t) / Math.max(0.001, p1.t - p0.t);
      return { x: p0.x + (p1.x - p0.x) * f, z: p0.z + (p1.z - p0.z) * f, y: p0.y + (p1.y - p0.y) * f, r: p0.r + angDiff(p0.r, p1.r) * f, v: Math.hypot(p1.x - p0.x, p1.z - p0.z) / Math.max(0.001, p1.t - p0.t) };
    }
    const u = b[b.length - 1], e = Math.min(AVANTI, rt - u.t), v = Math.hypot(u.vx, u.vz);
    return { x: u.x + u.vx * e, z: u.z + u.vz * e, y: u.y, r: u.r, v: rt - u.t < AVANTI ? v : 0 };
  }
  function aggiorna(peer, pr) {
    if (!pr || pr.v !== 1) return;
    let a = amici.get(peer);
    // arrivato in ritardo dopo uno piu' nuovo: si butta (ogni aggiornamento contiene gia' tutto)
    if (a && a.q != null && typeof pr.q === 'number' && pr.q <= a.q && !(typeof pr.t === 'number' && pr.t < a.tm - 2000)) return;   // t molto piu' piccolo: ha ricaricato la pagina
    if (a && (JSON.stringify(lookDa(pr.look)) !== a.lookK || (testo(pr.nick, 20) || 'Amico') !== a.nick)) { const vecchio = a; togli(peer); a = crea(peer, pr); a.nMsg = vecchio.nMsg; a.nEm = vecchio.nEm; a.nDm = vecchio.nDm; a.nEv = vecchio.nEv; a.nMo = vecchio.nMo; }
    if (!a) {
      a = crea(peer, pr);
      if (G.stato.giocatore) G.emetti('toast', a.nick + ' è online');
    }
    a.pr = pr; if (typeof pr.q === 'number') { a.q = pr.q; a.tm = num(pr.t, 0); }
    punto(a, pr);
    aiGiochi(peer, a.nick, pr);   // nei minigiochi: il suo stato di gioco
    // messaggio nuovo in chat: entra nella chat pubblica e appare nel fumetto
    if (pr.msg && pr.msg.n !== a.nMsg) {
      a.nMsg = pr.msg.n; const t = testo(pr.msg.t, 120);
      if (t && stessoLuogo(pr.s, luogo())) {
        const d = new Date(), voce = { id: idAmico(a.nick), nick: a.nick, testo: t, ora: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), io: false, amico: true };
        G.stato.chat.push(voce); if (G.stato.chat.length > 80) G.stato.chat.shift(); G.emetti('chat', voce);
        bolla(a, t, 4.5);
      }
    }
    riceviDm(a, pr); riceviEv(a, pr); riceviMo(a, pr);
    const mcK = JSON.stringify(pr.mc || null); if (mcK !== a.mcK) { a.mcK = mcK; G.emetti('annunci'); }
    if (pr.em && pr.em.n !== a.nEm) { a.nEm = pr.em.n; const e = EMOTE[pr.em.t]; if (e) { a.av.faiEmote(pr.em.t, e[1]); bolla(a, e[0], e[1] + 0.4); } }
  }
  const EMOTE = { saluta: ['Ciao!', 3], balla: ['♪', 5], ridi: ['Ahah!', 3], applaudi: ['Bravo!', 4], evviva: ['Evviva!', 3] };
  const viaBolla = (r, b) => { r.remove(b); if (b.material) { if (b.material.map) b.material.map.dispose(); b.material.dispose(); } };
  function bolla(a, t, sec) { if (a.bolla) viaBolla(a.av.root, a.bolla); a.bolla = B.fumetto(t); a.bolla.position.y = 3.05; a.av.root.add(a.bolla); a.durBolla = sec; }

  /* ---------- ogni fotogramma: seguono la loro posizione, si vedono solo nella tua stessa stanza ---------- */
  let prima = performance.now(), tBadge = 0;
  function ciclo() {
    requestAnimationFrame(ciclo);
    const ora = performance.now(), dt = Math.min(0.05, (ora - prima) / 1000); prima = ora;
    if (!app.gioco()) return;
    tInvio -= dt; if (tInvio <= 0) { tInvio = Object.keys(GIOCHI).some(n => GIOCHI[n]() && GIOCHI[n]().attivo) ? 0.066 : 0.1; invia(); }
    const libero = !(B.Raid && B.Raid.attivo) && !(B.Paintball && B.Paintball.attivo) && !(B.Kart && B.Kart.attivo), qui = luogo();
    amici.forEach(a => {
      const pr = a.pr, vis = libero && qui !== 'casa' && stessoLuogo(pr.s, qui);
      a.av.root.visible = vis;
      if (!vis) { a.vis = false; return; }
      const d = dove(a, ora / 1000) || { x: num(pr.x, a.x), z: num(pr.z, a.z), y: num(pr.y, a.y), r: num(pr.r, a.r), v: 0 };
      // appena ricompare (o dopo un salto) va subito al suo posto; altrimenti piccole correzioni morbide
      if (!a.vis || Math.hypot(d.x - a.x, d.z - a.z) > 6) { a.x = d.x; a.z = d.z; a.y = d.y; a.r = d.r; }
      else { const k = Math.min(1, dt * 25); a.x += (d.x - a.x) * k; a.z += (d.z - a.z) * k; a.y += (d.y - a.y) * Math.min(1, dt * 14); a.r += angDiff(a.r, d.r) * Math.min(1, dt * 14); }
      a.vis = true;
      const bk = pr.bk === 1 && !pr.sed; if (bk !== !!a.bk) bici(a, bk);
      const vel = pr.sed ? 0 : Math.min(14, typeof pr.vx === 'number' ? d.v : num(pr.vel, 0));
      a.av.sedT = pr.sed === 1 ? 1 : 0; a.av.sdrT = pr.sed === 2 ? 1 : 0; a.av.root.rotation.order = 'YXZ'; a.av.root.rotation.x = -PI / 2 * a.av.sdr;
      a.av.root.position.set(a.x, a.y, a.z); a.av.root.rotation.y = a.r;
      a.av.aggiorna(dt, vel, ora / 1000);
      if (a.bk) { a.bk.userData.ruote.forEach(r => { r.rotation.x += vel * dt / 0.27; }); a.bk.userData.pedali.rotation.x = -a.av.fb; }
      if (a.bolla) { a.durBolla -= dt; if (a.durBolla <= 0) { viaBolla(a.av.root, a.bolla); a.bolla = null; } }
    });
    tBadge -= dt; if (tBadge <= 0) { tBadge = 0.5; badge(amici.size); }
  }

  /* ---------- quanti amici sono online ---------- */
  let elB = null;
  function badge(n) {
    if (!elB) {
      elB = document.createElement('div'); elB.id = 'online-amici';
      elB.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top, 0px) + 58px);z-index:30;padding:4px 10px;border-radius:999px;background:rgba(22,51,34,.82);color:#c9f5da;font:600 12px system-ui,sans-serif;pointer-events:none;display:none';
      (document.getElementById('app') || document.body).appendChild(elB);
    }
    const mostra = n > 0 && app.gioco() && !(B.Raid && B.Raid.attivo) && !(B.Paintball && B.Paintball.attivo) && !(B.Kart && B.Kart.attivo);
    elB.style.display = mostra ? '' : 'none';
    if (mostra) elB.textContent = '● ' + (n === 1 ? '1 amico online' : n + ' amici online');
  }

  /* ---------- messaggi privati tra amici veri ----------
     Viaggiano nella presenza come la chat (ultimi 3, con il nick del destinatario):
     li vedono passare tutti i telefoni della stanza, ma li mostra solo chi ha quel nick. */
  const noti = new Map();   // nick minuscolo -> { nick, look }: la scheda resta anche se l'amico esce
  let nDm = 0, mieiDm = [];
  const maxN = x => (x && Array.isArray(x.l) ? x.l.reduce((m, e) => Math.max(m, num(e && e.n, 0)), 0) : 0);
  const maxDm = pr => maxN(pr && pr.dm);
  const idAmico = nick => 'amico:' + nick;
  const amicoDa = id => { if (typeof id !== 'string' || id.indexOf('amico:') !== 0) return null; const k = id.slice(6).toLowerCase(); for (const a of amici.values()) if (a.nick.toLowerCase() === k) return a; return null; };
  function riceviDm(a, pr) {
    if (!pr.dm || !Array.isArray(pr.dm.l)) return;
    const mio = ((G.stato.giocatore && G.stato.giocatore.nick) || '').toLowerCase();
    pr.dm.l.slice(-3).forEach(e => {
      if (!e || num(e.n, 0) <= a.nDm) return;
      a.nDm = num(e.n, 0);
      const t = testo(e.t, 200), id = idAmico(a.nick);
      if (!t || !mio || testo(e.a, 20).toLowerCase() !== mio || G.stato.bloccati.has(id)) return;
      const d = new Date(), c = G.conversazione(id);
      c.msgs.push({ da: id, testo: t, ora: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') });
      if (G.stato.dmAperto !== id) { c.nonLetti++; G.emetti('toast', 'Nuovo messaggio da ' + a.nick); }
      G.emetti('dm', { id });
    });
  }
  const NOMI = { piazza: 'In piazza', raid: 'Nel raid', paintball: 'A paintball', kart: 'Sui kart', carte: 'A Belinverse', casa: 'A casa sua' };
  const utenteOrig = G.utente, inviaOrig = G.inviaDM;
  G.utente = function (id) {
    if (typeof id !== 'string' || id.indexOf('amico:') !== 0) return utenteOrig(id);
    const a = amicoDa(id), n = noti.get(id.slice(6).toLowerCase()) || { nick: id.slice(6), look: {} };
    const s = a ? String(a.pr.s || '') : '', st = a && B.app.stanze && B.app.stanze[s];
    const casaDi = s.indexOf('casa:') === 0 ? s.slice(5) : null;
    return { id, nick: a ? a.nick : n.nick, look: a ? lookDa(a.pr.look) : n.look, online: !!a, amico: true,
      dove: !a ? 'Non in linea' : casaDi ? (stessoLuogo(casaDi, a.nick) ? 'A casa sua' : stessoLuogo(casaDi, mioNick()) ? 'A casa tua' : 'A casa di ' + testo(casaDi, 20)) : (NOMI[s] || (st && st.nome ? 'In ' + st.nome : 'Nel borgo')), bio: 'Collegato con il vostro codice amici: i messaggi privati arrivano davvero.' };
  };
  G.inviaDM = function (id, t) {
    if (typeof id !== 'string' || id.indexOf('amico:') !== 0) return inviaOrig(id, t);
    t = (t || '').trim().slice(0, 200);
    if (!t) return false;
    if (G.stato.bloccati.has(id)) { G.emetti('toast', 'Hai bloccato questo utente'); return false; }
    const a = amicoDa(id);
    if (!a) { G.emetti('toast', G.utente(id).nick + ' non è online: il messaggio non può arrivare'); return false; }
    const d = new Date();
    G.conversazione(id).msgs.push({ da: 'io', testo: t, ora: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') });
    G.emetti('dm', { id });
    nDm++; mieiDm = mieiDm.concat({ n: nDm, a: a.nick, t }).slice(-3);
    invia({ dm: { l: mieiDm } });
    return true;
  };
  /* ---------- visite in casa con il campanello (come Habbo) e "Raggiungi" ----------
     Eventi nella presenza (ultimi 3): bussa -> il padrone vede "Apri / Non ora";
     apri porta con se' la casa (livello, stili e mobili) e sparisce dopo qualche secondo. */
  let nEv = 0, mieiEv = [], bussato = null, tBussa = 0;
  function evento(e) {
    nEv++; mieiEv = mieiEv.concat(Object.assign({ n: nEv }, e)).slice(-3);
    invia({ ev: { l: mieiEv } });
    if (e.c) setTimeout(() => { mieiEv = mieiEv.map(x => (x.c ? { n: x.n, k: x.k, a: x.a } : x)); invia({ ev: { l: mieiEv } }); }, 8000);
  }
  function datiCasa() {
    const E = B.Eco && B.Eco.stato, r = v => Math.round(v * 100) / 100;
    if (!E) return { liv: 0, stili: null, p: [] };
    let p = (E.piazzati || []).slice(0, 80).map(q => { const o = [q.id, r(q.x), r(q.z), r(q.rot || 0), r(q.y || 0)]; if (q.s && Object.keys(q.s).length) o.push(q.s); return o; });
    while (p.length && JSON.stringify(p).length > 2200) p = p.slice(0, -1);   // la presenza deve restare piccola
    return { liv: E.liv | 0, stili: { pav: E.stili.pav, par: E.stili.par }, p };
  }
  let elPorta = null;
  function campanello(a) {
    if (elPorta) elPorta.remove();
    const d = elPorta = document.createElement('div');
    d.style.cssText = 'position:absolute;left:50%;top:calc(env(safe-area-inset-top, 0px) + 92px);transform:translateX(-50%);z-index:60;width:min(330px,calc(100% - 32px));padding:14px 16px;border-radius:18px;background:#2f2342;color:#fbf3dc;box-shadow:0 10px 30px rgba(0,0,0,.45);font:600 15px system-ui,sans-serif;text-align:center';
    d.innerHTML = '<div style="font-size:26px">🔔</div><div style="margin:4px 0 12px"></div><div style="display:flex;gap:10px"><button type="button" style="flex:1;padding:11px;border-radius:14px;background:#f2c76e;color:#241a33;font-weight:800">Apri</button><button type="button" style="flex:1;padding:11px;border-radius:14px;background:rgba(255,255,255,.12);color:#fbf3dc;font-weight:700">Non ora</button></div>';
    d.children[1].textContent = a.nick + ' bussa alla porta di casa tua';
    const [si, no] = d.querySelectorAll('button'), chiudi = () => { clearTimeout(tt); if (elPorta === d) elPorta = null; d.remove(); };
    const nick = a.nick, tt = setTimeout(() => { chiudi(); evento({ k: 'no', a: nick }); }, 25000);
    si.addEventListener('click', () => { chiudi(); evento({ k: 'apri', a: nick, c: datiCasa() }); G.emetti('toast', 'Hai aperto la porta a ' + nick); });
    no.addEventListener('click', () => { chiudi(); evento({ k: 'no', a: nick }); });
    (document.getElementById('app') || document.body).appendChild(d);
  }
  function entraDa(a, c) {
    const st = app.casaOspite({ nick: a.nick, liv: num(c.liv, 0), stili: c.stili && typeof c.stili === 'object' ? { pav: testo(c.stili.pav, 30), par: testo(c.stili.par, 30) } : null, p: Array.isArray(c.p) ? c.p : [] });
    G.emetti('transizione', () => { app.entraStanza('ospite'); G.emetti('toast', 'Sei a casa di ' + a.nick + '. Per uscire usa la porta in fondo.'); });
    return st;
  }
  function riceviEv(a, pr) {
    if (!pr.ev || !Array.isArray(pr.ev.l)) return;
    const mio = mioNick().toLowerCase();
    pr.ev.l.slice(-3).forEach(e => {
      if (!e || num(e.n, 0) <= a.nEv) return;
      a.nEv = num(e.n, 0);
      if (!mio || testo(e.a, 20).toLowerCase() !== mio || G.stato.bloccati.has(idAmico(a.nick))) return;
      if (e.k === 'bussa') campanello(a);
      else if (bussato && stessoLuogo(bussato, a.nick) && e.k === 'apri' && e.c && typeof e.c === 'object') { bussato = null; entraDa(a, e.c); }
      else if (bussato && stessoLuogo(bussato, a.nick) && e.k === 'no') { bussato = null; G.emetti('toast', a.nick + ' non ha aperto la porta'); }
      else if (e.k === 'compra') { const ok = !!(B.Mercato && B.Mercato.vendutoA(num(e.i, 0), testo(e.id, 4), num(e.p, 0), a.nick)); evento({ k: ok ? 'venduto' : 'esaurito', a: a.nick, i: num(e.i, 0) }); }
      else if (e.k === 'venduto' || e.k === 'esaurito') esitoAcquisto(a.nick, num(e.i, 0), e.k === 'venduto');
    });
  }
  function bussa(a) {
    if (bussato && stessoLuogo(bussato, a.nick) && performance.now() - tBussa < 8000) { G.emetti('toast', 'Hai già bussato, aspetta che ' + a.nick + ' apra'); return; }
    bussato = a.nick; tBussa = performance.now();
    evento({ k: 'bussa', a: a.nick });
    G.emetti('toast', 'Hai bussato a casa di ' + a.nick + '. Aspetta che ti apra…');
  }
  /* ---------- mobili interattivi: chi e' nella stessa casa vede luci, dado, jukebox, TV, cartello ----------
     Le ultime 3 azioni restano nella presenza (mo), cosi' arrivano anche se un aggiornamento si perde. */
  let nMo = 0, mieiMo = [];
  if (B.MobInt) B.MobInt.rete = e => { nMo++; mieiMo = mieiMo.concat(Object.assign({ n: nMo }, e)).slice(-3); invia(); };
  function riceviMo(a, pr) {
    if (!pr.mo || !Array.isArray(pr.mo.l) || !B.MobInt) return;
    pr.mo.l.slice(-3).forEach(e => {
      if (!e || num(e.n, 0) <= a.nMo) return;
      a.nMo = num(e.n, 0);
      if (!stessoLuogo(pr.s, luogo()) || G.stato.bloccati.has(idAmico(a.nick))) return;
      const b = B.MobInt.daRete({ i: num(e.i, -1), id: testo(e.id, 16), k: testo(e.k, 10), v: typeof e.v === 'string' ? testo(e.v, 40) : num(e.v, 0) }, a.nick);
      if (b && b.testo) setTimeout(() => { if (amici.get(a.peer) === a) bolla(a, b.testo, 3.5); }, (b.dopo || 0) * 1000);
    });
  }
  /* ---------- carte di Belinverse in vendita tra amici (banco Belinverse TCG del mercatino) ----------
     Chi vende tiene i suoi annunci nella presenza (mc: [[n, carta, prezzo]]). Chi compra paga subito
     e manda l'evento "compra"; il venditore toglie l'annuncio, incassa e risponde "venduto"
     (allora la carta arriva al compratore) o "esaurito" (allora i coins tornano indietro). */
  const inAttesa = new Map();   // "nick|n" -> { nick, i, id, p }
  const chiaveA = (nick, i) => String(nick).toLowerCase() + '|' + i;
  function annunciDi(a) {
    const l = a.pr && Array.isArray(a.pr.mc) ? a.pr.mc.slice(0, 16) : [], BC = B.BELIN_CARTE, ok = id => BC && (BC.CARTE.some(c => c.id === id) || BC.LEADER.some(c => c.id === id && c.alt));
    return l.filter(x => Array.isArray(x) && ok(testo(x[1], 4))).map(x => ({ nick: a.nick, i: num(x[0], 0), id: testo(x[1], 4), p: Math.max(1, Math.min(99999, Math.round(num(x[2], 0)))) }))
      .map(x => Object.assign(x, { attesa: inAttesa.has(chiaveA(x.nick, x.i)) }));
  }
  function compra(nick, i) {
    const a = [...amici.values()].find(x => stessoLuogo(x.nick, nick)); if (!a) return 'offline';
    const l = annunciDi(a).find(x => x.i === i); if (!l) return 'esaurito';
    if (l.attesa) return 'attesa';
    if (!B.Eco || !B.Eco.spendi(l.p)) return 'soldi';
    inAttesa.set(chiaveA(a.nick, i), { nick: a.nick, i, id: l.id, p: l.p });
    evento({ k: 'compra', a: a.nick, i, id: l.id, p: l.p }); G.emetti('annunci');
    return 'ok';
  }
  function esitoAcquisto(nick, i, ok) {
    const k = chiaveA(nick, i), c = inAttesa.get(k); if (!c) return; inAttesa.delete(k);
    const nome = ((B.BELIN_CARTE && B.BELIN_CARTE.PER_ID && B.BELIN_CARTE.PER_ID[c.id]) || {}).n || 'la carta';
    if (ok && B.Belinverse && B.Belinverse.aggiungi(c.id)) { G.emetti('toast', '🃏 Hai comprato ' + nome + ' da ' + c.nick + ': la trovi nello zaino'); if (B.Miss) B.Miss.ev('mercato'); }
    else { if (B.Eco) B.Eco.add(c.p); G.emetti('toast', ok ? 'Acquisto non riuscito: coins restituiti' : nome + ' era già stata venduta: ti tornano ' + c.p + ' coins'); }
    G.emetti('annunci');
  }
  // se il venditore esce prima di rispondere, i coins tornano indietro
  function rimborsaDi(nick) { inAttesa.forEach(c => { if (stessoLuogo(c.nick, nick)) esitoAcquisto(c.nick, c.i, false); }); }

  const GIOCO_NOME = { raid: 'nel raid', paintball: 'a paintball', kart: 'sui kart', carte: 'a Belinverse' };
  function visita(id) {
    const a = amicoDa(id);
    if (!a) { G.emetti('toast', (G.utente(id) || {}).nick + ' non è online: per visitare la sua casa deve esserci anche lui'); return; }
    if (app.stanza().id === 'ospite' && stessoLuogo(app.stanza().ospite, a.nick)) { G.emetti('toast', 'Sei già a casa di ' + a.nick); return; }
    bussa(a);
  }
  function raggiungi(id) {
    const a = amicoDa(id);
    if (!a) { G.emetti('toast', (G.utente(id) || {}).nick + ' non è online'); return; }
    const s = String(a.pr.s || '');
    if (GIOCO_NOME[s]) { G.emetti('toast', a.nick + ' sta giocando ' + GIOCO_NOME[s] + ': lo trovi nella Sala Giochi'); return; }
    if (stessoLuogo(s, luogo())) { G.emetti('toast', a.nick + ' è qui con te'); return; }
    if (s.indexOf('casa:') === 0) {
      const prop = s.slice(5);
      if (stessoLuogo(prop, mioNick())) { G.emetti('transizione', () => app.entraStanza('casa')); return; }
      let p = null; amici.forEach(x => { if (stessoLuogo(x.nick, prop)) p = x; });
      if (p) bussa(p); else G.emetti('toast', a.nick + ' è a casa di ' + testo(prop, 20));
      return;
    }
    if (s === 'casa' || !app.stanze[s] || s === 'ospite') { G.emetti('toast', a.nick + ' è in un posto dove non puoi seguirlo'); return; }
    G.emetti('transizione', () => app.entraStanza(s, { x: num(a.pr.x, a.x), z: num(a.pr.z, a.z), yaw: num(a.pr.r, a.r) }));
  }

  // in piazza (e nelle stanze pubbliche) gli amici si toccano come gli abitanti: si apre la loro scheda
  B.amiciToccabili = () => [...amici.values()].filter(a => a.av.root.visible).map(a => ({ obj: a.av.proxy, tipo: 'npc', id: idAmico(a.nick) }));

  /* ---------- i miei messaggi e le mie emote partono per tutti ---------- */
  G.su('chat', v => { if (v.io && !v.amico) { nMsg++; invia({ msg: { n: nMsg, t: testo(v.testo, 120) } }); } });
  const emoteOrig = app.emote;
  app.emote = function (tipo) { emoteOrig(tipo); if (EMOTE[tipo] && !app.io.seduto) { nEm++; invia({ em: { n: nEm, t: tipo } }); } };

  /* ---------- fuori da claude.ai: stanza tra telefoni con un codice ---------- */
  // stessa forma della stanza di claude.ai: presence(patch) e onPeers({ joined, left, updated })
  function stanzaPeer(codice) {
    const ID = 'theborg-v1-' + codice, srv = new URLSearchParams(location.search).get('peerserver');
    const opz = srv ? { host: srv.split(':')[0], port: +(srv.split(':')[1] || 9000), path: '/', secure: false } : {};
    let peer = null, capo = false, mioId = null, aCapo = null, mia = {}, tCapo = 0;
    const conns = new Map(), altri = new Map(), subs = [], visto = new Map(), usciti = new Map();
    const voce = (id, p) => Object.freeze({ peer: id, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: p, updatedAt: Date.now() });
    const avvisa = ch => subs.forEach(f => f(Object.assign({ joined: [], left: [], updated: [] }, ch)));
    // un aggiornamento in ritardo di chi e' appena uscito non lo fa ricomparire come fantasma
    const metti = (id, p) => { if (!id || id === mioId || !p || typeof p !== 'object' || Date.now() - (usciti.get(id) || 0) < 5000) return; const c = altri.has(id), v = voce(id, p); altri.set(id, v); avvisa(c ? { updated: [v] } : { joined: [v] }); };
    const via = (id, segna = true) => { const v = altri.get(id); if (v) { altri.delete(id); if (segna) usciti.set(id, Date.now()); avvisa({ left: [v] }); } };
    const tutti = () => { const o = {}; altri.forEach((v, k) => { o[k] = v.presence; }); if (mioId) o[mioId] = mia; return o; };
    // un telefono lento non deve accumulare posizioni vecchie: se la coda e' piena salto questo invio (il prossimo contiene gia' tutto)
    const libera = c => c && c.open && !(c.dataChannel && c.dataChannel.bufferedAmount > 65536);
    const manda = (c, m) => { try { c.send(m); } catch (e) { } };
    const aTutti = (m, tranne, sempre) => conns.forEach((c, k) => { if (k !== tranne && (sempre ? c.open : libera(c))) manda(c, m); });
    const piccolo = d => { try { return JSON.stringify(d).length < 4096; } catch (e) { return false; } };
    function prova() {
      // prima provo a essere il padrone di casa; se il posto e' gia' preso mi collego a lui
      peer = new window.Peer(ID, opz);
      peer.on('open', id => { if (capo) return; capo = true; mioId = id; G.emetti('toast', 'Stanza amici "' + codice + '": sei il padrone di casa'); });
      peer.on('connection', c => {
        c.on('open', () => { conns.set(c.peer, c); visto.set(c.peer, Date.now()); usciti.delete(c.peer); manda(c, { t: 'tutti', p: tutti() }); });
        c.on('data', d => { if (!d || d.t !== 'p' || !piccolo(d.p)) return; visto.set(c.peer, Date.now()); metti(c.peer, d.p); aTutti({ t: 'p', id: c.peer, p: d.p }, c.peer); });
        c.on('close', () => { if (conns.get(c.peer) === c) lascia(c.peer); });
      });
      peer.on('error', e => {
        console.warn('online capo', e.type);
        // il posto di padrone di casa e' preso (anche dopo una ricollegata al server): divento ospite di chi ce l'ha
        if (e.type === 'unavailable-id') { if (capo) { capo = false; [...conns.keys()].forEach(lascia); [...altri.keys()].forEach(k => via(k, false)); } peer.destroy(); ospite(); }
        else if (!capo && !aCapo) { peer.destroy(); setTimeout(prova, 4000); }
      });
    }
    function lascia(id) { const c = conns.get(id); conns.delete(id); visto.delete(id); if (c) try { c.close(); } catch (e) { } via(id); aTutti({ t: 'via', id }, null, true); }
    function ospite() {
      peer = new window.Peer(undefined, opz);
      peer.on('open', id => {
        if (aCapo) return;   // ricollegato al server dopo un'interruzione: il collegamento col padrone di casa c'e' gia'
        // non "affidabile": i messaggi non si mettono in fila dietro a uno perso (era il motivo degli amici fermi che poi
        // ricomparivano piu' avanti); quello che arriva in ritardo viene scartato grazie al numero progressivo
        mioId = id; aCapo = peer.connect(ID, { reliable: false }); tCapo = Date.now();
        aCapo.on('open', () => { tCapo = Date.now(); manda(aCapo, { t: 'p', p: mia }); G.emetti('toast', 'Collegato alla stanza amici "' + codice + '"'); });
        aCapo.on('data', d => {
          if (!d) return; tCapo = Date.now();
          if (d.t === 'tutti' && d.p && typeof d.p === 'object') { const ks = Object.keys(d.p).slice(0, 32); ks.forEach(k => metti(k, d.p[k])); [...altri.keys()].forEach(k => { if (!ks.includes(k)) via(k, false); }); }
          else if (d.t === 'p' && piccolo(d.p)) metti(d.id, d.p);
          else if (d.t === 'via') via(d.id);
        });
        // se il padrone di casa se ne va, qualcuno prende il suo posto
        aCapo.on('close', cambiaCapo);
      });
      peer.on('error', e => {
        console.warn('online ospite', e.type);
        if (!aCapo) { peer.destroy(); setTimeout(prova, 3000); }
        else if (e.type === 'peer-unavailable' && !aCapo.open) cambiaCapo();   // il padrone di casa non c'e' piu': qualcuno prende il suo posto
      });
    }
    function cambiaCapo() {
      if (!aCapo) return; aCapo = null; [...altri.keys()].forEach(k => via(k, false)); try { peer.destroy(); } catch (e) { } setTimeout(prova, 300 + Math.random() * 1500);
    }
    // battito ogni 2 s: chi tace da 8 s e' andato via (il telefono in tasca non sempre chiude la connessione)
    setInterval(() => {
      const ora = Date.now();
      if (capo) { visto.forEach((t, id) => { if (ora - t > 8000) lascia(id); }); aTutti({ t: 'tutti', p: tutti() }, null, true); }
      else if (aCapo) { if (aCapo.open) manda(aCapo, { t: 'p', p: mia }); if (ora - tCapo > (aCapo.open ? 8000 : 12000)) cambiaCapo(); }   // collegamento che non si apre: si riprova
      // il server dei telefoni a volte chiude la linea: ci si ricollega, se no il posto di padrone di casa si libera e la stanza si spacca in due
      if (peer && !peer.destroyed && peer.disconnected) try { peer.reconnect(); } catch (e) { }
      usciti.forEach((t, id) => { if (ora - t > 10000) usciti.delete(id); });
    }, 2000);
    prova();
    return {
      presence(patch) {
        mia = Object.assign({}, mia, patch);
        if (capo) aTutti({ t: 'p', id: mioId, p: mia }); else if (libera(aCapo)) manda(aCapo, { t: 'p', p: mia });
        return Promise.resolve();
      },
      onPeers(f) { subs.push(f); return () => { }; },
      stato: () => ({ capo, mioId, aperto: !!(aCapo && aCapo.open), conns: conns.size, altri: altri.size })
    };
  }

  (CODICE ? Promise.resolve(SERVER ? B.stanzaNakama(CODICE, SERVER, { avvisa: t => G.emetti('toast', t) }) : stanzaPeer(CODICE)) : window.claude.use('room')).then(r => {
    if (!r) return; room = r;
    r.onPeers(ch => {
      ch.left.forEach(p => { const a = amici.get(p.peer); if (a && G.stato.giocatore) G.emetti('toast', a.nick + ' è uscito'); togli(p.peer); if (a) { rimborsaDi(a.nick); G.emetti('annunci'); } });
      ch.joined.concat(ch.updated).forEach(p => { if (!p.sameTab && p.kind === 'viewer') aggiorna(p.peer, p.presence); });
    }, () => { amici.forEach((a, k) => togli(k)); room = null; });
    ultimo = ''; invia();
  }).catch(() => { });
  B.Online = { visita, raggiungi, compra, annunci: () => [...amici.values()].reduce((o, a) => o.concat(annunciDi(a)), []), inLinea: () => !!room, stato: () => room && room.stato ? room.stato() : null, amici: () => [...amici.values()].map(a => ({ nick: a.nick, s: a.pr.s, x: a.x, z: a.z, bici: !!a.bk })) };
  ciclo();
})();
