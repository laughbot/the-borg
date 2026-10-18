/* =====================================================================
   BORGO LUME 3D - LOGICA DEL GIOCO (locale e SIMULATA)
   Chat della piazza, messaggi privati, blocco, salvataggio del profilo.
   Non disegna nulla: emette eventi. In futuro qui parlera' il server vero.
   ===================================================================== */
(function () {
  'use strict';
  const CFG = window.CONFIG;

  const ascoltatori = {};
  function su(ev, fn) { (ascoltatori[ev] = ascoltatori[ev] || []).push(fn); }
  function emetti(ev, dati) { (ascoltatori[ev] || []).forEach(fn => fn(dati)); }

  const stato = {
    t: 0, stanzaId: null, giocatore: null, chat: [], dm: {}, dmAperto: null, bloccati: new Set(),
    atmosfera: 'tramonto', grafica: 'alta', timerChat: 7, ultimoMsgChat: 0, arrivoInviato: false, tInizio: 0
  };

  const ora = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const utente = id => CFG.utentiDemo.find(u => u.id === id);
  // gli abitanti dimostrativi in piazza: al massimo CFG.maxBotPiazza (ogni abitante costa al telefono come un pezzo di piazza)
  const botPiazza = () => CFG.utentiDemo.filter(u => u.online).slice(0, CFG.maxBotPiazza || 99);
  const inPiazza = () => botPiazza().filter(u => !stato.bloccati.has(u.id));

  /* ---------- chat pubblica (simulata) ---------- */
  function aggiungiChat(id, nick, testo, io) {
    const voce = { id, nick, testo, ora: ora(), io: !!io };
    stato.chat.push(voce); if (stato.chat.length > 80) stato.chat.shift();
    emetti('chat', voce);
  }
  function inviaChat(testo) {
    testo = (testo || '').trim().slice(0, 120);
    if (!testo) return false;
    const adesso = performance.now();
    if (adesso - stato.ultimoMsgChat < 700) { emetti('toast', 'Piano, un messaggio alla volta'); return false; }
    stato.ultimoMsgChat = adesso;
    aggiungiChat('io', stato.giocatore.nick, testo, true);
    if (stato.stanzaId === 'piazza' && Math.random() < 0.55) {
      const cand = inPiazza();
      if (cand.length) setTimeout(() => { const u = pick(inPiazza().length ? inPiazza() : cand); aggiungiChat(u.id, u.nick, pick(CFG.rispostePiazza).replace('{nick}', stato.giocatore.nick)); }, rnd(1500, 3200));
    }
    return true;
  }

  /* ---------- messaggi privati ----------
     I bot non scrivono e non ricevono messaggi privati: arrivano solo dagli amici veri (online.js). */
  function conversazione(id) { return stato.dm[id] || (stato.dm[id] = { msgs: [], nonLetti: 0 }); }
  function totNonLetti() { return Object.keys(stato.dm).reduce((s, k) => s + (stato.bloccati.has(k) ? 0 : stato.dm[k].nonLetti), 0); }
  function segnaLetti(id) { const c = conversazione(id); if (c.nonLetti) { c.nonLetti = 0; emetti('dm', { id }); } }
  function inviaDM() { emetti('toast', 'I messaggi privati si scambiano solo con gli amici veri'); return false; }
  function eliminaConversazione(id) { if (!stato.dm[id]) return; delete stato.dm[id]; emetti('dm', { id }); }
  function eliminaMessaggio(id, i) { const c = stato.dm[id]; if (!c || !c.msgs[i]) return; c.msgs.splice(i, 1); emetti('dm', { id }); }
  function blocca(id) { stato.bloccati.add(id); emetti('blocchi', { id }); }
  function sblocca(id) { stato.bloccati.delete(id); emetti('blocchi', { id }); }
  function segnala() { emetti('toast', 'Segnalazione registrata (dimostrativa: non viene inviato nulla)'); }

  /* ---------- salvataggio locale (solo su questo dispositivo) ---------- */
  function carica() { try { return JSON.parse(localStorage.getItem(CFG.chiaveSalvataggio) || 'null'); } catch (e) { return null; } }
  function salva() {
    try { localStorage.setItem(CFG.chiaveSalvataggio, JSON.stringify({ nick: stato.giocatore.nick, look: stato.giocatore.look, atmosfera: stato.atmosfera, grafica: stato.grafica })); } catch (e) { /* storage non disponibile */ }
  }

  /* ---------- ciclo: chat simulata e messaggio in arrivo ---------- */
  function tick(dt) {
    if (!stato.giocatore) return;
    stato.t += dt;
    if (stato.stanzaId === 'piazza') {
      stato.timerChat -= dt;
      if (stato.timerChat <= 0) {
        stato.timerChat = rnd(6, 13);
        const c = inPiazza(); if (c.length) { const u = pick(c); aggiungiChat(u.id, u.nick, pick(CFG.frasiPiazza)); }
      }
    }
  }

  function avvia(nick, look) {
    stato.giocatore = { id: 'io', nick, look: Object.assign({}, look), io: true };
    stato.chat = []; stato.dm = {}; stato.bloccati = new Set(); stato.dmAperto = null; stato.timerChat = 7;
    salva();
  }
  function nickValido(n) { return /^[A-Za-z0-9_]{3,14}$/.test(n); }
  function impostaAtmosfera(id) { stato.atmosfera = id; salva(); emetti('atmosfera', id); }
  function impostaGrafica(g) { stato.grafica = g; salva(); emetti('grafica', g); }
  function cambiaLook(look) { stato.giocatore.look = Object.assign({}, look); salva(); emetti('look', stato.giocatore.look); }

  window.Gioco = { stato, su, emetti, avvia, tick, inviaChat, inviaDM, eliminaConversazione, eliminaMessaggio, conversazione, totNonLetti, segnaLetti, blocca, sblocca, segnala,
    carica, salva, utente, nickValido, impostaAtmosfera, impostaGrafica, cambiaLook, inPiazza, botPiazza };
})();
