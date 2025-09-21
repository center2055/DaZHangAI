# DaZHangAI - Intelligentes Galgenmännchen-Spiel

> **Hinweis:** Dieses Projekt wird im Rahmen des [Bundeswettbewerbs Künstliche Intelligenz (BWKI)](https://www.bw-ki.de/) entwickelt. Das Ziel ist es, mit KI die Welt ein Stückchen besser zu machen – in diesem Fall, indem das Sprachenlernen effektiver und persönlicher gestaltet wird. Der BWKI motiviert junge Talente, ihre eigenen Ideen im Bereich der KI umzusetzen und innovative Lösungen für reale Probleme zu schaffen.

DaZHangAI ist eine interaktive Webanwendung, die das klassische Galgenmännchen-Spiel mit intelligenten Funktionen erweitert, um den Lernfortschritt von Sprachschülern zu optimieren. Die Anwendung wurde mit React im Frontend und Flask im Backend entwickelt.

## Inhaltsverzeichnis

- [Funktionen](#funktionen)
- [Technologien](#technologien)
- [Systemarchitektur](#systemarchitektur)
- [Installation](#installation)
- [Ausführung](#ausführung)

## Funktionen

### Für Schüler

- **Adaptives Gameplay**: Die App passt den Schwierigkeitsgrad der Wörter basierend auf dem Niveau des Schülers an (A1, A2, B1, etc.).
- **Einstufungstest**: Neue Schüler absolvieren einen kurzen Test, um ihr anfängliches Sprachniveau zu bestimmen.
- **Personalisiertes Training**:
    - **Spaced Repetition**: Wörter, die zuvor falsch geraten wurden, werden in zunehmenden Zeitabständen wiederholt, um das Langzeitgedächtnis zu fördern.
    - **KI-Modus**: Ein optionaler Modus, der Wörter vorschlägt, die die "Problembuchstaben" des Schülers enthalten, um gezielt an Schwächen zu arbeiten.
    - **Analyse von Wortarten**: Das System erkennt, wenn ein Schüler Schwierigkeiten mit bestimmten Wortarten (z.B. Nomen, Verben) hat und bietet entsprechende Übungen an.
- **Visuelles Feedback**: Nach jeder Runde erhält der Spieler eine Zusammenfassung und optionales Feedback zu seinen Problembuchstaben.
- **Dark Mode**: Ein augenfreundlicher dunkler Modus ist verfügbar.

### Für Lehrer

- **Lehrer-Dashboard**: Eine zentrale Ansicht zur Verwaltung aller Schüler.
- **Schüler-Monitoring**: Lehrer können den Fortschritt jedes Schülers einsehen, einschließlich:
    - Gesehene Wörter
    - Falsch geratene Wörter
    - Problembuchstaben und -wortarten
- **Benutzerverwaltung**: Lehrer können Schülerprofile löschen.

## Technologien

### Backend

- **Sprache**: Python
- **Framework**: Flask
- **Datenbank**: SQLite mit Flask-SQLAlchemy
- **Authentifizierung**: JWT (JSON Web Tokens) für sichere API-Kommunikation.
- **CORS**: Flask-Cors zur Handhabung von Cross-Origin-Anfragen.
- **Weitere Bibliotheken**: `werkzeug` (Passwort-Hashing), `python-dotenv` (Umgebungsvariablen).

### Frontend

- **Sprache**: TypeScript
- **Framework**: React
- **Routing**: React Router
- **Styling**: CSS mit Unterstützung für Dark Mode.
- **API-Kommunikation**: `fetch` API.

## Systemarchitektur

Die Anwendung folgt einer klassischen Client-Server-Architektur:

- **Frontend**: Eine in React geschriebene Single-Page-Application (SPA), die im Browser des Benutzers läuft. Sie ist verantwortlich für die Benutzeroberfläche, die Interaktionslogik und die Kommunikation mit dem Backend.
- **Backend**: Ein in Flask geschriebener REST-API-Server. Er übernimmt die Geschäftslogik, einschließlich Benutzerauthentifizierung, Wortmanagement, Speicherung von Lernfortschritten und Bereitstellung von Daten für das Lehrer-Dashboard.
- **Datenbank**: Eine SQLite-Datenbank speichert Benutzerdaten (Anmeldeinformationen, Rollen, Niveaus) und Schülerprofile (gesehene Wörter, Fehler, etc.).
- **Wortlisten**: Die Wörter für das Spiel sind in JSON-Dateien (`a1.json`, `a2.json`, etc.) nach Sprachniveau organisiert.

## Installation

Folgen Sie diesen Schritten, um das Projekt lokal einzurichten:

### Voraussetzungen

- [Node.js](https://nodejs.org/) (inkl. npm)
- [Python 3](https://www.python.org/downloads/)

### Backend-Setup

1.  **Navigieren Sie zum Backend-Verzeichnis:**
    `cd backend`

2.  **Erstellen Sie eine virtuelle Umgebung:**
    `python -m venv venv`

3.  **Aktivieren Sie die virtuelle Umgebung:**
    - Windows: `venv\Scripts\activate`
    - macOS/Linux: `source venv/bin/activate`

4.  **Installieren Sie die Python-Abhängigkeiten:**
    `pip install -r requirements.txt`

5.  **Initialisieren Sie die Datenbank:**
    Öffnen Sie eine Python-Konsole im Backend-Verzeichnis (`python`) und führen Sie aus:
    from app import init_db
    init_db()
    exit()

### Frontend-Setup

1.  **Navigieren Sie zum Frontend-Verzeichnis:**
    `cd ../frontend`

2.  **Installieren Sie die Node.js-Abhängigkeiten:**
    `npm install`

## Ausführung

Um die Anwendung zu starten, müssen sowohl der Backend-Server als auch der Frontend-Entwicklungsserver laufen.

### Backend starten

1.  Stellen Sie sicher, dass Sie sich im `backend`-Verzeichnis befinden und die virtuelle Umgebung aktiviert ist.
2.  Führen Sie den Flask-Server aus:
    `flask run`

Der Server läuft standardmäßig auf `http://127.0.0.1:5000`.

### Frontend starten

1.  Öffnen Sie ein **neues** Terminal.
2.  Navigieren Sie zum `frontend`-Verzeichnis.
3.  Starten Sie den React-Entwicklungsserver:
    `npm start`

Die Anwendung wird automatisch in Ihrem Browser unter `http://localhost:3000` geöffnet.

### Demo-Hinweis (BWKI 2025)

- Für Jury-Demos existiert ein Lehrer-Konto:
  - Benutzer: `Lehrer`
  - Passwort: `BWKI2025!`
- Dieses Konto ist rein für Demonstrationszwecke. Es dient zur Ansicht des Lehrer-Dashboards und ist nicht zum Spielen gedacht.
- Beim Push auf GitHub soll ausschließlich der Benutzer `Lehrer` bestehen bleiben; weitere Testkonten werden entfernt.

## Deployment

To deploy this application to a production environment:

1. **Backend**: Use Gunicorn as the WSGI server. Install it with `pip install gunicorn` and run `gunicorn -w 4 -b 0.0.0.0:8000 app:app`.

2. **Frontend**: Build the React app with `npm run build` in the frontend directory. Serve the build folder statically (e.g., via NGINX).

3. **Database**: For production, consider migrating from SQLite to PostgreSQL for better scalability.

4. **Environment**: Set up environment variables in a .env file or server config, especially for SECRET_KEY.

5. **Docker**: (Optional) Create a Dockerfile for containerization.

---

Viel Spaß beim Lernen und Lehren mit DaZHangAI! 