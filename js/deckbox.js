// Deckbox geometry – originally ported from a build123d model (card box with snap-on cap)
// to manifold-3d. Same design: cap ("Kappe") with rim top and bottom and snap bumps,
// finger notches at both short ends, push-out slot in the floor, diamond grid in the cap.
//
// Coordinates: x = card length, y = card width, z up. Print orientation: box floor down,
// cap plate down. All values in mm.

// ---- Cap (proven values from the insert projects) ----
export const K_T = 1.2;            // cap plate thickness
const K_W = 1.2;                   // cap wall
const K_SPIEL = 0.15;
const K_KAPPE_SPIEL = 0.1;         // cap clearance per side
const K_S = K_W + K_SPIEL;         // 1.35 inset of the box rim
const K_H_STD = 5.0;               // rim height
const K_H_MIN = 4.0;               // rim height for very low boxes
const NOPPE_R = 2.5;               // snap bump: sphere radius
const NOPPE_H = 0.5;               // bump height above the rim
const NOPPE_A = 6.0;               // bump centre from the rim corner
const MULDE_LUFT = 0.15;           // dimple in the cap: radius + this
const K_FASE = 0.5;                // chamfer at the cap's bed edge
const K_UNTEN = 0.1;               // lower rim inset extra (elephant foot)
const K_BETT = 0.4;                // 45° bed chamfer of the box
const K_GRIFF_B = 20.0;            // grip recess on the long sides
const K_GRIFF_H = 5.0;
const ECK_A = 10.0;                // corner grip recess: reaches this far along each side from the corner
                                   // (user idea 2026-10-24: levering the cap off at a corner works better
                                   // than from the middle of a long side, especially on large boxes)
const RAUTE_WAHL = [11, 11.5, 12, 12.5, 13, 13.5, 14];
const RAUTE_WAHL_BODEN = [7, 8, 9, 10, ...RAUTE_WAHL];   // floor: smaller diamonds fit beside the push-out slot of small boxes
const RAUTE_STEG = 2.0;
const GITTER_RAND = 3.0;

// ---- Box ----
export const WAND = 2.6;           // wall (min. for cap rim and notch roundings)
export const BODEN = 1.2;          // floor
const R_E = 3.0;                   // vertical outer corners
const R_FACH = 2.0;                // vertical inner corners
const KERBE_ANTEIL = 0.415;        // notch width at the bottom = share of the inner width
const KERBE_R_O_STD = 8.0;         // arc into the top edge
const KERBE_R_U = 3.0;
const KERBE_R_FACH = 1.6;          // rounding inner wall -> notch
const KERBE_R_AUSSEN = 1.0;        // rounding notch -> outside
const DRUECK = [40.0, 18.0];       // push-out slot
const E = 0.01;
const BOGEN_SEG = 12;              // segments per arc in the notch profile

export const MIN_KARTENRAUM = 9;   // below this two 4-mm rims do not fit

/** Derived dimensions for an inner size (fachB × fachL × kartenraum). */
export function masse(fachB, fachL, kartenraum) {
  const HB = BODEN + kartenraum;
  const K_H = HB >= 2 * K_H_STD + K_S + K_UNTEN + 1 ? K_H_STD : K_H_MIN;
  return {
    FACH_B: fachB, FACH_L: fachL, KARTENRAUM: kartenraum,
    L: fachL + 2 * WAND, B: fachB + 2 * WAND, HB, H_GESAMT: HB + K_T, K_H,
    GRIFF_H: Math.min(K_GRIFF_H, HB - 2 * K_H - K_S - K_UNTEN),
    KERBE_B: Math.round(KERBE_ANTEIL * fachB),
    KERBE_R_O: Math.min(KERBE_R_O_STD, HB - BODEN - KERBE_R_U - 1),
  };
}

