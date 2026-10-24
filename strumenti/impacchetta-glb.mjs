// Unisce piu' modelli glTF (.gltf + .bin + immagini) in UN solo file .glb.
// Ogni modello diventa un nodo con il nome del suo file: il gioco li prende per nome
// (B3.Modelli, in src/borgo/modelli-glb.js). Le immagini uguali (stesso file) vengono messe una volta sola,
// cosi' il telefono scarica un file solo e una texture sola.
//
//   node strumenti/impacchetta-glb.mjs uscita.glb modello1.gltf modello2.gltf ...
//
// Niente librerie esterne: basta Node.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const allinea4 = n => (n + 3) & ~3;

export function impacchetta(files) {
  const out = { asset: { version: '2.0', generator: 'The Borg impacchetta-glb' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], textures: [], images: [], samplers: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }] };
  const pezzi = []; let len = 0;
  const aggiungiDati = buf => {
    const off = len; pezzi.push(buf); len += buf.length;
    const pad = allinea4(len) - len; if (pad) { pezzi.push(Buffer.alloc(pad)); len += pad; }
    return off;
  };
  const immagini = new Map();   // percorso del file -> indice immagine
  for (const f of files) {
    const g = JSON.parse(readFileSync(f, 'utf8')), dir = dirname(f), nome = basename(f).replace(/\.gltf$/i, '');
    if ((g.extensionsRequired || []).length) throw new Error(`${f}: estensioni richieste non gestite (${g.extensionsRequired})`);
    const buf = (g.buffers || []).map(b => {
      if (!b.uri) throw new Error(`${f}: buffer senza file`);
      if (b.uri.startsWith('data:')) return Buffer.from(b.uri.split(',')[1], 'base64');
      return readFileSync(join(dir, decodeURIComponent(b.uri)));
    });
    // bufferViews: ricopio i dati nel buffer unico
    const bvMap = (g.bufferViews || []).map(v => {
      const dati = buf[v.buffer].subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
      const nv = Object.assign({}, v, { buffer: 0, byteOffset: aggiungiDati(Buffer.from(dati)) });
      out.bufferViews.push(nv); return out.bufferViews.length - 1;
    });
    const accMap = (g.accessors || []).map(a => {
      const na = Object.assign({}, a);
      if (a.bufferView !== undefined) na.bufferView = bvMap[a.bufferView];
      if (a.sparse) throw new Error(`${f}: accessor sparse non gestito`);
      out.accessors.push(na); return out.accessors.length - 1;
    });
    const smpMap = (g.samplers || []).map(s => { out.samplers.push(s); return out.samplers.length - 1; });
    const imgMap = (g.images || []).map(im => {
      if (im.uri && !im.uri.startsWith('data:')) {
        const p = resolve(dir, decodeURIComponent(im.uri)), nomeFile = basename(p);
        // stesso nome di file = stessa immagine (i pacchetti ripetono la stessa texture in ogni cartella)
        if (immagini.has(nomeFile)) return immagini.get(nomeFile);
        const dati = readFileSync(p), mime = im.mimeType || (/\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg');
        out.bufferViews.push({ buffer: 0, byteOffset: aggiungiDati(dati), byteLength: dati.length });
        out.images.push({ name: im.name || nomeFile, mimeType: mime, bufferView: out.bufferViews.length - 1 });
        immagini.set(nomeFile, out.images.length - 1); return out.images.length - 1;
      }
      const ni = Object.assign({}, im); if (ni.bufferView !== undefined) ni.bufferView = bvMap[ni.bufferView];
      out.images.push(ni); return out.images.length - 1;
    });
    const texMap = (g.textures || []).map(t => {
      const nt = Object.assign({}, t); if (t.source !== undefined) nt.source = imgMap[t.source]; if (t.sampler !== undefined) nt.sampler = smpMap[t.sampler];
      const k = JSON.stringify(nt), gia = out.textures.findIndex(x => JSON.stringify(x) === k);
      if (gia >= 0) return gia; out.textures.push(nt); return out.textures.length - 1;
    });
    const rimappaTex = o => { if (!o || typeof o !== 'object') return o; const c = Array.isArray(o) ? [] : {}; for (const k in o) c[k] = (k === 'index' && typeof o[k] === 'number') ? texMap[o[k]] : rimappaTex(o[k]); return c; };
    const matMap = (g.materials || []).map(m => {
      const nm = rimappaTex(m), k = JSON.stringify(nm), gia = out.materials.findIndex(x => JSON.stringify(x) === k);
      if (gia >= 0) return gia; out.materials.push(nm); return out.materials.length - 1;
    });
    const meshMap = (g.meshes || []).map(m => {
      const nm = Object.assign({}, m, { primitives: m.primitives.map(p => {
        const np = Object.assign({}, p, { attributes: {} });
        for (const k in p.attributes) np.attributes[k] = accMap[p.attributes[k]];
        if (p.indices !== undefined) np.indices = accMap[p.indices];
        if (p.material !== undefined) np.material = matMap[p.material];
        if (p.targets) np.targets = p.targets.map(t => { const o = {}; for (const k in t) o[k] = accMap[t[k]]; return o; });
        return np;
      }) });
      out.meshes.push(nm); return out.meshes.length - 1;
    });
    if ((g.skins || []).length || (g.animations || []).length) throw new Error(`${f}: modelli animati non gestiti da questo strumento`);
    const base = out.nodes.length;
    (g.nodes || []).forEach(n => {
      const nn = Object.assign({}, n);
      if (n.mesh !== undefined) nn.mesh = meshMap[n.mesh];
      if (n.children) nn.children = n.children.map(c => c + base);
      delete nn.camera; out.nodes.push(nn);
    });
    // un nodo "radice" con il nome del file, che contiene le radici della scena del modello
    const sc = (g.scenes || [])[g.scene || 0] || { nodes: [] };
    out.nodes.push({ name: nome, children: sc.nodes.map(i => i + base) });
    out.scenes[0].nodes.push(out.nodes.length - 1);
  }
  for (const k of ['textures', 'images', 'samplers', 'materials']) if (!out[k].length) delete out[k];
  const bin = Buffer.concat(pezzi); out.buffers[0].byteLength = bin.length;
  let json = Buffer.from(JSON.stringify(out));
  json = Buffer.concat([json, Buffer.alloc(allinea4(json.length) - json.length, 0x20)]);
  const tot = 12 + 8 + json.length + 8 + bin.length, h = Buffer.alloc(12);
  h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(tot, 8);
  const cj = Buffer.alloc(8); cj.writeUInt32LE(json.length, 0); cj.writeUInt32LE(0x4e4f534a, 4);
  const cb = Buffer.alloc(8); cb.writeUInt32LE(bin.length, 0); cb.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([h, cj, json, cb, bin]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dest, ...files] = process.argv.slice(2);
  if (!dest || !files.length) { console.error('uso: node strumenti/impacchetta-glb.mjs uscita.glb modello1.gltf ...'); process.exit(1); }
  const glb = impacchetta(files);
  writeFileSync(dest, glb);
  console.log(`${dest}: ${files.length} modelli, ${(glb.length / 1024).toFixed(0)} KB`);
}
