/* =====================================================================
   THE BORG: MODULO DEL SERVER NAKAMA
   Le "stanze amici": chi entra con lo stesso codice (?amici=CODICE) finisce
   nella stessa partita autoritativa. Il server tiene la presenza di ognuno
   (posizione, look, chat, emote, stato dei minigiochi: lo stesso oggetto che
   prima girava su PeerJS) e la manda agli altri della stanza.
   Al posto del "padrone di casa" PeerJS: la stanza vive sul server e non cade
   quando il primo telefono esce.

   Protocollo (dati JSON, op code):
     client -> server  1  presenza completa del giocatore (oggetto, max 8 KB)
     server -> client  1  { l: [[id, presenza], ...] }  presenze cambiate in questo tick
     server -> client  2  { io: id, l: [[id, presenza], ...] }  tutti, appena entri
     server -> client  3  { id }  un giocatore e' uscito
   L'id di un giocatore e' il suo user id Nakama.

   Runtime JavaScript di Nakama: le funzioni del match devono stare al livello
   piu' alto del file (niente arrow function o closure registrate).
   ===================================================================== */

var OP_PRESENZA = 1, OP_TUTTI = 2, OP_VIA = 3;
var TICK = 15;                 // aggiornamenti al secondo verso i telefoni
var MAX_GIOCATORI = 40;        // per stanza
var MAX_BYTE = 8192;           // presenza massima di un giocatore
var MAX_MSG_SECONDO = 40;      // oltre, i messaggi di quel giocatore si scartano
var VUOTA_SECONDI = 60;        // una stanza vuota si chiude dopo un minuto
var SISTEMA = '00000000-0000-0000-0000-000000000000';
var COLLEZIONE = 'stanze';

function codicePulito(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
}

/* ---------- RPC stanza_entra: { codice } -> { match_id } ----------
   Una sola partita per codice: il puntatore codice -> match sta nello storage
   e si scrive con controllo di versione, cosi' due telefoni che entrano nello
   stesso istante non creano due stanze diverse. */
function rpcStanzaEntra(ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('serve una sessione');
  var dati = {};
  try { dati = JSON.parse(payload || '{}'); } catch (e) { throw Error('payload non valido'); }
  var codice = codicePulito(dati.codice);
  if (!codice) throw Error('codice mancante');

  for (var giro = 0; giro < 3; giro++) {
    var letti = nk.storageRead([{ collection: COLLEZIONE, key: codice, userId: SISTEMA }]);
    var vecchio = letti.length ? letti[0] : null;
    if (vecchio && vecchio.value && vecchio.value.match_id && nk.matchGet(vecchio.value.match_id)) {
      return JSON.stringify({ match_id: vecchio.value.match_id });
    }
    var id = nk.matchCreate('stanza', { codice: codice });
    try {
      nk.storageWrite([{ collection: COLLEZIONE, key: codice, userId: SISTEMA, value: { match_id: id },
        version: vecchio ? vecchio.version : '*', permissionRead: 0, permissionWrite: 0 }]);
      return JSON.stringify({ match_id: id });
    } catch (e) {
      // qualcuno l'ha creata un attimo prima: si rilegge e si usa la sua (la nostra, vuota, si chiude da sola)
      logger.debug('stanza %s: creata in contemporanea, riprovo', codice);
    }
  }
  throw Error('stanza non disponibile, riprova');
}

/* ---------- la partita "stanza" ---------- */
function matchInit(ctx, logger, nk, params) {
  var codice = codicePulito(params && params.codice);
  return { state: { codice: codice, g: {}, vuota: 0 }, tickRate: TICK, label: JSON.stringify({ stanza: codice, n: 0 }) };
}

function contaGiocatori(state) { var n = 0; for (var k in state.g) n++; return n; }

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  var gia = state.g[presence.userId];
  if (!gia && contaGiocatori(state) >= MAX_GIOCATORI) return { state: state, accept: false, rejectMessage: 'stanza piena' };
  return { state: state, accept: true };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var pr = presences[i], gia = state.g[pr.userId];
    // stesso account da un'altra scheda o dopo una riconnessione: vale l'ultima
    if (gia && gia.presence.sessionId !== pr.sessionId) dispatcher.matchKick([gia.presence]);
    state.g[pr.userId] = { presence: pr, p: gia ? gia.p : null, cambiata: false, msg: 0 };
    var l = [];
    for (var k in state.g) if (k !== pr.userId && state.g[k].p) l.push([k, state.g[k].p]);
    dispatcher.broadcastMessage(OP_TUTTI, JSON.stringify({ io: pr.userId, l: l }), [pr], null, true);
  }
  state.vuota = 0;
  dispatcher.matchLabelUpdate(JSON.stringify({ stanza: state.codice, n: contaGiocatori(state) }));
  return { state: state };
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var pr = presences[i], g = state.g[pr.userId];
    if (!g || g.presence.sessionId !== pr.sessionId) continue;   // e' uscita la vecchia sessione, non quella attuale
    delete state.g[pr.userId];
    dispatcher.broadcastMessage(OP_VIA, JSON.stringify({ id: pr.userId }), null, null, true);
  }
  dispatcher.matchLabelUpdate(JSON.stringify({ stanza: state.codice, n: contaGiocatori(state) }));
  return { state: state };
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  if (tick % TICK === 0) for (var k in state.g) state.g[k].msg = 0;   // contatore anti-spam per secondo

  for (var i = 0; i < messages.length; i++) {
    var m = messages[i], g = state.g[m.sender.userId];
    if (!g || g.presence.sessionId !== m.sender.sessionId || m.opCode !== OP_PRESENZA) continue;
    if (++g.msg > MAX_MSG_SECONDO || !m.data || m.data.byteLength > MAX_BYTE) continue;
    var p = null;
    try { p = JSON.parse(nk.binaryToString(m.data)); } catch (e) { continue; }
    if (!p || typeof p !== 'object' || Array.isArray(p)) continue;
    g.p = p; g.cambiata = true;
  }

  // una sola spedizione per tick con tutte le presenze cambiate
  var l = [];
  for (var id in state.g) { var x = state.g[id]; if (x.cambiata) { x.cambiata = false; l.push([id, x.p]); } }
  if (l.length) dispatcher.broadcastMessage(OP_PRESENZA, JSON.stringify({ l: l }), null, null, true);

  if (contaGiocatori(state) === 0) { if (++state.vuota > VUOTA_SECONDI * TICK) return null; }
  else state.vuota = 0;
  return { state: state };
}

function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) { return { state: state }; }
function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) { return { state: state, data: '' }; }

function InitModule(ctx, logger, nk, initializer) {
  initializer.registerRpc('stanza_entra', rpcStanzaEntra);
  initializer.registerMatch('stanza', {
    matchInit: matchInit, matchJoinAttempt: matchJoinAttempt, matchJoin: matchJoin, matchLeave: matchLeave,
    matchLoop: matchLoop, matchTerminate: matchTerminate, matchSignal: matchSignal
  });
  logger.info('The Borg: modulo caricato (stanze amici)');
}
