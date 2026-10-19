import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Module from '../vendor/manifold.js';
import { makeDeckbox, masse, MIN_KARTENRAUM } from './deckbox.js';
import { make3mf } from './export3mf.js';
import { SPRACHEN, T } from './i18n.js';

// Card formats: common name, card size without sleeve (B × L) and the inner size for sleeved
// cards, taken from printed boxes / user measurements (Inserts/Standard-Kartenbox, 2026-10-19).
const FORMATE = [
  { id: '63.5x88', name: 'Standard', karte: [63.5, 88], sleeve: [68, 93] },
  { id: '59x92', name: 'Euro', karte: [59, 92], sleeve: [63.5, 97.3] },
  { id: '57.5x89', name: 'Chimera', karte: [57.5, 89], sleeve: [62, 93] },
  { id: '56x87', name: 'American', karte: [56, 87], sleeve: [60.5, 91] },
  { id: '65x100', name: '7 Wonders', karte: [65, 100], sleeve: [69.5, 104] },
  { id: '80x120', name: 'Dixit', karte: [80, 120], sleeve: [84, 124] },
  { id: '44x68', name: 'Mini Euro', karte: [44, 68], sleeve: [49, 72.5] },
  { id: '41x63', name: 'Mini American', karte: [41, 63], sleeve: [45, 66.5] },
  { id: 'custom', name: null, karte: null, sleeve: null },
];
const ZUGABE_SLEEVE = [4.5, 5.0];   // custom format with sleeves: card + this (average of the formats above)
const ZUGABE_OHNE = 1.0;            // without sleeves: card + 1 mm (0.5 per side)
const LUFT = 1.5;                   // air above the stack
const DICKE = { true: 0.8, false: 0.3 };
const PLA = 1.24;                   // g/cm³
const BAURAUM = 250;

const $ = id => document.getElementById(id);
const state = { fmt: '63.5x88', sleeves: true, edited: { innerB: false, innerL: false, innerH: false } };
let db = null, wasm = null, ergebnis = null, veraltet = true;

// ---------- language ----------
function startSprache() {
  try { const s = localStorage.getItem('deckbox-lang'); if (s && T[s]) return s; } catch (e) { /* no storage */ }
  const n = (navigator.language || 'de').slice(0, 2);
  return T[n] ? n : 'en';
}
let lang = startSprache();
const t = key => T[lang][key] ?? T.de[key];

const nf = (v, d = 1) => v.toLocaleString(SPRACHEN[lang].locale, { minimumFractionDigits: 0, maximumFractionDigits: d });
const num = id => parseFloat(String($(id).value).replace(',', '.'));
const runde = v => Math.round(v * 10) / 10;

// ---------- format buttons ----------
function renderFormate() {
  const box = $('formats');
  box.replaceChildren();
  const k = 42 / 120;   // icon scale: largest card (120 mm) = 42 px
  for (const f of FORMATE) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fmt'; b.dataset.id = f.id;
    const [w, l] = f.karte || [55, 80];
    b.innerHTML = `<span class="nm">${f.name ?? t('customName')}</span>` +
      `<span class="card${f.karte ? '' : ' custom'}" style="width:${w * k}px;height:${l * k}px"></span>` +
      `<span class="lbl">${f.karte ? `${nf(w)} × ${nf(l)}` : '… × …'}</span>`;
    b.addEventListener('click', () => { state.fmt = f.id; resetMasse(['innerB', 'innerL']); });
    box.append(b);
  }
}

function setzeSprache(neu) {
  lang = neu;
  try { localStorage.setItem('deckbox-lang', lang); } catch (e) { /* no storage */ }
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  $('lang').value = lang;
  renderFormate();
  aktualisiere(false);
  if (ergebnis) { ergebnis.info = infoText(ergebnis); setVeraltet(veraltet); }
  if (!db) $('status').textContent = t('loading');
}
function karte() {
  const f = FORMATE.find(x => x.id === state.fmt);
  return f.karte ? f.karte : [num('cardB'), num('cardL')];
}
function vorschlag() {
  const f = FORMATE.find(x => x.id === state.fmt);
  const [kb, kl] = karte();
  let b, l;
  if (state.sleeves) [b, l] = f.sleeve ? f.sleeve : [kb + ZUGABE_SLEEVE[0], kl + ZUGABE_SLEEVE[1]];
  else [b, l] = [kb + ZUGABE_OHNE, kl + ZUGABE_OHNE];
  return { innerB: runde(b), innerL: runde(l), innerH: runde(num('deck') + LUFT) };
}

