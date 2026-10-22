# Fingerzeig – Online-Umfrage

Mobile Umfrage (ca. 8 Minuten) zu Kochen mit digitalen Rezepten und nutzerdefinierten Gesten.
Statische Seite + eine Vercel-Funktion (`/api/submit`, Region Frankfurt) + Neon Postgres (Frankfurt).

## Aufbau

| Datei | Zweck |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Oberfläche (mobil zuerst, keine externen Skripte oder Schriften) |
| `questions.js` | Alle Fragen und erlaubten Werte – eine Quelle für Browser und Server |
| `api/submit.js` | Nimmt eine Antwort an, prüft sie streng, speichert sie |
| `api/_validate.js` | Prüfregeln (unbekannte Felder, Werte außerhalb der Listen, Längen) |
| `schema.sql` | Tabellen und Auswertungs-Views (inkl. Agreement Rate) |
| `vercel.json` | Region `fra1`, Sicherheits-Header (CSP, noindex) |
| `test/` | Unit-Tests (Prüfregeln, API-Handler): `npm test` |
| `e2e/` | Playwright-Test im Handy-Format gegen eine gemockte API: `npm run test:e2e` |
| `migrations/` | SQL-Änderungen an einer bestehenden Datenbank, nummeriert, einmal in Neon ausführen |
| `.github/workflows/ci.yml` | CI: `npm ci`, `npm test`, Playwright-E2E, Screenshots aller Schritte (Artefakt) |

## Veröffentlichen (ca. 15 Minuten)

1. **Kontakt eintragen:** In `index.html` den Platzhalter `[deine E-Mail-Adresse]` im Datenschutz-Dialog ersetzen.
2. **Projekt anlegen:** Im Terminal in diesem Ordner:
   ```
   npx vercel login
   npx vercel
   ```
   Projektname: `fingerzeig-umfrage` (dann lautet die Adresse `https://fingerzeig-umfrage.vercel.app`, passend zum QR-Code auf dem Poster).
3. **Datenbank verbinden:** Vercel-Dashboard → Projekt → **Storage** → **Create Database** → **Neon** (Serverless Postgres) → Region **Frankfurt (eu-central-1)**, Free-Plan → mit dem Projekt verbinden. Vercel setzt `DATABASE_URL` automatisch.
4. **Tabellen anlegen:** Im Neon-Dashboard (Link „Open in Neon“) → **SQL Editor** → Inhalt von `schema.sql` einfügen → **Run**.
5. **Live schalten:**
   ```
   npx vercel --prod
   ```
6. **Selbsttest:** Umfrage einmal am Handy ausfüllen. Im Neon SQL Editor prüfen: `select count(*) from responses;` → 1. Danach die Testantwort löschen: `delete from responses;` und `delete from test_contacts;`.

## Auswerten (Neon SQL Editor)

```sql
select * from v_agreement;                 -- Agreement Rate je Aktion
select * from v_gesture_counts;            -- Häufigste Gesten je Aktion
select note from v_gestures where note is not null;          -- Freitexte zu Gesten
select answers->'cooking'->>'annoyance' from responses
 where answers->'cooking'->>'annoyance' <> '';               -- Was nervt beim Kochen
```

Export als CSV: Ergebnis im SQL Editor → **Download**.

## Datenschutz in Kürze

- Kein Name, keine IP-Adresse in der Datenbank; der Server lehnt jedes unbekannte Feld ab.
- Kontaktangaben für spätere Tests liegen in einer eigenen Tabelle, nur mit Tagesdatum, ohne Bezug zu einer Antwort.
- Nach der Bewertung der Seminararbeit: Neon-Datenbank und Vercel-Projekt löschen.

## Vorschau am Handy testen

Vercel baut für jeden Pull Request automatisch eine Preview; die URL steht als Kommentar des Vercel-Bots im PR.
Achtung: Previews schreiben in **dieselbe** Neon-Datenbank wie die Produktion. Testantworten danach löschen
(`delete from responses; delete from test_contacts;`). Eine Preview mit neuem Schema funktioniert erst, nachdem die
passende Datei aus `migrations/` in Neon ausgeführt wurde.

## Entscheidungen

- **Schema 2 (Migration 001):** `responses` bekommt `submission_id` (UNIQUE) und `duration_s`; je Geste werden
  Passung (`fit`) und Leichtigkeit (`ease`) als 1–5 gespeichert. Vor der Migration die Tabellen leeren.
