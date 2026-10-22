/* se qualcosa si rompe sul telefono, mostra l'errore in basso (tocca per chiuderlo): serve a capire i problemi che capitano solo su iPhone.
   Gli ultimi 30 errori restano salvati sul telefono (theborg.errori.v1): dal Profilo, "Copia rapporto errori" li copia
   con versione del gioco e telefono, così si possono incollare in chat e correggere. */
(function () {
  'use strict';
  const CHIAVE = 'theborg.errori.v1', MAX = 30;
  let n = 0;
  function leggi() { try { return JSON.parse(localStorage.getItem(CHIAVE)) || []; } catch (e) { return []; } }
  function registra(msg, dove, pila) {
    try {
      const v = document.querySelector('meta[name="versione"]');
      const el = leggi(), ultimo = el[el.length - 1];
      // lo stesso errore ripetuto (per esempio in ogni fotogramma) si conta una volta sola
      if (ultimo && ultimo.m === msg && ultimo.d === dove) { ultimo.x = (ultimo.x || 1) + 1; ultimo.t = Date.now(); }
      else el.push({ t: Date.now(), m: String(msg).slice(0, 300), d: dove || '', p: String(pila || '').split('\n').slice(0, 6).join('\n').slice(0, 800), v: v ? v.content : '', s: document.body ? document.body.className.slice(0, 120) : '' });
      localStorage.setItem(CHIAVE, JSON.stringify(el.slice(-MAX)));
    } catch (e) { /* telefono pieno o salvataggio bloccato: pazienza */ }
  }
  function mostra(t) {
    if (n++ > 2) return;
    const d = document.createElement('div'); d.textContent = 'Errore: ' + t;
    d.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#7a1d1d;color:#fff;font:12px/1.35 system-ui,sans-serif;padding:8px 10px;border-radius:8px;white-space:pre-wrap';
    d.onclick = () => d.remove(); (document.body || document.documentElement).appendChild(d);
  }
  window.addEventListener('error', e => {
    const dove = e.filename ? e.filename.split('/').pop().split('?')[0] + ':' + e.lineno + ':' + e.colno : '';
    registra(e.message || 'errore', dove, e.error && e.error.stack);
    mostra((e.message || 'errore') + (dove ? ' (' + dove + ')' : ''));
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    registra('Promessa: ' + String(r && r.message || r), '', r && r.stack);
    mostra(String(r && r.message || r));
  });

  // rapporto da copiare (lo usa il pulsante nel Profilo)
  window.BorgErrori = {
    elenco: leggi,
    svuota() { try { localStorage.removeItem(CHIAVE); } catch (e) { /* ok */ } },
    rapporto() {
      const el = leggi(), v = document.querySelector('meta[name="versione"]');
      const righe = ['Borgopia - rapporto errori', 'Versione: ' + (v ? v.content : '?'), 'Telefono: ' + navigator.userAgent, 'Schermo: ' + screen.width + 'x' + screen.height + ' @' + (window.devicePixelRatio || 1), ''];
      if (!el.length) righe.push('Nessun errore registrato.');
      el.forEach(x => {
        righe.push('[' + new Date(x.t).toLocaleString('it-IT') + ']' + (x.x ? ' ×' + x.x : '') + (x.v && v && x.v !== v.content ? ' (versione ' + x.v + ')' : ''));
        righe.push(x.m + (x.d ? ' (' + x.d + ')' : ''));
        if (x.s) righe.push('Schermata: ' + x.s);
        if (x.p) righe.push(x.p);
        righe.push('');
      });
      return righe.join('\n');
    }
  };
})();
