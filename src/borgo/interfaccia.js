/* =====================================================================
   UI - interfaccia: schermata iniziale, barra, chat, messaggi privati,
   profili, editor dell'aspetto (con anteprime 3D), minimappa.
   Parla con il gioco solo tramite Gioco (logica) e B3.app (mondo 3D).
   ===================================================================== */
(function () {
  'use strict';
  const CFG = window.CONFIG, G = window.Gioco, B = window.B3, F = B.Foto;
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const PI = Math.PI;

  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  const UI = {};
  let inGioco = false, paginaAttiva = null, ordineDM = ['u1', 'u2'], lookFoglio = null, idFoglio = null, chatAperta = true;

  /* ---------- avatar nelle schede (miniature 3D) ---------- */
  function disegnaMini(canvas, look) { F.statica(canvas, look, 'busto', 0.3); }

  /* ---------- editor dell'aspetto ---------- */
  function aggiungiFrecce(canvas) {
    const box = el('div', 'anteprima-box'), sx = el('button', 'freccia'), dx = el('button', 'freccia');
    sx.type = dx.type = 'button'; sx.setAttribute('aria-label', 'Ruota a sinistra'); dx.setAttribute('aria-label', 'Ruota a destra');
    sx.innerHTML = '<svg viewBox="0 0 24 24" class="ico"><path d="m13 6-6 6 6 6M20 6l-6 6 6 6"/></svg>';
    dx.innerHTML = '<svg viewBox="0 0 24 24" class="ico"><path d="m11 6 6 6-6 6M4 6l6 6-6 6"/></svg>';
    canvas.parentNode.insertBefore(box, canvas); box.append(sx, canvas, dx);
    sx.addEventListener('click', () => F.ruota(canvas, -1));
    dx.addEventListener('click', () => F.ruota(canvas, 1));
  }
  function creaEditorLook(box, look, onChange) {
    box.innerHTML = '';
    const A = CFG.avatar, ed = el('div', 'editor2'), tabs = el('div', 'tabs-ed'), pannello = el('div', 'pannello-ed');
    const nomiSchede = ['Capelli', 'Viso', 'Vestiti', 'Accessori'];
    let scheda = 0, miniature = [], token = 0;
    function ridisegna() {                                   // le miniature si disegnano poche per volta, senza bloccare lo schermo
      const mio = ++token, lista = miniature.slice(); let i = 0;
      (function passo() {
        if (mio !== token) return;
        for (let k = 0; k < 2 && i < lista.length; k++, i++) { const m = lista[i]; F.statica(m.canvas, Object.assign({}, look, m.variante), m.crop, m.yaw); }
        if (i < lista.length) requestAnimationFrame(passo);
      })();
    }
    function colori(titolo, lista, chiave) {
      const g = el('div', 'gruppo-ed'), riga = el('div', 'colori'); g.append(el('label', null, titolo));
      lista.forEach((col, i) => {
        const b = el('button', 'colore' + ((look[chiave] || 0) === i ? ' sel' : '')); b.type = 'button'; b.style.background = col; b.setAttribute('aria-label', titolo + ' ' + (i + 1));
        b.addEventListener('click', () => { look[chiave] = i; onChange(look); riga.querySelectorAll('.colore').forEach((x, k) => x.classList.toggle('sel', k === i)); ridisegna(); });
        riga.append(b);
      });
      g.append(riga); return g;
    }
    function griglia(titolo, nomi, chiave, crop, yaw) {
      const g = el('div', 'gruppo-ed'), riga = el('div', 'griglia-ed'); g.append(el('label', null, titolo));
      nomi.forEach((nome, i) => {
        const b = el('button', 'opz' + ((look[chiave] || 0) === i ? ' sel' : '')); b.type = 'button'; b.setAttribute('aria-label', nome); b.title = nome;
        const cv = el('canvas'); cv.width = 112; cv.height = 112; b.append(cv); b.append(el('span', 'opz-nome', nome));
        miniature.push({ canvas: cv, variante: { [chiave]: i }, crop, yaw });
        b.addEventListener('click', () => { look[chiave] = i; onChange(look); riga.querySelectorAll('.opz').forEach((x, k) => x.classList.toggle('sel', k === i)); ridisegna(); });
        riga.append(b);
      });
      g.append(riga); return g;
    }
    function mostra() {
      pannello.innerHTML = ''; miniature = [];
      tabs.querySelectorAll('.tab-ed').forEach((b, i) => b.classList.toggle('sel', i === scheda));
      if (scheda === 0) pannello.append(griglia('Pettinatura', A.stili, 'stile', 'testa', 0.3), colori('Colore dei capelli', A.capelli, 'capelli'));
      if (scheda === 1) pannello.append(griglia('Viso', A.visi, 'viso', 'testa', 0.3), griglia('Barba', A.barbe, 'barba', 'testa', 0.3), colori('Pelle', A.pelli, 'pelle'), colori('Occhi', A.occhi, 'occhi'));
      if (scheda === 2) pannello.append(griglia('Stile', A.abiti, 'abito', 'busto', 0.3), colori('Colore giacca / maglia', A.giacche, 'giacca'), colori('Dettagli', A.dettagli, 'dettagli'), colori('Pantaloni', A.pantaloni, 'pantaloni'), colori('Stivali', A.stivali, 'stivali'));
      if (scheda === 3) pannello.append(griglia('Accessorio', A.accessori, 'accessorio', 'testa', 0.3));
      ridisegna();
    }
    nomiSchede.forEach((n, i) => { const b = el('button', 'tab-ed', n); b.type = 'button'; b.addEventListener('click', () => { scheda = i; mostra(); }); tabs.append(b); });
    ed.append(tabs, pannello); box.append(ed); mostra();
  }

  /* ---------- toast e transizioni ---------- */
  let tToast = 0;
  UI.toast = function (testo) {
    const t = $('#toast'); t.textContent = testo; t.classList.add('visibile');
    clearTimeout(tToast); tToast = setTimeout(() => t.classList.remove('visibile'), 3200);
  };
  let inFade = false;
  UI.fade = function (fn) {
    if (inFade) return; inFade = true;
    const d = $('#dissolvenza'); d.classList.add('attiva');
    setTimeout(() => { fn(); requestAnimationFrame(() => { d.classList.remove('attiva'); inFade = false; }); }, 230);
  };

  /* ---------- area visibile del mondo (dietro barre e chat) ---------- */
  UI.aggiornaArea = function () {
    const H = app.clientHeight;
    const top = $('#hud').hidden ? 0 : $('#barra-alto').offsetHeight;
    const tab = $('#tabbar'), tabH = (window.B3_ORIZZ || tab.hidden || app.classList.contains('tastiera')) ? 0 : tab.offsetHeight;
    const chat = $('#chat'), chatH = (window.B3_ORIZZ || chat.hidden || $('#hud').hidden) ? 0 : chat.offsetHeight + 8;
    app.style.setProperty('--h-chat', chatH + 'px');
    B.layout = { top, bottom: H - tabH - chatH * 0.55 };
    if (B.app) B.app.misura();
  };

  /* ---------- navigazione ---------- */
  const PAGINE = ['messaggi', 'amici', 'zaino', 'profilo'];
  function evidenziaTab() {
    const attivo = paginaAttiva || 'mondo';
    document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('attivo', b.dataset.vai === attivo));
  }
  function chiudiPagine() {
    paginaAttiva = null; G.stato.dmAperto = null;
    PAGINE.forEach(p => { $('#pagina-' + p).hidden = true; }); evidenziaTab();
  }
  function apriPagina(nome) {
    PAGINE.forEach(p => { $('#pagina-' + p).hidden = p !== nome; });
    paginaAttiva = nome;
    if (nome === 'messaggi') mostraElencoDM();
    if (nome === 'profilo') aggiornaProfilo();
    if (nome === 'amici') aggiornaAmici();
    evidenziaTab();
  }
  function vai(nome) {
    chiudiFoglio();
    if (nome === 'mondo') chiudiPagine();
    else if (paginaAttiva === nome) chiudiPagine();
    else apriPagina(nome);
  }
  UI.paginaPiena = () => paginaAttiva !== null || !inGioco;
  UI.inGioco = () => inGioco;

  /* ---------- stanza corrente ---------- */
  function aggiornaStanza(info) {
    $('#nome-stanza').textContent = info.def.nome;
    const b = $('#badge-stanza'); b.textContent = info.def.pubblica ? 'Pubblica' : 'Privata'; b.className = 'badge' + (info.def.pubblica ? ' pubblica' : '');
    $('#chat').hidden = !info.def.pubblica && info.id !== 'casa';   // in casa: per chiacchierare con gli amici in visita
    $('#btn-casa').setAttribute('aria-label', info.id === 'casa' ? 'Vai in piazza' : 'Vai a casa');
    $('#btn-casa').title = info.id === 'casa' ? 'Vai in piazza' : 'Vai a casa';
    $('#btn-contesto').hidden = true;
    rendiChat(); evidenziaTab(); UI.aggiornaArea();
    if (info.id === 'sala') UI.toast('Sala Giochi: a sinistra l\'ala PAINTBALL, a destra l\'ala GO-KART. Entra dagli archi per giocare (dimostrativo).');
    if (info.id === 'biblioteca') UI.toast('Biblioteca: al leggio, in fondo, premi "Leggi" per le letture.');
    if (info.id === 'collectibles') UI.toast('Laugh Tale Collectibles: avvicinati al bancone e premi "Apri il negozio online" (prodotti e pagamenti sono sul sito vero).');
    if (info.id === 'negozio') UI.toast('Stanza ancora vuota. Esci dal tappetino a sud.');
    if (info.id === 'casa') UI.toast('La tua casa: privata. Esci dalla porta sul fondo per andare in piazza.');
    if (info.id === 'piazza') UI.toast('Piazza del Borgo: gli altri abitanti sono simulati (demo).');
  }

  /* ---------- pulsante contestuale (entra / esci) ---------- */
  G.su('porta', p => {
    const b = $('#btn-contesto');
    if (p && inGioco && !UI.paginaPiena() && !(p.alzati && p.nome === 'Alzati')) { b.textContent = p.testo ? p.testo : p.verso === 'casa' ? 'Entra in casa' : p.verso === 'negozio' ? 'Entra nel negozio' : p.verso === 'collectibles' ? 'Entra da Laugh Tale' : p.verso === 'biblioteca' ? 'Entra in biblioteca' : p.id === 'varco-piazza' ? 'Vai in piazza' : p.verso === 'piazza' ? 'Esci in piazza' : p.nome + ' (presto)'; b.hidden = false; }
    else b.hidden = true;
  });

  /* ---------- chat pubblica ---------- */
  function coloreAvatar(id) {
    const look = id === 'io' ? (G.stato.giocatore && G.stato.giocatore.look) : (G.utente(id) || {}).look;
    return look ? CFG.avatar.capelli[(look.capelli || 0) % CFG.avatar.capelli.length] : '#ccc';
  }
  function compattaChat() { chatAperta = !chatAperta; $('#chat').classList.toggle('compatta', !chatAperta); if (!chatAperta) $('#chat-input').blur(); rendiChat(); UI.aggiornaArea(); }

  function rendiChat() {
    const lista = $('#chat-lista'); lista.innerHTML = '';
    const benv = el('div', 'riga sistema', 'Benvenuto! Rispetta tutti e non scrivere mai dati personali.'), lr = el('button', 'link', 'Regole');
    lr.type = 'button'; lr.addEventListener('click', () => mostraRegole()); benv.append(lr); lista.append(benv);
    const visibili = G.stato.chat.filter(m => !G.stato.bloccati.has(m.id));
    visibili.forEach(m => {
      const r = el('div', 'riga' + (m.io ? ' io' : ''));
      const av = el('span', 'av', m.nick.charAt(0).toUpperCase()), cb = coloreAvatar(m.id); av.style.background = cb;
      { const n2 = parseInt(cb.slice(1), 16), lum = (0.299 * (n2 >> 16) + 0.587 * ((n2 >> 8) & 255) + 0.114 * (n2 & 255)); av.style.color = lum < 110 ? '#ffffff' : '#2b2230'; }
      const corpo = el('div', 'corpo');
      const n = el('button', 'nick', m.nick); n.type = 'button';
      if (!m.io) n.addEventListener('click', () => apriFoglio(m.id));
      corpo.append(n, document.createTextNode(m.testo), el('span', 'ora', m.ora));
      r.append(av, corpo);
      lista.append(r);
    });
    lista.scrollTop = lista.scrollHeight;
    const ultimo = visibili[visibili.length - 1];
    $('#chat-ultimo').textContent = ultimo ? ultimo.nick + ': ' + ultimo.testo : '';
  }

  /* ---------- messaggi privati ---------- */
  function mostraElencoDM() {
    G.stato.dmAperto = null;
    $('#dm-elenco').hidden = false; $('#dm-thread').hidden = true;
    const lista = $('#dm-lista'); lista.innerHTML = '';
    const ids = Object.keys(G.stato.dm).filter(id => G.stato.dm[id].msgs.length).sort((a, b) => {
      const ia = ordineDM.indexOf(a), ib = ordineDM.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    if (!ids.length) lista.append(el('div', 'vuoto', 'Nessuna conversazione ancora.'));
    ids.forEach(id => {
      const u = G.utente(id), c = G.stato.dm[id], ultimo = c.msgs[c.msgs.length - 1], bloccato = G.stato.bloccati.has(id);
      const b = el('button', 'dm-voce' + (c.nonLetti && !bloccato ? ' nonletto' : '')); b.type = 'button';
      const cv = el('canvas', 'mini-avatar'); cv.width = 88; cv.height = 104; disegnaMini(cv, u.look);
      const t = el('div', 'dm-testo'), nome = el('div', 'dm-nome', u.nick); nome.append(el('small', null, ultimo.ora));
      t.append(nome, el('div', 'dm-anteprima', bloccato ? 'Utente bloccato' : ((ultimo.da === 'io' ? 'Tu: ' : '') + ultimo.testo)));
      b.append(cv, t);
      if (c.nonLetti && !bloccato) b.append(el('span', 'pallino', String(c.nonLetti)));
      b.addEventListener('click', () => apriThread(id));
      lista.append(b);
    });
  }
  function apriThread(id) {
    G.stato.dmAperto = id; G.segnaLetti(id);
    const u = G.utente(id);
    $('#dm-elenco').hidden = true; $('#dm-thread').hidden = false;
    $('#dm-nome').textContent = u.nick; disegnaMini($('#dm-avatar'), u.look);
    rendiThread(); aggiornaBadgeDM();
  }
  function rendiThread() {
    const id = G.stato.dmAperto; if (!id) return;
    const c = G.conversazione(id), box = $('#dm-messaggi'), bloccato = G.stato.bloccati.has(id);
    box.innerHTML = '';
    if (!c.msgs.length) box.append(el('div', 'vuoto', 'Scrivi il primo messaggio a ' + G.utente(id).nick + '.'));
    c.msgs.forEach((m, i) => {
      const b = el('div', 'bolla ' + (m.da === 'io' ? 'io' : 'altro'), m.testo); b.append(el('small', null, m.ora));
      // tocca un messaggio per farti chiedere se eliminarlo
      b.addEventListener('click', () => {
        const aperto = box.querySelector('.bolla-elimina'); if (aperto) aperto.remove();
        if (box.querySelector('.bolla.scelta') === b) { b.classList.remove('scelta'); return; }
        box.querySelectorAll('.bolla.scelta').forEach(x => x.classList.remove('scelta'));
        b.classList.add('scelta');
        const x = el('button', 'bolla-elimina ' + (m.da === 'io' ? 'io' : 'altro'), 'Elimina messaggio'); x.type = 'button';
        x.addEventListener('click', e => { e.stopPropagation(); G.eliminaMessaggio(id, i); UI.toast('Messaggio eliminato'); });
        b.after(x);
      });
      box.append(b);
    });
    box.scrollTop = box.scrollHeight;
    const cest = $('#dm-elimina'); cest.classList.remove('conferma'); cest.textContent = 'Elimina chat';
    $('#dm-input').disabled = bloccato;
    $('#dm-input').placeholder = bloccato ? 'Utente bloccato' : 'Scrivi un messaggio privato…';
  }
  function aggiornaBadgeDM() {
    const n = G.totNonLetti(), b = $('#badge-dm'); b.hidden = n === 0; b.textContent = n > 9 ? '9+' : String(n);
  }

  /* ---------- scheda di un altro utente ---------- */
  function apriFoglio(id) {
    const u = G.utente(id); if (!u) return;
    idFoglio = id; lookFoglio = u.look;
    $('#foglio-nick').textContent = u.nick; $('#foglio-bio').textContent = u.bio;
    $('#foglio-dove').textContent = u.dove || (u.online ? 'In piazza' : 'Non in linea');
    $('#foglio-tipo').textContent = u.amico ? 'Amico vero' : 'Utente dimostrativo';
    $('#foglio-amico').hidden = !u.amico;
    $('#foglio-dm').hidden = !u.amico;   // ai bot non si scrivono messaggi privati
    aggiornaBottoneBlocco();
    $('#foglio').hidden = false;
  }
  function chiudiFoglio() { $('#foglio').hidden = true; idFoglio = null; lookFoglio = null; }
  function aggiornaBottoneBlocco() { $('#foglio-blocca').textContent = G.stato.bloccati.has(idFoglio) ? 'Sblocca' : 'Blocca'; }

  /* ---------- segnalazione con motivo ---------- */
  let idSegnala = null, motivoSegnala = null;
  function apriSegnala(id) {
    const u = G.utente(id); if (!u) return;
    idSegnala = id; motivoSegnala = null;
    $('#segnala-nick').textContent = u.nick; $('#segnala-nota').value = '';
    $('#segnala-blocca').checked = !G.stato.bloccati.has(id); $('#segnala-blocca').parentNode.hidden = G.stato.bloccati.has(id);
    const box = $('#segnala-motivi'); box.innerHTML = '';
    G.MOTIVI.forEach(m => {
      const b = el('button', null, m[1]); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
      b.addEventListener('click', () => {
        motivoSegnala = m[0]; $('#segnala-invia').disabled = false;
        box.querySelectorAll('button').forEach(x => { const on = x === b; x.classList.toggle('sel', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
      });
      box.append(b);
    });
    $('#segnala-invia').disabled = true;
    $('#segnala').hidden = false;
  }
  function chiudiSegnala() { $('#segnala-nota').blur(); $('#segnala').hidden = true; idSegnala = null; }
  function inviaSegnala() {
    if (!idSegnala || !motivoSegnala) return;
    const id = idSegnala, blocca = !$('#segnala-blocca').parentNode.hidden && $('#segnala-blocca').checked;
    G.segnala(id, motivoSegnala, $('#segnala-nota').value);
    if (blocca) G.blocca(id);
    chiudiSegnala(); chiudiFoglio();
    UI.toast(blocca ? 'Grazie. Segnalazione salvata e persona bloccata.' : 'Grazie. Segnalazione salvata.');
  }

  /* ---------- regole della chat: la prima volta che si scrive ---------- */
  const CHIAVE_REGOLE = 'theborg.regole.v1';
  let dopoRegole = null;
  function regoleViste() { try { return localStorage.getItem(CHIAVE_REGOLE) === '1'; } catch (e) { return true; } }
  function mostraRegole(poi) { dopoRegole = poi || null; $('#regole').hidden = false; }
  function chiudiRegole() {
    try { localStorage.setItem(CHIAVE_REGOLE, '1'); } catch (e) { /* ok */ }
    $('#regole').hidden = true; const f = dopoRegole; dopoRegole = null; if (f) f();
  }

  /* ---------- utenti bloccati (nel profilo) ---------- */
  function aggiornaBloccati() {
    const box = $('#bloccati-lista'); if (!box) return; box.innerHTML = '';
    const l = G.elencoBloccati();
    if (!l.length) { box.append(el('p', 'nota-piccola', 'Non hai bloccato nessuno.')); return; }
    l.forEach(b => {
      const r = el('div', 'bloccato-voce'), x = el('button', null, 'Sblocca'); x.type = 'button';
      x.addEventListener('click', () => { G.sblocca(b.id); UI.toast(b.nick + ' sbloccato'); });
      r.append(el('span', null, b.nick), x); box.append(r);
    });
  }

  /* ---------- amici (utenti dimostrativi) ---------- */
  function aggiornaAmici() {
    const box = $('#amici-lista'); box.innerHTML = '';
    CFG.utentiDemo.filter(u => !u.extra).forEach(u => {
      const bloccato = G.stato.bloccati.has(u.id);
      const b = el('div', 'amico'); b.setAttribute('role', 'button'); b.tabIndex = 0;
      const cv = el('canvas', 'mini-avatar'); cv.width = 88; cv.height = 104; disegnaMini(cv, u.look);
      const t = el('div', 'amico-testo'), nome = el('div', 'amico-nome', u.nick);
      nome.prepend(el('span', 'stato-pt' + (u.online ? '' : ' off')));
      t.append(nome, el('div', 'amico-bio', bloccato ? 'Utente bloccato' : (u.online ? 'In piazza · ' : 'Non in linea · ') + u.bio));
      b.addEventListener('click', () => apriFoglio(u.id));
      b.append(cv, t); box.append(b);
    });
  }
  function creaZaino() {
    const g = $('#zaino-griglia'); g.innerHTML = '';
    for (let i = 0; i < 16; i++) g.append(el('div', 'slot-vuoto', '+'));
  }

  /* ---------- minimappa (si ruota insieme alla camera) ---------- */
  let sfondoMini = null;
  UI.disegnaMinimappa = function () {
    const cvs = $('#minimappa'), a = B.app; if (!a || !a.gioco() || !cvs.offsetParent) return;
    const st = a.stanza(), io = a.io, C = a.C, c = cvs.getContext('2d'), W = cvs.width, H = cvs.height;
    const grande = cvs.classList.contains('grande'), r0 = st.rect;
    const s = grande ? W / (st.id === 'piazza' ? 76 : st.id === 'sala' ? 60 : st.id === 'collectibles' ? 30 : st.id === 'tcg' ? 52 : st.id === 'biblioteca' ? 20 : 28) : (st.id === 'piazza' ? 8.5 : st.id === 'sala' ? 13 : st.id === 'collectibles' || st.id === 'biblioteca' ? 11 : 14) * (W / 196);
    const mx = grande ? (r0.x0 + r0.x1) / 2 : io.x, mz = grande ? (r0.z0 + r0.z1) / 2 : io.z;       // centro della mappa
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = st.sfondo; c.fillRect(0, 0, W, H);
    c.translate(W / 2, H / 2); c.rotate(C.az); c.scale(s, s); c.translate(-mx, -mz);
    const r = st.rect;
    if (st.id === 'piazza') {
      c.fillStyle = '#e3cfae'; const PX = B.CFG.plaza; c.fillRect(r.x0, r.z0, PX.x1 - r.x0, r.z1 - r.z0);;
      c.fillStyle = '#8fcbc5'; c.beginPath(); c.arc(0, 30, 6.3, 0, 7); c.fill();
      c.fillStyle = '#f1e7dc'; { const BL = B.BEL; c.fillRect(BL.x0, BL.z0, BL.x1 - BL.x0, BL.z1 - BL.z0); }
      c.fillStyle = '#6f9a60'; [[-16.2, 33.2, 2.2, 1.2], [16.4, 33.6, 2.2, 1.2]].forEach(q => c.fillRect(q[0] - q[2] / 2, q[1] - q[3] / 2, q[2], q[3]));
      st.edifici.forEach(e => { if (e.mappa === 'acqua') { c.fillStyle = '#9cc77a'; c.beginPath(); c.ellipse(e.x, e.z, e.w / 2 + 2, e.d / 2 + 2, 0, 0, 7); c.fill(); c.fillStyle = '#58b4da'; c.beginPath(); c.ellipse(e.x, e.z, e.w / 2, e.d / 2, 0, 0, 7); c.fill(); return; } if (e.mappa === 'banchi') return; c.fillStyle = '#8a6a7a'; c.fillRect(e.x - e.w / 2, e.z - e.d / 2, e.w, e.d); });
    } else if (st.id === 'negozio' || st.id === 'sala' || st.id === 'collectibles' || st.id === 'tcg' || st.id === 'biblioteca') {
      if (st.id === 'sala') { c.fillStyle = '#4a3a7a'; c.fillRect(-17, -13, 34, 28); c.fillStyle = '#35607a'; c.fillRect(-27, -6, 10, 14); c.fillStyle = '#5a5a68'; c.fillRect(17, -6, 10, 14); c.fillStyle = '#ffd36a'; c.font = 'bold 2px sans-serif'; c.textAlign = 'center'; c.fillText('PAINTBALL', -22, 1); c.fillText('KART', 22, 1); } else { c.fillStyle = '#b9a090'; c.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0); c.fillStyle = '#6a4bd6'; c.fillRect(-0.2, r.z0, 0.4, 0.3); }
    } else {
      c.fillStyle = '#cf966a'; c.fillRect(-5, -4, 10, 7); c.fillStyle = '#d9a877'; c.fillRect(-5, 3, 10, 3.1);
      c.fillStyle = '#e9d5c0'; c.fillRect(-5.3, -4.3, 10.6, 0.3); c.fillRect(-5.3, -4.3, 0.3, 7.3);
    }
    c.fillStyle = 'rgba(70,45,70,.55)';
    st.ostacoli.forEach(o => { if (o.t === 'f') return; if (o.t === 'b') c.fillRect(o.x0, o.z0, o.x1 - o.x0, o.z1 - o.z0); else { c.beginPath(); c.arc(o.x, o.z, Math.max(o.r, 0.3), 0, 7); c.fill(); } });
    st.porte.forEach(p => { c.fillStyle = p.verso ? '#ffd98a' : '#c9c1d6'; c.beginPath(); c.arc(p.x, p.z, 0.5, 0, 7); c.fill(); });
    if (st.id === 'piazza') a.npc.forEach(n => { if (n.bloccato) return; c.fillStyle = '#ffffff'; c.beginPath(); c.arc(n.x, n.z, 0.45, 0, 7); c.fill(); });
    c.setTransform(1, 0, 0, 1, 0, 0);
    // il giocatore e' sempre al centro, con la freccia che indica dove guarda
    const dx = Math.sin(io.yaw), dz = Math.cos(io.yaw), cs = Math.cos(C.az), sn = Math.sin(C.az);
    const fx = dx * cs - dz * sn, fy = dx * sn + dz * cs, ang = Math.atan2(fy, fx);
    const proj = (x, z) => { const px = (x - mx) * s, pz = (z - mz) * s; return [W / 2 + px * cs - pz * sn, H / 2 + px * sn + pz * cs]; };
    if (grande && st.id === 'piazza') {                       // nomi dei luoghi, dritti e leggibili
      c.font = '700 ' + Math.round(W / 40) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(30,18,45,.85)'; c.fillStyle = '#fff3d6';
      st.edifici.forEach(e => { if (!e.nome) return; const q = proj(e.x, e.z); c.strokeText(e.nome, q[0], q[1] + 4); c.fillText(e.nome, q[0], q[1] + 4); });
      const f = proj(0, 30); c.strokeText('Fontana', f[0], f[1]); c.fillText('Fontana', f[0], f[1]);
      const b = proj(0, (B.BEL.z0 + B.BEL.z1) / 2); c.strokeText('Belvedere', b[0], b[1]); c.fillText('Belvedere', b[0], b[1]);
    }
    const pq = proj(io.x, io.z), k = W / 196;
    c.save(); c.translate(pq[0], pq[1]); c.scale(k, k); c.rotate(ang); c.fillStyle = '#f2c76e'; c.strokeStyle = '#fff'; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(11, 0); c.lineTo(-6, 7); c.lineTo(-3, 0); c.lineTo(-6, -7); c.closePath(); c.fill(); c.stroke(); c.restore();
    if (!grande) { const vg = c.createRadialGradient(W / 2, H / 2, W * 0.34, W / 2, H / 2, W * 0.52); vg.addColorStop(0, 'rgba(20,12,35,0)'); vg.addColorStop(1, 'rgba(20,12,35,.55)'); c.fillStyle = vg; c.fillRect(0, 0, W, H); }
  };

  /* ---------- profilo personale ---------- */
  function aggiornaProfilo() {
    $('#profilo-nick').textContent = G.stato.giocatore.nick;
    document.querySelectorAll('#atmosfere .catena').forEach(b => b.classList.toggle('sel', b.dataset.id === G.stato.atmosfera));
    document.querySelectorAll('#grafica .catena').forEach(b => b.classList.toggle('sel', b.dataset.id === G.stato.grafica));
    aggiornaBloccati();
  }

  /* ---------- schermata iniziale ---------- */
  function mostraInizio() {
    inGioco = false; chiudiPagine(); chiudiFoglio(); G.emetti('chiusura');
    $('#hud').hidden = true; $('#tabbar').hidden = true; $('#btn-contesto').hidden = true;
    $('#inizio').hidden = false; UI.aggiornaArea();
  }
  let lookInizio = Object.assign({}, CFG.avatar.lookIniziale);
  function entra() {
    const nick = $('#nick').value.trim(), err = $('#nick-errore');
    if (!G.nickValido(nick)) { err.textContent = 'Usa da 3 a 14 caratteri: lettere, numeri o _ (senza spazi).'; return; }
    if (!G.nickPermesso(nick)) { err.textContent = 'Questo nickname non è permesso nel Borgo: scegline un altro.'; return; }
    if (CFG.utentiDemo.some(u => u.nick.toLowerCase() === nick.toLowerCase())) { err.textContent = 'Nickname gia\' in uso (prova dimostrativa: la verifica vera sara\' sul server).'; return; }
    err.textContent = '';
    UI.fade(() => {
      $('#inizio').hidden = true; $('#hud').hidden = false; $('#tabbar').hidden = false; inGioco = true;
      G.avvia(nick, lookInizio);
      G.emetti('avvio', { nick, look: G.stato.giocatore.look });
      creaEditorLook($('#profilo-editor'), G.stato.giocatore.look, look => G.cambiaLook(look));
      aggiornaBadgeDM(); chiudiPagine(); evidenziaTab(); UI.aggiornaArea();
    });
  }

  /* ---------- avvio ---------- */
  UI.init = function () {
    document.title = CFG.nomeApp + ' 3D';
    $('#titolo-app').textContent = CFG.nomeApp;
    $('#versione').textContent = CFG.nomeApp + ' · ' + CFG.versione;

    const salvato = G.carica();
    if (salvato) {
      if (salvato.look) lookInizio = Object.assign({}, CFG.avatar.lookIniziale, salvato.look);
      if (salvato.nick) $('#nick').value = salvato.nick;
      if (salvato.atmosfera && B.CFG.atmosfere[salvato.atmosfera]) G.impostaAtmosfera(salvato.atmosfera);
      if (salvato.grafica) G.stato.grafica = salvato.grafica;
    }
    B.app.misura();
    creaEditorLook($('#inizio-editor'), lookInizio, () => { });
    F.viva($('#inizio-anteprima'), () => lookInizio, 'intero');
    F.viva($('#profilo-anteprima'), () => (G.stato.giocatore ? G.stato.giocatore.look : null), 'intero');
    F.viva($('#foglio-avatar'), () => lookFoglio, 'intero');

    $('#btn-entra').addEventListener('click', entra);
    $('#nick').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#nick').blur(); entra(); } });
    $('#nick').addEventListener('input', () => { $('#nick-errore').textContent = ''; });

    document.querySelectorAll('#tabbar button').forEach(b => b.addEventListener('click', () => vai(b.dataset.vai)));
    $('#minimappa').addEventListener('click', () => {
      const cv = $('#minimappa'), g = !cv.classList.contains('grande');
      cv.classList.toggle('grande', g); $('#minimappa-box').classList.toggle('grande', g); cv.width = cv.height = g ? 680 : 240;
    });
    $('#btn-zoom-piu').addEventListener('click', () => B.app.impostaZoom(B.app.C.zoom * 1.2));
    $('#btn-zoom-meno').addEventListener('click', () => B.app.impostaZoom(B.app.C.zoom / 1.2));
    $('#btn-giu').addEventListener('click', () => B.app.inclina(-7));
    $('#btn-su').addEventListener('click', () => B.app.inclina(7));
    const menuE = $('#menu-emote');
    $('#btn-emote').addEventListener('click', () => { menuE.hidden = !menuE.hidden; });
    menuE.addEventListener('click', e => { const b = e.target.closest('button[data-e]'); if (!b) return; B.app.emote(b.dataset.e); menuE.hidden = true; });
    $('#btn-rot-sx').addEventListener('click', () => B.app.ruota(1));
    $('#btn-rot-dx').addEventListener('click', () => B.app.ruota(-1));
    $('#btn-contesto').addEventListener('click', () => { const p = B.app.portaVicina(); if (p) B.app.usaPorta(p); });

    $('#chat-chiudi').addEventListener('click', compattaChat);
    $('#btn-casa').addEventListener('click', () => {
      chiudiPagine();
      const a = B.app, haCasa = a.stanza().id === 'casa';
      G.emetti('transizione', () => a.entraStanza(haCasa ? 'piazza' : 'casa', haCasa ? { x: 12.4, z: -4.3, yaw: PI / 4 } : undefined));
    });
    aggiungiFrecce($('#inizio-anteprima')); aggiungiFrecce($('#profilo-anteprima')); creaZaino();
    $('#chat-form').addEventListener('submit', e => {
      e.preventDefault(); const i = $('#chat-input');
      if (G.inviaChat(i.value)) i.value = '';
    });

    $('#dm-indietro').addEventListener('click', mostraElencoDM);
    $('#dm-profilo').addEventListener('click', () => { if (G.stato.dmAperto) apriFoglio(G.stato.dmAperto); });
    // elimina tutta la conversazione: il primo tocco chiede conferma, il secondo elimina
    let tConferma = 0;
    $('#dm-elimina').addEventListener('click', () => {
      const b = $('#dm-elimina'), id = G.stato.dmAperto; if (!id) return;
      if (!b.classList.contains('conferma')) {
        b.classList.add('conferma'); b.textContent = 'Sicuro?';
        clearTimeout(tConferma); tConferma = setTimeout(() => { b.classList.remove('conferma'); b.textContent = 'Elimina chat'; }, 3000);
        return;
      }
      clearTimeout(tConferma);
      G.eliminaConversazione(id); UI.toast('Conversazione eliminata'); mostraElencoDM(); aggiornaBadgeDM();
    });
    $('#dm-form').addEventListener('submit', e => {
      e.preventDefault(); const i = $('#dm-input'), id = G.stato.dmAperto;
      if (id && G.inviaDM(id, i.value)) i.value = '';
    });

    $('#foglio-sfondo').addEventListener('click', chiudiFoglio);
    $('#foglio-chiudi').addEventListener('click', chiudiFoglio);
    $('#foglio-dm').addEventListener('click', () => {
      const id = idFoglio; chiudiFoglio();
      if (!G.stato.dm[id]) G.conversazione(id);
      apriPagina('messaggi'); apriThread(id);
    });
    $('#foglio-segnala').addEventListener('click', () => apriSegnala(idFoglio));
    $('#segnala-annulla').addEventListener('click', chiudiSegnala);
    $('#segnala .fc-sfondo').addEventListener('click', chiudiSegnala);
    $('#segnala-invia').addEventListener('click', inviaSegnala);
    $('#segnala-nota').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#segnala-nota').blur(); } });
    $('#regole-ok').addEventListener('click', chiudiRegole);
    $('#btn-regole').addEventListener('click', () => mostraRegole());
    // la prima volta che si tocca la chat (pubblica o privata) si leggono le regole
    ['#chat-input', '#dm-input'].forEach(sel => $(sel).addEventListener('focus', () => {
      if (regoleViste()) return;
      const inp = $(sel); inp.blur(); mostraRegole(() => { try { inp.focus(); } catch (e) { /* ok */ } });
    }));
    $('#foglio-visita').addEventListener('click', () => { const id = idFoglio; chiudiFoglio(); if (B.Online && B.Online.visita) B.Online.visita(id); });
    $('#foglio-raggiungi').addEventListener('click', () => { const id = idFoglio; chiudiFoglio(); if (B.Online && B.Online.raggiungi) B.Online.raggiungi(id); });
    $('#foglio-blocca').addEventListener('click', () => {
      if (G.stato.bloccati.has(idFoglio)) { G.sblocca(idFoglio); UI.toast('Utente sbloccato'); }
      else { G.blocca(idFoglio); UI.toast('Utente bloccato: non vedrai più i suoi messaggi e il suo personaggio'); }
      aggiornaBottoneBlocco();
    });

    const catene = $('#atmosfere');
    CFG.atmosfereOrdine.forEach(id => {
      const b = el('button', 'catena', B.CFG.atmosfere[id].nome); b.type = 'button'; b.dataset.id = id;
      b.addEventListener('click', () => { G.impostaAtmosfera(id); aggiornaProfilo(); });
      catene.append(b);
    });
    const gr = $('#grafica');
    [['alta', 'Alta'], ['leggera', 'Leggera (piu\' fluida)']].forEach(q => {
      const b = el('button', 'catena', q[1]); b.type = 'button'; b.dataset.id = q[0];
      b.addEventListener('click', () => { G.impostaGrafica(q[0]); aggiornaProfilo(); });
      gr.append(b);
    });
    $('#btn-esci').addEventListener('click', () => UI.fade(mostraInizio));
    // ricomincia da capo: cancella i progressi su questo dispositivo (si tengono il codice amici e le impostazioni di audio e comandi)
    { const b = $('#btn-ricomincia'); let sicuro = 0, tt = 0;
      if (b) b.addEventListener('click', () => {
        if (!sicuro) { sicuro = 1; b.textContent = 'Sicuro? Perdi coins, mobili e carte: tocca ancora'; clearTimeout(tt); tt = setTimeout(() => { sicuro = 0; b.textContent = 'Ricomincia da capo'; }, 4000); return; }
        const tieni = ['borg_amici', 'theborg.musica', 'theborg.effetti', 'theborg.muto', 'theborg.comandi.v1', 'theborg.raid.vibra'];
        try { Object.keys(localStorage).forEach(k => { if ((k.indexOf('borg') === 0 || k.indexOf('theborg') === 0 || k === CFG.chiaveSalvataggio) && tieni.indexOf(k) < 0) localStorage.removeItem(k); }); } catch (e) { /* ok */ }
        location.reload();
      }); }

    // eventi dal gioco
    G.su('toast', t => { if ((B.Kart && B.Kart.attivo) || (B.Paintball && B.Paintball.attivo) || (B.Raid && B.Raid.attivo)) return; UI.toast(t); });
    G.su('transizione', fn => UI.fade(fn));
    G.su('stanza', aggiornaStanza);
    G.su('profilo', d => apriFoglio(d.id));
    G.su('chat', () => rendiChat());
    G.su('blocchi', () => { rendiChat(); aggiornaBadgeDM(); if (paginaAttiva === 'profilo') aggiornaBloccati(); if (paginaAttiva === 'messaggi') { G.stato.dmAperto ? rendiThread() : mostraElencoDM(); } });
    G.su('dm', d => {
      ordineDM = [d.id].concat(ordineDM.filter(x => x !== d.id));
      if (G.stato.dmAperto === d.id) { G.segnaLetti(d.id); rendiThread(); }
      else if (paginaAttiva === 'messaggi' && !G.stato.dmAperto) mostraElencoDM();
      aggiornaBadgeDM();
    });
    setInterval(UI.disegnaMinimappa, 70);

    // tastiera sul telefono: nasconde la barra in basso e adatta l'altezza
    // schermata iniziale: la pagina resta ferma (niente cambi di altezza), scorre solo la scheda per portare il nickname in alto, sopra la tastiera
    const inInizio = () => !$('#inizio').hidden;
    function nickInAlto(inp) {
      const box = $('#inizio'), y = inp.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 90;
      window.scrollTo(0, 0); box.scrollTop = Math.max(0, y);
    }
    app.addEventListener('focusin', e => {
      if (e.target.tagName !== 'INPUT') return;
      if (inInizio()) { const inp = e.target; app.style.height = ''; [0, 120, 400].forEach(ms => setTimeout(() => { if (document.activeElement === inp) nickInAlto(inp); }, ms)); return; }
      app.classList.add('tastiera'); setTimeout(UI.aggiornaArea, 50);
    });
    app.addEventListener('focusout', e => {
      if (e.target.tagName !== 'INPUT') return;
      setTimeout(() => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        app.classList.remove('tastiera'); app.style.height = ''; UI.aggiornaArea(); window.scrollTo(0, 0);
      }, 350);
    });
    ['#chat-form button', '#dm-form button'].forEach(sel => $(sel).addEventListener('mousedown', e => e.preventDefault()));
    if (window.visualViewport) {
      let rafVV = 0;
      const adatta = () => { if (!rafVV) rafVV = requestAnimationFrame(() => { rafVV = 0; adattaOra(); }); };
      const adattaOra = () => {
        if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
        if (window.B3_ORIZZ || document.body.classList.contains('kart-attivo') || document.body.classList.contains('pb-attivo') || document.body.classList.contains('raid-attivo')) { window.scrollTo(0, 0); return; }
        if (inInizio()) { if (app.style.height) { app.style.height = ''; UI.aggiornaArea(); } return; }
        // senza tastiera l'app occupa tutto lo schermo; prima seguiva sempre l'area visibile e, girando il telefono,
        // barre del browser e altezza si rincorrevano facendo oscillare la schermata
        const tastiera = app.classList.contains('tastiera') && window.innerWidth < 560;
        const h = tastiera ? Math.round(window.visualViewport.height) + 'px' : '';
        if (app.style.height === h) return;
        app.style.height = h; UI.aggiornaArea();
        const box = $('#dm-messaggi'); if (box && !$('#dm-thread').hidden) box.scrollTop = box.scrollHeight;   // ultimi messaggi sopra la tastiera
      };
      window.visualViewport.addEventListener('resize', adatta); window.visualViewport.addEventListener('scroll', adatta); adatta();
    }
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
    window.addEventListener('resize', UI.aggiornaArea);
  };

  window.UI = UI;
  UI.init();
})();