- **Mehrfach-Absenden:** Der Browser erzeugt je Teilnahme eine `submission_id`. Ein erneutes Senden mit derselben ID
  fügt nichts ein und wird mit 200 beantwortet. Antwort und Kontakt werden in einem Statement gespeichert.
  Ein Rate-Limit gibt es bewusst nicht; Honeypot und `submission_id` genügen.
- **Größenlimit:** Geprüft wird der geparste Body, nicht nur der Header `content-length`.
- **Dauer:** Gespeichert wird nur die Zeit in Sekunden vom Klick auf „Los geht’s“ bis zum Absenden (höchstens 24 h).
  Sie belegt die Angabe „ca. 8 Minuten“; was auf dem Poster steht, entscheidet die gemessene Dauer.
- **„Andere“-Antworten:** Jede Antwort mit „Andere“ zählt als eigene Geste (Code `other:<Antwort>:<Aktion>`), solange
  sie nicht manuell codiert ist. Manuelle Codes stehen in `gesture_codes`; gleicher Code = gleiche Geste.
  Sonst würden zwei verschiedene „Andere“-Antworten als Übereinstimmung zählen und die Agreement Rate aufblähen.
- **Reihenfolge der Aktionen:** zufällig je Person, ohne Ausgleichsverfahren (Zufall genügt).
- **Seiten:** Die ersten beiden Koch-Seiten sind zusammengelegt, um die Zeit für die zwei Skalen je Geste
  auszugleichen. Der Freitext „Was nervt?“ bleibt, er ersetzt die Interviews.
- **Bausteine der Geste:** Handform und Bewegung sind neutrale Linien-Piktogramme (`icons.js`, reine Pfaddaten),
  keine Emoji, die je Gerät anders aussehen. Die Reihenfolge der Kacheln wird je Person zufällig gemischt und
  bleibt für alle fünf Gesten gleich; „Andere“ steht immer zuletzt (`tiles.js`).
- **Aktionsleiste:** Der primäre Button sitzt auf allen Schritten fixiert unten im Daumenbereich (mit Safe-Area).
  Er ist nie ausgegraut: Ein Klick bei unvollständigen Angaben zeigt direkt am Feld, was fehlt, und setzt den Fokus
  dorthin (`aria-describedby`). Die Meldung verschwindet, sobald das Feld bearbeitet wird.
- **Fokus:** Beim Aktualisieren eines Schritts (z. B. nach Auswahl einer Kachel) bleibt der Fokus auf dem gewählten Element.
  Der Zeichenzähler wird nicht mehr bei jedem Tastendruck vorgelesen, sondern hängt als Beschreibung am Feld.
- **Startseite:** Überschrift („Schon wieder Teig am Display?“, „Display?“ in Safran), Unterzeile, „Zeig mir, wie’s geht.“,
  Holz-Optik und kleingeschriebenes Logo folgen dem Poster `design/plakat-4x5.png`. Die Zeile „Dauert so lange, wie
  Nudelwasser zum Kochen braucht (ca. 8 Min.)“ steht zusätzlich als Band; die Minutenangabe wird nach der gemessenen
  Dauer angepasst.
- **Ziel Lighthouse (mobil) ≥ 95:** Messung vom 22.10.2026 (Lighthouse 13.5, Startseite, lokal mit Poster-Farben):
  Performance 99, Barrierefreiheit 100, Best Practices 100, SEO 60. SEO fällt nur wegen `noindex` ab
  (Audit „Page is blocked from indexing“); das bleibt Absicht, damit die Umfrage nicht in Suchmaschinen auftaucht.

## Screenshots für das Design

`npm run screenshots` rendert alle Schritte bei 390 × 844 in den Ordner `screenshots/`. Die CI lädt ihn als Artefakt
`screenshots` hoch (Reiter „Summary“ des Workflow-Laufs).
- **Fortschritt als Kochtopf:** Der Topf in der Kopfzeile füllt sich mit der Frage (`--p`), ab 60 % blubbert das Wasser,
  ab 90 % steigt Dampf auf. Die Kopfzeile zeigt zusätzlich „n/12“; das Bedienelement (`role=progressbar`) sagt „Frage n von 12“.
- **Übergänge:** Ein Schritt gleitet in 240 ms seitlich ein (zurück: von links). Nur beim Wechsel des Schritts, nicht bei
  jeder Auswahl. Mit `prefers-reduced-motion` entfallen alle Animationen; Blasen und Dampf stehen dann statisch.
