/* =====================================================================
   THE BORG - MODELLI GLB: carica i modelli 3D esterni (cartella modelli/) e li mette nel mondo.
   - Ogni file .glb si scarica UNA volta sola, quando serve, e resta in memoria.
   - Lo stesso modello ripetuto tante volte (casse, botti, alberi...) diventa una sola InstancedMesh:
     il telefono lo disegna in un colpo solo.
   - I materiali vengono trasformati nello stesso stile "cartone animato" del resto del borgo (toon + contorno).
   - Se il file non arriva (niente rete, file mancante) si usa il "ripiego" disegnato da codice:
     il gioco funziona sempre uguale. Collisioni, porte e sedili NON dipendono mai dai modelli esterni.
   ===================================================================== */
(function () {
  'use strict';
  const T = window.THREE, B = window.B3;
  const BASE = 'modelli/';
  const file = {};                 // nome file -> Promise della scena caricata
  const stato = {};                // nome file -> 'attesa' | 'ok' | 'errore'
  const matToon = new Map();       // materiale originale -> materiale toon
  const COLORE_LINEA = 0x2a1a2e;
  let loader = null;

  function carica(nome) {
    if (file[nome]) return file[nome];
    if (!T.GLTFLoader) { stato[nome] = 'errore'; return (file[nome] = Promise.reject(new Error('GLTFLoader mancante'))); }
    loader = loader || new T.GLTFLoader();
    stato[nome] = 'attesa';
    file[nome] = new Promise((ok, ko) => loader.load(BASE + nome, g => { stato[nome] = 'ok'; ok(g.scene); }, undefined, e => { stato[nome] = 'errore'; console.warn('Modello non caricato: ' + nome, e && e.message); ko(e); }));
    return file[nome];
  }

  // materiale del modello -> materiale toon del borgo (stessa texture, stessi 4 toni di luce)
  function toon(m) {
    if (matToon.has(m)) return matToon.get(m);
    const gm = B.M('#fff').gradientMap;
    if (m.map) { m.map.encoding = T.LinearEncoding; m.map.anisotropy = 4; m.map.needsUpdate = true; }   // come le texture disegnate dal gioco
    const n = new T.MeshToonMaterial({ color: m.color ? m.color.clone() : new T.Color(0xffffff), map: m.map || null, gradientMap: gm, transparent: !!m.transparent, opacity: m.opacity, alphaTest: m.alphaTest || 0, side: m.side, vertexColors: !!m.vertexColors });
    if (m.emissive && m.emissive.getHex()) { n.emissive = m.emissive.clone(); n.emissiveIntensity = m.emissiveIntensity; }
    matToon.set(m, n); return n;
  }

  // contorno scuro che funziona anche con le istanze
  const matLinee = {};
  function matLinea(sp) {
    const k = sp.toFixed(4); if (matLinee[k]) return matLinee[k];
    return (matLinee[k] = new T.ShaderMaterial({
      uniforms: { t: { value: sp }, c: { value: new T.Color(COLORE_LINEA) } },
      vertexShader: 'uniform float t; void main(){ vec4 p = vec4(position + normal * t, 1.0);\n#ifdef USE_INSTANCING\n p = instanceMatrix * p;\n#endif\n gl_Position = projectionMatrix * modelViewMatrix * p; }',
      fragmentShader: 'uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }',
      side: T.BackSide
    }));
  }

  // tutte le mesh di un nodo, con la loro posizione rispetto al nodo
  function pezzi(radice) {
    radice.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(radice.matrixWorld).invert(), lista = [];
    radice.traverse(o => { if (o.isMesh) lista.push({ geo: o.geometry, mat: o.material, rel: new T.Matrix4().multiplyMatrices(inv, o.matrixWorld) }); });
    return lista;
  }

  /* Mette tante copie dello stesso modello.
     file: nome del .glb in modelli/   nodo: nome del modello dentro il file
     posti: [{ x, y, z, rot, s }]       genitore: gruppo dove aggiungerle
     o: { scala, linea (spessore contorno, 0 = niente), ombre, riserva: function(posti, genitore) } */
  function sparpaglia(nomeFile, nodo, posti, genitore, o) {
    o = o || {};
    const sc = o.scala || 1, g = new T.Group(); g.name = 'glb:' + nodo; g.userData.vivo = true; genitore.add(g);
    const fatto = carica(nomeFile).then(scena => {
      const radice = scena.getObjectByName(nodo);
      if (!radice) throw new Error('nel file ' + nomeFile + ' manca il modello ' + nodo);
      const m = new T.Matrix4(), q = new T.Quaternion(), asseY = new T.Vector3(0, 1, 0), v = new T.Vector3(), s = new T.Vector3();
      pezzi(radice).forEach(p => {
        const mat = Array.isArray(p.mat) ? p.mat.map(toon) : toon(p.mat);
        const im = new T.InstancedMesh(p.geo, mat, posti.length);
        im.castShadow = o.ombre !== false; im.receiveShadow = true; im.frustumCulled = false;
        posti.forEach((q0, i) => {
          q.setFromAxisAngle(asseY, q0.rot || 0); v.set(q0.x, q0.y || 0, q0.z); const k = sc * (q0.s || 1); s.set(k, k, k);
          m.compose(v, q, s).multiply(p.rel); im.setMatrixAt(i, m);
        });
        im.instanceMatrix.needsUpdate = true; g.add(im);
        if (o.linea !== 0) {
          const li = new T.InstancedMesh(p.geo, matLinea((o.linea || 0.02) / sc), posti.length);
          li.instanceMatrix = im.instanceMatrix; li.frustumCulled = false; li.castShadow = false; li.receiveShadow = false; g.add(li);
        }
      });
      return g;
    }).catch(e => {
      if (o.riserva) { try { o.riserva(posti, g); } catch (e2) { console.warn(e2); } }
      return g;
    });
    g.userData.pronto = fatto;
    return g;
  }

  B.Modelli = { carica, sparpaglia, stato, base: BASE };
})();