export function makeDeckbox(wasm) {
  const { Manifold, CrossSection, Mesh, triangulate } = wasm;

  // ---------- basic shapes ----------
  function rr(w, l, r) {
    r = Math.max(r, 0.05);
    return CrossSection.square([w - 2 * r, l - 2 * r], true).offset(r, 'Round', 2, 48);
  }
  function platte(w, l, r, z0, h) {
    return rr(w, l, r).extrude(h).translate([0, 0, z0]);
  }
  // 45° transition: bottom w × l, top smaller (or larger) by h on each side
  function kegel(w, l, r, z0, h, nachAussen = false) {
    const s = nachAussen ? 1 : -1;
    const t = 1e-3;
    const unten = rr(w, l, r).extrude(t).translate([0, 0, z0]);
    const oben = rr(w + 2 * s * h, l + 2 * s * h, r + s * h).extrude(t).translate([0, 0, z0 + h - t]);
    return Manifold.hull([unten, oben]);
  }
  function polygonCS(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      a += x1 * y2 - x2 * y1;
    }
    return new CrossSection([a < 0 ? [...pts].reverse() : pts]);
  }
  // polygon in the (y, z) plane, extruded along x from x0 by len
  function extrudeYZ(pts, x0, len) {
    return polygonCS(pts).extrude(len).warp(v => {
      const [a, b, c] = v;
      v[0] = c + x0; v[1] = a; v[2] = b;
    });
  }

  function griffmulde(m, sg) {
    const { HB, K_H, GRIFF_H, B } = m;
    const s = K_S, su = K_S + K_UNTEN;
    const zt = HB - K_H, zb = K_H;
    const oben = [[1, zt + 1], [-s + 0.5, zt + 1], [-s - 0.05, zt + 0.45], [-s - 0.05, zt - GRIFF_H],
      [0.5, zt - GRIFF_H - s - 0.5], [1, zt - GRIFF_H - s - 0.5]];
    const unten = [[1, zb - 1], [-su - 0.05, zb - 1], [-su - 0.05, zb + GRIFF_H],
      [0.5, zb + GRIFF_H + su + 0.5], [1, zb + GRIFF_H + su + 0.5]];
    return Manifold.union([oben, unten].map(pts =>
      extrudeYZ(pts.map(([d, z]) => [sg * (B / 2 + d), z]), -K_GRIFF_B / 2, K_GRIFF_B)));
  }

  // Corner grip recesses: same profile as griffmulde (depth = rim inset, 45° run-out), wrapped
  // around all four vertical corners, below the top cap edge and above the bottom rim.
  function eckmulden(m) {
    const { L, B, HB, K_H, GRIFF_H } = m;
    const s = K_S + 0.05, su = K_S + K_UNTEN + 0.05;
    const zt = HB - K_H, zb = K_H;
    const ecken = (z0, z1) => Manifold.union([1, -1].flatMap(sx => [1, -1].map(sy =>
      Manifold.cube([ECK_A + 5, ECK_A + 5, z1 - z0])
        .translate([sx > 0 ? L / 2 - ECK_A : -L / 2 - 5, sy > 0 ? B / 2 - ECK_A : -B / 2 - 5, z0]))));
    // top: recess from the cap edge down by GRIFF_H, then 45° back to the outer wall
    const o0 = zt - GRIFF_H - s - 0.5, o1 = zt + 0.3;
    const obenBleibt = Manifold.union([
      platte(L - 2 * s, B - 2 * s, R_E - s, zt - GRIFF_H - E, o1 - zt + GRIFF_H + 1),
      kegel(L + 1, B + 1, R_E + 0.8, o0 - E, s + 0.5 + E),   // radius != outer corner where they meet
    ]);
    // bottom: mirrored, recess above the lower rim, 45° roof (prints without supports)
    const u0 = zb - 0.3, u1 = zb + GRIFF_H + su + 0.5;
    const untenBleibt = Manifold.union([
      platte(L - 2 * su, B - 2 * su, R_E - su, u0 - 1, zb + GRIFF_H - u0 + 1 + E),
      kegel(L - 2 * su, B - 2 * su, R_E - su + 0.5, zb + GRIFF_H, su + 0.5 + E, true),   // centre differs from the top one
    ]);
    return Manifold.union([
      ecken(o0, o1).subtract(obenBleibt),
      ecken(u0, u1).subtract(untenBleibt),
    ]);
  }

  function noppenLagen(m, zs) {
    const lr = m.L - 2 * K_S, br = m.B - 2 * K_S;
    const lagen = [];
    for (const z of zs)
      for (const sx of [1, -1])
        for (const sy of [1, -1]) {
          lagen.push([sx * (lr / 2 - NOPPE_A), sy * br / 2, z, 'y', sy]);
          lagen.push([sx * lr / 2, sy * (br / 2 - NOPPE_A), z, 'x', sx]);
        }
    return lagen;
  }

  // spherical cap (radius r) on the rim surface at (x, y, z), normal along axis·sg,
  // from `basis` (negative = into the wall) up to `spitze` above the surface
  function kugelkappe(x, y, z, achse, sg, r, spitze, basis = -0.35) {
    const zm = spitze - r;
    let k = Manifold.sphere(r, 64).translate([0, 0, zm]).trimByPlane([0, 0, 1], basis);
    k = achse === 'y' ? k.rotate([-90 * sg, 0, 0]) : k.rotate([0, 90 * sg, 0]);
    return k.translate([x, y, z]);
  }

  function huelle(m) {
    const { L, B, HB, K_H } = m;
    const s = K_S, su = K_S + K_UNTEN;
    const wu = L - 2 * su, lu = B - 2 * su, ru = R_E - su;
    const wi = L - 2 * s, li = B - 2 * s, ri = R_E - s;
    const teile = [
      kegel(wu - 2 * K_BETT, lu - 2 * K_BETT, ru - K_BETT, 0, K_BETT + E, true),   // bed chamfer
      platte(wu, lu, ru, K_BETT, K_H - K_BETT + E),
      kegel(wu, lu, ru, K_H, su + E, true),                                        // 45° outwards
      platte(L, B, R_E, K_H + su, HB - 2 * K_H - su + E),
      platte(wi, li, ri, HB - K_H, K_H),
    ];
    for (const [x, y, z, a, sg] of noppenLagen(m, [K_H / 2, HB - K_H / 2]))
      teile.push(kugelkappe(x, y, z, a, sg, NOPPE_R, NOPPE_H));
    return Manifold.union(teile).subtract(Manifold.union([griffmulde(m, 1), griffmulde(m, -1), eckmulden(m)]));
  }

  // ---------- finger notch (lofted, roundings built in) ----------
  function arc(cx, cy, r, a0, a1, out) {
    for (let i = 0; i <= BOGEN_SEG; i++) {
      const a = (a0 + (a1 - a0) * i / BOGEN_SEG) * Math.PI / 180;
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  function kerbeProfil(m, d) {
    // arcs run into a plane 0.05 above the top edge, so they cut it instead of touching it tangentially
    const zo = m.HB + 0.05;
    const b2 = m.KERBE_B / 2 + d, ru = KERBE_R_U + d, ro = m.KERBE_R_O - d, zb = BODEN, top = zo + 2;
    const yo = b2 + ro + 1;
    const p = [[-yo, top], [-yo, zo]];
    arc(-(b2 + ro), zo - ro, ro, 90, 0, p);
    arc(-(b2 - ru), zb + ru, ru, 180, 270, p);
    arc(b2 - ru, zb + ru, ru, 270, 360, p);
    arc(b2 + ro, zo - ro, ro, 180, 90, p);
    p.push([yo, zo], [yo, top]);
    return p;   // counter-clockwise in (y, z)
  }
  function loft(stationen) {   // stationen: [[x, pts2d], ...], same point count, increasing x
    const n = stationen[0][1].length, verts = [], tris = [];
    for (const [x, pts] of stationen) for (const [y, z] of pts) verts.push(x, y, z);
    const idx = (i, j) => i * n + (j % n);
    for (let i = 0; i + 1 < stationen.length; i++)
      for (let j = 0; j < n; j++) {
        tris.push(idx(i, j), idx(i + 1, j + 1), idx(i + 1, j));
        tris.push(idx(i, j), idx(i, j + 1), idx(i + 1, j + 1));
      }
    const last = stationen.length - 1;
    for (const [a, b, c] of triangulate([stationen[0][1]])) tris.push(a, c, b);
    for (const [a, b, c] of triangulate([stationen[last][1]])) tris.push(idx(last, a), idx(last, b), idx(last, c));
    const mesh = new Mesh({ numProp: 3, vertProperties: new Float32Array(verts), triVerts: new Uint32Array(tris) });
    mesh.merge();
    let k = new Manifold(mesh);
    if (k.volume() < 0) throw new Error('loft orientation');
    return k;
  }
  function kerbe(m, sx, n = 6) {
    const xi = m.L / 2 - WAND, xa = m.L / 2;
    const ri = KERBE_R_FACH, ra = KERBE_R_AUSSEN;
    let s = [[xi - 1, ri]];
    for (let i = 0; i <= n; i++) {
      const u = ri * i / n;
      s.push([xi + u, ri - Math.sqrt(Math.max(ri * ri - (ri - u) ** 2, 0))]);
    }
    for (let i = n; i >= 0; i--) {
      const u = ra * i / n;
      s.push([xa - u, ra - Math.sqrt(Math.max(ra * ra - (ra - u) ** 2, 0))]);
    }
    s.push([xa + 2, ra]);
    // stations exactly in the inner or outer wall plane produce coincident edges -> move them off
    s = s.map(([x, d]) => [Math.abs(x - xi) < 1e-9 ? xi - 0.02 : Math.abs(x - xa) < 1e-9 ? xa + 0.02 : x, d]);
    s.sort((a, b) => a[0] - b[0]);
    s = s.filter((p, j) => j === 0 || p[0] - s[j - 1][0] > 0.02);
    const teil = loft(s.map(([x, d]) => [x, kerbeProfil(m, d)]));
    return sx > 0 ? teil : teil.rotate([0, 0, 180]);
  }

  // ---------- diamond grid ----------
  function rautenPunkte(w, l, raute) {
    const d = raute / 2, p = raute + RAUTE_STEG * Math.SQRT2;
    const n = Math.floor(Math.max(w, l) / p) + 2, pts = [];
    for (let i = -2 * n; i <= 2 * n; i++)
      for (let j = -2 * n; j <= 2 * n; j++) {
        if ((i + j) % 2) continue;
        const x = i * p / 2, y = j * p / 2;
        if (Math.abs(x) + d <= w / 2 && Math.abs(y) + d <= l / 2) pts.push([x, y]);
      }
    return pts;
  }
  // frei(x, y, d): optional filter, false drops the diamond at (x, y) with half-diagonal d
  function rautengitter(w, l, z0, h, frei = () => true, wahl = RAUTE_WAHL) {
    const punkte = r => rautenPunkte(w, l, r).filter(([x, y]) => frei(x, y, r / 2));
    let best = wahl[0], bestA = -1;
    for (const r of wahl) {
      const a = punkte(r).length * r * r;
      if (a >= bestA) { best = r; bestA = a; }
    }
    const pts = punkte(best), a = best / Math.SQRT2;
    if (!pts.length) return { gitter: null, raute: best, anzahl: 0 };
    const quad = CrossSection.square([a, a], true).rotate(45);
    const cs = CrossSection.union(pts.map(([x, y]) => quad.translate([x, y])));
    return { gitter: cs.extrude(h).translate([0, 0, z0]), raute: best, anzahl: pts.length };
  }

  // ---------- parts ----------
  function box(m) {
    const slot = CrossSection.hull([
      CrossSection.circle(DRUECK[1] / 2, 48).translate([-(DRUECK[0] - DRUECK[1]) / 2, 0]),
      CrossSection.circle(DRUECK[1] / 2, 48).translate([(DRUECK[0] - DRUECK[1]) / 2, 0]),
    ]).extrude(BODEN + 2).translate([0, 0, -1]);
    // floor grid (saves material): same diamonds as the lid, closed border to the walls and a
    // closed ring around the push-out slot, which stays as it is
    const sx = (DRUECK[0] - DRUECK[1]) / 2, sr = DRUECK[1] / 2;
    const freiVomLoch = (x, y, d) => Math.hypot(Math.max(Math.abs(x) - sx, 0), y) - sr - d >= GITTER_RAND;
    const boden = rautengitter(m.FACH_L - 2 * GITTER_RAND, m.FACH_B - 2 * GITTER_RAND, -1, BODEN + 2, freiVomLoch, RAUTE_WAHL_BODEN);
    const weg = [platte(m.FACH_L, m.FACH_B, R_FACH, BODEN, m.HB), kerbe(m, 1), kerbe(m, -1), slot];
    if (boden.gitter) weg.push(boden.gitter);
    return huelle(m).subtract(Manifold.union(weg));
  }

  function kappe(m) {
    const { L, B, K_H } = m;
    const s = K_S;
    const wk = L - 2 * s + 2 * K_KAPPE_SPIEL, lk = B - 2 * s + 2 * K_KAPPE_SPIEL, rk = R_E - s + K_KAPPE_SPIEL;
    const koerper = Manifold.union([
      kegel(L - 2 * K_FASE, B - 2 * K_FASE, R_E - K_FASE, 0, K_FASE + E, true),
      platte(L, B, R_E, K_FASE, K_T + K_H - K_FASE),
    ]);
    const weg = [platte(wk, lk, rk, K_T, K_H + 1),
      kegel(wk, lk, rk, K_T + K_H - 0.4, 0.4 + E, true)];
    for (const [x, y, z, a, sg] of noppenLagen(m, [K_T + K_H / 2]))
      weg.push(kugelkappe(x, y, z, a, sg, NOPPE_R + MULDE_LUFT, NOPPE_H + MULDE_LUFT, -0.5));
    const g = rautengitter(wk - 2 * GITTER_RAND, lk - 2 * GITTER_RAND, -1, K_T + 2);
    weg.push(g.gitter);
    return { teil: koerper.subtract(Manifold.union(weg)), raute: g.raute, anzahl: g.anzahl };
  }

  return { box, kappe };
}
