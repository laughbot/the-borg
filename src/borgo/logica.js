/* =====================================================================
   BORGO LUME 3D - LOGICA DEL GIOCO (locale e SIMULATA)
   Chat della piazza, messaggi privati, blocco, segnalazioni, salvataggio del profilo.
   Non disegna nulla: emette eventi. In futuro qui parlera' il server vero.
   Ogni messaggio passa da controllaMessaggio(): filtro (src/chat/filtro.js)
   e modalita' lenta. Chi invia messaggi bloccati di continuo resta muto per un po'.
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

  /* ---------- sicurezza: filtro, modalita' lenta, silenzio dopo troppi messaggi bloccati ---------- */
  const FC = window.FiltroChat;
  const limiti = { chat: FC.creaLimitatore(), dm: FC.creaLimitatore({ massimo: 8 }) };
  const MUTO_DOPO = 3, MUTO_FINESTRA = 120000, MUTO_DURATA = 60000;   // 3 messaggi bloccati in 2 minuti -> 1 minuto di silenzio
  let bloccatiDi = [], mutoFino = 0;
  // tipo: 'chat' o 'dm'. Restituisce il testo da inviare (gia' ripulito) oppure null, dopo aver avvisato il giocatore.
  function controllaMessaggio(testo, tipo, max) {
    testo = FC.sistema(testo).slice(0, max || 120);
    if (!testo) return null;
    const ora = Date.now();
    if (ora < mutoFino) { emetti('toast', 'Chat in pausa: potrai scrivere tra ' + Math.ceil((mutoFino - ora) / 1000) + ' secondi'); return null; }
    const lim = limiti[tipo] || limiti.chat, no = lim.prova(testo, ora);
    if (no) { emetti('toast', no); return null; }
    const r = FC.controlla(testo);
    if (!r.ok) {
      bloccatiDi = bloccatiDi.filter(t => ora - t < MUTO_FINESTRA).concat(ora);
      if (bloccatiDi.length >= MUTO_DOPO) { mutoFino = ora + MUTO_DURATA; bloccatiDi = []; emetti('toast', 'Troppi messaggi non permessi: chat in pausa per un minuto'); }
      else emetti('toast', r.avviso);
      emetti('bloccato', r);
      return null;
    }
    lim.registra(r.testo, ora);
    return r.testo;
  }

  /* ---------- chat pubblica (simulata) ----------
     Ogni voce ricorda il luogo (stanza): ogni luogo ha la sua chat, come le stanze di Habbo.
     sussurro: solo tu e chi lo riceve lo vedete; lontano: detto lontano da te (piu' tenue). */
  function aggiungiVoce(voce) {
    voce.stanza = voce.stanza || stato.chiaveChat || stato.stanzaId;
    voce.reazioni = voce.reazioni || {};
    if (!voce.io && stato.giocatore && citaNick(voce.testo, stato.giocatore.nick)) voce.menzione = true;
    stato.chat.push(voce); if (stato.chat.length > 150) stato.chat.shift();
    emetti('chat', voce);
    if (voce.menzione) emetti('menzione', voce);
    return voce;
  }
  // "@Nick" nel testo (maiuscole e minuscole non contano)
  function citaNick(testo, nick) {
    if (!nick) return false;
    const re = new RegExp('@' + nick.replace(/[^A-Za-z0-9_]/g, '') + '(?![A-Za-z0-9_])', 'i');
    return re.test(testo || '');
  }

  /* ---------- reazioni ai messaggi (❤️ 😂 👍 😮): un tocco mette o toglie la tua ----------
     voce.reazioni = { emoji: [nick, ...] }. Con gli amici veri viaggiano con la chiave del messaggio (online/amici.js). */
  const REAZIONI = ['❤️', '😂', '👍', '😮'];
  const RISPOSTE_CITATO = ['Eccomi!', 'Dimmi tutto!', 'Ciao! 👋', 'Sì?', 'Ci sono!', 'Ahah, ciao!'];
  function reagisci(voce, emoji, daNick, on) {
    if (!voce || REAZIONI.indexOf(emoji) < 0) return;
    const chi = daNick || (stato.giocatore && stato.giocatore.nick) || 'io', l = voce.reazioni[emoji] || (voce.reazioni[emoji] = []);
    const i = l.findIndex(n => n.toLowerCase() === chi.toLowerCase()), metti = on === undefined ? i < 0 : on;
    if (metti && i < 0) l.push(chi); else if (!metti && i >= 0) l.splice(i, 1);
    else return;
    if (!l.length) delete voce.reazioni[emoji];
    emetti('reazione', { voce, emoji, on: metti, mia: !daNick });
  }
  function voceDaChiave(k) { for (let i = stato.chat.length - 1; i >= 0; i--) if (stato.chat[i].chiave === k) return stato.chat[i]; return null; }
  function aggiungiChat(id, nick, testo, io, extra) { return aggiungiVoce(Object.assign({ id, nick, testo, ora: ora(), io: !!io }, extra || {})); }
  function chatQui() { const k = stato.chiaveChat || stato.stanzaId; return stato.chat.filter(m => m.stanza === k); }

  // sussurro a un abitante dimostrativo (quelli degli amici veri li gestisce online/amici.js)
  const SUSSURRI = ['Psst! Ciao {nick} 😄', 'Shh, è un segreto!', 'Ahah, ok!', 'Non lo dico a nessuno 🤫', 'Ci vediamo alla fontana?', 'Hehe 😉'];
  function inviaSussurro(id, testo) {
    const u = utenteDi(id); if (!u) return false;
    if (stato.bloccati.has(id)) { emetti('toast', 'Hai bloccato questo utente'); return false; }
    if (stato.stanzaId !== 'piazza' || !inPiazza().some(b => b.id === id)) { emetti('toast', u.nick + ' non è qui: non puoi sussurrargli'); return false; }
    testo = controllaMessaggio(testo, 'chat', 120);
    if (!testo) return false;
    aggiungiChat('io', stato.giocatore.nick, testo, true, { sussurro: true, aId: id, aNick: u.nick });
    if (Math.random() < 0.6) setTimeout(() => { if (!stato.bloccati.has(id) && stato.stanzaId === 'piazza') aggiungiChat(id, u.nick, pick(SUSSURRI).replace('{nick}', stato.giocatore.nick), false, { sussurro: true }); }, rnd(1800, 3500));
    return true;
  }
  function inviaChat(testo) {
    testo = controllaMessaggio(testo, 'chat', 120);
    if (!testo) return false;
    const mia = aggiungiChat('io', stato.giocatore.nick, testo, true);
    // abitanti dimostrativi: chi viene citato con @ risponde quasi sempre; ogni tanto qualcuno mette una reazione
    if (stato.stanzaId === 'piazza') {
      const citato = inPiazza().find(u => citaNick(testo, u.nick));
      if (citato) { setTimeout(() => { if (!stato.bloccati.has(citato.id)) aggiungiChat(citato.id, citato.nick, '@' + stato.giocatore.nick + ' ' + pick(RISPOSTE_CITATO)); }, rnd(1400, 2600)); return true; }
      if (Math.random() < 0.3) setTimeout(() => { const u = pick(inPiazza()); if (u) reagisci(mia, pick(REAZIONI), u.nick, true); }, rnd(1500, 3500));
    }
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
  /* ---------- blocchi: restano salvati su questo telefono ---------- */
  const CHIAVE_BLOCCHI = 'theborg.bloccati.v1', CHIAVE_SEGNALAZIONI = 'theborg.segnalazioni.v1';
  const nomiBloccati = {};   // id -> nick, per l'elenco nel profilo
  function caricaBlocchi() {
    try { const l = JSON.parse(localStorage.getItem(CHIAVE_BLOCCHI) || '[]'); l.forEach(b => { stato.bloccati.add(b.id); nomiBloccati[b.id] = b.nick; }); } catch (e) { /* niente */ }
  }
  function salvaBlocchi() {
    try { localStorage.setItem(CHIAVE_BLOCCHI, JSON.stringify([...stato.bloccati].map(id => ({ id, nick: nomiBloccati[id] || (utenteDi(id) || {}).nick || id })))); } catch (e) { /* storage non disponibile */ }
  }
  const utenteDi = id => (window.Gioco && window.Gioco.utente ? window.Gioco.utente(id) : utente(id));
  function blocca(id) { nomiBloccati[id] = (utenteDi(id) || {}).nick || nomiBloccati[id] || id; stato.bloccati.add(id); salvaBlocchi(); emetti('blocchi', { id }); }
  function sblocca(id) { stato.bloccati.delete(id); salvaBlocchi(); emetti('blocchi', { id }); }
  function elencoBloccati() { return [...stato.bloccati].map(id => ({ id, nick: nomiBloccati[id] || (utenteDi(id) || {}).nick || id })); }

  /* ---------- segnalazioni ----------
     Restano in coda su questo telefono, con gli ultimi messaggi di quella persona come prova:
     quando ci sara' il server (fase 2) partiranno verso i moderatori. */
  const MOTIVI = [
    ['insulti', 'Insulti, bullismo o prese in giro'],
    ['sessuale', 'Messaggi o richieste a sfondo sessuale'],
    ['dati', 'Mi chiede dati personali, foto o di vederci'],
    ['minacce', 'Minacce o violenza'],
    ['spam', 'Spam o pubblicità'],
    ['imbroglio', 'Imbrogli o scambi scorretti'],
    ['nick', 'Nickname o aspetto offensivo'],
    ['altro', 'Altro']
  ];
  function segnalazioni() { try { return JSON.parse(localStorage.getItem(CHIAVE_SEGNALAZIONI) || '[]'); } catch (e) { return []; } }
  function segnala(id, motivo, nota) {
    const u = utenteDi(id) || { nick: id }, conv = stato.dm[id];
    const prove = stato.chat.filter(m => m.id === id).slice(-10).map(m => ({ dove: 'chat', ora: m.ora, testo: m.testo }))
      .concat(conv ? conv.msgs.filter(m => m.da === id).slice(-10).map(m => ({ dove: 'privato', ora: m.ora, testo: m.testo })) : []);
    const s = { quando: new Date().toISOString(), id, nick: u.nick, motivo: MOTIVI.some(m => m[0] === motivo) ? motivo : 'altro',
      nota: FC.sistema(nota || '').slice(0, 300), stanza: stato.stanzaId, prove, inviata: false };
    try { localStorage.setItem(CHIAVE_SEGNALAZIONI, JSON.stringify(segnalazioni().concat(s).slice(-50))); } catch (e) { /* storage non disponibile */ }
    emetti('segnalazione', s);
    return s;
  }

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
    caricaBlocchi(); salva();
  }
  function nickValido(n) { return /^[A-Za-z0-9_]{3,14}$/.test(n); }
  function nickPermesso(n) { return FC.nickOk(n); }
  function impostaAtmosfera(id) { stato.atmosfera = id; salva(); emetti('atmosfera', id); }
  function impostaGrafica(g) { stato.grafica = g; salva(); emetti('grafica', g); }
  function cambiaLook(look) { stato.giocatore.look = Object.assign({}, look); salva(); emetti('look', stato.giocatore.look); }

  window.Gioco = { stato, su, emetti, avvia, tick, inviaChat, inviaDM, eliminaConversazione, eliminaMessaggio, conversazione, totNonLetti, segnaLetti, blocca, sblocca, segnala,
    segnalazioni, MOTIVI, elencoBloccati, controllaMessaggio, aggiungiVoce, chatQui, inviaSussurro, citaNick, REAZIONI, reagisci, voceDaChiave, carica, salva, utente, nickValido, nickPermesso, impostaAtmosfera, impostaGrafica, cambiaLook, inPiazza, botPiazza };
})();
