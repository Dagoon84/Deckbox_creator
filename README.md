# Deckbox Creator

Web-Tool für 3D-gedruckte Kartenboxen mit Rastkappe. Läuft komplett im Browser – kein Server,
keine Installation.

1. Kartenformat wählen (oder eigenes Maß eingeben)
2. Mit oder ohne Sleeves
3. Deckhöhe in mm (oder Kartenanzahl)
4. Innenmaße prüfen – Vorschlag wird angezeigt, jeder Wert lässt sich ändern
5. **Box erstellen** → 3D-Vorschau → 3MF herunterladen (Box + Kappe, nur Box, nur Kappe)

## Design

Übernommen aus dem Projekt *Standard-Kartenbox* (Brettspiel-Inserts, build123d-Modell
`standard_kartenbox.py`), gleiche Geometrie und Werte:

- Kappe mit 5-mm-Rand oben und unten (1,35 mm eingerückt, Spiel 0,1 mm), Rastnoppen an den
  Ecken (2 je Ecke). Die Kappe lässt sich im Spiel unter die Box stecken.
- Griffkerben an beiden Stirnseiten, Drückloch 40 × 18 mm im Boden.
- Rautengitter in der Kappe (Rautengröße 11–14 mm, automatisch passend zur Fläche).
- Wand 2,6 mm, Boden 1,2 mm, Kappenplatte 1,2 mm. Höhe geschlossen = Innenhöhe + 2,4 mm.
- Innenhöhe unter ca. 10,3 mm: Rand 4 mm statt 5 mm (Kappe passt dann nur zu dieser Höhe).
  Minimum 9 mm.

## Formate

| Karte (ohne Sleeve) | Fach innen mit Sleeves | Fach innen ohne Sleeves |
|---|---|---|
| 63,5 × 88 | 67,5 × 93,3 | 64,5 × 89 |
| 59 × 92 | 63,5 × 97,3 | 60 × 93 |
| 57,5 × 89 | 62 × 93 | 58,5 × 90 |
| 56 × 87 | 60,5 × 91 | 57 × 88 |
| 44 × 68 | 49 × 72,5 | 45 × 69 |
| 41 × 63 | 45 × 66,5 | 42 × 64 |
| eigenes | Karte + 4,5 / + 5 | Karte + 1 |

Mit Sleeves: gemessene bzw. gedruckte Werte. Ohne Sleeves: Vorschlag (0,5 mm Luft je Seite),
noch nicht gedruckt. Höhe = Deckhöhe + 1,5 mm Luft. Kartenanzahl: 0,8 mm je Karte mit Sleeve,
0,3 mm ohne.

## Druck

PLA, 0,4-mm-Düse, 0,2 mm Schichthöhe, keine Stützen. Box mit dem Boden aufs Bett, Kappe mit
der Platte aufs Bett (so liegen sie in der 3MF). Bambu Studio warnt evtl. vor Überhängen –
die Teile drucken ohne Stützen.

## Technik

- Geometrie: [`js/deckbox.js`](js/deckbox.js) mit [manifold-3d](https://github.com/elalish/manifold)
  3.5.3 (WebAssembly, Apache-2.0, liegt in `vendor/`)
- 3D-Vorschau: three.js 0.180.0 (CDN), 3MF-Zip: fflate 0.8.2 (CDN)
- 3MF-Writer: [`js/export3mf.js`](js/export3mf.js)
- Lokal testen: `python -m http.server 8765` im Repo-Ordner, dann http://localhost:8765

Geprüft (2026-10-19): Box 67,5 × 93,3 × 20 mm = 17,1 cm³, Kappe 6,9 cm³ – identisch mit dem
build123d-Modell; 3MF geschlossen (trimesh), von Bambu Studio gesliced.

## Änderungen

- 2026-10-19 – Erste Version: 6 Formate + eigenes, mit/ohne Sleeves, Deckhöhe oder Kartenanzahl,
  editierbare Innenmaße, 3D-Vorschau, 3MF-Download.
