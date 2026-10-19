/* =====================================================================
   THE BORG - ZAINO: la pagina "Zaino" della barra in basso.
   Mostra cio' che il giocatore possiede, leggendo i salvataggi degli altri moduli
   (non salva niente di suo):
   - Oggetti: secchio dei pesci, collezione pesci, stili della casa, ricordi
   - Mobili: i mobili comprati (B.Eco), quanti sono in casa e quanti liberi
   - Carte: Belinverse 2, il tuo mazzo e l'album del Set 001
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3;
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  const leggi = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const css = `
#pagina-zaino .zn-soldi{display:flex;gap:8px;flex-wrap:wrap;margin:0 14px 10px}
#pagina-zaino .zn-pill{padding:6px 12px;border-radius:99px;background:rgba(255,255,255,.08);font-size:13.5px;font-weight:700}
#pagina-zaino .zn-pill b{color:var(--ambra)}
#pagina-zaino .zaino-schede .catena{opacity:1;cursor:pointer}
#pagina-zaino #zaino-griglia.zn-corpo{display:block;padding:10px 14px 24px}
#pagina-zaino .zn-corpo h3{margin:16px 0 8px;font-size:15px;color:var(--ambra);display:flex;align-items:center;gap:8px}
#pagina-zaino .zn-corpo h3:first-child{margin-top:4px}
#pagina-zaino .zn-corpo h3 small{font-weight:600;color:var(--testo-tenue);font-size:12.5px}
#pagina-zaino .zn-nota{margin:0 0 8px;font-size:13px;color:var(--testo-tenue);line-height:1.4}
#pagina-zaino .zn-griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}
#pagina-zaino .zn-ogg{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px 9px;border-radius:14px;background:rgba(255,255,255,.07);text-align:center;font-size:12.5px;line-height:1.25;color:var(--crema);border:0;font-family:inherit}
#pagina-zaino .zn-ogg .im{width:64px;height:64px;border-radius:12px;display:grid;place-items:center;font-size:34px;background:rgba(0,0,0,.18);overflow:hidden;background-size:cover}
#pagina-zaino .zn-ogg .im img{width:100%;height:100%;object-fit:contain}
#pagina-zaino .zn-ogg b{font-size:12.5px}
#pagina-zaino .zn-ogg small{color:var(--testo-tenue);font-size:11.5px}
#pagina-zaino .zn-ogg .n{position:absolute;top:5px;right:6px;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:var(--ambra);color:#2a1a2e;font-weight:900;font-size:12px;display:grid;place-items:center}
#pagina-zaino .zn-vuoto{padding:14px;border-radius:14px;border:1.5px dashed rgba(255,255,255,.2);color:var(--testo-tenue);font-size:13px;text-align:center}
#pagina-zaino .zn-bt{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:99px;border:0;background:var(--ambra);color:#2a1a2e;font-weight:800;font-size:14px;font-family:inherit;cursor:pointer}
#pagina-zaino .zn-bt.sec{background:rgba(255,255,255,.12);color:var(--crema)}
#pagina-zaino .zn-riga{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 4px}
#pagina-zaino .zn-carte{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:8px}
#pagina-zaino .zn-carta{position:relative;border:0;padding:0;background:none;cursor:pointer;border-radius:7px}
#pagina-zaino .zn-carta img{width:100%;aspect-ratio:5/7;display:block;border-radius:7px;box-shadow:0 2px 6px rgba(0,0,0,.4)}
#pagina-zaino .zn-carta.fuori img{filter:saturate(.35) brightness(.55)}
#pagina-zaino .zn-carta .n{position:absolute;top:-5px;right:-5px;min-width:22px;height:22px;border-radius:11px;background:var(--ambra);color:#2a1a2e;font-weight:900;font-size:12px;display:grid;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.5)}
#pagina-zaino .zn-filtri{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}
#pagina-zaino .zn-filtri .catena{padding:6px 11px;font-size:13px;cursor:pointer}
#zn-zoom{position:fixed;inset:0;z-index:80;background:rgba(10,6,18,.85);display:none;align-items:center;justify-content:center;padding:20px}
#zn-zoom.on{display:flex}
#zn-zoom img{max-width:min(92vw,420px);max-height:86vh;border-radius:14px;box-shadow:0 8px 30px #000}
#zn-zoom.scorri{padding:0;flex-direction:column;background:rgba(10,6,18,.97)}
#zn-zoom .zs-fila{display:flex;width:100%;flex:1 1 auto;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
#zn-zoom .zs-fila::-webkit-scrollbar{display:none}
#zn-zoom .zs-p{flex:0 0 100%;scroll-snap-align:center;scroll-snap-stop:always;display:flex;align-items:center;justify-content:center;padding:16px 18px 8px;box-sizing:border-box}
#zn-zoom .zs-p img{max-width:min(86vw,420px);max-height:calc(100% - 8px);aspect-ratio:5/7;object-fit:contain}
#zn-zoom .zs-p.fuori img{filter:saturate(.35) brightness(.55)}
#zn-zoom .zs-giu{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:14px;padding:6px 12px calc(env(safe-area-inset-bottom,0px) + 14px);color:var(--crema);font-size:14px;font-weight:700;text-align:center}
#zn-zoom .zs-giu span{min-width:150px}
#zn-zoom .zs-giu small{display:block;font-weight:600;color:var(--testo-tenue);font-size:12px}
#zn-zoom .zs-fr{width:44px;height:44px;border-radius:22px;border:0;background:rgba(255,255,255,.14);color:var(--crema);font-size:22px;font-weight:900;cursor:pointer;font-family:inherit}
#zn-zoom .zs-fr:disabled{opacity:.3;cursor:default}
#zn-zoom .zs-x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);right:12px;width:40px;height:40px;border-radius:20px;border:0;background:rgba(255,255,255,.16);color:var(--crema);font-size:20px;font-weight:900;cursor:pointer;z-index:2}
body.orizz #pagina-zaino .zn-carte{grid-template-columns:repeat(auto-fill,minmax(70px,1fr))}
`;

  const RAR = { comune: '#b9c3cf', noncomune: '#6fbf73', raro: '#4a8df0', epico: '#b07cf0', leggendario: '#f2c76e', rottame: '#8a6a50' };
  const NOMI_RAR = { comune: 'comune', noncomune: 'non comune', raro: 'raro', epico: 'epico', leggendario: 'leggendario', rottame: 'rottame' };
  let scheda = 'oggetti', filtroCarte = 'tutte', costruito = false, pagina = null;

  function costruisci() {
    pagina = document.getElementById('pagina-zaino'); if (!pagina) return false;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const tag = pagina.querySelector('.tag-demo'); if (tag) tag.remove();
    const avv = pagina.querySelector('.avviso'); if (avv) avv.remove();
    const schede = pagina.querySelector('.zaino-schede'); schede.innerHTML = '';
    [['oggetti', 'Oggetti'], ['mobili', 'Mobili'], ['carte', 'Carte']].forEach(([id, t]) => {
      const b = el('button', 'catena', t); b.type = 'button'; b.dataset.s = id;
      b.addEventListener('click', () => { scheda = id; disegna(); });
      schede.appendChild(b);
    });
    const soldi = el('div', 'zn-soldi'); schede.before(soldi);
    document.getElementById('zaino-griglia').classList.add('zn-corpo');
    const z = el('div'); z.id = 'zn-zoom'; z.addEventListener('click', e => { if (!z.classList.contains('scorri') || e.target === z || e.target.classList.contains('zs-p') || e.target.classList.contains('zs-x')) chiudiZoom(); }); document.body.appendChild(z);
    document.addEventListener('keydown', e => { if (!z.classList.contains('on') || !z.classList.contains('scorri')) return; if (e.key === 'Escape') chiudiZoom(); else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const f = z.querySelector('.zs-fila'); f.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * f.clientWidth, behavior: 'smooth' }); } });
    // ridisegna ogni volta che la pagina si apre
    new MutationObserver(() => { if (!pagina.hidden) disegna(); }).observe(pagina, { attributes: true, attributeFilter: ['hidden'] });
    if (B.Eco) B.Eco.su(() => { if (!pagina.hidden) disegna(); });
    costruito = true; return true;
  }

  function zoom(src) { const z = document.getElementById('zn-zoom'); z.innerHTML = ''; z.classList.remove('scorri'); const i = new Image(); i.src = src; z.appendChild(i); z.classList.add('on'); }
  function chiudiZoom() { const z = document.getElementById('zn-zoom'); z.classList.remove('on', 'scorri'); z.innerHTML = ''; }
  // carte a tutto schermo che si scorrono col dito (o con le frecce), partendo da quella toccata
  function sfoglia(voci, da) {
    const z = document.getElementById('zn-zoom'); z.innerHTML = ''; z.classList.add('on', 'scorri');
    const x = el('button', 'zs-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Chiudi');
    const fila = el('div', 'zs-fila'), giu = el('div', 'zs-giu');
    const pr = el('button', 'zs-fr', '‹'), nx = el('button', 'zs-fr', '›'), info = el('span');
    pr.type = nx.type = 'button'; giu.append(pr, info, nx);
    voci.forEach((v, k) => {
      const p = el('div', 'zs-p' + (v.fuori ? ' fuori' : '')), i = new Image(); i.alt = v.nome; i.draggable = false;
      if (Math.abs(k - da) <= 2) i.src = v.src; else i.dataset.src = v.src;   // le altre si caricano mentre scorri
      p.appendChild(i); fila.appendChild(p);
    });
    z.append(x, fila, giu);
    let cur = -1;
    const vai = k => fila.scrollTo({ left: k * fila.clientWidth, behavior: 'smooth' });
    pr.addEventListener('click', () => vai(cur - 1)); nx.addEventListener('click', () => vai(cur + 1));
    const agg = () => {
      const k = Math.max(0, Math.min(voci.length - 1, Math.round(fila.scrollLeft / Math.max(1, fila.clientWidth)))); if (k === cur) return; cur = k;
      for (let j = k - 2; j <= k + 2; j++) { const im = fila.children[j] && fila.children[j].firstChild; if (im && im.dataset.src) { im.src = im.dataset.src; delete im.dataset.src; } }
      const v = voci[k]; info.innerHTML = esc(v.nome) + '<small>' + (k + 1) + ' / ' + voci.length + (v.sotto ? ' · ' + v.sotto : '') + '</small>';
      pr.disabled = k === 0; nx.disabled = k === voci.length - 1;
    };
    fila.addEventListener('scroll', agg, { passive: true });
    fila.scrollLeft = da * fila.clientWidth; requestAnimationFrame(() => { fila.scrollLeft = da * fila.clientWidth; agg(); }); agg();
  }
  function vaiAlMondo(poi) {
    const t = document.querySelector('#tabbar [data-vai="mondo"]'); if (t) t.click();
    if (poi) setTimeout(poi, 60);
  }
  function tile(icona, nome, sotto, n, click) {
    const d = el(click ? 'button' : 'div', 'zn-ogg'); if (click) { d.type = 'button'; d.addEventListener('click', click); }
    const im = el('div', 'im');
    if (icona && icona.src) { const i = new Image(); i.src = icona.src; i.alt = ''; im.appendChild(i); }
    else if (icona && icona.bg) { im.style.background = icona.bg; if (icona.size) im.style.backgroundSize = icona.size; if (icona.testo) { im.textContent = icona.testo; } }
    else im.textContent = icona || '📦';
    d.appendChild(im); d.appendChild(el('b', '', esc(nome))); if (sotto) d.appendChild(el('small', '', sotto));
    if (n > 1) d.appendChild(el('span', 'n', '×' + n));
    return d;
  }
  const vuoto = t => el('div', 'zn-vuoto', t);

  /* ---------- Oggetti ---------- */
  function oggetti(c) {
    const A = B.Attivita, P = A && A.stato, SP = (A && A.SPECIE) || [];
    // secchio
    const nel = P ? SP.filter(s => P.secchio[s.id]) : [];
    const tot = nel.reduce((a, s) => a + P.secchio[s.id], 0);
    c.appendChild(el('h3', '', '🪣 Secchio dei pesci <small>' + tot + ' pesci</small>'));
    if (!nel.length) c.appendChild(vuoto('Il secchio è vuoto. Vai a pescare al laghetto in piazza.'));
    else {
      c.appendChild(el('p', 'zn-nota', 'Li vendi alla Pescheria del mercatino, in piazza.'));
      const g = el('div', 'zn-griglia');
      nel.forEach(s => g.appendChild(tile({ bg: 'radial-gradient(circle at 50% 55%,' + s.col2 + ' 0 22%,' + s.col + ' 23% 60%,rgba(0,0,0,.18) 61%)', testo: '' }, s.nome, '<span style="color:' + (RAR[s.rar] || '#ccc') + '">' + (NOMI_RAR[s.rar] || '') + '</span> · 🪙 ' + s.prezzo, P.secchio[s.id])));
      c.appendChild(g);
    }
    // collezione
    if (P) {
      const trovate = SP.filter(s => !s.curiosita && P.pesci[s.id]).length, totale = SP.filter(s => !s.curiosita).length;
      c.appendChild(el('h3', '', '🐟 Collezione pesci <small>' + trovate + ' / ' + totale + ' specie</small>'));
      const r = el('div', 'zn-riga'), b = el('button', 'zn-bt sec', 'Apri la collezione'); b.type = 'button';
      b.addEventListener('click', () => vaiAlMondo(() => A.apriCollezione && A.apriCollezione()));
      r.appendChild(b); c.appendChild(r);
    }
    // stili della casa
    const E = B.Eco && B.Eco.stato;
    if (E && B.STILI) {
      c.appendChild(el('h3', '', '🎨 Pavimenti e pareti'));
      const g = el('div', 'zn-griglia');
      ['pav', 'par'].forEach(tipo => B.STILI[tipo].filter(a => B.Eco.haStile(a.id)).forEach(a => {
        g.appendChild(tile({ bg: B.STILI.anteprima(tipo, a), size: a.dis || a.tex ? '48px' : '' }, a.nome, (tipo === 'pav' ? 'pavimento' : 'pareti') + (B.Eco.stileInUso(tipo) === a.id ? ' · in uso' : ''), 0));
      }));
      c.appendChild(g);
    }
    // ricordi
    c.appendChild(el('h3', '', '🏅 Ricordi'));
    const g = el('div', 'zn-griglia'); let n = 0;
    if (P && P.trofeo) { g.appendChild(tile('🏆', 'Trofeo di pesca', 'è un mobile: lo metti in casa', 0)); n++; }
    const raid = leggi('theborg.raid.v2') || leggi('theborg.raid') || {}, fatti = Object.keys(raid).filter(k => raid[k]).length;
    if (fatti) { g.appendChild(tile('🗝️', 'La Cripta', fatti + ' incursion' + (fatti === 1 ? 'e completata' : 'i completate'), 0)); n++; }
    const bv = leggi('borg_belinverse_v1');
    if (bv && (bv.vinte || bv.perse)) { g.appendChild(tile('🃏', 'Belinverse 2', bv.vinte + ' vint' + (bv.vinte === 1 ? 'a' : 'e') + ' · ' + bv.perse + ' pers' + (bv.perse === 1 ? 'a' : 'e'), 0)); n++; }
    const kb = leggi('theborg.kart.best');
    if (typeof kb === 'number' && kb > 0) { g.appendChild(tile('🏎️', 'Go-kart', 'miglior tempo ' + kb.toFixed(2) + ' s', 0)); n++; }
    c.appendChild(n ? g : vuoto('Ancora niente: vinci a Belinverse, completa la Cripta o il trofeo di pesca.'));
  }

  /* ---------- Mobili ---------- */
  function mobili(c) {
    const E = B.Eco, L = (B.ARREDI || []).filter(a => E && E.posseduti(a.id) > 0);
    const tot = L.reduce((a, m) => a + E.posseduti(m.id), 0);
    c.appendChild(el('h3', '', '🛋️ I tuoi mobili <small>' + tot + ' in tutto</small>'));
    if (!L.length) { c.appendChild(vuoto('Non hai mobili. Li compri al negozio Arredamenti in piazza.')); return; }
    c.appendChild(el('p', 'zn-nota', 'Per metterli in casa vai a casa e tocca «Arreda». Tocca un mobile per vederlo più grande.'));
    const r = el('div', 'zn-riga'), b = el('button', 'zn-bt', '🏠 Vai a casa ad arredare'); b.type = 'button';
    b.addEventListener('click', () => vaiAlMondo(() => { const a = B.app; if (!a) return; if (a.stanza && a.stanza().id === 'casa') return; a.G.emetti('transizione', () => a.entraStanza('casa')); }));
    r.appendChild(b); c.appendChild(r);
    const g = el('div', 'zn-griglia');
    L.forEach(m => {
      const n = E.posseduti(m.id), liberi = E.liberi(m.id), src = B.anteprimaMobile && B.anteprimaMobile(m.id);
      g.appendChild(tile(src ? { src } : '🪑', m.nome, liberi === n ? 'tutti nello zaino' : liberi ? (n - liberi) + ' in casa · ' + liberi + ' liberi' : 'tutti in casa', n, src ? () => zoom(src) : null));
    });
    c.appendChild(g);
  }

  /* ---------- Carte: la collezione di Belinverse 2 (pacchetti dal venditore della sala TCG) ---------- */
  function carte(c) {
    const BC = B.BELIN_CARTE, BV = B.Belinverse; if (!BC || !BV) { c.appendChild(vuoto('Le carte non sono disponibili.')); return; }
    const img = id => (window.BELIN_IMG && window.BELIN_IMG[id]) || ('img/belinverse/' + id + '.webp');
    const coll = BV.collezione(), mazzo = BV.mazzo, inMazzo = {}; (mazzo || []).forEach(id => { inMazzo[id] = (inMazzo[id] || 0) + 1; });
    const tot = BC.CARTE.reduce((a, k) => a + (coll[k.id] | 0), 0), diverse = BV.carteDiverse();
    c.appendChild(el('h3', '', '🃏 Belinverse 2 <small>' + tot + ' carte · ' + diverse + ' diverse su ' + BC.CARTE.length + '</small>'));
    c.appendChild(el('p', 'zn-nota', (BV.gratisOggi() ? '🎁 Oggi hai un pacchetto gratis dal venditore nella sala TCG. ' : 'Il pacchetto gratis di oggi l\'hai già preso: gli altri si comprano a coins dal venditore nella sala TCG. ') + (mazzo ? 'Il tuo mazzo è pronto.' : tot >= 40 ? 'Hai abbastanza carte per costruire il tuo mazzo.' : 'Ti servono 40 carte per un mazzo tuo.')));
    const r = el('div', 'zn-riga');
    const pk = el('button', 'zn-bt', BV.gratisOggi() ? '🎁 Apri il pacchetto' : '🎁 Pacchetti'); pk.type = 'button';
    pk.addEventListener('click', () => vaiAlMondo(() => BV.negozio()));
    const gioca = el('button', 'zn-bt sec', '▶ Gioca'); gioca.type = 'button';
    gioca.addEventListener('click', () => vaiAlMondo(() => BV.apri()));
    r.append(pk, gioca); c.appendChild(r);
    const f = el('div', 'zn-filtri');
    [['tutte', 'Le mie carte'], ['mazzo', 'Nel mazzo'], ['C', 'Character'], ['E', 'Equipaggiamenti'], ['V', 'Eventi'], ['L', 'Belinoni']].forEach(([id, t]) => {
      if (id === 'mazzo' && !mazzo) return;
      const b = el('button', 'catena' + (filtroCarte === id ? ' sel' : ''), t); b.type = 'button';
      b.addEventListener('click', () => { filtroCarte = id; disegna(); }); f.appendChild(b);
    });
    c.appendChild(f);
    const base = ['101', '103', '105', '107', '109'];
    let lista;
    if (filtroCarte === 'tutte') lista = BC.CARTE.filter(k => coll[k.id]);
    else if (filtroCarte === 'mazzo') lista = BC.CARTE.filter(k => inMazzo[k.id]);
    else if (filtroCarte === 'L') lista = BC.LEADER;
    else lista = BC.CARTE.filter(k => k.t === filtroCarte);
    if (!lista.length) { c.appendChild(vuoto(filtroCarte === 'tutte' ? 'Non hai ancora carte: apri il pacchetto gratis dal venditore nella sala TCG.' : 'Niente qui.')); return; }
    if (filtroCarte !== 'tutte' && filtroCarte !== 'mazzo') c.appendChild(el('p', 'zn-nota', 'Le carte scure non le hai ancora.'));
    const g = el('div', 'zn-carte'), NT = { C: 'Character', E: 'Equipaggiamento', V: 'Evento', L: 'Belinone' }, NR = { C: 'Comune', R: 'Rara', SR: 'Super rara' };
    const voci = lista.map(k => {
      const n = coll[k.id] | 0, mia = k.t === 'L' ? base.includes(k.id) || n : n;
      return { src: img(k.id), nome: k.n, fuori: !mia, sotto: (k.t === 'L' ? (k.alt ? 'Belinone Alternative' : 'Belinone') : NT[k.t] + ' · ' + (NR[k.r] || '')) + (n ? ' · ne hai ' + n : mia ? '' : ' · non ce l\'hai') };
    });
    lista.forEach((k, idx) => {
      const n = filtroCarte === 'mazzo' ? inMazzo[k.id] : (coll[k.id] | 0), mia = k.t === 'L' ? base.includes(k.id) || coll[k.id] : coll[k.id];
      const b = el('button', 'zn-carta' + (mia ? '' : ' fuori')); b.type = 'button';
      const i = new Image(); i.src = img(k.id); i.alt = k.n; i.loading = 'lazy'; b.appendChild(i);
      if (n > 1 || (filtroCarte === 'mazzo' && n)) b.appendChild(el('span', 'n', '×' + n));
      if (k.t === 'L' && k.id === BV.leader) b.appendChild(el('span', 'n', '★'));
      b.addEventListener('click', () => sfoglia(voci, idx));
      g.appendChild(b);
    });
    c.appendChild(g);
  }

  function disegna() {
    if (!costruito && !costruisci()) return;
    pagina.querySelectorAll('.zaino-schede .catena').forEach(b => b.classList.toggle('sel', b.dataset.s === scheda));
    const E = B.Eco, P = B.Attivita && B.Attivita.stato;
    const pesci = P ? Object.keys(P.secchio).reduce((a, k) => a + P.secchio[k], 0) : 0;
    const coll = B.Belinverse ? B.Belinverse.collezione() : {}, nCarte = Object.keys(coll).reduce((a, k) => a + (k < '101' ? coll[k] : 0), 0);
    const nMob = E ? (B.ARREDI || []).reduce((a, m) => a + E.posseduti(m.id), 0) : 0;
    pagina.querySelector('.zn-soldi').innerHTML = '<span class="zn-pill">🪙 <b>' + (E ? E.coins : 0) + '</b> coins</span><span class="zn-pill">🛋️ <b>' + nMob + '</b> mobili</span><span class="zn-pill">🃏 <b>' + nCarte + '</b> carte</span><span class="zn-pill">🐟 <b>' + pesci + '</b> nel secchio</span>';
    const c = document.getElementById('zaino-griglia'); c.innerHTML = '';
    if (scheda === 'oggetti') oggetti(c); else if (scheda === 'mobili') mobili(c); else carte(c);
  }

  B.Zaino = { disegna };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', costruisci); else costruisci();
})();
