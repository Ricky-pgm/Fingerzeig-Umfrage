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
| `.github/workflows/ci.yml` | CI: `npm ci`, `npm test`, Playwright-E2E |

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
