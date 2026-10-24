# Deckbox Creator

Web-Tool für 3D-gedruckte Kartenboxen mit Rastkappe. Läuft komplett im Browser – kein Server,
keine Installation.

**Online:** https://dagoon84.github.io/Deckbox_creator/

**Start (lokal):** `start.bat` doppelklicken – startet einen kleinen Webserver und öffnet
http://localhost:8765 im Browser. Das Fenster offen lassen, solange das Tool läuft. (Die
`index.html` direkt zu öffnen geht nicht: Browser laden die CAD-Bibliothek nicht von `file://`.)

Sprache wählbar: Deutsch, English, Français, Español, Italiano, Nederlands, Polski, 日本語, 한국어
(Browsersprache als Vorgabe, Auswahl wird im Browser gemerkt).

1. Kartenformat wählen (oder eigenes Maß eingeben)
2. Mit oder ohne Sleeves
3. Deckgröße: Höhe des Kartenstapels in mm (oder Kartenanzahl)
4. Innenmaße prüfen – Vorschlag wird angezeigt, jeder Wert lässt sich ändern
5. **Box erstellen** → 3D-Vorschau → 3MF herunterladen (Box + Kappe, nur Box, nur Kappe)

## Design

Ursprünglich aus einem build123d-Modell übernommen; das Tool ist jetzt die einzige Quelle für
Geometrie und Werte:

- Kappe mit 5-mm-Rand oben und unten (1,35 mm eingerückt, Spiel 0,1 mm), Rastnoppen an den
  Ecken (2 je Ecke). Die Kappe lässt sich im Spiel unter die Box stecken.
- Griffkerben an beiden Stirnseiten, Drückloch 40 × 18 mm im Boden.
- Griffmulden für die Kappe an den langen Seiten (20 mm) und an allen 4 Ecken (je 10 mm um die
  Ecke, oben und unten): An der Ecke lässt sich die Kappe besonders bei großen Boxen leichter abhebeln.
- Rautengitter in der Kappe (Rautengröße 11–14 mm, automatisch passend zur Fläche).
- Rautengitter auch im Boden (spart Material, z. B. Standard 20 mm 17,1 → 14,7 cm³): 3 mm geschlossener
  Rand zu den Wänden, 3 mm geschlossener Ring um das Drückloch; Rauten 7–14 mm, damit auch kleine
  Formate Löcher bekommen.
- Wand 2,6 mm, Boden 1,2 mm, Kappenplatte 1,2 mm. Höhe geschlossen = Innenhöhe + 2,4 mm.
- Innenhöhe unter ca. 10,3 mm: Rand 4 mm statt 5 mm (Kappe passt dann nur zu dieser Höhe).
  Minimum 9 mm.

## Formate

| Name | Karte (ohne Sleeve) | Fach innen mit Sleeves | Fach innen ohne Sleeves |
|---|---|---|---|
| Standard | 63,5 × 88 | 68 × 93 | 64,5 × 89 |
| Euro | 59 × 92 | 63,5 × 97,3 | 60 × 93 |
| Chimera | 57,5 × 89 | 62 × 93 | 58,5 × 90 |
| American | 56 × 87 | 60,5 × 91 | 57 × 88 |
| 7 Wonders | 65 × 100 | 69,5 × 104 | 66 × 101 |
| Dixit | 80 × 120 | 84 × 124 | 81 × 121 |
| Mini Euro | 44 × 68 | 48 × 73 | 45 × 69 |
| Mini American | 41 × 63 | 45 × 66,5 | 42 × 64 |
| Eigenes Maß | eingeben | Karte + 4,5 / + 5 | Karte + 1 |

Namen wie bei den Sleeve-Herstellern.
Mit Sleeves: gemessene bzw. gedruckte Werte. Ohne Sleeves: Vorschlag (0,5 mm Luft je Seite),
noch nicht gedruckt. Höhe = Deckhöhe + 1,5 mm Luft. Kartenanzahl: 0,6 mm je Karte
(mit und ohne Sleeve).

## Druck

PLA, 0,4-mm-Düse, 0,2 mm Schichthöhe, keine Stützen. Box mit dem Boden aufs Bett, Kappe mit
der Platte aufs Bett (so liegen sie in der 3MF). Bambu Studio warnt evtl. vor Überhängen –
die Teile drucken ohne Stützen.

## Technik

- Geometrie: [`js/deckbox.js`](js/deckbox.js) mit [manifold-3d](https://github.com/elalish/manifold)
  3.5.3 (WebAssembly, Apache-2.0, liegt in `vendor/`)
- 3D-Vorschau: three.js 0.180.0, 3MF-Zip: fflate 0.8.2, Schriften: Bricolage Grotesque, IBM Plex
  (OFL) – alles lokal in `vendor/`, die Seite lädt nichts von fremden Servern (DSGVO)
- 3MF-Writer: [`js/export3mf.js`](js/export3mf.js)
- Texte: [`js/i18n.js`](js/i18n.js) – neue Sprache: Eintrag in `SPRACHEN` und `T`
- Lokal testen: `python -m http.server 8765` im Repo-Ordner, dann http://localhost:8765

## Änderungen