function resetMasse(felder) {
  const v = vorschlag();
  for (const id of felder) { $(id).value = v[id]; state.edited[id] = false; }
  aktualisiere();
}

function aktualisiere(geaendert = true) {
  for (const b of document.querySelectorAll('.fmt')) b.setAttribute('aria-pressed', String(b.dataset.id === state.fmt));
  $('customCard').hidden = state.fmt !== 'custom';
  $('sleeveOn').setAttribute('aria-pressed', String(state.sleeves));
  $('sleeveOff').setAttribute('aria-pressed', String(!state.sleeves));
  $('countHint').textContent = t('countHint')(nf(DICKE[state.sleeves]), state.sleeves);
  const v = vorschlag();
  let abw = false;
  for (const id of ['innerB', 'innerL', 'innerH']) {
    state.edited[id] = Math.abs(num(id) - v[id]) > 1e-6;
    $(id).classList.toggle('edited', state.edited[id]);
    abw ||= state.edited[id];
  }
  $('resetInner').hidden = !abw;
  zeigeMasse();
  setVeraltet(geaendert || veraltet);
}

function pruefe() {
  const b = num('innerB'), l = num('innerL'), h = num('innerH');
  if (![b, l, h].every(Number.isFinite)) return { fehler: t('errNum') };
  if (b < 22) return { fehler: t('errB')(22) };
  if (l < 45) return { fehler: t('errL')(45) };
  if (b > l) return { fehler: t('errSwap') };
  if (h < MIN_KARTENRAUM) return { fehler: t('errH')(MIN_KARTENRAUM) };
  const m = masse(b, l, h);
  if (m.L > BAURAUM || m.H_GESAMT > BAURAUM) return { fehler: t('errSize')(BAURAUM) };
  return { m };
}

function zeigeMasse() {
  const { m, fehler } = pruefe();
  $('msg').className = 'msg' + (fehler ? ' error' : '');
  if (fehler) { $('msg').textContent = fehler; $('sOuter').textContent = $('sHeight').textContent = '–'; return; }
  $('sOuter').textContent = `${nf(m.L, 2)} × ${nf(m.B, 2)}`;
  $('sHeight').textContent = `${nf(m.H_GESAMT, 1)} mm`;
  const hinweis = [];
  if (m.K_H < 5) hinweis.push(t('lowRim'));
  const n = Math.floor((m.KARTENRAUM - LUFT) / DICKE[state.sleeves]);
  hinweis.push(t('capacity')(n, state.sleeves));
  $('msg').textContent = hinweis.join(' ');
  $('msg').className = 'msg' + (m.K_H < 5 ? ' warn' : '');
}

function setVeraltet(v) {
  veraltet = v;
  const ok = !pruefe().fehler && !!db;
  $('build').disabled = !ok;
  for (const id of ['dlBoth', 'dlBox', 'dlLid']) $(id).disabled = veraltet || !ergebnis;
  if (db) $('status').textContent = veraltet && ergebnis ? t('stale') :
    ergebnis ? ergebnis.info : '';
}

// ---------- 3D preview ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 4 / 3, 1, 5000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
const sonne = new THREE.DirectionalLight(0xffffff, 1.8);
sonne.position.set(-150, -250, 300);
scene.add(sonne);
const gruppe = new THREE.Group();
scene.add(gruppe);

function farbe(name) {
  return new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
}
function geometrie(mesh) {
  const g = new THREE.BufferGeometry();
  const np = mesh.numProp, vp = mesh.vertProperties;
  const pos = new Float32Array((vp.length / np) * 3);
  for (let i = 0, j = 0; i < vp.length; i += np, j += 3) { pos[j] = vp[i]; pos[j + 1] = vp[i + 1]; pos[j + 2] = vp[i + 2]; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(mesh.triVerts, 1));
  const flach = g.toNonIndexed();
  flach.computeVertexNormals();
  return flach;
}
function zeige3d(r) {
  for (const c of [...gruppe.children]) { c.geometry.dispose(); gruppe.remove(c); }
  const abst = 10;
  const box = new THREE.Mesh(geometrie(r.boxMesh), new THREE.MeshStandardMaterial({ color: farbe('--box'), roughness: 0.6 }));
  const lid = new THREE.Mesh(geometrie(r.lidMesh), new THREE.MeshStandardMaterial({ color: farbe('--lid'), roughness: 0.6 }));
  box.position.x = -(r.m.L / 2 + abst / 2);
  lid.position.x = r.m.L / 2 + abst / 2;
  box.userData.c = '--box'; lid.userData.c = '--lid';
  gruppe.add(box, lid);
  const bb = new THREE.Box3().setFromObject(gruppe);
  const mitte = bb.getCenter(new THREE.Vector3()), radius = bb.getBoundingSphere(new THREE.Sphere()).radius;
  controls.target.copy(mitte);
  const d = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.95;
  camera.position.copy(mitte).add(new THREE.Vector3(0.35, -0.8, 0.6).normalize().multiplyScalar(d));
  camera.near = d / 50; camera.far = d * 10; camera.updateProjectionMatrix();
}
function groesse() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(groesse).observe(stage);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  for (const c of gruppe.children) c.material.color = farbe(c.userData.c);
});
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

