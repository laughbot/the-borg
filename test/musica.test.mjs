// Prove della musica del borgo (src/borgo/suoni.js) con un finto audio.
//   node test/musica.test.mjs
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

console.log('ok  musica del borgo: ' + n + ' controlli');