- **Häkchen:** Neben einer beantworteten Frage zeichnet sich ein Häkchen, nur für die Änderung, die sie beantwortet hat.
  Vibration (8 ms) nur, wo der Browser sie unterstützt (nicht iOS).
- **Fortsetzen:** Der Fortschritt liegt im `localStorage` dieses Browsers (nicht auf dem Server) und verfällt nach 14 Tagen.
  Ein Reload im selben Tab macht direkt weiter; wer später zurückkommt, sieht „Schön, dass du zurück bist“ mit
  „Weitermachen“ oder „Neu beginnen“ (zweiter Klick zur Bestätigung). Der Datenschutztext nennt das Zwischenspeichern.
- **Noch einmal teilnehmen:** Die Danke-Seite hat den Button „Noch einmal teilnehmen“ (z. B. für eine zweite Person am
  selben Gerät). Er löscht den Merker „fertig“ und beginnt mit einer neuen `submission_id`.
- **Gesten-Karte:** Zu jeder Aktion zeigt die Karte einen kleinen Küchengegenstand (Brett, Rezeptbuch, Timer, Mehlschüssel,
  Topf), nie eine Hand. Die Skalen 1–5 sind an beiden Enden beschriftet.
- **Danke-Seite:** „Umfrage teilen“ (Web Share) oder „Link kopieren“ als Ersatz. Der Bonus „Erkennt dein Handy deine Hand?“
  verlinkt `CHECK_URL` in `questions.js` (Gerätecheck der App, Azure-Static-Website). Ist sie leer, entfällt der Bonus.
- **Kontakt ohne Datum (Migration 002):** `test_contacts` hat keine Zeitangabe mehr, damit sich ein Kontakt nicht über den Tag
  einer Antwort zuordnen lässt. Dazu die Views `v_duration` (Median, Mittel, Minimum, Maximum in Minuten, über 1 h ausgelassen)
  und `v_ratings` (Passung und Leichtigkeit je Aktion).

## Grenzen der Methode

- **Nähe zum MediaPipe-Vokabular:** Die Handformen (offene Hand, Faust, ein Finger, Daumen hoch/runter, V) entsprechen weitgehend
  den Gesten, die der Gesture Recognizer kennt. Die Auswahl kann also Gesten nahelegen, die sich leicht erkennen lassen
  (Legacy Bias). Gegenmaßnahmen: neutrale Piktogramme, zufällige Kachelreihenfolge je Person, „Andere“ immer zuletzt.
- **Feste Zerlegung in Handform × Bewegung:** Jede Geste besteht aus genau einer Handform und einer Bewegung. Zweihändige Gesten,
  Kopf- oder Körperbewegungen und Abfolgen mehrerer Gesten sind nicht vorgesehen; „Andere“ mit Beschreibung ist der einzige Ausweg.
- **Keine Vorführung am Gerät:** Die Teilnehmenden wählen Bausteine, sie führen die Geste nicht vor einer Kamera aus. Die
  Bewertung (Passung, Leichtigkeit) ist eine Einschätzung, keine Messung.
- **„Andere“-Antworten:** Solange sie nicht manuell codiert sind (`gesture_codes`), zählt jede als eigene Geste und senkt die
  Agreement Rate.
- **Online statt moderiert:** Es gibt keine Rückfragen und keine Beobachtung; die Stichprobe ist selbst gewählt.

## Datenbank aktualisieren

Reihenfolge, einmal je Datei im Neon SQL Editor: `migrations/001_methodology.sql`, dann `migrations/002_privacy_and_views.sql`.
Vor 001 die Tabellen leeren. Die Dateien in `migrations/` sind der Weg für bestehende Datenbanken, `schema.sql` der Endstand
für eine neue.
- **Farben aus dem Poster gemessen** (`design/plakat-4x5.png`, Auslesen der Pixel): Safran `#EA9E3A` („Display?“, QR-Rahmen),
  Dunkelgrün `#1E3A2A` (Button, Titel), Creme `#F6F2EA` (Karte, Headline), Holz im Mittel `#352318`. Die CSS-Variablen
  entsprechen diesen Werten. Das Rostrot der Zeile „UMFRAGE · CA. 8 MIN.“ (`#C65A3E`) kommt in der App nicht vor, Fehler
  bleiben `#B3261E`.