// ---------- build & download ----------
function infoText(r) {
  return t('info')(nf(r.vBox), nf(r.vLid), nf(r.raute), r.ms);
}

function erstelle() {
  const { m, fehler } = pruefe();
  if (fehler) return;
  $('status').textContent = t('building');
  requestAnimationFrame(() => setTimeout(() => {
    const t0 = performance.now();
    const box = db.box(m), lid = db.kappe(m);
    const vol = (box.volume() + lid.teil.volume()) / 1000;
    const name = `${nf(m.FACH_B, 1).replace(',', '.')}x${nf(m.FACH_L, 1).replace(',', '.')}x${nf(m.KARTENRAUM, 1).replace(',', '.')}`;
    ergebnis = {
      m, name, boxMesh: box.getMesh(), lidMesh: lid.teil.getMesh(),
      vBox: box.volume() / 1000, vLid: lid.teil.volume() / 1000, raute: lid.raute, ms: Math.round(performance.now() - t0),
    };
    ergebnis.info = infoText(ergebnis);
    box.delete(); lid.teil.delete();
    $('sWeight').textContent = `${Math.round(vol * PLA)} g`;
    zeige3d(ergebnis);
    setVeraltet(false);
  }, 0));
}

function lade(dateiname, objekte) {
  const blob = new Blob([make3mf(objekte)], { type: 'model/3mf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = dateiname;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function objekt(teil) {
  const r = ergebnis;
  return teil === 'box'
    ? { name: `Deckbox ${r.name}`, mesh: r.boxMesh, x: 0, y: 0 }
    : { name: `Deckbox ${r.name} Lid`, mesh: r.lidMesh, x: 0, y: 0 };
}
$('dlBoth').addEventListener('click', () => {
  const b = objekt('box'), l = objekt('lid'), dx = ergebnis.m.L / 2 + 5;
  b.x = -dx; l.x = dx;
  lade(`deckbox_${ergebnis.name}.3mf`, [b, l]);
});
$('dlBox').addEventListener('click', () => lade(`deckbox_${ergebnis.name}_box.3mf`, [objekt('box')]));
$('dlLid').addEventListener('click', () => lade(`deckbox_${ergebnis.name}_lid.3mf`, [objekt('lid')]));
$('build').addEventListener('click', erstelle);

// ---------- inputs ----------
$('sleeveOn').addEventListener('click', () => { state.sleeves = true; resetMasse(['innerB', 'innerL']); });
$('sleeveOff').addEventListener('click', () => { state.sleeves = false; resetMasse(['innerB', 'innerL']); });
for (const id of ['cardB', 'cardL']) $(id).addEventListener('input', () => resetMasse(['innerB', 'innerL']));
$('deck').addEventListener('input', () => { $('count').value = ''; resetMasse(['innerH']); });
$('count').addEventListener('input', () => {
  const n = num('count');
  if (Number.isFinite(n) && n > 0) { $('deck').value = runde(n * DICKE[state.sleeves]); resetMasse(['innerH']); }
});
for (const id of ['innerB', 'innerL', 'innerH']) $(id).addEventListener('input', aktualisiere);
$('resetInner').addEventListener('click', () => resetMasse(['innerB', 'innerL', 'innerH']));
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !$('build').disabled) erstelle(); });

for (const [k, s] of Object.entries(SPRACHEN)) $('lang').append(new Option(s.name, k));
$('lang').addEventListener('change', e => setzeSprache(e.target.value));
setzeSprache(lang);
resetMasse(['innerB', 'innerL', 'innerH']);
groesse();

wasm = await Module();
wasm.setup();
wasm.setMinCircularAngle?.(5);
db = makeDeckbox(wasm);
erstelle();   // open with a ready example (63.5 × 88, sleeves, 20 mm deck)
