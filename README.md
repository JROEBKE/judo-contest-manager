# Judo Contest Manager

Eine statische Web-App zur Verwaltung eines Judo-Mannschaftsturniers mit bis zu zehn Mannschaften und ein bis vier Matten (Standard: zwei). Es wird kein Build-Schritt benötigt.

## Starten

Das Projektverzeichnis über einen lokalen Webserver öffnen, zum Beispiel:

```sh
python3 -m http.server 8000
```

Anschließend `http://localhost:8000` im Browser aufrufen. Ein Webserver ist erforderlich, damit der Service Worker funktioniert; `localhost` gilt hierfür als sicherer Kontext.

## Turnier verwalten

1. Mannschafts- und Mattenanzahl auswählen, Mannschaften anlegen und Namen speichern. Die Mattenanzahl wird für neu erstellte Begegnungen verwendet.
2. Optional einen Turniertitel eingeben.
3. **Begegnungen erstellen** auswählen. Bei zwei bis vier Mannschaften wird eine Hin- und Rückrunde erzeugt; ab fünf Mannschaften eine einfache Runde, verteilt auf zwei Wettkampftage.
4. Ergebnisse eintragen und speichern. Die Rangliste berücksichtigt gespeicherte Ergebnisse.
5. Über die Navigation zwischen Mannschaften, Wettkampftagen und Rangliste wechseln oder die Bereiche ein- und ausklappen.

Der Turnierstand wird lokal im Browser gespeichert. **Backup speichern** lädt eine JSON-Datei herunter; über **Datei hochladen** kann ein Backup wiederhergestellt werden. Ältere Turnierdaten werden beim Laden auf das aktuelle Datenformat migriert; für sie gilt die bisherige Standardbelegung mit zwei Matten.

## Offlinebetrieb

Nach einem Online-Aufruf cached der Service Worker die App-Dateien und Icons. Danach kann die App auch ohne Netzwerkverbindung geöffnet werden. Turnierdaten werden nicht im Cache, sondern im lokalen Browser-Speicher abgelegt; für eine Übertragung auf ein anderes Gerät ein Backup verwenden.

Neue Service-Worker-Versionen werden im Hintergrund installiert und aktiviert. Die laufende Seite wird dabei nicht automatisch neu geladen. Die App zeigt einen Hinweis an; **Nach Kampfende neu laden** lädt den bestätigenden Tab neu.

## Tests

Voraussetzung ist Node.js 18 oder neuer mit integriertem Test-Runner. Tests ohne zusätzliche Pakete ausführen:

```sh
node --test tests/*.test.js
```

Die Tests decken Ranglisten-Fixtures, Spielplangenerierung, Datenmigration und -validierung, Backup-Import, Offline-Fallback und Navigation ab.
