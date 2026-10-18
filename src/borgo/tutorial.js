/* =====================================================================
   THE BORG 3D - TUTORIAL DEL PRIMO ACCESSO
   Appare la prima volta che si entra nel gioco: spiega i comandi con un
   riquadro che evidenzia i pulsanti. All'inizio si puo' scegliere "Salta".
   Si puo' rivedere dal Profilo ("Rivedi il tutorial").
   ===================================================================== */
(function () {
  'use strict';
  const CH = 'borg_tutorial_v2';
  const fatto = () => { try { return localStorage.getItem(CH) === '1'; } catch (e) { return false; } };
  const segna = () => { try { localStorage.setItem(CH, '1'); } catch (e) { /* ok */ } };

  const PASSI = [
    { t: 'Benvenuto nel Borgo! 👋', d: 'Vuoi un giro veloce di circa un minuto? Ti mostro i comandi principali. Puoi saltarlo adesso, o in qualsiasi momento.', inizio: true },
    { sel: '#joy', t: 'Muoviti', d: 'Trascina il pallino del joystick per camminare. Sul computer puoi usare anche le frecce o i tasti W A S D.' },
    { sel: '#controlli', t: 'Guarda come vuoi', d: 'Con questi pulsanti ruoti la visuale, ingrandisci o riduci, alzi e abbassi la telecamera. 😊 apre le emote (saluta, balla, ride...).' },
    { sel: '#minimappa-box', t: 'Minimappa e casa', d: 'La mappa mostra dove sei: toccala per ingrandirla. Il pulsante con la casetta ti porta subito a casa tua.' },
    { sel: '#pill-coins', t: 'I tuoi coins 🪙', d: 'Sono la moneta del gioco. Servono per comprare mobili, pavimenti e pareti per la tua casa, e per ampliare la stanza.' },
    { sel: '#btn-miss', t: 'Missioni', d: 'Ogni giorno hai delle missioni facili (parlare in chat, sederti, arredare...). Completale per guadagnare coins. Più giorni di fila giochi, più guadagni.' },
    { sel: '#btn-arreda', t: 'Arreda la casa', d: 'Qui in casa tocca questo pulsante per spostare i mobili col dito, girarli e cambiare pavimento e pareti. Parti con una stanza vuota ma con tutti i mobili base nello zaino.' },
    { sel: '#chat', t: 'Chat della piazza', d: 'In piazza puoi scrivere agli altri. Tocca un personaggio per vedere il profilo, scrivergli in privato, segnalarlo o bloccarlo.' },
    { sel: '#tabbar', t: 'Il menu', d: 'Mondo, Chat privata, Amici, Zaino e Profilo (qui cambi aspetto e atmosfera, e puoi rivedere questo tutorial).' },
    { t: 'Dove andare in piazza 🏛️', d: 'Esci da casa dalla porta in alto: in piazza trovi il negozio Arredamenti (lato ovest), Laugh Tale Collectibles con la sala giochi TCG, la Sala Giochi con kart e paintball, la Biblioteca e il belvedere. Quando sei vicino a una porta compare un pulsante giallo per entrare.' },
    { t: 'Sei pronto! 🎉', d: 'Divertiti e fai amicizia. Ricorda: gli altri abitanti e la chat sono ancora simulati (DEMO).', fine: true }
  ];

  let ov, spot, card, tit, txt, bAv, bIn, bSa, dots, i = 0, attivo = false;

  const css = document.createElement('style');
  css.textContent = `
#tut{position:absolute;inset:0;z-index:70;display:none;touch-action:none}
#tut.on{display:block}
#tut .sp{position:absolute;border-radius:16px;box-shadow:0 0 0 9999px rgba(10,5,20,.72);border:3px solid #f2c76e;transition:all .25s;pointer-events:none}
#tut .sp.nessuno{border-color:transparent;box-shadow:0 0 0 9999px rgba(10,5,20,.72)}
#tut .cd{position:absolute;left:12px;right:12px;max-width:380px;margin:0 auto;background:#2f2342;border:2px solid #f2c76e;border-radius:20px;padding:14px 16px 12px;color:#fbf3dc;box-shadow:0 12px 36px rgba(0,0,0,.55);font-family:inherit}
#tut .cd h3{margin:0 0 6px;font-size:18px}
#tut .cd p{margin:0 0 12px;font-size:14.5px;line-height:1.42;color:#e8dcc2}
#tut .rg{display:flex;gap:8px;align-items:center}
#tut .rg button{border:0;border-radius:12px;padding:10px 14px;font:800 14px inherit;font-family:inherit;cursor:pointer}
#tut .av{background:#f2c76e;color:#2a1a2e;flex:1}
#tut .in{background:rgba(255,255,255,.14);color:#fbf3dc}
#tut .sa{background:none;color:#b9aac9;text-decoration:underline;padding:10px 4px;margin-left:auto}
#tut .pt{display:flex;gap:5px;margin:0 0 10px}
#tut .pt i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.25)}
#tut .pt i.on{background:#f2c76e}
#tut .scelta{display:flex;flex-direction:column;gap:8px}
#tut .scelta button{width:100%}
@media (max-height:520px){#tut .cd{padding:10px 14px 8px;max-width:420px}#tut .cd p{font-size:13px;margin-bottom:8px}#tut .cd h3{font-size:15px}}
`;
  document.head.appendChild(css);

  function crea() {
    const app = document.getElementById('app'); if (!app) return false;
    ov = document.createElement('div'); ov.id = 'tut';
    ov.innerHTML = '<div class="sp nessuno"></div><div class="cd"><div class="pt"></div><h3></h3><p></p><div class="rg"></div></div>';
    app.appendChild(ov);
    spot = ov.querySelector('.sp'); card = ov.querySelector('.cd'); tit = card.querySelector('h3'); txt = card.querySelector('p'); dots = card.querySelector('.pt');
    ov.addEventListener('pointerdown', e => e.stopPropagation()); ov.addEventListener('click', e => e.stopPropagation());
    window.addEventListener('resize', () => { if (attivo) mostra(); });
    window.addEventListener('keydown', e => { if (!attivo) return; if (e.key === 'Escape') chiudi(true); });
    return true;
  }
  const visibile = el => el && el.offsetParent !== null && el.getBoundingClientRect().width > 0;

  function mostra() {
    const p = PASSI[i], rg = card.querySelector('.rg'); rg.textContent = '';
    tit.textContent = p.t; txt.textContent = p.d;
    dots.innerHTML = PASSI.map((q, k) => '<i class="' + (k === i ? 'on' : '') + '"></i>').join('');
    const btn = (cl, t, f) => { const b = document.createElement('button'); b.className = cl; b.textContent = t; b.addEventListener('click', f); rg.appendChild(b); return b; };
    if (p.inizio) {
      rg.className = 'rg scelta'; btn('av', '▶ Fai il giro (1 minuto)', () => { i++; mostra(); }); btn('in', '⏭ Salta, so già giocare', () => chiudi(true));
    } else {
      rg.className = 'rg';
      if (i > 1) btn('in', '←', () => { i--; mostra(); });
      btn('av', p.fine ? 'Inizia a giocare!' : 'Avanti →', () => { if (p.fine) chiudi(true); else { i++; mostra(); } });
      if (!p.fine) btn('sa', 'Salta', () => chiudi(true));
    }
    // evidenzia l'elemento (se c'e' ed e' visibile); altrimenti riquadro al centro
    const el = p.sel ? document.querySelector(p.sel) : null, ar = document.getElementById('app').getBoundingClientRect();
    card.style.top = card.style.bottom = '';
    if (visibile(el)) {
      const r = el.getBoundingClientRect(), m = 6;
      spot.classList.remove('nessuno');
      spot.style.left = (r.left - ar.left - m) + 'px'; spot.style.top = (r.top - ar.top - m) + 'px'; spot.style.width = (r.width + 2 * m) + 'px'; spot.style.height = (r.height + 2 * m) + 'px';
      const sopra = (r.top - ar.top) > ar.height / 2;                 // elemento in basso: riquadro in alto, e viceversa
      if (sopra) card.style.top = '70px'; else card.style.bottom = '14px';
    } else {
      spot.classList.add('nessuno'); spot.style.left = ar.width / 2 + 'px'; spot.style.top = ar.height / 2 + 'px'; spot.style.width = '0px'; spot.style.height = '0px';
      card.style.top = Math.max(20, (ar.height - card.offsetHeight) / 2) + 'px';
    }
  }
  function apri(daCapo) {
    if (!ov && !crea()) return; i = 0; attivo = true; ov.classList.add('on');
    if (window.B3 && B3.app && B3.app.joy) B3.app.joy.x = B3.app.joy.y = 0;
    mostra(); if (!daCapo) return;
  }
  function chiudi(salva) { attivo = false; if (ov) ov.classList.remove('on'); if (salva) segna(); }
  window.Tutorial = { apri: () => apri(true), attivo: () => attivo };

  // parte da sola la prima volta che si entra nel gioco
  let pronto = false;
  const tick = setInterval(() => {
    if (fatto()) { clearInterval(tick); return; }
    const hud = document.getElementById('hud'); if (!hud || hud.hidden) return;
    if (pronto) return; pronto = true; setTimeout(() => { clearInterval(tick); if (!fatto()) apri(true); }, 1200);
  }, 400);

  // pulsante nel Profilo per rivederlo
  function aggiungiBottone() {
    const esci = document.getElementById('btn-esci'); if (!esci || document.getElementById('btn-tutorial')) return !!esci;
    const b = document.createElement('button'); b.id = 'btn-tutorial'; b.className = 'btn-secondario'; b.textContent = '❓ Rivedi il tutorial'; b.style.cssText = 'margin:14px 16px 0;width:calc(100% - 32px)';
    b.addEventListener('click', () => { const t = document.querySelector('#tabbar button[data-vai="mondo"]'); if (t) t.click(); setTimeout(() => window.Tutorial.apri(), 250); });
    esci.parentNode.insertBefore(b, esci); return true;
  }
  const t2 = setInterval(() => { if (aggiungiBottone()) clearInterval(t2); }, 500);
})();
