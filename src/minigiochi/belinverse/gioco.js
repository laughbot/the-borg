/* =====================================================================
   THE BORG 3D - BELINVERSE 2: il gioco di carte della sala giochi TCG.
   Partita a 2 contro un avversario guidato dal computer, con le regole del
   Set 001 (vedi belinverse-carte.js per le carte).
   Si apre da B.Belinverse.apri() (tavolo da gioco nella sala TCG).
   Struttura: motore (stato + regole, asincrono), IA, interfaccia (DOM).
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3;
  const { CARTE, LEADER, PER_ID } = B.BELIN_CARTE;
  const CHIAVE = 'borg_belinverse_v1';
  const PREMIO = 60, PREMI_GIORNO = 5;                   // coins per vittoria, vittorie premiate al giorno

  /* ---------- salvataggio: mazzo personale, Belinone scelto, statistiche ---------- */
  const SAV = { mazzo: null, leader: '101', vinte: 0, perse: 0, premiDi: '', premi: 0, coll: {}, pacchettoDi: '', pacchetti: 0 };
  try { const r = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); if (r) Object.assign(SAV, r); } catch (e) { /* ok */ }
  const salva = () => { try { localStorage.setItem(CHIAVE, JSON.stringify(SAV)); } catch (e) { /* ok */ } };
  if (!SAV.coll || typeof SAV.coll !== 'object') SAV.coll = {};

  /* ---------- collezione e pacchetti (le carte finiscono nello zaino) ---------- */
  const PACCHETTO = { carte: 6, prezzo: 150 };               // 1 gratis al giorno, gli altri a coins
  const possiedi = id => SAV.coll[id] | 0;
  const LEADER_BASE = ['101', '103', '105', '107', '109'];    // i Belinoni base si usano sempre; le Alternative si trovano nei pacchetti
  const oggiStr = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const gratisOggi = () => SAV.pacchettoDi !== oggiStr();
  function apriUnPacchetto() {
    const pesca1 = r => { const l = CARTE.filter(c => c.r === r); return l[rnd(l.length)].id; };
    const out = [];
    for (let k = 0; k < 4; k++) out.push(pesca1('C'));
    out.push(pesca1('R'));
    const x = Math.random(), alt = LEADER.filter(l => l.alt && !possiedi(l.id));
    out.push(x < 0.06 && alt.length ? alt[rnd(alt.length)].id : x < 0.33 ? pesca1('SR') : pesca1('R'));
    const ris = out.map(id => ({ id, nuova: !possiedi(id) }));
    out.forEach(id => { SAV.coll[id] = possiedi(id) + 1; });
    SAV.pacchetti = (SAV.pacchetti | 0) + 1; salva();
    return ris;
  }

  const img = id => (window.BELIN_IMG && window.BELIN_IMG[id]) || ('img/belinverse/' + id + '.webp');
  const rnd = n => Math.floor(Math.random() * n);
  const mescola = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const NOMI_TIPO = { C: 'Character', E: 'Equipaggiamento', V: 'Evento', L: 'Belinone' };

  /* ---------- mazzi ---------- */
  // mazzo casuale ma giocabile: ~24 Character con una curva di costi, 8 Equipaggiamenti, 8 Eventi
  function mazzoCasuale(lim) {
    const cont = {}, out = [], max = id => lim ? Math.min(3, lim(id)) : 3;
    const prendi = (pool, n, peso) => {
      let guard = 0;
      while (n > 0 && guard++ < 2000) {
        pool = pool.filter(c => max(c.id) > (cont[c.id] || 0)); if (!pool.length) return;
        const tot = pool.reduce((s, c) => s + peso(c), 0); let r = Math.random() * tot, c = pool[0];
        for (const x of pool) { r -= peso(x); if (r <= 0) { c = x; break; } }
        if ((cont[c.id] || 0) >= 2 && Math.random() < 0.7) continue;
        if ((cont[c.id] || 0) >= max(c.id)) continue;
        cont[c.id] = (cont[c.id] || 0) + 1; out.push(c.id); n--;
      }
    };
    const PC = { 1: 6, 2: 8, 3: 8, 4: 6, 5: 4, 6: 2.2, 7: 1, 8: 0.8 };
    prendi(CARTE.filter(c => c.t === 'C'), 24, c => PC[c.c] / ({ 1: 8, 2: 10, 3: 12, 4: 12, 5: 10, 6: 6, 7: 1, 8: 1 })[c.c]);
    prendi(CARTE.filter(c => c.t === 'E'), 8, c => c.c <= 3 ? 1.2 : 0.8);
    prendi(CARTE.filter(c => c.t === 'V'), 8, c => c.c <= 3 ? 1.1 : 0.7);
    return out;
  }
  const conteggio = m => m.reduce((o, id) => { o[id] = (o[id] || 0) + 1; return o; }, {});
  const mazzoValido = m => Array.isArray(m) && m.length === 40 && m.every(id => PER_ID[id] && PER_ID[id].t !== 'L') && Object.entries(conteggio(m)).every(([id, n]) => n <= 3 && n <= possiedi(id));
  const leaderOk = id => !!PER_ID[id] && PER_ID[id].t === 'L' && (LEADER_BASE.includes(id) || possiedi(id) > 0);
  const carteDiverse = () => CARTE.filter(c => possiedi(c.id)).length;
  const tuttePossedute = () => CARTE.reduce((s, c) => s + possiedi(c.id), 0);

  /* =====================================================================
     MOTORE
     ===================================================================== */
  class Fine extends Error { }
  // testi 'tu / l'avversario': online il tavolo li scrive per tutti e due, ognuno li legge dal suo lato
  const V = (p, tu, lui) => S && S.online ? '\u0001' + p.i + '\u0002' + tu + '\u0002' + lui + '\u0003' : (p.ia ? lui : tu);
  const risolvi = (t, chi) => String(t == null ? '' : t).replace(/\u0001(\d)\u0002([^\u0002]*)\u0002([^\u0003]*)\u0003/g, (m, i, tu, lui) => (+i === chi ? tu : lui));
  let S = null, uidN = 1;
  const nuovaIst = c => ({ uid: uidN++, c });
  const avv = p => S.g[1 - p.i];
  const pronte = p => p.tire - p.tireGirate;

  function nuovaPartita(mioMazzo, mioLeader, amico) {
    const crea = (i, nome, ia, mazzo, leader) => ({
      i, nome, ia, leader: { c: PER_ID[leader], girato: false, usato: -1, morteUsata: -1 },
      mazzo: mescola(mazzo.map(id => nuovaIst(PER_ID[id]))), mano: [], belinate: [], bormida: [], campo: [],
      tire: 0, tireGirate: 0, nTurni: 0
    });
    const lIA = LEADER.filter(l => !l.alt)[rnd(5)].id;
    S = { g: [crea(0, 'Tu', false, mioMazzo, mioLeader), amico ? crea(1, amico.nome, true, amico.mazzo, amico.leader) : crea(1, 'Avversario', true, mazzoCasuale(), Math.random() < 0.5 ? lIA : String(+lIA + 1).padStart(3, '0'))], turno: 0, att: 0, primo: rnd(2), fase: 'inizio', fine: null, log: [], occupato: false };
    S.att = S.primo;
  }

  function log(t, forte) { if (!S) return; S.log.push(t); if (S.log.length > 80) S.log.shift(); UI.log(risolvi(t, 0), forte); }

  function potenza(p, ch) {
    let v = ch.c.p + ch.bonusT - ch.malusT + ch.comb;
    ch.eq.forEach(e => { v += e.c.bonus || 0; });
    const st = ch.c.stat;
    if (st && ((st.min && p.campo.length >= st.min) || (st.eq && ch.eq.length))) v += st.v;
    if (p.leader.c.passivo === 'costo1' && ch.c.c === 1) v += 500;
    return Math.max(0, v);
  }
  const ha = (ch, k) => !!((ch.c.kw && ch.c.kw[k]) || ch.eq.some(e => e.c.kw && e.c.kw[k]));
  const puoAttaccare = (p, ch) => S.fase === 'attacchi' && S.att === p.i && p.nTurni > 1 && !ch.girato && (ch.entrato < S.turno || ha(ch, 'rush'));
  const leaderPuoAttaccare = p => S.fase === 'attacchi' && S.att === p.i && p.nTurni > 1 && !p.leader.girato;
  const leaderAbilUsabile = p => !!(p.leader.c.abil && p.leader.usato !== S.turno && pronte(p) >= p.leader.c.abil.costo);

  function pesca(p, n) {
    let k = 0;
    for (let i = 0; i < n && p.mazzo.length; i++) { p.mano.push(p.mazzo.shift()); k++; }
    return k;
  }
  function perde(p, motivo) {
    S.fine = { vince: avv(p).i, motivo };
    log(V(p, 'Hai', 'L\'avversario ha') + ' perso: ' + motivo, true);
    throw new Fine();
  }
  async function perdiBelinata(p) {
    if (!p.belinate.length) perde(p, V(p, 'sei stato colpito senza più Belinate', 'colpito senza più Belinate'));
    const c = p.belinate.shift(); p.mano.push(c);
    log(V(p, 'Perdi', 'L\'avversario perde') + ' una Belinata' + V(p, ': ' + c.c.n + ' va in mano', '') + ' (ne restano ' + p.belinate.length + ')', true);
    UI.colpo(p); UI.render(); await attesa(650);
  }
  function paga(p, n) { if (pronte(p) < n) return false; p.tireGirate += n; return true; }

  // un Character lascia il campo (Bormida o mano): i suoi Equipaggiamenti vanno in Bormida
  function lascia(p, ch, dove) {
    const i = p.campo.indexOf(ch); if (i < 0) return;
    p.campo.splice(i, 1);
    ch.eq.forEach(e => p.bormida.push(e)); ch.eq = [];
    const ist = { uid: ch.uid, c: ch.c };
    if (dove === 'mano') p.mano.push(ist); else p.bormida.push(ist);
  }
  // eliminazione (combattimento o effetto): Tasto Reset, effetti "quando viene eliminato", Belinone KingParis
  async function elimina(p, ch, causa) {
    if (p.campo.indexOf(ch) < 0) return false;
    if (causa === 'effetto' && ch.eq.some(e => e.c.noElimina)) return false;
    const reset = ch.eq.find(e => e.c.reset);
    if (reset) { ch.eq.splice(ch.eq.indexOf(reset), 1); p.bormida.push(reset); log(ch.c.n + ' resta in gioco grazie a ' + reset.c.n); return false; }
    const eqMorte = ch.eq.filter(e => e.c.morte);
    lascia(p, ch, 'bormida');
    log(ch.c.n + V(p, '', ' (avversario)') + ' è eliminato');
    UI.render();
    if (ch.c.morte) await esegui(p, ch.c.morte, ch);
    for (const e of eqMorte) await esegui(p, e.c.morte, ch);
    if (p.leader.c.passivo === 'pescaMorte' && p.leader.morteUsata !== S.turno) { p.leader.morteUsata = S.turno; if (pesca(p, 1)) log(p.leader.c.n + ': ' + V(p, 'peschi', 'l\'avversario pesca') + ' 1 carta'); }
    return true;
  }
  // girare con un effetto: Occhiali (immune), Casco (torna pronto la prima volta per turno)
  function giraEffetto(p, ch) {
    if (ch.eq.some(e => e.c.noGira)) return;
    if (ch.eq.some(e => e.c.casco) && ch.cascoUsato !== S.turno) { ch.cascoUsato = S.turno; log(ch.c.n + ': il Casco lo rimette pronto'); return; }
    ch.girato = true;
  }

  /* ---------- effetti ---------- */
  async function scegli(p, req) {
    if (!req.cand.length && !req.vuotoOk) return [];
    const r = p.remoto ? await RETE.scegli(p, req) : p.ia ? IA.scegli(p, req) : await UI.scegli(Object.assign({}, req, { titolo: risolvi(req.titolo, 0) }));
    return r || [];
  }
  async function scartaDa(p, n, titolo) {
    n = Math.min(n, p.mano.length); if (!n) return;
    const sc = await scegli(p, { scopo: 'scarta', titolo: titolo || ('Scarta ' + n + ' carta' + (n > 1 ? 'e' : '')), cand: p.mano.slice(), min: n, max: n, tipo: 'mano' });
    sc.forEach(c => { const i = p.mano.indexOf(c); if (i >= 0) { p.mano.splice(i, 1); p.bormida.push(c); } });
    if (sc.length) log(V(p, 'Scarti ', 'L\'avversario scarta ') + sc.map(c => c.c.n).join(', '));
  }
  async function esegui(p, fx, fonte) {
    const o = avv(p), nomeF = fonte ? fonte.c.n : '';
    for (const f of fx) {
      if (S.fine) return;
      switch (f.op) {
        case 'pesca': { const k = pesca(p, f.n); log(nomeF + ': ' + V(p, 'peschi ', 'l\'avversario pesca ') + k + ' carta' + (k === 1 ? '' : 'e')); break; }
        case 'scarta': await scartaDa(p, f.n, nomeF + ': scarta 1 carta'); break;
        case 'avvScarta': await scartaDa(o, 1, nomeF + ': devi scartare 1 carta'); break;
        case 'ogniAvvScarta': await scartaDa(o, 1, nomeF + ': devi scartare 1 carta'); break;
        case 'avvBelinata': log(nomeF + ': ' + V(o, 'perdi', 'l\'avversario perde') + ' 1 Belinata'); await perdiBelinata(o); break;
        case 'tire': { const k = Math.min(f.n, p.tireGirate); p.tireGirate -= k; log(nomeF + ': ' + k + ' Tir' + (k === 1 ? 'a torna pronta' : 'e tornano pronte')); break; }
        case 'gira': {
          const cand = o.campo.filter(ch => !ch.girato && ch.c.c <= f.max && !ch.eq.some(e => e.c.noGira));
          const k = Math.min(f.k, cand.length);
          const sel = await scegli(p, { scopo: 'gira', titolo: nomeF + ': gira ' + (f.k > 1 ? 'fino a ' + f.k + ' Character' : 'un Character') + ' avversari' + (f.k > 1 ? '' : 'o') + (f.max < 99 ? ' (costo ' + f.max + ' o meno)' : ''), cand, min: f.k > 1 ? 0 : k, max: k, tipo: 'campo', di: o });
          sel.forEach(ch => giraEffetto(o, ch));
          if (sel.length) log(nomeF + ': gira ' + sel.map(c => c.c.n).join(', '));
          break;
        }
        case 'elimina': {
          const cand = o.campo.filter(ch => ch.c.c <= f.max && (!f.girato || ch.girato) && !ch.eq.some(e => e.c.noElimina));
          const k = Math.min(f.k, cand.length);
          const sel = await scegli(p, { scopo: 'elimina', titolo: nomeF + ': elimina ' + (f.k > 1 ? 'fino a ' + f.k + ' Character' : 'un Character') + ' avversari' + (f.k > 1 ? '' : 'o') + (f.girato ? (f.k > 1 ? ' girati' : ' girato') : '') + ' (costo ' + f.max + ' o meno)', cand, min: f.k > 1 ? 0 : k, max: k, tipo: 'campo', di: o });
          for (const ch of sel) await elimina(o, ch, 'effetto');
          break;
        }
        case 'eliminaTutti': {
          for (const q of [p, o]) for (const ch of q.campo.filter(ch => ch.girato && ch.c.c <= f.max)) await elimina(q, ch, 'effetto');
          break;
        }
        case 'malus': {
          const sel = await scegli(p, { scopo: 'malus', titolo: nomeF + ': un Character avversario perde ' + f.v + ' Potenza', cand: o.campo.slice(), min: 1, max: 1, tipo: 'campo', di: o });
          sel.forEach(ch => { ch.malusT += f.v; log(ch.c.n + ' perde ' + f.v + ' Potenza fino alla fine del turno'); });
          break;
        }
        case 'bonus': {
          const sel = await scegli(p, { scopo: 'bonus', titolo: nomeF + ': un tuo Character guadagna +' + f.v + ' Potenza', cand: p.campo.slice(), min: 1, max: 1, tipo: 'campo', di: p, v: f.v });
          sel.forEach(ch => { ch.bonusT += f.v; log(ch.c.n + ' guadagna +' + f.v + ' Potenza fino alla fine del turno'); });
          break;
        }
        case 'bonusTutti': p.campo.forEach(ch => { ch.bonusT += f.v; }); log(nomeF + ': i Character ' + V(p, 'tuoi', 'avversari') + ' guadagnano +' + f.v); break;
        case 'riprendiC': case 'riprendiE': case 'riprendi': {
          const cand = p.bormida.filter(c => f.op === 'riprendi' || (f.op === 'riprendiE' ? c.c.t === 'E' : c.c.t === 'C' && c.c.c <= f.max));
          const sel = await scegli(p, { scopo: 'riprendi', titolo: nomeF + ': riprendi dalla Bormida ' + (f.op === 'riprendiE' ? '1 Equipaggiamento' : f.op === 'riprendi' ? '1 carta' : 'un Character (costo ' + f.max + ' o meno)'), cand, min: cand.length ? 1 : 0, max: 1, tipo: 'carte' });
          sel.forEach(c => { p.bormida.splice(p.bormida.indexOf(c), 1); p.mano.push(c); log(nomeF + ': ' + V(p, 'riprendi ', 'l\'avversario riprende ') + c.c.n); });
          break;
        }
        case 'cerca': {
          const top = p.mazzo.splice(0, 5), cand = top.filter(c => c.c.t === f.tipo);
          const sel = await scegli(p, { scopo: 'cerca', titolo: nomeF + ': prime 5 carte, prendi 1 ' + NOMI_TIPO[f.tipo], cand, min: cand.length ? 1 : 0, max: 1, tipo: 'carte', mostra: top });
          sel.forEach(c => { top.splice(top.indexOf(c), 1); p.mano.push(c); log(nomeF + ': ' + V(p, 'aggiungi ', 'l\'avversario aggiunge ') + c.c.n + ' alla mano'); });
          p.mazzo.push(...mescola(top));
          if (!sel.length) log(nomeF + ': nessun ' + NOMI_TIPO[f.tipo] + ' tra le prime 5');
          break;
        }
        case 'equipBormida': {
          const cand = p.bormida.filter(c => c.c.t === 'E' && c.c.c <= f.max), dest = p.campo.filter(ch => ch.eq.length < 2);
          if (!dest.length) break;
          const sel = await scegli(p, { scopo: 'equipB', titolo: nomeF + ': scegli un Equipaggiamento dalla Bormida', cand, min: cand.length ? 1 : 0, max: 1, tipo: 'carte' });
          if (!sel.length) break;
          const ch = (await scegli(p, { scopo: 'equipa', titolo: 'A chi assegni ' + sel[0].c.n + '?', cand: dest, min: 1, max: 1, tipo: 'campo', di: p, eq: sel[0].c }))[0];
          if (ch) { p.bormida.splice(p.bormida.indexOf(sel[0]), 1); ch.eq.push(sel[0]); log(sel[0].c.n + ' assegnato a ' + ch.c.n); }
          break;
        }
        case 'inMano': {
          const sel = await scegli(p, { scopo: 'inMano', titolo: nomeF + ': rimetti in mano un tuo Character', cand: p.campo.slice(), min: 1, max: 1, tipo: 'campo', di: p });
          sel.forEach(ch => { lascia(p, ch, 'mano'); log(ch.c.n + ' torna in mano'); });
          break;
        }
      }
      UI.render();
    }
  }

  /* ---------- giocare le carte ---------- */
  function giocabile(p, c) {
    if (S.fine || S.att !== p.i || S.fase !== 'main') return false;
    if (pronte(p) < c.c.c) return false;
    if (c.c.t === 'E') return p.campo.some(ch => ch.eq.length < 2);
    if (c.c.t === 'V') return !c.c.reaz;
    return true;
  }
  async function gioca(p, c, opz) {
    if (ospite()) { RETE.manda('gioca', c.uid); return true; }      // online: la mossa la fa il tavolo dell'amico
    opz = opz || {};
    if (!giocabile(p, c)) return false;
    const card = c.c;
    if (card.t === 'C' && p.campo.length >= 5) {
      const via = opz.via || (await scegli(p, { scopo: 'sacrifica', titolo: 'Hai già 5 Character: quale mandi in Bormida per fare spazio?', cand: p.campo.slice(), min: 0, max: 1, tipo: 'campo', di: p }))[0];
      if (!via) return false;
      lascia(p, via, 'bormida'); log(via.c.n + ' va in Bormida per fare spazio');
    }
    let dest = null;
    if (card.t === 'E') {
      dest = opz.su || (await scegli(p, { scopo: 'equipa', titolo: 'A chi assegni ' + card.n + '?', cand: p.campo.filter(ch => ch.eq.length < 2), min: 0, max: 1, tipo: 'campo', di: p, eq: card }))[0];
      if (!dest) return false;
    }
    paga(p, card.c); p.mano.splice(p.mano.indexOf(c), 1);
    if (card.t === 'C') {
      const ch = { uid: c.uid, c: card, girato: false, entrato: S.turno, eq: [], bonusT: 0, malusT: 0, comb: 0, telUsato: -1, cascoUsato: -1 };
      p.campo.push(ch); nuovi.add(ch.uid); log(V(p, 'Giochi ', 'L\'avversario gioca ') + card.n, p.ia); UI.render(); UI.mostra(p, card);
      if (card.etb) { await attesa(p.ia ? 500 : 150); await esegui(p, card.etb, ch); }
    } else if (card.t === 'E') {
      dest.eq.push(c); log(V(p, 'Assegni ', 'L\'avversario assegna ') + card.n + ' a ' + dest.c.n, p.ia); UI.mostra(p, card);
    } else {
      log(V(p, 'Giochi ', 'L\'avversario gioca ') + card.n, p.ia); UI.render(); UI.mostra(p, card);
      await attesa(p.ia ? 500 : 150);
      await esegui(p, card.fx, c); p.bormida.push(c);
    }
    UI.render(); return true;
  }
  async function usaLeader(p) {
    if (ospite()) { RETE.manda('leader', 0); return true; }
    if (!leaderAbilUsabile(p)) return false;
    paga(p, p.leader.c.abil.costo); p.leader.usato = S.turno;
    log(V(p, 'Usi ', 'L\'avversario usa ') + p.leader.c.n + ' (' + p.leader.c.abil.costo + ' Tir' + (p.leader.c.abil.costo === 1 ? 'a' : 'e') + ')', p.ia);
    await esegui(p, p.leader.c.abil.fx, p.leader); UI.render(); return true;
  }

  /* ---------- attacco e blocco ---------- */
  async function attacca(p, ch) {          // ch = Character, oppure null per il Belinone
    if (ospite()) { RETE.manda('attacca', ch ? ch.uid : 0); return true; }
    const d = avv(p), nomeA = ch ? ch.c.n : p.leader.c.n;
    if (ch) {
      if (!puoAttaccare(p, ch)) return false;
      ch.girato = true; ch.comb = (ch.c.att || 0) + ch.eq.reduce((s, e) => s + (e.c.att || 0), 0);
    } else { if (!leaderPuoAttaccare(p)) return false; p.leader.girato = true; }
    log(V(p, 'Attacchi con ', 'L\'avversario attacca con ') + nomeA + (ch ? ' (' + potenza(p, ch) + ')' : ' (3000)'), true);
    UI.attacco(p, ch); UI.render(); await attesa(p.ia ? 500 : 250);
    try {
      if (ch) { const tel = ch.eq.find(e => e.c.tele); if (tel && ch.telUsato !== S.turno) { ch.telUsato = S.turno; await esegui(p, [{ op: 'gira', max: tel.c.tele, k: 1 }], tel); } }
      // REAZIONE del difensore (prima dei blocchi)
      let blocco = null, libero = false;
      const reazioni = d.mano.filter(c => c.c.reaz && pronte(d) >= c.c.c && (c.c.fx[0].op !== 'bloccoLibero' || d.campo.some(x => !x.girato)));
      if (reazioni.length) {
        const r = (await scegli(d, { scopo: 'reazione', titolo: nomeA + ' ti attacca! Vuoi giocare una REAZIONE?', cand: reazioni, min: 0, max: 1, tipo: 'mano', att: ch, attP: ch ? potenza(p, ch) : 3000, attL: !ch }))[0];
        if (r) {
          paga(d, r.c.c); d.mano.splice(d.mano.indexOf(r), 1); d.bormida.push(r);
          log(V(d, 'Rispondi con ', 'L\'avversario risponde con ') + r.c.n, true); UI.mostra(d, r.c); UI.render(); await attesa(500);
          if (r.c.fx[0].op === 'annulla') { log('Attacco annullato'); return true; }
          blocco = (await scegli(d, { scopo: 'blocco', titolo: r.c.n + ': quale Character blocca senza girarsi (+2000)?', cand: d.campo.filter(x => !x.girato), min: 1, max: 1, tipo: 'campo', di: d, att: ch, attP: ch ? potenza(p, ch) : 3000, attL: !ch, libero: true }))[0] || null;
          if (blocco) { libero = true; blocco.comb += r.c.fx[0].v; }
        }
      }
      if (!blocco) {
        const cand = d.campo.filter(x => !x.girato);
        if (cand.length) blocco = (await scegli(d, { scopo: 'blocco', titolo: nomeA + ' (' + (ch ? potenza(p, ch) : 3000) + ') ti attacca: blocchi?', cand, min: 0, max: 1, tipo: 'campo', di: d, att: ch, attP: ch ? potenza(p, ch) : 3000, attL: !ch }))[0] || null;
      }
      if (!blocco) {
        log(nomeA + ' non viene bloccato');
        await perdiBelinata(d);
        if (ch) {
          if (ch.c.nonb) await esegui(p, ch.c.nonb, ch);
          for (const e of ch.eq.filter(e => e.c.nonb)) await esegui(p, e.c.nonb, e);
        }
        return true;
      }
      if (!libero && !ha(blocco, 'guardia')) blocco.girato = true;
      blocco.comb += blocco.eq.reduce((s, e) => s + (e.c.blocco || 0), 0);
      log(V(d, 'Blocchi con ', 'L\'avversario blocca con ') + blocco.c.n + ' (' + potenza(d, blocco) + ')', true);
      UI.render(); await attesa(450);
      // effetto del Belinone del difensore dopo il blocco
      if (leaderAbilUsabile(d) && d.leader.c.abil.fx[0].op === 'bonus') {
        const usa = d.remoto ? (await RETE.chiedi(d, 'Usi l\'effetto di ' + d.leader.c.n + ' (' + d.leader.c.abil.costo + ' Tire) prima del combattimento?', ['Sì', 'No'])) === 0 : d.ia ? IA.leaderInDifesa(d, p, ch, blocco) : await UI.chiedi('Usi l\'effetto di ' + d.leader.c.n + ' (' + d.leader.c.abil.costo + ' Tire) prima del combattimento?', ['Sì', 'No']) === 0;
        if (usa) await usaLeader(d);
      }
      // combattimento
      const aP = ch ? potenza(p, ch) : 3000, bP = potenza(d, blocco);
      log('Combattimento: ' + nomeA + ' ' + aP + ' contro ' + blocco.c.n + ' ' + bP);
      await attesa(400);
      if (!ch) { if (bP < 3000) await elimina(d, blocco, 'combattimento'); else log(blocco.c.n + ' resiste al Belinone'); }
      else if (aP > bP) { if (await elimina(d, blocco, 'combattimento') && ch.c.uccide && p.campo.includes(ch)) await esegui(p, ch.c.uccide, ch); }
      else if (bP > aP) { if (await elimina(p, ch, 'combattimento') && blocco.c.uccide && d.campo.includes(blocco)) await esegui(d, blocco.c.uccide, blocco); }
      else { await elimina(d, blocco, 'combattimento'); await elimina(p, ch, 'combattimento'); }
      return true;
    } finally {
      if (ch) ch.comb = 0;
      S.g.forEach(q => q.campo.forEach(x => { x.comb = 0; }));
      UI.render();
    }
  }

  /* ---------- turni ---------- */
  function fineTurnoPulizia() {
    S.g.forEach(q => q.campo.forEach(ch => {
      ch.bonusT = 0; ch.malusT = 0; ch.comb = 0;
      const tmp = ch.eq.filter(e => e.c.temp); tmp.forEach(e => { ch.eq.splice(ch.eq.indexOf(e), 1); q.bormida.push(e); });
    }));
  }
  let fineTurnoUmano = null;
  async function partita() {
    const st = S, via = () => S !== st || (st.fine && st.fine.motivo === 'chiuso');
    try {
      const [a, b] = [S.g[S.primo], S.g[1 - S.primo]];
      pesca(a, 5); pesca(b, 6);
      log(S.primo === 0 ? 'Inizi tu! (5 carte)' : 'Inizia l\'avversario: tu parti con 6 carte', true);
      UI.render();
      for (const p of [a, b]) {                      // mulligan, una volta sola
        const via = p.remoto ? await RETE.scegli(p, { scopo: 'mulligan', titolo: 'Mulligan: tocca le carte che vuoi rimettere nel mazzo (una volta sola)', cand: p.mano.slice(), min: 0, max: p.mano.length, tipo: 'mano', okTesto: 'Tieni queste' }) : p.ia ? IA.mulligan(p) : await UI.scegli({ scopo: 'mulligan', titolo: 'Mulligan: tocca le carte che vuoi rimettere nel mazzo (una volta sola)', cand: p.mano.slice(), min: 0, max: p.mano.length, tipo: 'mano', okTesto: 'Tieni queste' });
        if (via && via.length) {
          via.forEach(c => p.mano.splice(p.mano.indexOf(c), 1)); p.mazzo.push(...via); mescola(p.mazzo); pesca(p, via.length);
          log(V(p, 'Cambi ', 'L\'avversario cambia ') + via.length + ' carte');
        }
      }
      S.g.forEach(p => { p.belinate = p.mazzo.splice(0, 5); });
      UI.render();
      for (; ;) {
        S.turno++; const p = S.g[S.att]; p.nTurni++;
        S.fase = 'ready';
        p.campo.forEach(ch => { ch.girato = false; }); p.leader.girato = false; p.tireGirate = 0;
        p.tire = Math.min(10, p.tire + (p.nTurni === 1 ? (S.att === S.primo ? 1 : 2) : 2));
        if (!(p.nTurni === 1 && S.att === S.primo)) {
          if (!p.mazzo.length) perde(p, V(p, 'devi pescare ma il mazzo è vuoto', 'deve pescare con il mazzo vuoto'));
          pesca(p, 1);
        }
        S.fase = 'main';
        log(V(p, '— Il tuo turno' + (p.nTurni === 1 ? ' (nel primo turno non si attacca)' : '') + ' —', '— Turno dell\'avversario —'), true);
        UI.render(); UI.banner(p.remoto ? 'Turno di ' + p.nome : p.ia ? 'Turno avversario' : 'Il tuo turno');
        if (p.remoto) await RETE.turno(p);
        else if (p.ia) await IA.turno(p);
        else await new Promise(r => { fineTurnoUmano = r; });
        fineTurnoUmano = null;
        if (via() || st.fine) return;
        S.fase = 'fine';
        fineTurnoPulizia();
        if (p.mano.length > 10) await scartaDa(p, p.mano.length - 10, 'Fine turno: scarta fino a 10 carte');
        UI.render();
        S.att = 1 - S.att;
        await attesa(300);
        if (via()) return;
      }
    } catch (e) {
      if (via()) return;
      if (!(e instanceof Fine)) { console.error(e); UI.log('Errore: ' + e.message, true); return; }
      fineDellaPartita();
    }
  }
  function fineDellaPartita() {
    if (!S || S.finito) return; S.finito = true;
    const vinto = S.fine.vince === 0;
    if (vinto) SAV.vinte++; else SAV.perse++;
    let premio = 0;
    if (vinto && B.Eco) {
      const oggi = new Date().toDateString(); if (SAV.premiDi !== oggi) { SAV.premiDi = oggi; SAV.premi = 0; }
      if (SAV.premi < PREMI_GIORNO) { SAV.premi++; premio = PREMIO; B.Eco.add(PREMIO); }
    }
    salva(); UI.render(); UI.fine(vinto, S.fine.motivo, premio);
  }
  // l'umano agisce dall'interfaccia: un'azione alla volta
  async function azione(fn) {
    if (S.occupato || S.fine) return;
    S.occupato = true; UI.render();
    try { await fn(); } catch (e) { if (e instanceof Fine) { S.occupato = false; fineDellaPartita(); return; } console.error(e); }
    S.occupato = false; UI.render();
  }
  let velocita = 1;
  const attesa = ms => new Promise(r => setTimeout(r, ms * velocita));

  /* =====================================================================
     IA (avversario): semplice e prudente, sceglie la mossa che rende di piu'
     ===================================================================== */
  const IA = {
    valoreMano(c, p) { const k = c.c; return k.t === 'C' ? k.p / 1000 + (k.etb ? 1 : 0) - Math.max(0, k.c - p.tire - 2) : k.t === 'E' ? 1.5 + (k.bonus || 0) / 1500 : 2 - (k.c > p.tire + 2 ? 1 : 0); },
    scegli(p, req) {
      const o = avv(p), c = req.cand.slice();
      const pw = ch => potenza(S.g.find(q => q.campo.includes(ch)) || p, ch);
      const ordina = f => c.sort((a, b) => f(b) - f(a));
      switch (req.scopo) {
        case 'gira': case 'elimina': case 'malus': ordina(ch => pw(ch) + ch.c.c * 300 + (ch.girato ? -2000 : 0)); return c.slice(0, req.max);
        case 'bonus': ordina(ch => (puoAttaccare(p, ch) || (S.att !== p.i && !ch.girato) ? 5000 : 0) + pw(ch)); return c.slice(0, 1);
        case 'equipa': ordina(ch => (ha(ch, 'guardia') ? 800 : 0) + pw(ch) + (ch.girato ? -1500 : 0) + (req.eq && req.eq.kw && req.eq.kw.rush && ch.entrato === S.turno ? 6000 : 0)); return c.slice(0, 1);
        case 'scarta': c.sort((a, b) => IA.valoreMano(a, p) - IA.valoreMano(b, p)); return c.slice(0, req.max);
        case 'riprendi': case 'cerca': case 'equipB': ordina(x => (x.c.p || 0) / 1000 + x.c.c + (x.c.bonus || 0) / 1000 - Math.max(0, x.c.c - p.tire - 2) * 2); return c.slice(0, req.max);
        case 'sacrifica': case 'inMano': c.sort((a, b) => pw(a) - pw(b)); return c.slice(0, 1);
        case 'blocco': return IA.blocco(p, req);
        case 'reazione': return IA.reazione(p, req);
      }
      return c.slice(0, req.min);
    },
    blocco(d, req) {
      const aP = req.attP, cand = req.cand.slice(), pw = ch => potenza(d, ch) + (req.libero ? 0 : ch.eq.reduce((s, e) => s + (e.c.blocco || 0), 0));
      if (req.libero) { cand.sort((a, b) => pw(b) - pw(a)); return [cand[0]]; }
      if (req.attL) { const ok = cand.filter(ch => pw(ch) >= 3000).sort((a, b) => (ha(b, 'guardia') - ha(a, 'guardia')) || pw(a) - pw(b)); if (ok.length) return [ok[0]]; if (d.belinate.length <= 1 && cand.length) return [cand.sort((a, b) => a.c.c - b.c.c)[0]]; return []; }
      const vince = cand.filter(ch => pw(ch) > aP).sort((a, b) => (ha(b, 'guardia') - ha(a, 'guardia')) || a.c.c - b.c.c);
      if (vince.length) return [vince[0]];
      const pari = cand.filter(ch => pw(ch) === aP && req.att && ch.c.c <= req.att.c.c);
      if (pari.length) return [pari[0]];
      if (d.belinate.length <= 1 && cand.length) return [cand.sort((a, b) => a.c.c - b.c.c)[0]];
      return [];
    },
    reazione(d, req) {
      const pw = ch => potenza(d, ch);
      const pronti = d.campo.filter(ch => !ch.girato), vince = pronti.some(ch => pw(ch) > req.attP);
      const ann = req.cand.find(c => c.c.fx[0].op === 'annulla'), lib = req.cand.find(c => c.c.fx[0].op === 'bloccoLibero');
      if (lib && !vince && pronti.some(ch => pw(ch) + 2000 > req.attP)) return [lib];
      if (ann && !vince && (d.belinate.length <= 2 || req.attP >= 5000)) return [ann];
      return [];
    },
    leaderInDifesa(d, p, ch, blocco) {
      const ab = d.leader.c.abil.fx[0];
      if (ab.op !== 'bonus') return false;
      const aP = ch ? potenza(p, ch) : 3000, bP = potenza(d, blocco);
      return ch ? bP <= aP && bP + ab.v > aP : bP < 3000 && bP + ab.v >= 3000;
    },
    mulligan(p) { const cheap = p.mano.filter(c => c.c.c <= 2 && c.c.t === 'C').length; return cheap >= 2 ? p.mano.filter(c => c.c.c >= 6) : p.mano.filter(c => c.c.c >= 4); },
    // valore di giocare una carta adesso (0 = non conviene)
    valore(p, c) {
      const k = c.c, o = avv(p), riserva = p.mano.some(x => x.c.reaz && x !== c) ? Math.min(...p.mano.filter(x => x.c.reaz && x !== c).map(x => x.c.c)) : 0;
      if (!giocabile(p, c) || pronte(p) - k.c < (k.t === 'C' && k.c >= 3 ? 0 : riserva)) return 0;
      const pw = ch => potenza(p, ch), opw = ch => potenza(o, ch), attaccanti = p.nTurni > 1;
      const valFx = fx => (fx || []).reduce((s, f) => {
        switch (f.op) {
          case 'pesca': return s + f.n * 1.2;
          case 'scarta': return s - 0.6;
          case 'avvScarta': case 'ogniAvvScarta': return s + (o.mano.length ? 1 : 0);
          case 'avvBelinata': return s + 3;
          case 'tire': return s + (p.tireGirate + k.c > 0 ? 0.8 : 0);
          case 'gira': { const n = o.campo.filter(ch => !ch.girato && ch.c.c <= f.max && !ch.eq.some(e => e.c.noGira)).length; return s + Math.min(n, f.k) * (attaccanti ? 1.6 : 0.6); }
          case 'elimina': { const t = o.campo.filter(ch => ch.c.c <= f.max && (!f.girato || ch.girato) && !ch.eq.some(e => e.c.noElimina)); return s + t.slice(0, f.k).reduce((x, ch) => x + 1 + ch.c.c * 0.8, 0); }
          case 'eliminaTutti': { const v = q => q.campo.filter(ch => ch.girato && ch.c.c <= f.max).reduce((x, ch) => x + 1 + ch.c.c, 0); return s + v(o) - v(p) - 2; }
          case 'malus': return s + (o.campo.length ? (attaccanti ? 1 : 0.3) : 0);
          case 'bonus': return s + (p.campo.some(ch => !ch.girato) && attaccanti ? 1 : 0.1);
          case 'bonusTutti': return s + (attaccanti ? p.campo.filter(ch => !ch.girato && ch.entrato < S.turno).length * 0.9 - 0.5 : 0);
          case 'riprendiC': case 'riprendiE': case 'riprendi': return s + (p.bormida.some(x => f.op === 'riprendi' || (f.op === 'riprendiE' ? x.c.t === 'E' : x.c.t === 'C' && x.c.c <= f.max)) ? 1.2 : 0);
          case 'cerca': return s + 1;
          case 'equipBormida': return s + (p.bormida.some(x => x.c.t === 'E' && x.c.c <= f.max) && p.campo.some(ch => ch.eq.length < 2) ? 2 : 0);
        }
        return s;
      }, 0);
      if (k.t === 'C') {
        let v = 2 + k.p / 1000 + valFx(k.etb) + (k.kw && k.kw.rush && attaccanti ? 1 : 0) + (k.kw && k.kw.guardia ? 0.5 : 0);
        if (p.campo.length >= 5) { const peggiore = Math.min(...p.campo.map(pw)); if (k.p < peggiore + 1500) return 0; v -= peggiore / 1000 + 1; }
        return v;
      }
      if (k.t === 'E') {
        if (k.temp && !(attaccanti && p.campo.some(ch => puoAttaccareDopo(p, ch)))) return 0;
        return 1 + (k.bonus || 0) / 1000 + (k.kw && k.kw.guardia ? 0.8 : 0) + (k.kw && k.kw.rush ? (p.campo.some(ch => ch.entrato === S.turno) && attaccanti ? 1.5 : 0.2) : 0) + (k.reset || k.noElimina || k.noGira || k.casco ? 1 : 0) + (k.att || k.blocco ? 1.2 : 0) + (k.tele ? 1 : 0) + (k.morte || k.nonb ? 0.4 : 0);
      }
      if (k.reaz || k.fx[0].op === 'inMano') return 0;
      const v = valFx(k.fx); return v > 0.9 ? v + 0.2 : 0;
    },
    async turno(p) {
      const o = avv(p);
      await attesa(600);
      for (let g = 0; g < 25 && !S.fine; g++) {
        let best = null, bv = 0;
        for (const c of p.mano) { const v = IA.valore(p, c) / Math.max(1, c.c.c * 0.55); if (v > bv) { bv = v; best = c; } }
        if (!best) break;
        const k = best.c;
        let opz = {};
        if (k.t === 'C' && p.campo.length >= 5) opz.via = p.campo.slice().sort((a, b) => potenza(p, a) - potenza(p, b))[0];
        if (k.t === 'E') opz.su = IA.scegli(p, { scopo: 'equipa', cand: p.campo.filter(ch => ch.eq.length < 2), eq: k, max: 1 })[0];
        if (!(await gioca(p, best, opz))) break;
        await attesa(650);
      }
      // effetto del Belinone nel proprio turno
      const ab = p.leader.c.abil;
      if (ab && leaderAbilUsabile(p)) {
        const f = ab.fx[0];
        if (f.op === 'gira' && p.nTurni > 1 && o.campo.some(ch => !ch.girato && ch.c.c <= f.max && !ch.eq.some(e => e.c.noGira))) { await usaLeader(p); await attesa(500); }
        if (f.op === 'riprendiC' && p.bormida.some(x => x.c.t === 'C' && x.c.c <= f.max) && pronte(p) >= ab.costo) { await usaLeader(p); await attesa(500); }
      }
      if (S.fine) return;
      S.fase = 'attacchi'; UI.render();
      if (p.nTurni <= 1) return;
      const pwO = ch => potenza(o, ch);
      const bloccanti = () => o.campo.filter(ch => !ch.girato);
      const letale = () => o.belinate.length === 0;
      // prima il Belinone (non viene mai eliminato), poi i Character dal piu' forte
      if (leaderPuoAttaccare(p)) { await attacca(p, null); await attesa(600); }
      for (let g = 0; g < 6 && !S.fine; g++) {
        const pronti = p.campo.filter(ch => puoAttaccare(p, ch)).sort((a, b) => potenza(p, b) - potenza(p, a));
        let scelto = null;
        for (const ch of pronti) {
          const aP = potenza(p, ch) + (ch.c.att || 0) + ch.eq.reduce((s, e) => s + (e.c.att || 0), 0);
          const forti = bloccanti().filter(b => pwO(b) + b.eq.reduce((s, e) => s + (e.c.blocco || 0), 0) >= aP);
          const tengo = p.belinate.length <= 1 && p.campo.filter(x => !x.girato).length <= 1 && !ha(ch, 'guardia');
          if (letale() || (!forti.length && !tengo)) { scelto = ch; break; }
        }
        if (!scelto) {
          // Vambrael: un bonus puo' far passare un attacco
          if (ab && ab.fx[0].op === 'bonus' && leaderAbilUsabile(p) && pronti.length) {
            const ch = pronti[0], aP = potenza(p, ch) + ab.fx[0].v + (ch.c.att || 0);
            if (!bloccanti().some(b => pwO(b) >= aP)) { p.leader.usato = S.turno; paga(p, ab.costo); ch.bonusT += ab.fx[0].v; log('L\'avversario usa ' + p.leader.c.n + ': ' + ch.c.n + ' +' + ab.fx[0].v, true); continue; }
          }
          break;
        }
        await attacca(p, scelto); await attesa(700);
      }
    }
  };
  function puoAttaccareDopo(p, ch) { return !ch.girato && (ch.entrato < S.turno || ha(ch, 'rush')); }

  /* =====================================================================
     INTERFACCIA: tavolo in stile tappetino (zone tratteggiate, corda in mezzo,
     barra in basso con la carta scelta e le sue azioni). In verticale le zone
     vanno su due righe, in orizzontale su una.
     ===================================================================== */
  const css = `
body.bv-attivo #barra-alto,body.bv-attivo #controlli,body.bv-attivo #btn-contesto,body.bv-attivo #chat,body.bv-attivo #minimappa-box,body.bv-attivo #joy,body.bv-attivo #tabbar,body.bv-attivo #hud{display:none!important}
#bv{--felt:#1c4b53;--felt-deep:#133840;--felt-edge:#2c6a73;--gold:#d4a24c;--gold-hi:#f2c977;--chrome:#10282d;--ink:#f4ecd6;--dim:#a9b8b4;--ok:#7be39a;--cw:66px;--ch:92px;--gap:5px;
  position:absolute;inset:0;z-index:55;display:none;flex-direction:column;background:var(--felt-deep);color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-user-select:none;user-select:none;overflow:hidden;touch-action:manipulation}
#bv.on{display:flex}
#bv *{box-sizing:border-box}
#bv button{font-family:inherit;font-weight:800;font-size:13px;line-height:1.1;cursor:pointer;color:var(--ink);background:transparent;border:1.5px solid var(--gold);border-radius:999px;padding:.45em 1em}
#bv button.pri{background:var(--gold);color:#241a08}
#bv button:disabled{opacity:.38;cursor:default}
#bv .disp{font-family:Georgia,'Times New Roman',serif;font-weight:700;letter-spacing:.01em}

/* barra in alto */
#bv .bar{flex:none;display:flex;align-items:center;gap:6px;padding:calc(env(safe-area-inset-top,0px) + 5px) calc(env(safe-area-inset-right,0px) + 8px) 5px calc(env(safe-area-inset-left,0px) + 8px);background:var(--chrome);border-bottom:2px solid var(--gold)}
#bv .bar h1{margin:0;font-size:19px;color:var(--gold-hi);white-space:nowrap}
#bv .bar .fase{font-size:12px;padding:.2em .7em;border-radius:999px;background:rgba(0,0,0,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
#bv .bar .fase.mio{color:var(--ok)}
#bv .bar .sp{flex:1}
#bv .bar button{padding:.4em .85em;white-space:nowrap}
#bv.vert .bar h1{display:none}
#bv.vert .bar .fase{font-size:12.5px}

/* tavolo */
#bv .tav{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:var(--gap);padding:var(--gap) calc(env(safe-area-inset-right,0px) + 6px) var(--gap) calc(env(safe-area-inset-left,0px) + 6px);background:radial-gradient(ellipse at 50% 50%,var(--felt) 0%,var(--felt-deep) 130%);overflow:hidden}
#bv .side{display:grid;gap:var(--gap);width:100%;max-width:calc(var(--cw) * 12.6);margin-inline:auto;grid-template-columns:var(--cw) var(--cw) auto minmax(calc(var(--cw) * 1.1),1fr) var(--cw);grid-template-areas:"h h h h h" "l v c t b";align-items:stretch}
#bv.vert .side{grid-template-columns:var(--cw) var(--cw) minmax(0,1fr) var(--cw);grid-template-areas:"h h h h" "c c c c" "l v t b"}
#bv.vert .side.avv{grid-template-areas:"h h h h" "l v t b" "c c c c"}
#bv .head{grid-area:h;display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-height:20px}
#bv .pname{font-size:15px;color:var(--gold-hi);margin-right:2px}
#bv .pname.on::before{content:'';display:inline-block;width:.5em;height:.5em;border-radius:50%;background:var(--ok);margin-right:.35em;vertical-align:.1em}
#bv .chip{font-size:11.5px;background:rgba(0,0,0,.3);padding:.12em .6em;border-radius:999px;white-space:nowrap}
#bv .chip b{margin-left:.25em;color:var(--gold-hi)}
#bv .chip.vita b{color:#ff8d8d}
#bv .zona{position:relative;display:flex;align-items:center;justify-content:center;gap:calc(var(--cw) * .08);min-height:calc(var(--ch) + 8px);padding:3px;border:1.5px dashed rgba(242,201,119,.3);border-radius:calc(var(--cw) * .12)}
#bv .zona[data-et]::after{content:attr(data-et);position:absolute;left:50%;bottom:-1px;transform:translate(-50%,50%);font-size:9.5px;line-height:1;padding:1px 6px;border-radius:999px;background:var(--felt-deep);color:rgba(244,236,214,.55);white-space:nowrap;pointer-events:none;z-index:3}
#bv .zona.l{grid-area:l}#bv .zona.v{grid-area:v}#bv .zona.t{grid-area:t}#bv .zona.b{grid-area:b}
#bv .zona.c{grid-area:c;justify-content:center;width:calc(var(--cw) * 5 + var(--cw) * .08 * 4 + 10px)}
#bv.vert .zona.c{width:auto}
#bv .zona.pila{cursor:pointer}
#bv .vuoto{color:rgba(244,236,214,.4);font-size:11px;text-align:center;font-family:Georgia,serif}
#bv .slot{width:var(--cw);height:var(--ch);border-radius:calc(var(--cw) * .08);border:1px dashed rgba(242,201,119,.14)}
#bv .badge{position:absolute;right:-6px;top:-6px;z-index:4;min-width:1.7em;height:1.7em;padding:0 .3em;border-radius:999px;background:var(--gold);color:#241a08;font-weight:900;display:grid;place-items:center;font-size:11px;border:2px solid var(--felt-deep)}
#bv .rope{position:relative;flex:none;height:12px;margin:3px 0;border-radius:6px;background:repeating-linear-gradient(115deg,#c9a45c 0 6px,#8a6a2c 6px 12px);box-shadow:0 2px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;cursor:pointer}
#bv .rope span{max-width:calc(100% - 20px);background:var(--chrome);color:var(--gold-hi);border:1.5px solid var(--gold);border-radius:999px;padding:.1em 1em;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* carte */
#bv .carta{position:relative;flex:none;width:var(--cw);height:var(--ch);border-radius:calc(var(--cw) * .07);transition:transform .18s,filter .18s,box-shadow .18s;cursor:pointer}
#bv .carta img{width:100%;height:100%;border-radius:inherit;display:block;pointer-events:none;box-shadow:0 2px 4px rgba(0,0,0,.45)}
#bv .carta.girato{transform:rotate(90deg) scale(.72);filter:brightness(.62)}
#bv .carta.sel{box-shadow:0 0 0 2.5px var(--gold-hi),0 0 0 6px rgba(242,201,119,.3)}
#bv .carta.pronto-att,#bv .mano .carta.ok{box-shadow:0 0 0 2px var(--ok)}
#bv .carta.pronto-att.sel,#bv .mano .carta.ok.sel{box-shadow:0 0 0 2.5px var(--gold-hi),0 0 0 6px rgba(124,242,154,.35)}
#bv .carta .pw{position:absolute;left:50%;bottom:3%;transform:translateX(-50%);min-width:36px;padding:0 5px;border-radius:999px;background:rgba(0,0,0,.78);color:#fff;font-weight:900;font-size:11px;line-height:1.45;text-align:center;z-index:2}
#bv .carta .pw.su{color:var(--ok)}#bv .carta .pw.giu{color:#ff9a90}
#bv .carta .tk{position:absolute;left:50%;top:3%;transform:translateX(-50%);display:flex;gap:2px;z-index:2}
#bv .carta .tk i{font-style:normal;font-weight:900;font-size:9px;line-height:1.3;padding:0 .45em;border-radius:3px;color:#fff;box-shadow:0 1px 2px rgba(0,0,0,.5)}
#bv .tk .g{background:#3a7bd5}#bv .tk .r{background:#e8731a}#bv .tk .e{background:#7a4a1a}
#bv .carta.nuovo{animation:bvIn .35s ease-out}
@keyframes bvIn{from{transform:translateY(-14px) scale(1.15);opacity:.2}to{transform:none;opacity:1}}
#bv .dorso{background:repeating-linear-gradient(45deg,#2b1a4a 0 6px,#352158 6px 12px);border:1.5px solid var(--gold);display:grid;place-items:center;box-shadow:0 2px 4px rgba(0,0,0,.45)}
#bv .dorso::before{content:'B2';font-family:Georgia,serif;font-weight:700;color:var(--gold-hi);font-size:calc(var(--cw) * .26);width:58%;aspect-ratio:1;border-radius:50%;border:2px solid var(--gold);display:grid;place-items:center}
#bv .pila .carta+.carta{position:absolute}
#bv .tire{justify-content:flex-start;padding:3px 8px 3px 4px}
#bv .tire .tt{flex:0 1 calc(var(--cw) * .62);min-width:5px}
#bv .tire .tt:last-child{flex-shrink:0}
#bv .tire .tt img{width:calc(var(--cw) * .62);height:calc(var(--ch) * .62);border-radius:5px;display:block;box-shadow:0 1px 3px rgba(0,0,0,.5);transition:transform .2s,filter .2s}
#bv .tire .tt.g img{transform:rotate(90deg) scale(.8);filter:brightness(.5) grayscale(.4)}
#bv .lead.colpo{animation:bvColpo .6s}
@keyframes bvColpo{0%,100%{transform:none}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}

/* mano */
#bv .manoAvv{display:none;justify-content:center;height:calc(var(--cw) * .7);flex:none}
#bv.vert .manoAvv{display:flex}
#bv .manoAvv .carta{width:calc(var(--cw) * .5);height:calc(var(--cw) * .7);margin-left:calc(var(--cw) * -.18);cursor:default}
#bv .manoAvv .carta:first-child{margin-left:0}
#bv .manoAvv .dorso::before{border-width:1px;font-size:calc(var(--cw) * .13)}
#bv .mano{flex:none;display:flex;align-items:flex-end;justify-content:center;width:100%;max-width:calc(var(--cw) * 12.6);margin-inline:auto;padding:5px 6px 4px;border:1.5px dashed rgba(242,201,119,.3);border-radius:calc(var(--cw) * .12);min-height:calc(var(--hw) * 1.4 + 12px)}
#bv .mano .mc{flex:0 1 calc(var(--hw) + 5px);min-width:14px}
#bv .mano .carta{width:var(--hw);height:calc(var(--hw) * 1.4)}
#bv .mano .mc:last-child{flex:none}
#bv .mano .carta.ok{transform:translateY(-4px)}
#bv .mano .carta.no{filter:brightness(.72)}
#bv .mano .carta.sel{transform:translateY(-9px);z-index:3}

/* barra azioni (carta scelta) */
#bv .bvaz{position:absolute;left:0;right:0;bottom:0;z-index:6;box-shadow:0 -6px 18px rgba(0,0,0,.45);flex-direction:row;width:auto;margin:0;display:none;gap:10px;align-items:stretch;max-height:60%;overflow:auto;padding:7px calc(env(safe-area-inset-right,0px) + 10px) calc(env(safe-area-inset-bottom,0px) + 7px) calc(env(safe-area-inset-left,0px) + 10px);background:var(--chrome);border-top:2px solid var(--gold)}
#bv .bvaz.on{display:flex}
#bv .bvaz .prev{flex:none;width:calc(var(--cw) * 1.25);height:calc(var(--ch) * 1.25);cursor:zoom-in}
#bv .bvaz .prev img{width:100%;height:100%;border-radius:8px;display:block;box-shadow:0 2px 6px rgba(0,0,0,.5)}
#bv .bvaz .info{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
#bv .bvaz .nome{font-size:18px;color:var(--gold-hi);line-height:1.05}
#bv .bvaz .sub{font-size:11.5px;color:var(--dim)}
#bv .bvaz .stats{display:flex;flex-wrap:wrap;gap:4px}
#bv .bvaz .txt{font-size:12.5px;line-height:1.3;max-height:4.2em;overflow:auto}
#bv .bvaz .btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}
#bv .bvaz .eqs{display:flex;gap:4px}
#bv .bvaz .eqs img{height:calc(var(--ch) * .5);border-radius:4px}

/* annunci */
#bv .banner{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);padding:.3em 1.1em;border-radius:999px;background:var(--chrome);border:2px solid var(--gold);font-family:Georgia,serif;font-weight:700;font-size:26px;color:var(--gold-hi);pointer-events:none;opacity:0;transition:opacity .25s;z-index:7;white-space:nowrap;box-shadow:0 6px 24px rgba(0,0,0,.5)}
#bv .banner.on{opacity:1}
#bv .mostra{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);height:min(62%,calc(var(--ch) * 2.6));opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;z-index:7;border-radius:12px;box-shadow:0 6px 28px #000}
#bv .mostra.on{opacity:1;transform:translate(-50%,-50%) scale(1)}

/* finestre */
#bv .ov{position:absolute;inset:0;z-index:10;background:rgba(0,0,0,.66);display:none;align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top,0px) + 8px) 10px calc(env(safe-area-inset-bottom,0px) + 8px)}
#bv .ov.on{display:flex}
#bv .zoom img.big{height:min(86vh,86vw * 1.4);max-height:100%;max-width:100%;border-radius:14px;box-shadow:0 8px 30px #000}
#bv .pick{width:min(100%,760px);max-height:100%;display:flex;flex-direction:column;gap:8px;background:var(--chrome);border:2px solid var(--gold);border-radius:14px;padding:12px 14px}
#bv .pick h3{margin:0;font-size:15px;line-height:1.3;color:var(--gold-hi)}
#bv .pick .lista{display:flex;flex-wrap:wrap;gap:8px;overflow-y:auto;justify-content:center;padding:6px 2px;min-height:0}
#bv .pick .lista .carta{width:calc(var(--cw) * 1.2);height:calc(var(--ch) * 1.2)}
#bv .pick .lista .carta.sel{transform:translateY(-4px)}
#bv .pick .lista .carta.fuori{filter:brightness(.4) grayscale(.6);cursor:default}
#bv .pick .piede{display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap}
#bv .pick .piede span{flex:1;font-size:12px;color:var(--dim)}
#bv .menu{position:absolute;inset:0;z-index:8;overflow-y:auto;padding:calc(env(safe-area-inset-top,0px) + 10px) calc(env(safe-area-inset-right,0px) + 14px) calc(env(safe-area-inset-bottom,0px) + 14px) calc(env(safe-area-inset-left,0px) + 14px);background:radial-gradient(ellipse at 50% 0%,var(--felt),var(--felt-deep) 75%)}
#bv .menu h1{margin:0;font-family:Georgia,serif;font-size:26px;color:var(--gold-hi)}
#bv .menu h2{margin:12px 0 6px;font-size:14px;color:var(--gold-hi)}
#bv .menu p{margin:4px 0;font-size:13px;opacity:.92;line-height:1.4}
#bv .menu .top{display:flex;align-items:center;gap:10px}
#bv .menu .top h1{flex:1}
#bv .leaders{display:flex;gap:8px;overflow-x:auto;padding:6px 2px 8px}
#bv .leaders .carta{width:calc(var(--cw) * 1.3);height:calc(var(--ch) * 1.3)}
#bv .riga-b{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
#bv .regole{font-size:12.5px;line-height:1.45}
#bv .regole li{margin-bottom:3px}
#bv .ed{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;background:var(--felt-deep);padding:calc(env(safe-area-inset-top,0px) + 8px) calc(env(safe-area-inset-right,0px) + 10px) calc(env(safe-area-inset-bottom,0px) + 8px) calc(env(safe-area-inset-left,0px) + 10px);gap:6px}
#bv .ed .ebar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#bv .ed .ebar b{flex:1;font-size:14px;color:var(--gold-hi)}
#bv .ed .ebar button.f.on{background:var(--gold);color:#241a08}
#bv .ed .griglia{flex:1;overflow-y:auto;display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start;justify-content:center;padding:4px}
#bv .ed .cella{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px}
#bv .ed .cella .carta{width:calc(var(--cw) * 1.15);height:calc(var(--ch) * 1.15)}
#bv .ed .cella .n{position:absolute;top:-5px;right:-5px;min-width:22px;height:22px;border-radius:11px;background:var(--gold);color:#241a08;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center}
#bv .ed .cella .pm{display:flex;gap:4px}
#bv .ed .cella .pm button{padding:2px 12px;font-size:15px}
/* pacchetti */
#bv .pk-riga{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap;margin-top:12px}
#bv .pacco{flex:none;width:150px;height:210px;border-radius:12px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:linear-gradient(160deg,#7a2fd6 0%,#3b1d6e 55%,#1a0f33 100%);border:3px solid var(--gold);box-shadow:0 8px 22px rgba(0,0,0,.5),inset 0 0 0 4px rgba(255,255,255,.06);transform:rotate(-4deg);overflow:hidden}
#bv .pacco::before{content:'';position:absolute;left:0;right:0;top:14px;height:10px;background:repeating-linear-gradient(90deg,var(--gold) 0 6px,transparent 6px 10px);opacity:.7}
#bv .pacco::after{content:'';position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.22) 50%,transparent 60%);animation:bvLuce 3.2s infinite}
@keyframes bvLuce{from{transform:translateX(-40%)}to{transform:translateX(40%)}}
#bv .pacco b{font-family:Georgia,serif;font-size:22px;color:#ffe9a8;letter-spacing:.02em;text-shadow:0 2px 0 #000}
#bv .pacco span{font-family:Georgia,serif;font-weight:700;font-size:58px;line-height:1;color:var(--gold-hi);text-shadow:0 3px 0 #000}
#bv .pacco small{font-size:11px;color:#d9c8ff}
#bv .pk-info{flex:1;min-width:240px}
#bv .pk-voce{font-size:15px!important;color:var(--gold-hi);font-style:italic}
#bv .apertura .lista{gap:10px}
#bv .flip{position:relative;width:calc(var(--cw) * 1.35);height:calc(var(--cw) * 1.35 * 1.4);perspective:700px;cursor:pointer}
#bv .flip .carta{position:absolute;inset:0;width:100%;height:100%;backface-visibility:hidden;transition:transform .45s}
#bv .flip .faccia-f{transform:rotateY(180deg)}
#bv .flip.su .faccia-d{transform:rotateY(180deg)}
#bv .flip.su .faccia-f{transform:none}
#bv .flip.rara.su .faccia-f{box-shadow:0 0 0 2px var(--gold-hi),0 0 18px var(--gold-hi)}
#bv .flip .nuova{position:absolute;left:50%;top:-8px;transform:translateX(-50%);padding:1px 8px;border-radius:999px;background:#e8731a;color:#fff;font-weight:900;font-size:10px;letter-spacing:.05em;box-shadow:0 1px 3px rgba(0,0,0,.5)}
#bv .ed .cella .hai{font-size:10.5px;color:var(--dim)}
@media (prefers-reduced-motion:reduce){#bv .carta,#bv .tire .tt img{transition:none}}
`;
  let root = null, avviato = false, nuovi = new Set(), selez = null, BV_rete = () => null, BV_amico = () => { };
  const $ = (s, r) => (r || root).querySelector(s);
  function nodo(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; }

  // misura delle carte: in verticale 5 Character stanno in larghezza; in orizzontale due file + la mano stanno in altezza
  function misura() {
    if (!root) return;
    const h = root.clientHeight || 360, w = root.clientWidth || 640, vert = h > w * 1.05;
    root.classList.toggle('vert', vert); root.classList.toggle('oriz', !vert);
    let cw;
    if (vert) cw = Math.min((w - 12 - 4 * 5 - 18) / 5, (h - 312) / 5 / 1.4);
    else cw = Math.min((w - 12 - 6 * 5 - 70) / 10.4, (h - 160) / 3.0 / 1.4);
    cw = Math.max(36, Math.min(Math.floor(cw), 110));
    root.style.setProperty('--hw', Math.round(vert ? Math.max(cw, Math.min(cw * 1.4, (h - 230 - cw * 1.4 * 4) / 1.4)) : cw) + 'px');
    root.style.setProperty('--cw', cw + 'px'); root.style.setProperty('--ch', Math.round(cw * 1.4) + 'px');
  }

  function cartaEl(card, opz) {
    opz = opz || {};
    const d = nodo('div', 'carta'); const im = nodo('img'); im.src = img(card.id); im.alt = card.n; im.draggable = false; d.appendChild(im);
    if (opz.cls) d.className += ' ' + opz.cls;
    if (opz.click) d.addEventListener('click', e => { e.stopPropagation(); opz.click(); });
    return d;
  }
  const dorso = cls => nodo('div', 'carta dorso' + (cls ? ' ' + cls : ''));
  function campoEl(p, ch) {
    const d = cartaEl(ch.c, { cls: (ch.girato ? 'girato' : '') + (nuovi.has(ch.uid) ? ' nuovo' : '') + (selez && selez.ch === ch ? ' sel' : '') });
    const pw = potenza(p, ch), base = ch.c.p;
    d.appendChild(nodo('span', 'pw' + (pw > base ? ' su' : pw < base ? ' giu' : ''), String(pw)));
    const tk = [ha(ch, 'guardia') ? '<i class="g">GUARDIA</i>' : '', ha(ch, 'rush') ? '<i class="r">RUSH</i>' : '', ch.eq.length ? '<i class="e">⚙' + ch.eq.length + '</i>' : ''].join('');
    if (tk) d.appendChild(nodo('span', 'tk', tk));
    if (!p.ia && !S.occupato && puoAttaccare(p, ch)) d.classList.add('pronto-att');
    d.addEventListener('click', e => { e.stopPropagation(); seleziona({ p, ch }); });
    return d;
  }

  function lato(i) {
    return `<section class="side ${i ? 'avv' : 'io'}" data-s="${i}">
  <div class="head"></div>
  <div class="zona l lead" data-et="Belinone"></div>
  <div class="zona v pila" data-et="Belinate"></div>
  <div class="zona c" data-et="Character"></div>
  <div class="zona t tire" data-et="Tire"></div>
  <div class="zona b pila" data-et="Bormida"></div>
</section>`;
  }
  function costruisci() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    root = nodo('div'); root.id = 'bv';
    root.innerHTML = `
<header class="bar">
  <h1 class="disp">Belinverse 2</h1><span class="fase"></span><span class="sp"></span>
  <button data-b="attacchi">Attacchi ▸</button><button class="pri" data-b="fine">Fine turno</button><button data-b="menu">☰</button>
</header>
<main class="tav">
  <div class="manoAvv"></div>
  ${lato(1)}
  <div class="rope"><span>Belinverse 2</span></div>
  ${lato(0)}
  <div class="mano"></div>
</main>
<aside class="bvaz"></aside>
<img class="mostra" alt="">
<div class="banner"></div>
<div class="ov" data-o="zoom"></div>
<div class="ov" data-o="pick"></div>
<div class="menu" style="display:none"></div>
<div class="ed" style="display:none"></div>`;
    (document.getElementById('app') || document.body).appendChild(root);
    root.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); bottone(b.dataset.b); }));
    $('.rope').addEventListener('click', () => mostraLog());
    $('.tav').addEventListener('click', () => seleziona(null));
    root.querySelectorAll('.side').forEach(s => {
      const p = () => S && S.g[+s.dataset.s];
      $('.zona.b', s).addEventListener('click', e => { e.stopPropagation(); if (S) vediBormida(p()); });
      $('.zona.l', s).addEventListener('click', e => { e.stopPropagation(); if (S) seleziona({ p: p(), leader: true }); });
      $('.zona.v', s).addEventListener('click', e => { e.stopPropagation(); if (S) UI.log((p().ia ? 'L\'avversario ha ' : 'Hai ') + p().belinate.length + ' Belinate: se viene colpito il Belinone senza Belinate, la partita è persa'); });
      $('.zona.t', s).addEventListener('click', e => { e.stopPropagation(); if (S) UI.log((p().ia ? 'L\'avversario ha ' : 'Hai ') + pronte(p()) + ' Tire pronte su ' + p().tire); });
    });
    $('[data-o="zoom"]').addEventListener('click', e => { if (e.target === e.currentTarget || e.target.tagName === 'IMG') chiudiZoom(); });
    window.addEventListener('resize', () => { if (UI.aperto) { misura(); } });
    window.addEventListener('keydown', e => { if (UI.aperto && e.key === 'Escape') { chiudiZoom(); seleziona(null); } });
  }
  function vediBormida(p) { UI.scegli({ titolo: (p.ia ? 'Bormida dell\'avversario' : 'La tua Bormida') + ' (' + p.bormida.length + ')', cand: p.bormida.slice().reverse(), min: 0, max: 0, tipo: 'carte', vista: true }); }

  function bottone(b) {
    if (b === 'menu') {
      if (!S) return;
      chiediUI('Menu della partita', ['Registro della partita', 'Regole', 'Esci dalla partita', 'Torna al tavolo']).then(r => {
        if (r === 0) mostraLog();
        if (r === 1) regole();
        if (r === 2) bottone('esci');
      });
      return;
    }
    if (b === 'esci') { if (!S || S.fine || S.fase === 'inizio') { BV.chiudi(); return; } UI.chiedi('Vuoi lasciare la partita? Conta come sconfitta.', ['Esci', 'Continua']).then(r => { if (r === 0) { SAV.perse++; salva(); S.fine = { vince: 1, motivo: 'ritirato' }; BV.chiudi(); } }); return; }
    const io = S.g[0];
    if (S.att !== 0 || S.occupato || S.fine) return;
    if (ospite()) { if (b === 'attacchi' && S.fase === 'main') RETE.manda('attacchi', 0); if (b === 'fine' && (S.fase === 'main' || S.fase === 'attacchi')) { selez = null; RETE.manda('fine', 0); } return; }
    if (b === 'attacchi' && S.fase === 'main') { S.fase = 'attacchi'; selez = null; (S.online ? UI.log : log)(io.nTurni > 1 ? 'Fase attacchi: tocca un tuo Character pronto (o il Belinone) per attaccare' : 'Nel primo turno non puoi attaccare'); UI.render(); }
    if (b === 'fine' && (S.fase === 'main' || S.fase === 'attacchi') && fineTurnoUmano) { selez = null; fineTurnoUmano(); }
  }

  /* ---------- carta scelta: barra in basso con le azioni ---------- */
  function seleziona(s) {
    if (s && selez && ((s.c && s.c === selez.c) || (s.ch && s.ch === selez.ch) || (s.leader && selez.leader && s.p === selez.p))) s = null;   // ritocco = chiudi
    selez = s; if (S) UI.render();
  }
  function riga(t) { return '<span class="chip">' + t + '</span>'; }
  function disegnaAzioni() {
    const a = $('.bvaz');
    // la scelta non vale piu' se la carta ha cambiato posto
    if (selez && S) {
      const p = selez.p;
      if (selez.c && !p.mano.includes(selez.c)) selez = null;
      else if (selez.ch && !p.campo.includes(selez.ch)) selez = null;
    }
    if (!selez || !S || S.fine) { a.classList.remove('on'); a.innerHTML = ''; return; }
    const io = S.g[0], p = selez.p, mio = S.att === 0 && !S.occupato && !S.fine;
    let card, sub, stats = '', txt = '', bt = [], eqs = null;
    if (selez.c) {
      const mc = selez.c, k = mc.c; card = k;
      sub = NOMI_TIPO[k.t] + (k.reaz ? ' · Reazione' : '') + ' · costo ' + k.c + ' Tir' + (k.c === 1 ? 'a' : 'e');
      if (k.t === 'C') stats += riga('Potenza<b>' + k.p + '</b>');
      if (k.t === 'E' && k.bonus) stats += riga('Bonus<b>+' + k.bonus + '</b>');
      txt = k.reaz ? 'REAZIONE: si gioca quando l\'avversario ti attacca.' : !mio ? 'Puoi giocare carte nel tuo turno, in fase MAIN.' : S.fase !== 'main' ? 'Le carte si giocano in fase MAIN, prima degli attacchi.' : pronte(io) < k.c ? 'Non hai abbastanza Tire pronte.' : k.t === 'E' && !io.campo.some(ch => ch.eq.length < 2) ? 'Serve un tuo Character con meno di 2 Equipaggiamenti.' : 'Tocca la carta grande per leggerla meglio.';
      if (!k.reaz) bt.push({ t: (k.t === 'E' ? 'Assegna' : 'Gioca') + ' (' + k.c + ')', pri: true, off: !mio || !giocabile(io, mc), fn: () => azione(() => gioca(io, mc)) });
    } else if (selez.ch) {
      const ch = selez.ch, pw = potenza(p, ch); card = ch.c;
      sub = (p.ia ? 'Character dell\'avversario' : 'Il tuo Character') + ' · ' + (ch.girato ? 'girato' : 'pronto');
      stats = riga('Potenza<b>' + pw + '</b>') + (ha(ch, 'guardia') ? riga('GUARDIA') : '') + (ha(ch, 'rush') ? riga('RUSH') : '');
      if (!p.ia) {
        txt = ch.entrato === S.turno && !ha(ch, 'rush') ? 'Appena entrato: attacca dal prossimo turno.' : S.att === 0 && S.fase === 'main' ? 'Per attaccare passa alla fase Attacchi.' : '';
        bt.push({ t: 'Attacca', pri: true, off: S.occupato || !puoAttaccare(p, ch), fn: () => azione(() => attacca(io, ch)) });
      }
      if (ch.eq.length) { eqs = nodo('div', 'eqs'); ch.eq.forEach(x => { const i = nodo('img'); i.src = img(x.c.id); i.addEventListener('click', () => apriAnteprima(x.c)); eqs.appendChild(i); }); }
    } else {
      card = p.leader.c;
      sub = 'Belinone' + (p.ia ? ' dell\'avversario' : '') + ' · 3000 Potenza';
      txt = p.leader.c.desc;
      stats = riga('Belinate<b>' + p.belinate.length + '</b>') + (p.leader.girato ? riga('girato') : '');
      if (!p.ia) {
        bt.push({ t: 'Attacca (3000)', pri: true, off: S.occupato || !leaderPuoAttaccare(p), fn: () => azione(() => attacca(io, null)) });
        if (p.leader.c.abil) bt.push({ t: 'Usa effetto (' + p.leader.c.abil.costo + ')', off: S.occupato || S.att !== 0 || (S.fase !== 'main' && S.fase !== 'attacchi') || !leaderAbilUsabile(p), fn: () => azione(() => usaLeader(io)) });
      }
    }
    a.innerHTML = '';
    const pv = nodo('div', 'prev'); const im = nodo('img'); im.src = img(card.id); pv.appendChild(im); pv.addEventListener('click', () => apriAnteprima(card)); a.appendChild(pv);
    const inf = nodo('div', 'info');
    inf.appendChild(nodo('div', 'nome disp', esc(card.n)));
    inf.appendChild(nodo('div', 'sub', esc(sub)));
    if (stats) inf.appendChild(nodo('div', 'stats', stats));
    if (eqs) inf.appendChild(eqs);
    if (txt) inf.appendChild(nodo('div', 'txt', esc(txt)));
    const bs = nodo('div', 'btns');
    bt.forEach(x => { const b = nodo('button', x.pri ? 'pri' : '', x.t); b.disabled = !!x.off; b.addEventListener('click', () => { selez = null; x.fn(); }); bs.appendChild(b); });
    const c = nodo('button', '', 'Chiudi'); c.addEventListener('click', () => seleziona(null)); bs.appendChild(c);
    inf.appendChild(bs); a.appendChild(inf); a.classList.add('on');
  }

  /* ---------- finestre ---------- */
  function chiudiZoom() { $('[data-o="zoom"]').classList.remove('on'); }
  function apriAnteprima(card) {
    const o = $('[data-o="zoom"]'); o.innerHTML = '';
    const z = nodo('div', 'zoom'); const im = nodo('img', 'big'); im.src = img(card.id); z.appendChild(im);
    o.appendChild(z); o.classList.add('on');
  }
  function scegliUI(req) {
    return new Promise(res => {
      chiudiZoom(); selez = null; disegnaAzioni();
      const o = $('[data-o="pick"]'); o.innerHTML = '';
      const box = nodo('div', 'pick'); box.appendChild(nodo('h3', '', req.titolo));
      const lista = nodo('div', 'lista'), sel = [];
      const tutte = req.mostra || req.cand;
      const piede = nodo('div', 'piede'), conta = nodo('span');
      const ok = nodo('button', 'pri', req.okTesto || 'Conferma');
      const agg = () => {
        conta.textContent = req.vista ? (tutte.length ? 'Tocca una carta per ingrandirla' : 'Vuota') : req.max > 1 ? 'Scelte: ' + sel.length + (req.max < 99 ? ' / ' + req.max : '') : '';
        ok.disabled = sel.length < req.min || sel.length > req.max;
        if (req.scopo === 'blocco' && !req.libero) ok.textContent = sel.length ? 'Blocca' : 'Non bloccare';
        if (req.scopo === 'mulligan') ok.textContent = sel.length ? 'Cambia ' + sel.length + ' carte' : 'Tieni tutte';
        if (req.scopo === 'reazione') ok.textContent = sel.length ? 'Gioca la reazione' : 'Nessuna reazione';
      };
      tutte.forEach(x => {
        const disp = req.cand.includes(x);
        const dueno = req.di; let d;
        if (req.tipo === 'campo') { d = cartaEl(x.c); const pw = potenza(dueno, x); d.appendChild(nodo('span', 'pw' + (pw > x.c.p ? ' su' : pw < x.c.p ? ' giu' : ''), String(pw))); if (x.girato) d.appendChild(nodo('span', 'tk', '<i class="g">girato</i>')); }
        else d = cartaEl(x.c);
        if (!disp) d.classList.add('fuori');
        d.addEventListener('click', () => {
          if (!disp || req.vista) { apriAnteprima(x.c); return; }
          const i = sel.indexOf(x);
          if (i >= 0) { sel.splice(i, 1); d.classList.remove('sel'); }
          else { if (req.max === 1 && sel.length) { sel.length = 0; lista.querySelectorAll('.sel').forEach(n => n.classList.remove('sel')); } if (sel.length < req.max) { sel.push(x); d.classList.add('sel'); } }
          agg();
        });
        lista.appendChild(d);
      });
      if (req.attP !== undefined && !req.libero) box.appendChild(nodo('div', '', '<small>Attaccante: <b style="color:var(--gold-hi)">' + req.attP + '</b>' + (req.attL ? ' (Belinone: il tuo Character è eliminato solo se ha meno di 3000)' : '') + '. Se non blocchi perdi 1 Belinata (ne hai ' + S.g[0].belinate.length + ').</small>'));
      box.appendChild(lista);
      piede.appendChild(conta);
      if (req.vista) { const c = nodo('button', '', 'Chiudi'); c.addEventListener('click', () => { o.classList.remove('on'); res([]); }); piede.appendChild(c); }
      else { ok.addEventListener('click', () => { o.classList.remove('on'); res(sel.slice()); }); piede.appendChild(ok); }
      box.appendChild(piede); o.appendChild(box); o.classList.add('on'); agg();
    });
  }
  function chiediUI(testo, opz) {
    return new Promise(res => {
      const o = $('[data-o="pick"]'); o.innerHTML = '';
      const box = nodo('div', 'pick'); box.style.maxWidth = '440px'; box.appendChild(nodo('h3', '', testo));
      const piede = nodo('div', 'piede');
      opz.forEach((t, i) => { const b = nodo('button', i ? '' : 'pri', t); b.addEventListener('click', () => { o.classList.remove('on'); res(i); }); piede.appendChild(b); });
      box.appendChild(piede); o.appendChild(box); o.classList.add('on');
    });
  }
  function mostraLog() {
    const o = $('[data-o="pick"]'); if (o.classList.contains('on') || !S) return;
    chiediUI('<div style="max-height:60vh;overflow-y:auto;font-weight:400;font-size:12.5px;color:var(--ink)">' + S.log.slice().reverse().map(t => '<div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,.08)">' + esc(risolvi(t, 0)) + '</div>').join('') + '</div>', ['Chiudi']);
  }
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

  /* ---------- disegno del tavolo ---------- */
  let timerMostra = 0, timerBanner = 0;
  const UI = {
    aperto: false,
    scegli: scegliUI, chiedi: chiediUI,
    log(t, forte) { if (!root) return; const m = $('.rope span'); m.innerHTML = forte ? '<b>' + esc(t) + '</b>' : esc(t); },
    banner(t) { const b = $('.banner'); b.textContent = t; b.classList.add('on'); clearTimeout(timerBanner); timerBanner = setTimeout(() => b.classList.remove('on'), 1100); },
    mostra(p, card) { if (ON && ON.ruolo === 'h' && !p.ia) { RETE.mostrato(card.id); } if (!p.ia) return; const m = $('.mostra'); m.src = img(card.id); m.classList.add('on'); clearTimeout(timerMostra); timerMostra = setTimeout(() => m.classList.remove('on'), 1500); },
    colpo(p) { const l = $('.side[data-s="' + p.i + '"] .lead'); if (l) { l.classList.remove('colpo'); void l.offsetWidth; l.classList.add('colpo'); } if (B.Audio && B.Audio.bip) try { B.Audio.bip(false); } catch (e) { /* ok */ } },
    attacco(p, ch) { if (B.Audio && B.Audio.bip) try { B.Audio.bip(true); } catch (e) { /* ok */ } },
    fine(vinto, motivo, premio) {
      selez = null; disegnaAzioni();
      chiediUI('<div style="text-align:center"><div class="disp" style="font-size:28px;margin-bottom:6px">' + (vinto ? '🏆 Hai vinto!' : 'Hai perso') + '</div><div style="font-weight:400;font-size:13px;color:var(--ink)">' + esc(risolvi(motivo, 0)) + (premio ? '<br>+' + premio + ' coins' : '') + '<br><small>Vittorie ' + SAV.vinte + ' · Sconfitte ' + SAV.perse + '</small></div></div>', ON ? ['Menu'] : ['Rivincita', 'Menu']).then(r => { if (ON) { ON = null; menu(); return; } if (r === 0) avviaPartita(); else menu(); });
    },
    render() {
      if (!root || !S) return;
      const io = S.g[0], ia = S.g[1], mio = S.att === 0 && !S.fine;
      [io, ia].forEach(p => {
        const s = $('.side[data-s="' + p.i + '"]');
        $('.head', s).innerHTML = '<span class="pname disp' + (S.att === p.i && !S.fine ? ' on' : '') + '">' + esc(p.ia ? (S.nomeAvv || 'Avversario') : 'Tu') + '</span>' +
          '<span class="chip vita">♥<b>' + p.belinate.length + '</b></span><span class="chip">Mano<b>' + p.mano.length + '</b></span><span class="chip">Mazzo<b>' + p.mazzo.length + '</b></span><span class="chip">Tire<b>' + pronte(p) + '/' + p.tire + '</b></span>';
        // Character
        const c = $('.zona.c', s); c.innerHTML = '';
        p.campo.forEach(ch => c.appendChild(campoEl(p, ch)));
        for (let k = p.campo.length; k < 5; k++) c.appendChild(nodo('div', 'slot'));
        // Belinone
        const l = $('.zona.l', s); l.innerHTML = '';
        l.appendChild(cartaEl(p.leader.c, { cls: (p.leader.girato ? 'girato' : '') + (!p.ia && !S.occupato && leaderPuoAttaccare(p) ? ' pronto-att' : '') + (selez && selez.leader && selez.p === p ? ' sel' : '') }));
        // Belinate (vita): coperte, una sopra l'altra
        const v = $('.zona.v', s); v.innerHTML = '';
        if (p.belinate.length) { v.appendChild(dorso()); v.appendChild(nodo('span', 'badge', String(p.belinate.length))); } else v.appendChild(nodo('span', 'vuoto', 'nessuna'));
        // Tire
        const t = $('.zona.t', s); t.innerHTML = '';
        for (let k = 0; k < p.tire; k++) { const w = nodo('div', 'tt' + (k >= pronte(p) ? ' g' : '')); const im = nodo('img'); im.src = img('T01'); im.alt = 'Tira'; w.appendChild(im); t.appendChild(w); }
        if (!p.tire) t.appendChild(nodo('span', 'vuoto', 'Tire'));
        // Bormida: l'ultima carta scoperta
        const b = $('.zona.b', s); b.innerHTML = '';
        if (p.bormida.length) { b.appendChild(cartaEl(p.bormida[p.bormida.length - 1].c)); b.appendChild(nodo('span', 'badge', String(p.bormida.length))); } else b.appendChild(nodo('span', 'vuoto', 'vuota'));
      });
      const ma = $('.manoAvv'); ma.innerHTML = ''; ia.mano.forEach(() => ma.appendChild(dorso()));
      // la mano: le carte si sovrappongono da sole quando sono tante
      const m = $('.mano'); m.innerHTML = '';
      io.mano.forEach(c => {
        const ok = giocabile(io, c) && !S.occupato;
        const w = nodo('div', 'mc');
        w.appendChild(cartaEl(c.c, { cls: (ok ? 'ok' : (S.att === 0 && S.fase === 'main' ? 'no' : '')) + (selez && selez.c === c ? ' sel' : ''), click: () => seleziona({ p: io, c }) }));
        m.appendChild(w);
      });
      if (!io.mano.length) m.appendChild(nodo('span', 'vuoto', 'La tua mano è vuota'));
      const f = $('.bar .fase');
      f.textContent = S.fine ? 'Partita finita' : 'Turno ' + Math.max(1, S.turno) + ' · ' + (!mio ? 'avversario' : S.fase === 'main' ? 'tocca a te · MAIN' : S.fase === 'attacchi' ? 'tocca a te · ATTACCHI' : 'tocca a te');
      f.classList.toggle('mio', mio);
      $('[data-b="attacchi"]').disabled = !mio || S.fase !== 'main' || S.occupato;
      $('[data-b="fine"]').disabled = !mio || (S.fase !== 'main' && S.fase !== 'attacchi') || S.occupato;
      disegnaAzioni();
      nuovi.clear();
    }
  };

  /* ---------- menu: Belinone, mazzo, regole ---------- */
  function menu() {
    S = null; ON = null; sfida = null;
    const mn = $('.menu'); mn.style.display = 'block'; $('.ed').style.display = 'none';
    if (!leaderOk(SAV.leader)) SAV.leader = '101';
    const mio = mazzoValido(SAV.mazzo), tot = tuttePossedute();
    mn.innerHTML = `<div class="top"><h1>BELINVERSE 2</h1><button class="sec" data-m="esci">✕ Esci</button></div>
<p>Il gioco di carte del gruppo, Set 001. Sfida l'avversario al tavolo: colpisci il suo Belinone finché non resta senza Belinate.</p>
<h2>Scegli il tuo Belinone</h2><div class="leaders"></div><p class="ldesc"></p>
<h2>Mazzo</h2><p>${mio ? 'Userai il tuo mazzo personale (40 carte).' : tot >= 40 ? 'Hai ' + tot + ' carte: puoi costruire il tuo mazzo. Finché non lo fai giochi con un mazzo in prestito.' : 'Hai ' + tot + ' carte su 40 che servono per un mazzo tuo: intanto giochi con un mazzo in prestito. Le carte si trovano nei pacchetti.'}</p>
<div class="riga-b"><button class="pri" data-m="gioca">▶ Gioca</button><button class="sec" data-m="mazzo">✎ ${mio ? 'Modifica il tuo mazzo' : 'Costruisci il tuo mazzo'}</button>${mio ? '<button class="sec" data-m="casuale">Gioca con mazzo in prestito</button>' : ''}<button class="sec" data-m="pacchetti">🎁 Pacchetti${gratisOggi() ? ' (1 gratis)' : ''}</button><button class="sec" data-m="regole">Regole</button></div>
<div class="amici-bv"></div>
<p style="margin-top:10px;opacity:.7;font-size:12px">Le tue carte: ${tot} (${carteDiverse()} diverse su ${CARTE.length}) · Vittorie ${SAV.vinte} · Sconfitte ${SAV.perse} · Ogni vittoria vale ${PREMIO} coins (fino a ${PREMI_GIORNO} al giorno)</p>`;
    const ls = $('.leaders', mn);
    LEADER.filter(l => leaderOk(l.id)).forEach(l => {
      const d = cartaEl(l, { cls: SAV.leader === l.id ? 'sel' : '', click: () => { SAV.leader = l.id; salva(); ls.querySelectorAll('.carta').forEach(n => n.classList.remove('sel')); d.classList.add('sel'); $('.ldesc', mn).textContent = l.n + ': ' + l.desc; } });
      ls.appendChild(d);
    });
    const sl = PER_ID[SAV.leader] || LEADER[0]; $('.ldesc', mn).textContent = sl.n + ': ' + sl.desc;
    mn.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.m;
      if (m === 'esci') BV.chiudi();
      if (m === 'gioca') avviaPartita();
      if (m === 'casuale') avviaPartita(true);
      if (m === 'mazzo') editor();
      if (m === 'pacchetti') negozio(true);
      if (m === 'regole') regole();
    }));
  }

  /* ---------- il venditore di pacchetti (sala TCG) ---------- */
  function negozio(daMenu) {
    S = null;
    const mn = $('.menu'); mn.style.display = 'block'; $('.ed').style.display = 'none';
    const coins = B.Eco ? B.Eco.coins : 0, gratis = gratisOggi();
    mn.innerHTML = `<div class="top"><h1>Pacchetti</h1><button class="sec" data-n="esci">${daMenu ? '← Indietro' : '✕ Esci'}</button></div>
<div class="pk-riga"><div class="pacco"><b>BELINVERSE</b><span>2</span><small>Set 001 · ${PACCHETTO.carte} carte</small></div>
<div class="pk-info"><p class="pk-voce">«${gratis ? 'Ciao! Il pacchetto di oggi è offerto dalla casa.' : 'Il regalo di oggi l\'hai già preso. Se ne vuoi altri costano ' + PACCHETTO.prezzo + ' coins.'}»</p>
<p>Ogni pacchetto ha ${PACCHETTO.carte} carte: 4 comuni, 1 rara e 1 rara o super rara. Ogni tanto esce un Belinone Alternative. Le carte finiscono nello zaino e le usi per il tuo mazzo.</p>
<div class="riga-b">${gratis ? '<button class="pri" data-n="gratis">🎁 Apri il pacchetto gratis</button>' : ''}<button class="${gratis ? 'sec' : 'pri'}" data-n="compra"${coins < PACCHETTO.prezzo ? ' disabled' : ''}>Compra un pacchetto · 🪙 ${PACCHETTO.prezzo}</button>${daMenu ? '' : '<button class="sec" data-n="gioca">Gioca a Belinverse</button>'}</div>
<p style="opacity:.75;font-size:12px">Hai 🪙 ${coins} · Le tue carte: ${tuttePossedute()} (${carteDiverse()} diverse su ${CARTE.length}) · Pacchetti aperti: ${SAV.pacchetti | 0}</p></div></div>`;
    mn.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', () => {
      const n = b.dataset.n;
      if (n === 'esci') { if (daMenu) menu(); else BV.chiudi(); }
      if (n === 'gioca') menu();
      if (n === 'gratis' && gratisOggi()) { SAV.pacchettoDi = oggiStr(); mostraPacchetto(apriUnPacchetto(), () => negozio(daMenu)); }
      if (n === 'compra' && B.Eco && B.Eco.spendi(PACCHETTO.prezzo)) mostraPacchetto(apriUnPacchetto(), () => negozio(daMenu));
    }));
  }
  function mostraPacchetto(ris, poi) {
    const o = $('[data-o="pick"]'); o.innerHTML = '';
    const box = nodo('div', 'pick apertura'); box.appendChild(nodo('h3', '', 'Tocca le carte per girarle'));
    const lista = nodo('div', 'lista'); let girate = 0;
    const ok = nodo('button', 'pri', 'Gira tutte');
    const gira = (d, r) => { if (d.classList.contains('su')) return; d.classList.add('su'); girate++; if (girate === ris.length) { ok.textContent = 'Nello zaino ✓'; box.querySelector('h3').textContent = 'Ecco le tue carte!'; } };
    ris.forEach((r, i) => {
      const k = PER_ID[r.id], d = nodo('div', 'flip' + (k.r === 'SR' || k.t === 'L' ? ' rara' : ''));
      d.appendChild(nodo('div', 'carta dorso faccia-d'));
      const f = cartaEl(k, { cls: 'faccia-f' }); if (r.nuova) f.appendChild(nodo('span', 'nuova', 'NUOVA')); d.appendChild(f);
      d.addEventListener('click', () => { if (d.classList.contains('su')) apriAnteprima(k); else gira(d, r); });
      lista.appendChild(d);
    });
    ok.addEventListener('click', () => {
      if (girate < ris.length) { [...lista.children].forEach((d, i) => setTimeout(() => gira(d, ris[i]), i * 140)); return; }
      o.classList.remove('on'); if (poi) poi();
    });
    const piede = nodo('div', 'piede'); piede.appendChild(nodo('span', '', ris.filter(r => r.nuova).length + ' nuove')); piede.appendChild(ok);
    box.appendChild(lista); box.appendChild(piede); o.appendChild(box); o.classList.add('on');
    if (B.Audio && B.Audio.bip) try { B.Audio.bip(true); } catch (e) { /* ok */ }
  }
  function regole() {
    chiediUI('<div class="regole" style="font-weight:400;max-height:62vh;overflow-y:auto"><ul style="padding-left:18px;margin:0">' + [
        'Mazzo di 40 carte (max 3 copie), più 1 Belinone (3000 Potenza) e 10 Tire.',
        'Si pescano 5 carte (chi non inizia 6), con un mulligan. Le prime 5 carte del mazzo diventano le tue <b>Belinate</b>.',
        'Ogni turno: le carte girate tornano pronte, prendi Tire (1 o 2 al primo turno, poi 2, fino a 10), peschi 1 carta, giochi carte (MAIN) e poi attacchi.',
        'Le Tire si girano per pagare i costi e tornano pronte all\'inizio del tuo turno.',
        'Massimo 5 Character in campo. Un Character non attacca nel turno in cui entra (salvo RUSH). Nel tuo primo turno non si attacca.',
        'Ogni attacco colpisce il Belinone avversario. Chi viene attaccato può bloccare con un Character pronto: vince chi ha più Potenza (pari: eliminati entrambi).',
        'Il Belinone attacca una volta per turno con 3000; il Character che lo blocca è eliminato solo se ha meno di 3000. Il Belinone non blocca e non viene mai eliminato.',
        'Se nessuno blocca, chi è colpito perde 1 Belinata: la prende in mano. Chi viene colpito senza più Belinate perde.',
        'GUARDIA: quando blocca non viene girato. RUSH: attacca subito. REAZIONE: si gioca nel turno avversario quando ti attaccano.',
        'Equipaggiamenti: massimo 2 per Character, vanno in Bormida quando il Character lascia il campo. Fine turno: massimo 10 carte in mano.'
      ].map(t => '<li>' + t + '</li>').join('') + '</ul></div>', ['Ok']);
  }
  function avviaPartita(casuale) {
    $('.menu').style.display = 'none'; $('.ed').style.display = 'none'; chiudiZoom(); selez = null; $('[data-o="pick"]').classList.remove('on');
    const m = !casuale && mazzoValido(SAV.mazzo) ? SAV.mazzo : mazzoCasuale();
    nuovaPartita(m, leaderOk(SAV.leader) ? SAV.leader : '101');
    UI.render(); UI.log('Si mischia e si pesca…');
    setTimeout(() => partita(), 400);
  }
  function editor() {
    const ed = $('.ed'); ed.style.display = 'flex';
    let m = mazzoValido(SAV.mazzo) ? SAV.mazzo.slice() : [], filtro = 'C';
    ed.innerHTML = `<div class="ebar"><b class="tot"></b><button class="sec" data-e="casuale">Casuale</button><button class="sec" data-e="svuota">Svuota</button><button class="sec" data-e="annulla">Annulla</button><button class="pri" data-e="salva">Salva</button></div>
<div class="ebar"><button class="sec f" data-f="C">Character</button><button class="sec f" data-f="E">Equipaggiamenti</button><button class="sec f" data-f="V">Eventi</button><button class="sec f" data-f="M">Nel mazzo</button></div><div class="griglia"></div>`;
    const n = id => m.filter(x => x === id).length;
    const disegna = () => {
      $('.tot', ed).textContent = 'Il tuo mazzo: ' + m.length + ' / 40' + (m.length === 40 ? ' ✓' : '') + ' · usi solo le carte che hai';
      ed.querySelectorAll('.f').forEach(b => b.classList.toggle('on', b.dataset.f === filtro));
      $('[data-e="salva"]', ed).disabled = m.length !== 40;
      const g = $('.griglia', ed), sy = g.scrollTop; g.innerHTML = '';
      const lista = filtro === 'M' ? CARTE.filter(c => n(c.id)) : CARTE.filter(c => c.t === filtro && possiedi(c.id));
      if (!lista.length) g.appendChild(nodo('p', '', filtro === 'M' ? 'Il mazzo è vuoto.' : 'Non hai ancora carte di questo tipo: aprile nei pacchetti.'));
      lista.forEach(c => {
        const cel = nodo('div', 'cella'); cel.appendChild(cartaEl(c, { click: () => apriAnteprima(c) }));
        const k = n(c.id), lim = Math.min(3, possiedi(c.id)); if (k) cel.appendChild(nodo('span', 'n', String(k)));
        cel.appendChild(nodo('small', 'hai', 'ne hai ' + possiedi(c.id)));
        const pm = nodo('div', 'pm'), meno = nodo('button', 'sec', '−'), piu = nodo('button', 'pri', '+');
        meno.disabled = !k; piu.disabled = k >= lim || m.length >= 40;
        meno.addEventListener('click', () => { m.splice(m.indexOf(c.id), 1); disegna(); });
        piu.addEventListener('click', () => { m.push(c.id); disegna(); });
        pm.append(meno, piu); cel.appendChild(pm); g.appendChild(cel);
      });
      g.scrollTop = sy;
    };
    ed.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filtro = b.dataset.f; $('.griglia', ed).scrollTop = 0; disegna(); }));
    ed.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => {
      const e = b.dataset.e;
      if (e === 'casuale') m = mazzoCasuale(possiedi);
      if (e === 'svuota') m = [];
      if (e === 'annulla') { menu(); return; }
      if (e === 'salva' && m.length === 40) { SAV.mazzo = m.slice().sort(); salva(); menu(); return; }
      disegna();
    }));
    disegna();
  }


  /* =====================================================================
     ONLINE: partita tra due amici (vedi online.js). Chi sfida fa da tavolo: il motore gira
     da lui e l'amico e' il giocatore 2. Il tavolo manda all'amico la foto della partita vista
     dal suo lato (senza la mano e il mazzo dell'altro) e le domande da fare a lui (blocchi,
     reazioni, scelte); l'amico risponde e manda le sue mosse. Tutto passa nella presenza.
     ===================================================================== */
  const mioId = Math.random().toString(36).slice(2, 8), amici = new Map();   // peer -> { nick, d, t }
  let ON = null, sfida = null, accetto = 0, tAmici = 0, chiesta = 0;
  const ospite = () => !!(ON && ON.ruolo === 'o');
  const fresco = a => performance.now() - a.t < 8000;
  const ist = x => x.uid + '.' + x.c.id;
  const finta = () => ({ uid: -1, c: CARTE[0] });
  const istDa = q => { const t = String(q).split('.'); return { uid: +t[0] || -1, c: PER_ID[t[1]] || CARTE[0] }; };
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const lista = (v, n) => (Array.isArray(v) ? v.slice(0, n || 80) : []);
  const escA = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const RETE = {
    // --- dal lato del tavolo ---
    scegli(p, req) {
      const r = { sc: req.scopo, ti: risolvi(req.titolo, 1), ca: req.cand.map(ist), mo: req.mostra ? req.mostra.map(ist) : null, mi: req.min, mx: req.max, tp: req.tipo, di: req.di ? 1 - req.di.i : null, ok: req.okTesto || null, ap: req.attP, al: req.attL ? 1 : 0, li: req.libero ? 1 : 0 };
      return domanda('scegli', r).then(x => {
        const u = lista(x && x.sel, 40); let out = req.cand.filter(c => u.includes(c.uid)).slice(0, req.max);
        if (out.length < req.min) out = req.cand.slice(0, req.min);
        return out;
      });
    },
    chiedi(p, testo, opz) { return domanda('chiedi', { ti: testo, op: opz }).then(x => clampI(num(x && x.i, opz.length - 1), opz.length)); },
    turno(p) { lista(ON.azAmico, 6).forEach(x => { if (x && num(x.n, 0) > ON.azF) ON.azF = x.n; }); return new Promise((res, rej) => { ON.turno = { p, res, rej }; ciclaAzioni(); }); },   // mosse vecchie (di prima del turno) non valgono
    mostrato(id) { ON.mo = [(ON.mo ? ON.mo[0] : 0) + 1, id]; },
    // --- dal lato dell'amico ---
    manda(op, u) { ON.azN++; ON.az.push({ n: ON.azN, op, u }); if (ON.az.length > 6) ON.az.shift(); if (S) { S.occupato = true; UI.render(); } }
  };
  const clampI = (i, n) => Math.max(0, Math.min(n - 1, Math.round(i)));
  function domanda(k, r) { ON.rqN++; ON.rq = { n: ON.rqN, k, r }; return new Promise((res, rej) => { ON.attesa = { n: ON.rqN, res, rej }; }); }
  // le mosse dell'amico nel suo turno, una alla volta
  async function ciclaAzioni() {
    if (!ON || ON.ruolo !== 'h' || ON.lavora || !ON.turno) return;
    const a = lista(ON.azAmico, 6).find(x => x && num(x.n, 0) > ON.azF); if (!a) return;
    ON.azF = a.n; const p = ON.turno.p; ON.lavora = true; S.occupato = true; UI.render();
    try {
      if (a.op === 'fine') { const t = ON.turno; ON.turno = null; ON.lavora = false; S.occupato = false; t.res(); return; }
      if (a.op === 'attacchi' && S.fase === 'main') S.fase = 'attacchi';
      if (a.op === 'gioca') { const c = p.mano.find(x => x.uid === a.u); if (c) await gioca(p, c); }
      if (a.op === 'attacca') { const ch = a.u ? p.campo.find(x => x.uid === a.u) : null; if (!a.u || ch) await attacca(p, ch); }
      if (a.op === 'leader') await usaLeader(p);
    } catch (e) {
      if (!ON) return;
      ON.lavora = false; S.occupato = false; const t = ON.turno; ON.turno = null;
      if (e instanceof Fine) { if (t) t.rej(e); return; } console.error(e);
    }
    if (!ON) return;
    ON.lavora = false; S.occupato = false; UI.render(); ciclaAzioni();
  }
  // la partita vista dall'amico: lui e' g[0]
  function foto() {
    const lato = i => 1 - i, P = (p, mio) => ({ n: p.nome, l: [p.leader.c.id, p.leader.girato ? 1 : 0, p.leader.usato, p.leader.morteUsata], mz: p.mazzo.length, ma: mio ? p.mano.map(ist) : p.mano.length, be: p.belinate.length, bo: p.bormida.map(ist),
      ca: p.campo.map(ch => [ch.uid, ch.c.id, ch.girato ? 1 : 0, ch.entrato, ch.eq.map(ist), ch.bonusT, ch.malusT, ch.comb, ch.telUsato, ch.cascoUsato]), ti: p.tire, tg: p.tireGirate, nt: p.nTurni });
    return { tu: S.turno, at: lato(S.att), pr: lato(S.primo), fa: S.fase, fi: S.fine ? { v: lato(S.fine.vince), m: risolvi(S.fine.motivo, 1) } : null, oc: S.occupato ? 1 : 0, lg: S.log.slice(-6).map(t => risolvi(t, 1).slice(0, 140)), g: [P(S.g[1], true), P(S.g[0], false)], mo: ON.mo || null, af: ON.azF };
  }
  function daFoto(f) {
    const P = (q, i, mio) => ({ i, nome: String(q.n || ''), ia: !mio, leader: { c: PER_ID[lista(q.l)[0]] || LEADER[0], girato: !!lista(q.l)[1], usato: num(lista(q.l)[2], -1), morteUsata: num(lista(q.l)[3], -1) },
      mazzo: Array.from({ length: Math.min(60, num(q.mz, 0)) }, finta), mano: Array.isArray(q.ma) ? lista(q.ma, 20).map(istDa) : Array.from({ length: Math.min(20, num(q.ma, 0)) }, finta),
      belinate: Array.from({ length: Math.min(10, num(q.be, 0)) }, finta), bormida: lista(q.bo).map(istDa),
      campo: lista(q.ca, 5).map(a => ({ uid: num(a[0], -1), c: PER_ID[a[1]] || CARTE[0], girato: !!a[2], entrato: num(a[3], 0), eq: lista(a[4], 2).map(istDa), bonusT: num(a[5], 0), malusT: num(a[6], 0), comb: num(a[7], 0), telUsato: num(a[8], -1), cascoUsato: num(a[9], -1) })),
      tire: num(q.ti, 0), tireGirate: num(q.tg, 0), nTurni: num(q.nt, 0) });
    const g = lista(f.g, 2);
    return { g: [P(g[0] || {}, 0, true), P(g[1] || {}, 1, false)], turno: num(f.tu, 0), att: f.at ? 1 : 0, primo: f.pr ? 1 : 0, fase: String(f.fa || 'main'), fine: f.fi ? { vince: f.fi.v ? 1 : 0, motivo: String(f.fi.m || '') } : null,
      log: lista(f.lg, 6).map(String), occupato: !!f.oc || ON.azN > num(f.af, 0), online: true, nomeAvv: ON.nick };
  }
  // l'amico riceve una nuova foto dal tavolo
  function nuovaFoto(d) {
    const f = d.f; if (!f || !f.s || f.v === ON.v) return; ON.v = f.v;
    let nuovo; try { nuovo = daFoto(f.s); } catch (e) { return; }
    const vecchio = S; S = nuovo;
    if (vecchio && vecchio.g) {
      const uid0 = new Set(); vecchio.g.forEach(q => q.campo.forEach(ch => uid0.add(ch.uid))); S.g.forEach(q => q.campo.forEach(ch => { if (!uid0.has(ch.uid)) nuovi.add(ch.uid); }));
      [0, 1].forEach(i => { if (S.g[i].belinate.length < vecchio.g[i].belinate.length) UI.colpo(S.g[i]); });
      if (vecchio.att !== S.att && !S.fine) UI.banner(S.att === 0 ? 'Il tuo turno' : 'Turno di ' + ON.nick);
      if (selez) { const u = selez.c ? selez.c.uid : selez.ch ? selez.ch.uid : null, p = S.g[selez.p.i]; selez = selez.leader ? { p, leader: true } : selez.c ? ((c => c ? { p, c } : null)(p.mano.find(x => x.uid === u))) : ((ch => ch ? { p, ch } : null)(p.campo.find(x => x.uid === u))); }
    } else UI.banner('Partita con ' + ON.nick);
    if (S.log.length) UI.log(S.log[S.log.length - 1]);
    const mo = lista(f.s.mo, 2); if (mo.length === 2 && mo[0] !== ON.moV) { ON.moV = mo[0]; if (vecchio && PER_ID[mo[1]]) UI.mostra(S.g[1], PER_ID[mo[1]]); }
    UI.render();
    if (S.fine && !ON.fineVista) { ON.fineVista = true; fineDellaPartita(); }
  }
  // l'amico risponde a una domanda del tavolo
  async function rispondi(q) {
    ON.rqIn = q.n; const r = q.r || {};
    let out;
    if (q.k === 'chiedi') out = { i: await UI.chiedi(escA(String(r.ti || '')), lista(r.op, 4).map(x => escA(String(x)))) };
    else {
      const mappa = new Map(); if (S) S.g.forEach(g => { g.mano.forEach(x => mappa.set(x.uid, x)); g.campo.forEach(x => mappa.set(x.uid, x)); g.bormida.forEach(x => mappa.set(x.uid, x)); });
      const trova = t => { const u = +String(t).split('.')[0]; if (!mappa.has(u)) mappa.set(u, istDa(t)); return mappa.get(u); };
      const mostra = r.mo ? lista(r.mo, 40).map(trova) : null, cand = lista(r.ca, 40).map(trova);
      const req = { scopo: String(r.sc || ''), titolo: escA(String(r.ti || '')), cand, mostra: mostra || undefined, min: num(r.mi, 0), max: num(r.mx, 1), tipo: String(r.tp || 'carte'), di: r.di == null ? undefined : S.g[r.di ? 1 : 0], okTesto: r.ok ? escA(String(r.ok)) : undefined, attP: r.ap, attL: !!r.al, libero: !!r.li };
      if (req.tipo === 'campo' && !req.di) req.di = S.g[0];
      out = { sel: (await UI.scegli(req)).map(x => x.uid) };
    }
    if (ON && ON.rqIn === q.n) ON.rs = Object.assign({ n: q.n }, out);
  }
  // quello che metto nella presenza
  BV_rete = function () {
    if (!UI.aperto) return null;
    if (ON && ON.ruolo === 'h') {
      if (S) { const s = foto(), k = JSON.stringify(s); if (k !== ON.fk) { ON.fk = k; ON.fv++; } ON.fs = s; }
      return { id: mioId, st: 'gioco', ru: 'h', con: ON.id, f: { v: ON.fv, s: ON.fs }, rq: ON.rq };
    }
    if (ON) return { id: mioId, st: 'gioco', ru: 'o', con: ON.id, az: ON.az, rs: ON.rs };
    const m = mazzoValido(SAV.mazzo) ? SAV.mazzo : null;
    return { id: mioId, st: S ? 'solo' : 'menu', md: m, ld: leaderOk(SAV.leader) ? SAV.leader : '101', sf: sfida, acc: accetto };
  };
  // quello che ricevo dagli amici
  BV_amico = function (peer, nick, d) {
    if (!d || typeof d !== 'object') { amici.delete(peer); return; }
    const a = amici.get(peer) || {}; a.nick = String(nick || 'Amico').slice(0, 20); a.d = d; a.t = performance.now(); a.peer = peer; amici.set(peer, a);
    if (!UI.aperto) return;
    if (ON && ON.peer === peer) {
      if (ON.ruolo === 'h') {
        ON.azAmico = d.az;
        if (ON.attesa && d.rs && d.rs.n === ON.attesa.n) { const w = ON.attesa; ON.attesa = null; ON.rq = null; w.res(d.rs); }
        ciclaAzioni();
      } else {
        nuovaFoto(d);
        if (d.rq && num(d.rq.n, 0) > (ON.rqIn || 0)) rispondi(d.rq);
      }
      return;
    }
    if (ON || S) return;
    // nel menu: l'amico che ho sfidato ha accettato -> apro il tavolo
    if (sfida && d.acc && d.acc === sfida.n && d.st === 'menu' && String(d.id) === sfida.a) { avviaOnline(a); return; }
    // ho accettato e il tavolo dell'amico e' pronto -> entro
    if (accetto && d.st === 'gioco' && d.ru === 'h' && d.con === mioId) { ON = { ruolo: 'o', peer, id: String(d.id), nick: a.nick, az: [], azN: 0, rs: null, v: -1 }; accetto = 0; $('.menu').style.display = 'none'; chiudiZoom(); $('[data-o="pick"]').classList.remove('on'); nuovaFoto(d); return; }
    // mi sfidano
    if (d.sf && d.sf.a === mioId && d.sf.n !== chiesta && !accetto) {
      chiesta = d.sf.n; const n = d.sf.n;
      UI.chiedi(escA(a.nick) + ' ti sfida a Belinverse 2!', ['Accetta', 'No']).then(r => { if (r === 0 && !ON && !S) accetto = n; });
    }
  };
  function avviaOnline(a) {
    const d = a.d, okM = Array.isArray(d.md) && d.md.length === 40 && d.md.every(id => PER_ID[id] && PER_ID[id].t !== 'L');
    $('.menu').style.display = 'none'; $('.ed').style.display = 'none'; chiudiZoom(); selez = null; $('[data-o="pick"]').classList.remove('on');
    const m = mazzoValido(SAV.mazzo) ? SAV.mazzo : mazzoCasuale();
    ON = { ruolo: 'h', peer: a.peer, id: String(d.id), nick: a.nick, rqN: 0, rq: null, attesa: null, turno: null, azF: 0, azAmico: [], fv: 0, fk: '', fs: null, mo: null };
    sfida = null;
    nuovaPartita(m, leaderOk(SAV.leader) ? SAV.leader : '101', { nome: a.nick, mazzo: okM ? d.md : mazzoCasuale(), leader: PER_ID[d.ld] && PER_ID[d.ld].t === 'L' ? d.ld : '101' });
    S.online = true; S.nomeAvv = a.nick; S.g[1].remoto = true;
    UI.render(); UI.log('Partita con ' + a.nick + ': si mischia e si pesca…');
    setTimeout(() => partita(), 400);
  }
  // l'amico non c'e' piu': la partita finisce (vince chi resta)
  setInterval(() => {
    if (!UI.aperto) return;
    if (ON) {
      const a = amici.get(ON.peer), ok = a && fresco(a) && a.d.st === 'gioco' && a.d.con === mioId;
      ON.via = ok ? 0 : (ON.via || 0) + 1;
      if (ON.via >= 6 && S && !S.fine) {
        S.fine = { vince: 0, motivo: escA(ON.nick) + ' ha lasciato la partita' };
        if (ON.ruolo === 'h') { const e = new Fine(); if (ON.attesa) { ON.attesa.rej(e); ON.attesa = null; } else if (ON.turno) { ON.turno.rej(e); ON.turno = null; } else { fineDellaPartita(); if (fineTurnoUmano) fineTurnoUmano(); } }
        else { ON.fineVista = true; fineDellaPartita(); }
      }
      return;
    }
    if (S) return;
    const box = root && $('.amici-bv'); if (!box) return;
    const l = [...amici.values()].filter(a => fresco(a) && (a.d.st === 'menu' || a.d.st === 'solo' || a.d.st === 'gioco'));
    const k = JSON.stringify(l.map(a => [a.peer, a.nick, a.d.st, sfida && sfida.a === String(a.d.id)]));
    if (k === box._k) return; box._k = k;
    box.innerHTML = l.length ? '<h2>Amici al tavolo</h2>' : '';
    l.forEach(a => {
      const r = nodo('div', 'riga-b'), mia = sfida && sfida.a === String(a.d.id);
      r.appendChild(nodo('span', '', escA(a.nick) + (a.d.st === 'menu' ? '' : ' <small style="opacity:.7">(sta giocando)</small>')));
      if (a.d.st === 'menu') { const b = nodo('button', mia ? 'sec' : 'pri', mia ? 'In attesa… (annulla)' : 'Sfida'); b.addEventListener('click', () => { sfida = mia ? null : { a: String(a.d.id), n: 1 + Math.floor(Math.random() * 1e9) }; box._k = ''; }); r.appendChild(b); }
      box.appendChild(r);
    });
  }, 1000);

  /* ---------- apertura / chiusura ---------- */
  const BV = B.Belinverse = {
    get attivo() { return UI.aperto; },
    apri(pacchetti) {
      if (!avviato) { costruisci(); avviato = true; }
      if (window.UI && window.UI.paginaPiena && !window.UI.paginaPiena._bv) { const orig = window.UI.paginaPiena; window.UI.paginaPiena = () => UI.aperto || orig(); window.UI.paginaPiena._bv = true; }   // il mondo 3D si ferma mentre si gioca a carte
      UI.aperto = true; root.classList.add('on'); document.body.classList.add('bv-attivo');
      if (B.app && B.app.joy) B.app.joy.x = B.app.joy.y = 0;
      setTimeout(misura, 60); misura();
      if (pacchetti === true) negozio(false); else menu();
    },
    chiudi() {
      if (S && !S.fine) S.fine = { vince: 1, motivo: 'chiuso' };
      if (fineTurnoUmano) fineTurnoUmano();
      UI.aperto = false; if (root) root.classList.remove('on'); document.body.classList.remove('bv-attivo');
    },
    // venditore della sala TCG: apre direttamente la schermata dei pacchetti
    negozio() { BV.apri(true); },
    collezione: () => Object.assign({}, SAV.coll), gratisOggi, carteDiverse,
    // banco Belinverse TCG del mercatino: si vendono solo le copie che non servono al tuo mazzo e al Belinone scelto
    vendibili(id) { const nm = mazzoValido(SAV.mazzo) ? SAV.mazzo.filter(x => x === id).length : 0; return Math.max(0, possiedi(id) - nm - (SAV.leader === id && !LEADER_BASE.includes(id) ? 1 : 0)); },
    aggiungi(id, n) { if (!PER_ID[id] || PER_ID[id].t === 'T') return false; SAV.coll[id] = possiedi(id) + (n || 1); salva(); return true; },
    vendi(id, n) { n = Math.min(n || 1, BV.vendibili(id)); if (n <= 0) return 0; SAV.coll[id] = possiedi(id) - n; if (!SAV.coll[id]) delete SAV.coll[id]; salva(); return n; },
    get mazzo() { return mazzoValido(SAV.mazzo) ? SAV.mazzo.slice() : null; },
    get leader() { return leaderOk(SAV.leader) ? SAV.leader : '101'; },
    _sav: SAV,
    _s: () => S, _ia: IA, _velocita: v => { velocita = v; },
    rete: () => BV_rete(), amico: (peer, nick, d) => BV_amico(peer, nick, d), _on: () => ON
  };
})();
