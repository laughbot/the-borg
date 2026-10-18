/* =====================================================================
   THE BORG - OTTIMIZZA: unisce i pezzi FERMI di una stanza in poche mesh grandi (una per materiale e per zona).
   La piazza e' fatta di migliaia di pezzetti (ognuno col suo contorno): il telefono li disegnava uno per uno,
   due volte (anche per le ombre). Uniti, la piazza resta identica ma costa molto meno.
   Cosa resta fuori: tutto cio' che si muove o cambia (si scopre facendo girare le animazioni qualche volta),
   cio' che e' segnato userData.vivo, gli oggetti da toccare, le cose trasparenti, nascoste o speciali.
   ===================================================================== */
(function () {
  'use strict';
  const T = window.THREE, B = window.B3;
  const CELLA = 12;                       // le mesh unite sono divise in zone di 12 m: cosi' quelle fuori schermo non si disegnano
  const OUT = {};                         // materiali contorno condivisi (lo spessore viene messo dentro la geometria)
  function matContorno(c) {
    const k = c.getHex(); if (OUT[k]) return OUT[k];
    return (OUT[k] = new T.ShaderMaterial({
      uniforms: { t: { value: 0 }, c: { value: c.clone() } },
      vertexShader: 'uniform float t; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * t, 1.0); }',
      fragmentShader: 'uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }',
      side: T.BackSide
    }));
  }
  const tocca = T.Object3D.prototype.onBeforeRender;

  B.unisciStatici = function (root, o) {
    o = o || {};
    root.updateMatrixWorld(true);
    // 1) cosa si muove: fotografo posizione/rotazione/scala/visibilita', faccio girare le animazioni e confronto
    const foto = new Map();
    const scatta = ob => [ob.position.x, ob.position.y, ob.position.z, ob.quaternion.x, ob.quaternion.y, ob.quaternion.z, ob.quaternion.w, ob.scale.x, ob.scale.y, ob.scale.z, ob.visible ? 1 : 0, ob.parent ? ob.parent.id : -1];
    root.traverse(ob => foto.set(ob, scatta(ob)));
    [0.53, 2.31, 7.17, 15.9, 31.4].forEach(t => (o.anim || []).forEach(f => { try { f(t, 0.05); } catch (e) { /* alcune animazioni vogliono il gioco gia' avviato */ } }));
    const vivo = new Set(), segna = ob => ob.traverse(q => vivo.add(q));
    const nMesh = ob => { let n = 0; ob.traverse(q => { if (q.isMesh) n++; }); return n; };
    root.traverse(ob => {
      if (ob.userData.vivo) { segna(ob); return; }
      const a = foto.get(ob), b = scatta(ob);
      if (!a || a.some((v, i) => Math.abs(v - b[i]) > 1e-6)) {
        segna(ob);
        // il pezzo che si muove fa spesso parte di un oggetto piccolo (es. la testa di un piccione): lascio fuori tutto l'oggetto
        const p = ob.parent; if (p && p !== root && nMesh(p) <= 12) segna(p);
      }
    });
    root.updateMatrixWorld(true);

    // 2) a quale oggetto "che sbiadisce" appartiene ogni mesh (gli edifici davanti alla camera diventano trasparenti)
    const fid = new Map(), linee = new Set();
    (o.fade || []).forEach((it, i) => { if (it.g) it.g.traverse(q => { if (q.isMesh) fid.set(q, i); }); (it.lines || []).forEach(l => linee.add(l)); });
    const protetti = new Set(o.protetti || []);

    // 3) quali mesh si possono unire
    const ok = new Map();
    const inv = new T.Matrix4().copy(root.matrixWorld).invert();
    const perche = B.perche = {};
    const no = r => { perche[r] = (perche[r] || 0) + 1; return null; };
    function idoneo(m, visibile) {
      if (!m.isMesh) return null;
      if (m.isInstancedMesh || m.isSkinnedMesh) return no('inst'); if (!visibile) return no('nascosta'); if (vivo.has(m)) return no('vivo'); if (protetti.has(m)) return no('prot');
      if (!m.frustumCulled) return no('fc'); if (m.onBeforeRender !== tocca) return no('obr'); if (Object.keys(m.userData).length) return no('ud');
      const g = m.geometry, mt = m.material;
      if (!g || !g.isBufferGeometry || Array.isArray(mt) || !mt) return no('mat'); if (mt.transparent || mt.opacity < 1) return no('trasp');
      if (!g.attributes.position || !g.attributes.normal || Object.keys(g.morphAttributes).length) return no('geo');
      const f = fid.has(m) ? fid.get(m) : -1;
      let id, mat, sp = 0, linea = linee.has(m), attr;
      if (mt.isShaderMaterial) {
        if (!mt.uniforms || !mt.uniforms.t || !mt.uniforms.c || mt.side !== T.BackSide) return no('shader');
        sp = mt.uniforms.t.value; mat = matContorno(mt.uniforms.c.value); id = 'OUT' + mt.uniforms.c.value.getHex(); attr = 'pn';
      } else if (mt.isMeshBasicMaterial && mt.side === T.BackSide && !mt.map) {
        id = 'B' + mt.color.getHex(); mat = mt; attr = 'pn';     // contorno delle scatole: stesso colore = stesso materiale
      } else {
        if (mt.isShaderMaterial || mt.isRawShaderMaterial) return null;
        id = mt.uuid; mat = mt;
        attr = 'pn' + (g.attributes.uv ? 'u' : '') + (mt.vertexColors && g.attributes.color ? 'c' + g.attributes.color.itemSize : '');
        if (mt.map && !g.attributes.uv) return null;
      }
      const mm = new T.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      if (!g.boundingSphere) g.computeBoundingSphere();
      const c = g.boundingSphere.center.clone().applyMatrix4(mm);
      const k = [id, m.castShadow ? 1 : 0, m.receiveShadow ? 1 : 0, m.renderOrder, attr, f, linea ? 1 : 0, Math.floor(c.x / CELLA), Math.floor(c.z / CELLA)].join('|');
      return { m, mm, k, mat, sp, attr, f, linea };
    }
    (function giro(ob, vis) {
      ob.children.forEach(c => giro(c, vis && c.visible));
      if (ob === root) return;
      const d = idoneo(ob, vis);
      // una mesh si toglie solo se anche tutte le sue figlie si tolgono (di solito: il suo contorno)
      if (d && ob.children.every(c => ok.has(c))) ok.set(ob, d); else if (d) no('figli');
    })(root, root.visible);

    // 4) raggruppo e unisco
    const gruppi = {};
    ok.forEach(d => { (gruppi[d.k] = gruppi[d.k] || []).push(d); });
    const nuoveLinee = {}; let tolte = 0, nuove = 0;
    Object.keys(gruppi).forEach(k => {
      const lista = gruppi[k]; if (lista.length < 2) { lista.forEach(d => ok.delete(d.m)); return; }
      const a0 = lista[0].attr, nomi = ['position', 'normal'].concat(a0.indexOf('u') >= 0 ? ['uv'] : []).concat(a0.indexOf('c') >= 0 ? ['color'] : []);
      const tuttiIdx = lista.every(d => d.m.geometry.index);
      const parti = lista.map(d => {
        const src = d.m.geometry, ge = new T.BufferGeometry();
        nomi.forEach(n => ge.setAttribute(n, src.attributes[n].clone()));
        if (src.index) ge.setIndex(src.index.clone());
        if (d.sp) { const p = ge.attributes.position, nn = ge.attributes.normal; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + nn.getX(i) * d.sp, p.getY(i) + nn.getY(i) * d.sp, p.getZ(i) + nn.getZ(i) * d.sp); }
        ge.applyMatrix4(d.mm);
        const out = tuttiIdx ? ge : (ge.index ? ge.toNonIndexed() : ge);
        if (d.mm.determinant() < 0) {   // specchiata: giro i triangoli, se no si vedrebbe l'interno
          if (out.index) { const ix = out.index.array; for (let i = 0; i + 2 < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
          else nomi.forEach(n => { const at = out.attributes[n], s = at.itemSize, ar = at.array; for (let i = 0; i + 2 < at.count; i += 3) for (let c = 0; c < s; c++) { const t = ar[(i + 1) * s + c]; ar[(i + 1) * s + c] = ar[(i + 2) * s + c]; ar[(i + 2) * s + c] = t; } });
        }
        return out;
      });
      let nv = 0, ni = 0; parti.forEach(p => { nv += p.attributes.position.count; if (tuttiIdx) ni += p.index.count; });
      const ge = new T.BufferGeometry();
      nomi.forEach(n => {
        const s = parti[0].attributes[n].itemSize, ar = new Float32Array(nv * s); let off = 0;
        parti.forEach(p => {
          const at = p.attributes[n];
          if (at.array instanceof Float32Array && !at.isInterleavedBufferAttribute && at.itemSize === s) ar.set(at.array.subarray(0, at.count * s), off * s);
          else for (let i = 0; i < at.count; i++) { const v = [at.getX(i), at.getY(i), at.getZ(i), at.getW(i)]; for (let c = 0; c < s; c++) ar[(off + i) * s + c] = v[c] || 0; }
          off += at.count;
        });
        ge.setAttribute(n, new T.BufferAttribute(ar, s));
      });
      if (tuttiIdx) {
        const ix = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni); let o2 = 0, base = 0;
        parti.forEach(p => { const a = p.index.array; for (let i = 0; i < a.length; i++) ix[o2 + i] = a[i] + base; o2 += a.length; base += p.attributes.position.count; });
        ge.setIndex(new T.BufferAttribute(ix, 1));
      }
      ge.computeBoundingSphere(); ge.computeBoundingBox();
      const d0 = lista[0], m = new T.Mesh(ge, d0.mat);
      m.castShadow = d0.m.castShadow; m.receiveShadow = d0.m.receiveShadow; m.renderOrder = d0.m.renderOrder;
      m.matrixAutoUpdate = false; m.matrixWorldNeedsUpdate = true; m.userData.unita = lista.length;
      root.add(m); nuove++;
      if (d0.linea && d0.f >= 0) (nuoveLinee[d0.f] = nuoveLinee[d0.f] || []).push(m);
    });
    ok.forEach(d => { if (d.m.parent) d.m.parent.remove(d.m); tolte++; });
    (o.fade || []).forEach((it, i) => { if (!it.lines) return; it.lines = it.lines.filter(l => !ok.has(l)).concat(nuoveLinee[i] || []); });
    return { tolte, nuove };
  };
})();
