// Prove delle voci delle Gemelle (src/minigiochi/cripta/voci.js) e della musica del borgo (src/borgo/suoni.js),
// con una finta sintesi vocale e un finto audio.
//   node test/voci.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// finto audio: ogni nodo accetta tutto
const param = () => ({ value: 0, setValueAtTime() { }, linearRampToValueAtTime() { }, exponentialRampToValueAtTime() { }, setTargetAtTime() { }, cancelScheduledValues() { } });
let nodi = 0;
const nodo = () => { nodi++; return { gain: param(), frequency: param(), detune: param(), Q: param(), delayTime: param(), pan: param(), type: '', buffer: null, loop: false, connect() { }, start() { }, stop() { } }; };
class FintoAudio {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = nodo(); }
  createGain() { return nodo(); } createOscillator() { return nodo(); } createBiquadFilter() { return nodo(); } createDelay() { return nodo(); }
  createBufferSource() { return nodo(); } createStereoPanner() { return nodo(); }
  createBuffer(c, l) { const d = new Float32Array(l); return { getChannelData: () => d }; }
  resume() { }
}
const memoria = {};
const localStorage = { getItem: k => (k in memoria ? memoria[k] : null), setItem: (k, v) => { memoria[k] = String(v); } };

/* ---------- voci delle Gemelle ---------- */
const dette = [];
class Frase { constructor(t) { this.text = t; } }
const sintesi = { speak: u => dette.push(u), cancel() { }, getVoices: () => [{ name: 'Alice', lang: 'it-IT' }, { name: 'Federica', lang: 'it-IT' }, { name: 'Daniel', lang: 'en-GB' }], addEventListener() { } };
let effettiMuti = false;
const win = { B3: { Audio: { effettiMuti: () => effettiMuti } }, speechSynthesis: sintesi, SpeechSynthesisUtterance: Frase, AudioContext: FintoAudio };
vm.runInNewContext(readFileSync(new URL('../src/minigiochi/cripta/voci.js', import.meta.url), 'utf8'), { window: win, localStorage, Math, setTimeout: () => 0, clearTimeout() { } });
const V = win.B3.CriptaVoci;
ok(V, 'B3.CriptaVoci esiste');

// ogni sala ha un titolo e almeno una frase, tutte in italiano e con la voce italiana
for (let i = 0; i < 14; i++) {
  dette.length = 0; V.zitte(); V.sala(i);
  ok(dette.length >= 2, 'sala ' + (i + 1) + ': titolo e frase');
  ok(dette.every(u => u.lang === 'it-IT' && u.text.trim().length > 2), 'sala ' + (i + 1) + ': frasi in italiano');
  ok(dette.every(u => u.voice && /^it/.test(u.voice.lang)), 'sala ' + (i + 1) + ': voce italiana');
  ok(dette.every(u => u.pitch < 1), 'sala ' + (i + 1) + ': voce piu\' bassa del normale');
}
// le due sorelle hanno voci diverse
dette.length = 0; V.zitte(); V.sala(0);
ok(dette[0].voice.name !== dette[1].voice.name && dette[0].pitch !== dette[1].pitch, 'Velna e Sorna si distinguono');
// il percorso del Ponte ha le sue frasi
dette.length = 0; V.zitte(); V.sala(6, 'ponte'); ok(/Ponte/.test(dette[0].text), 'il Ponte delle Catene');
// riprovando la stessa sala dicono una frase di ritorno
dette.length = 0; V.zitte(); V.sala(2); const prima = dette.map(u => u.text); dette.length = 0; V.sala(2);
ok(V._frasi.RITORNO.includes(dette[dette.length - 1].text), 'riprovando: frase di ritorno');
ok(prima[0] === dette[0].text, 'riprovando: stesso titolo');
// squadra annientata
dette.length = 0; V.wipe(); ok(dette.length === 1 && V._frasi.WIPE.includes(dette[0].text), 'frase quando la squadra cade');
// con gli effetti spenti o le voci spente, silenzio
effettiMuti = true; dette.length = 0; V.sala(5); ok(dette.length === 0, 'effetti spenti: niente voci'); effettiMuti = false;
ok(V.cambia() === false && memoria['theborg.cripta.voci'] === '0', 'tasto Voci: spento e ricordato');
dette.length = 0; V.zitte(); V.sala(5); ok(dette.length === 0, 'voci spente: silenzio');
V.cambia(); dette.length = 0; V.zitte(); V.sala(5); ok(dette.length === 2, 'voci riaccese');

/* ---------- musica del borgo: gira senza errori in piazza, in casa e con il jukebox ---------- */
let pianifica = null; const ascolta = {};
const win2 = { B3: {}, AudioContext: FintoAudio, addEventListener: (e, f) => { ascolta[e] = f; } };
vm.runInNewContext(readFileSync(new URL('../src/borgo/suoni.js', import.meta.url), 'utf8'),
  { window: win2, localStorage, Math, document: { getElementById: () => null }, setInterval: f => { pianifica = f; } });
const A = win2.B3.Audio; const ctxA = A.sblocca(); ok(ctxA && pianifica, 'audio del borgo pronto');
for (const [scena, disco] of [['piazza', 0], ['altro', 0], ['altro', 1], ['altro', 2], ['piazza', 0]]) {
  A.scena(scena); A.jukebox(disco); const prima = nodi;
  for (let k = 0; k < 1200; k++) { ctxA.currentTime += 0.1; pianifica(); }     // due minuti di musica
  ok(nodi > prima, 'musica in ' + scena + (disco ? ' (disco ' + disco + ')' : ''));
}

console.log('ok  voci delle Gemelle e musica del borgo: ' + n + ' controlli');
