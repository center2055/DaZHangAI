import os
import random
import csv
import json
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
from collections import Counter

app = Flask(__name__)
# Vereinfachte und robustere CORS-Konfiguration für die Entwicklung
CORS(app, origins=["http://localhost:3000", "http://localhost:3001"])

WORDLISTS_DIR = os.path.join(os.path.dirname(__file__), 'word_lists')
USER_PROFILES_FILE = os.path.join(os.path.dirname(__file__), 'user_profiles.json')

# --- User Profile Management ---
def load_user_profiles():
    if not os.path.exists(USER_PROFILES_FILE):
        return {}
    with open(USER_PROFILES_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_user_profiles(profiles):
    with open(USER_PROFILES_FILE, 'w', encoding='utf-8') as f:
        json.dump(profiles, f, indent=2)

def get_user_profile(user_id='default_user'):
    profiles = load_user_profiles()
    return profiles.get(user_id, {
        "seen_words": [],
        "failed_words": {}, # word: { count: N, next_review: ISO_timestamp }
        "problem_letters": []
    })

def update_user_profile(user_id, profile_data):
    profiles = load_user_profiles()
    profiles[user_id] = profile_data
    save_user_profiles(profiles)

# --- Word List Management ---
def get_words(level='a1'):
    safe_level = ''.join(filter(str.isalnum, level))
    filepath = os.path.join(WORDLISTS_DIR, f"{safe_level}.json")

    if not os.path.exists(filepath):
        # Wenn die Zieldatei nicht existiert, falle auf a1 zurück
        filepath = os.path.join(WORDLISTS_DIR, 'a1.json')

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            words = data.get('words', [])
            if words: # Sicherstellen, dass die Liste nicht leer ist
                return words
    except (json.JSONDecodeError, IOError):
        # Bei Lesefehler oder JSON-Fehler, ebenfalls auf a1 zurückgreifen
        pass

    # Fallback zum Laden von a1, falls der erste Versuch fehlschlägt
    try:
        filepath_a1 = os.path.join(WORDLISTS_DIR, 'a1.json')
        with open(filepath_a1, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('words', [])
    except (json.JSONDecodeError, IOError):
        # Wenn selbst a1 fehlschlägt, eine leere Liste zurückgeben (wird unten behandelt)
        return []

@app.route('/api/word')
def get_word():
    level = request.args.get('level', default='a1', type=str)
    use_model = request.args.get('use_model', default='false', type=str).lower() == 'true'
    user_id = 'default_user'

    profile = get_user_profile(user_id)
    now = datetime.now(timezone.utc)

    # 1. Priorität: Spaced Repetition - fällige Wörter wiederholen
    due_words = [
        word for word, data in profile['failed_words'].items()
        if now >= datetime.fromisoformat(data['next_review'])
    ]
    
    all_words_data = get_words(level)

    if due_words:
        word_to_review = random.choice(due_words)
        # Finde die vollen Wortdaten für das zu wiederholende Wort
        word_data = next((item for item in all_words_data if item['word'] == word_to_review), None)
        if word_data:
            return jsonify(word_data)

    # 2. Priorität: KI-Training mit Problembuchstaben (falls aktiviert)
    if use_model:
        problem_letters = profile.get('problem_letters', [])
        if problem_letters:
            candidate_words = [
                item for item in all_words_data
                if any(char in item['word'].lower() for char in problem_letters) and item['word'] not in profile['seen_words']
            ]
            if candidate_words:
                word_data = random.choice(candidate_words)
                return jsonify(word_data)

    # 3. Priorität: Ein zufälliges, noch nicht gesehenes Wort vom gewählten Level
    unseen_words = [item for item in all_words_data if item['word'] not in profile['seen_words']]
    if unseen_words:
        word_data = random.choice(unseen_words)
        return jsonify(word_data)
        
    # 4. Fallback: Wenn alle Wörter des Levels gesehen wurden, ein zufälliges Wort
    if all_words_data:
        word_data = random.choice(all_words_data)
        return jsonify(word_data)

    # 5. Absoluter Notfall-Fallback, falls alles andere fehlschlägt
    return jsonify({"word": "software", "type": "Nomen", "category": "Technik"})

@app.route('/api/hint')
def get_hint():
    word_to_find = request.args.get('word', default='', type=str)
    if not word_to_find:
        return jsonify({'hint': 'Kein Wort angegeben.'}), 400

    # Durchsuche alle Wortlisten nach dem Wort, um die Metadaten zu finden
    for level in ['a1', 'a2', 'b1']:
        all_words_data = get_words(level)
        for word_data in all_words_data:
            if word_data['word'].lower() == word_to_find.lower():
                hint = f"Tipp: Es ist ein {word_data['type']} aus der Kategorie '{word_data['category']}'."
                return jsonify({'hint': hint})

    return jsonify({'hint': 'Zu diesem Wort konnte kein Tipp gefunden werden.'}), 404


@app.route('/api/feedback')
def get_feedback():
    user_id = request.args.get('user_id', 'default_user')
    profile = get_user_profile(user_id)
    
    problem_letters = profile.get('problem_letters')
    if not problem_letters:
        return jsonify({'feedback': None})

    feedback_message = f"Gut gespielt! Mir ist aufgefallen, dass du manchmal mit den Buchstaben {', '.join(problem_letters)} Schwierigkeiten hast. Im KI-Trainingsmodus können wir das gezielt üben."
    return jsonify({'feedback': feedback_message})


@app.route('/api/log_guess', methods=['POST'])
def log_guess():
    data = request.get_json()
    log_entry = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'word': data.get('word'),
        'guessed_letter': data.get('letter'),
        'is_correct': data.get('isCorrect')
    }
    
    log_file = os.path.join(os.path.dirname(__file__), 'guess_log.csv')
    
    # Schreibe den Header, wenn die Datei neu ist
    write_header = not os.path.exists(log_file)
    
    with open(log_file, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=log_entry.keys())
        if write_header:
            writer.writeheader()
        writer.writerow(log_entry)
        
    return jsonify({'success': True}), 201


# Neuer Endpunkt zum Protokollieren des gesamten Spiels
@app.route('/api/log_game', methods=['POST'])
def log_game():
    data = request.get_json()
    word = data.get('word')
    was_successful = data.get('wasSuccessful')
    user_id = 'default_user' # Hardcoded für den Moment

    # Update des Nutzerprofils
    profile = get_user_profile(user_id)
    
    # Füge das Wort zur Liste der gesehenen Wörter hinzu
    if word not in profile['seen_words']:
        profile['seen_words'].append(word)

    if not was_successful:
        # Wenn das Wort falsch war, füge es zu den failed_words hinzu oder aktualisiere es
        failure_count = profile['failed_words'].get(word, {}).get('count', 0) + 1
        profile['failed_words'][word] = {
            "count": failure_count,
            # Nächste Wiederholung in 2^N Tagen (einfacher Spaced Repetition Algorithmus)
            "next_review": (datetime.now(timezone.utc) + timedelta(days=2**failure_count)).isoformat()
        }

    # Dynamische Analyse der Problembuchstaben
    all_failed_letters = "".join(profile['failed_words'].keys())
    if all_failed_letters:
        letter_counts = Counter(all_failed_letters)
        # Nimm die 5 häufigsten Problembuchstaben
        profile['problem_letters'] = [letter for letter, count in letter_counts.most_common(5)]

    update_user_profile(user_id, profile)
    
    # Logge das Spielereignis in die CSV-Datei (kann für globale Analysen nützlich bleiben)
    log_entry = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'user_id': user_id,
        'word': word,
        'wrong_guesses': data.get('wrongGuesses'),
        'was_successful': was_successful
    }
    
    log_file = os.path.join(os.path.dirname(__file__), 'game_log.csv')
    
    # Schreibe den Header, wenn die Datei neu ist
    write_header = not os.path.exists(log_file)
    
    with open(log_file, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=log_entry.keys())
        if write_header:
            writer.writeheader()
        writer.writerow(log_entry)
        
    return jsonify({'success': True, 'problem_letters': profile.get('problem_letters', [])}), 201

# Simuliert eine einfache Benutzerdatenbank. In einer echten Anwendung wäre dies eine Datenbank.
# Das Passwort für 'admin' ist 'password'. Der Hash wurde mit generate_password_hash('password') erstellt.
users = {
    "admin": {
        "hash": "pbkdf2:sha256:600000$cMoKRRyCI3bwXDEp$79414674ac973a8a313e6e8e826b52825d14b301721543ab763133606ad4de48"
    }
}

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = users.get(username)

    if user and check_password_hash(user['hash'], password):
        # In einer echten App würden Sie hier einen Session-Token oder JWT zurückgeben.
        return jsonify({'success': True, 'message': 'Login successful'})
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401


if __name__ == '__main__':
    # 'use_reloader=False' behebt den OSError unter Windows
    app.run(debug=True, use_reloader=False) 