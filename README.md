# Lesezeichen-Werkstatt

Lokale Browser-App zum Kombinieren und Aufräumen von Lesezeichen. Keine Installation, Abhängigkeiten, Konten oder Uploads.

## Starten

`index.html` in Firefox oder Chromium öffnen. Alle vier Dateien `index.html`, `style.css`, `core.js` und `app.js` zusammen im Projektordner lassen.

Alternativ im Projektordner `python3 -m http.server 8080 --bind 127.0.0.1` starten und `http://localhost:8080` öffnen.

## Benutzen

1. Eine oder mehrere HTML-Lesezeichenexporte aus Firefox, Chrome, Brave, Chromium oder anderen Browsern mit Netscape-Lesezeichenformat oder unkomprimierte Firefox-JSON-Sicherungen importieren. Die Dateien unterschiedlicher Browser lassen sich in einem Import mischen; Duplikate werden über alle Quellen hinweg erkannt. Weitere Importe ergänzen die Sammlung. Identische Ordnerpfade werden zusammengeführt.
2. Nach Titeln, URLs, Ordnern oder Tags suchen; nach Titel, Website, Ordner oder Quelldatei sortieren. Die Ordneransicht umfasst Unterordner.
3. Unter „Duplikate prüfen“ gleiche URLs vergleichen. Optional Fragmente und bekannte Tracking-Parameter (`utm_*`, `fbclid`, `gclid`, `msclkid`) ignorieren. Andere Query-Parameter, HTTP und HTTPS bleiben verschieden.
4. Überzählige Duplikate auswählen und mit „Entfernen“ löschen. Der zuerst importierte Eintrag bleibt erhalten; unterschiedliche Titel, Tags und Ordner werden nicht automatisch verschmolzen. Bei aktiver Suche werden nur passende überzählige Einträge ausgewählt.
5. Einträge einzeln bearbeiten oder gesammelt in neue/bestehende Ordner verschieben. „Sichtbare auswählen“ bezieht sich auf die aktuelle Seite (80 Einträge); Auswahlen bleiben beim Blättern bestehen.
6. Mit „Leere Ordner entfernen“ in der Ordnerleiste alle leeren Ordner aufräumen, einschließlich vollständig leerer Unterordnerstrukturen. Ordner mit Lesezeichen in Unterordnern bleiben erhalten. Die Aktion gilt unabhängig von Suche und Ansicht und lässt sich rückgängig machen.
7. Die vollständige Sammlung als HTML exportieren und über den HTML-Import des Browsers einlesen. Alternativ eine JSON-Sicherung für diese App speichern.

**Vor dem Schließen exportieren:** Die Sammlung liegt nur im Arbeitsspeicher. Originaldateien werden nicht verändert. Die letzten 15 Änderungen lassen sich rückgängig machen.

## Grenzen

- Komprimierte Firefox-Sicherungen (`.jsonlz4`) werden nicht unterstützt. Stattdessen unkomprimiertes JSON oder HTML verwenden.
- Die Werkstatt-JSON ist kein Firefox-Wiederherstellungsformat; für Firefox HTML exportieren.
- Übernommen werden URLs, Titel, Ordner, Tags und vorhandene Erstellungszeitpunkte. Favicons, Separatoren, Beschreibungen und weitere browserspezifische Metadaten werden nicht übernommen.
- Spezielle Browserordner wie die Lesezeichenleiste werden als normale Ordner übernommen. Unterschiedliche Namen (etwa „Bookmarks bar“ und „Lesezeichen-Symbolleiste“) werden nicht automatisch gleichgesetzt.
- Ein `/` trennt beim Eingeben neuer Ordnerpfade Unterordner. Vorhandene Ordnernamen werden beim Import unverändert übernommen.
- Die Sortierung betrifft die Ansicht. Exportiert werden alle Einträge, nach Ordnern gruppiert.
- Es gibt keine automatische Erreichbarkeitsprüfung. Nur HTTP-/HTTPS-Lesezeichen sind direkt anklickbar; andere URL-Schemata bleiben als Daten erhalten.
- Maximal 50 MB pro Importdatei. Sehr große Sammlungen können den Browser belasten.

## Tests

`tests/test.html` im Browser öffnen: Parser, Chromium-HTML inklusive Lesezeichenleiste, gemischte HTML-/JSON-Importdaten, Ordnerstruktur, JSON-Tags, HTML-/JSON-Roundtrips, Duplikatregeln und Escaping.

Für `tests/ui.html` das Projekt über den oben genannten lokalen Server öffnen. Der Integrationstest prüft Mehrfachimport, Suche, Duplikatauswahl/-entfernung, Rückgängig, Verschieben, Bearbeiten und Exportdialog.
