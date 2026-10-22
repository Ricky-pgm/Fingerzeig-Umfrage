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
| `test/` | Tests der Prüfregeln: `npm test` |

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
