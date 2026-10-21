/* =====================================================================
   STANZA AMICI SUL SERVER NAKAMA
   Stessa forma della stanza di claude.ai e di quella PeerJS (vedi online.js):
   presence(patch) e onPeers(f) con { joined, left, updated }.
   Il telefono entra con un id dispositivo anonimo (salvato in localStorage),
   chiede al server la partita del codice (rpc stanza_entra) e ci entra;
   da li' manda la sua presenza (op 1) e riceve quella degli altri.
   Se la connessione cade riprova da solo, con attese crescenti.
   Indirizzo del server: "host:porta" (senza https, per lo sviluppo in locale)
   oppure "https://host" (in produzione, websocket sicuro).
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3 = window.B3 || {};
  const CHIAVE = 'defaultkey';   // chiave pubblica del server (non e' un segreto: sta in ogni client)
  const OP_PRESENZA = 1, OP_TUTTI = 2, OP_VIA = 3, MAX_BYTE = 8192;

  // testo <-> base64 in UTF-8 (il protocollo JSON di Nakama manda i dati in base64)
  const a64 = s => { const b = new TextEncoder().encode(s); let t = ''; for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(t); };
  const da64 = s => new TextDecoder().decode(Uint8Array.from(atob(s || ''), c => c.charCodeAt(0)));

  function indirizzi(server) {
    let s = String(server || '').trim().replace(/\/+$/, '');
    const sicuro = /^https:\/\//i.test(s) || (!/^http:\/\//i.test(s) && !/^(localhost|127\.|192\.168\.|10\.)/.test(s) && !/:\d+$/.test(s));
    s = s.replace(/^https?:\/\//i, '');
    return { http: (sicuro ? 'https://' : 'http://') + s, ws: (sicuro ? 'wss://' : 'ws://') + s };
  }
  function idDispositivo() {
    let id = null;
    try { id = localStorage.getItem('borg_dispositivo'); } catch (e) { }
    if (!id || id.length < 10) {
      id = 'borg-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
      try { localStorage.setItem('borg_dispositivo', id); } catch (e) { }
    }
    return id;
  }

  // Il gioco pubblicato sul dominio vero (https://tuodominio.it o www.) usa il server
  // https://api.tuodominio.it. Altrove (GitHub Pages, anteprime di Cloudflare, claude.ai,
  // computer di casa) niente server automatico: si resta su PeerJS o su ?server=.
  B.serverDelDominio = function (loc) {
    if (!loc || loc.protocol !== 'https:') return '';
    const host = String(loc.hostname || '').toLowerCase().replace(/^www\./, '');
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^[\d.]+$/.test(host)) return '';
    if (/(^|\.)(github\.io|pages\.dev|claude\.ai|claudeusercontent\.com|anthropic\.com|sslip\.io|localhost)$/.test(host)) return '';
    return 'https://api.' + host;
  };

  B.stanzaNakama = function (codice, server, opz) {
    opz = opz || {};
    const url = indirizzi(server), dispositivo = opz.dispositivo || idDispositivo();
    const altri = new Map(), subs = [];
    let ws = null, matchId = null, mioId = null, mia = {}, cid = 0, attesa = 1000, aperto = false, chiuso = false;
    const risposte = new Map();
    const voce = (id, p) => Object.freeze({ peer: id, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: p, updatedAt: Date.now() });
    const avvisa = ch => subs.forEach(f => { try { f(Object.assign({ joined: [], left: [], updated: [] }, ch)); } catch (e) { console.warn('online', e); } });
    const metti = (id, p) => { if (!id || id === mioId || !p || typeof p !== 'object') return; const c = altri.has(id), v = voce(id, p); altri.set(id, v); avvisa(c ? { updated: [v] } : { joined: [v] }); };
    const via = id => { const v = altri.get(id); if (v) { altri.delete(id); avvisa({ left: [v] }); } };

    function chiedi(msg) {
      return new Promise((ok, ko) => {
        const c = String(++cid); risposte.set(c, { ok, ko });
        ws.send(JSON.stringify(Object.assign({ cid: c }, msg)));
        setTimeout(() => { if (risposte.delete(c)) ko(new Error('nessuna risposta')); }, 10000);
      });
    }
    function mandaMia() {
      if (!aperto || !matchId || !ws || ws.readyState !== 1) return;
      const j = JSON.stringify(mia);
      if (j.length > MAX_BYTE) { console.warn('online: presenza troppo grande, non la mando', j.length); return; }   // il server la scarterebbe comunque
      ws.send(JSON.stringify({ match_data_send: { match_id: matchId, op_code: OP_PRESENZA, data: a64(j) } }));
    }
    function ricevi(ev) {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.cid && risposte.has(m.cid)) { const r = risposte.get(m.cid); risposte.delete(m.cid); if (m.error) r.ko(new Error(m.error.message || 'errore')); else r.ok(m); return; }
      if (!m.match_data || m.match_data.match_id !== matchId) return;
      let d; try { d = JSON.parse(da64(m.match_data.data)); } catch (e) { return; }
      const op = +m.match_data.op_code;
      if (op === OP_PRESENZA && Array.isArray(d.l)) d.l.forEach(x => Array.isArray(x) && metti(x[0], x[1]));
      else if (op === OP_TUTTI && Array.isArray(d.l)) {
        if (d.io) mioId = d.io;
        const ks = d.l.slice(0, 64).map(x => Array.isArray(x) ? x[0] : null);
        d.l.slice(0, 64).forEach(x => Array.isArray(x) && metti(x[0], x[1]));
        [...altri.keys()].forEach(k => { if (!ks.includes(k)) via(k); });
      } else if (op === OP_VIA && d.id) via(d.id);
    }

    async function collega() {
      if (chiuso) return;
      ws = null;
      try {
        const r = await fetch(url.http + '/v2/account/authenticate/device?create=true', {
          method: 'POST', headers: { 'Authorization': 'Basic ' + btoa(CHIAVE + ':'), 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dispositivo })
        });
        if (!r.ok) throw new Error('accesso ' + r.status);
        const sess = await r.json();
        try { mioId = JSON.parse(atob(sess.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).uid; } catch (e) { }
        const s = ws = new WebSocket(url.ws + '/ws?lang=it&status=false&format=json&token=' + encodeURIComponent(sess.token));
        s.onmessage = ricevi;
        s.onclose = () => {
          if (ws !== s) return;
          const eraAperto = aperto; aperto = false; matchId = null;
          risposte.forEach(r => r.ko(new Error('chiuso'))); risposte.clear();
          [...altri.keys()].forEach(via);
          if (chiuso) return;
          if (eraAperto && opz.avvisa) opz.avvisa('Connessione al server persa, mi ricollego…');
          setTimeout(collega, attesa); attesa = Math.min(30000, attesa * 2);
        };
        await new Promise((ok, ko) => { s.onopen = ok; s.onerror = () => ko(new Error('websocket')); });
        const rpc = await chiedi({ rpc: { id: 'stanza_entra', payload: JSON.stringify({ codice }) } });
        const id = JSON.parse(rpc.rpc.payload).match_id;
        matchId = id;   // da qui i dati della partita sono nostri (lo snapshot puo' arrivare prima della risposta)
        await chiedi({ match_join: { match_id: id } });
        aperto = true; attesa = 1000;
        mandaMia();
        if (opz.avvisa) opz.avvisa('Collegato al server: stanza amici "' + codice + '"');
      } catch (e) {
        console.warn('online server', e && e.message);
        if (ws && ws.readyState < 2) ws.close();   // onclose riprova
        else if (!ws) { setTimeout(collega, attesa); attesa = Math.min(30000, attesa * 2); }
      }
    }
    collega();

    return {
      presence(patch) { mia = Object.assign({}, mia, patch); mandaMia(); return Promise.resolve(); },
      onPeers(f) { subs.push(f); return () => { const i = subs.indexOf(f); if (i >= 0) subs.splice(i, 1); }; },
      chiudi() { chiuso = true; if (ws) try { ws.close(); } catch (e) { } },
      stato: () => ({ server: url.http, aperto, mioId, matchId, altri: altri.size })
    };
  };
})();
