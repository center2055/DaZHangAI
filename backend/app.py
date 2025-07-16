import os
import random
import csv
import json
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash
from collections import Counter
from functools import wraps
import jwt
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='../frontend/build')
app.config['SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'a-fallback-secret-key-for-dev')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Database Models ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='student')
    level = db.Column(db.String(10))
    # Beziehung zu UserProfile
    profile = db.relationship('UserProfile', backref='user', uselist=False, cascade="all, delete-orphan")

class UserProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    seen_words = db.Column(db.JSON, default=list)
    failed_words = db.Column(db.JSON, default=dict)
    problem_letters = db.Column(db.JSON, default=list)
    failed_word_types = db.Column(db.JSON, default=dict)


# Vereinfachte und robustere CORS-Konfiguration für die Entwicklung
CORS(app) # Enable CORS for all routes

WORDLISTS_DIR = os.path.join(os.path.dirname(__file__), 'word_lists')
# Die folgenden Dateien werden nicht mehr verwendet
# USER_PROFILES_FILE = os.path.join(os.path.dirname(__file__), 'user_profiles.json')

# --- User Profile Management (jetzt über DB) ---
def get_user_profile(user_id):
    user = User.query.filter_by(id=user_id).first()
    if user and user.profile:
        return user.profile
    # Erstelle ein Profil, falls es nicht existiert
    profile = UserProfile(user_id=user_id)
    db.session.add(profile)
    db.session.commit()
    return profile

# update_user_profile wird durch direkte Zuweisung und db.session.commit() ersetzt

def create_token_required_decorator(f, check_teacher=False):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            # user_id statt username verwenden
            current_user = User.query.get(data['user_id'])
            
            if current_user is None:
                return jsonify({'message': 'User not found!'}), 401
            
            # Überprüfen, ob der Benutzer die Lehrerrolle hat
            if check_teacher and current_user.role != 'teacher':
                return jsonify({'message': 'Admin rights required!'}), 403

        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401

        return f(current_user, *args, **kwargs)

    return decorated

def teacher_token_required(f):
    return create_token_required_decorator(f, check_teacher=True)

def user_token_required(f):
    return create_token_required_decorator(f, check_teacher=False)

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
@user_token_required
def get_word(current_user):
    level = request.args.get('level', default='a1', type=str)
    use_model = request.args.get('use_model', default='false', type=str).lower() == 'true'
    user_id = current_user.id

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

    # 2. Priorität: Gezieltes Training von Problem-Wortarten
    failed_types = profile.get('failed_word_types', {})
    if failed_types:
        # Finde die problematischste Wortart (die mit den meisten Fehlern)
        problem_type = max(failed_types, key=failed_types.get)
        # Bedingung: mehr als 3 Fehler und es ist ein klares Problemfeld
        if failed_types[problem_type] > 3:
            candidate_words = [
                item for item in all_words_data
                if item.get('type') == problem_type and item['word'] not in profile['seen_words']
            ]
            if candidate_words:
                word_data = random.choice(candidate_words)
                return jsonify(word_data)

    # 3. Priorität: KI-Training mit Problembuchstaben (falls aktiviert)
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

    # 4. Priorität: Ein zufälliges, noch nicht gesehenes Wort vom gewählten Level
    unseen_words = [item for item in all_words_data if item['word'] not in profile['seen_words']]
    if unseen_words:
        word_data = random.choice(unseen_words)
        return jsonify(word_data)
        
    # 5. Fallback: Wenn alle Wörter des Levels gesehen wurden, ein zufälliges Wort
    if all_words_data:
        word_data = random.choice(all_words_data)
        return jsonify(word_data)

    # 6. Absoluter Notfall-Fallback, falls alles andere fehlschlägt
    return jsonify({"word": "software", "type": "Nomen", "category": "Technik"})

@app.route('/api/hint')
def get_hint():
    word_to_find = request.args.get('word', default='', type=str)
    if not word_to_find:
        return jsonify({'hint': 'Kein Wort angegeben.'}), 400

    # Durchsuche alle Wortlisten nach dem Wort, um die Metadaten zu finden
    for level in ['a1', 'a2', 'b1', 'b2', 'c1']:
        all_words_data = get_words(level)
        for word_data in all_words_data:
            if word_data['word'].lower() == word_to_find.lower():
                hint = f"Tipp: Es ist ein {word_data['type']} aus der Kategorie '{word_data['category']}'."
                return jsonify({'hint': hint})

    return jsonify({'hint': 'Zu diesem Wort konnte kein Tipp gefunden werden.'}), 404


@app.route('/api/feedback')
@user_token_required
def get_feedback(current_user):
    user_id = current_user.id
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
@user_token_required
def log_game(current_user):
    data = request.get_json()
    word = data.get('word')
    word_type = data.get('wordType') # Neu: Wortart vom Frontend empfangen
    was_successful = data.get('wasSuccessful')
    user_id = current_user.id

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
        # Zähle den Fehler für die Wortart
        if word_type:
            profile['failed_word_types'][word_type] = profile['failed_word_types'].get(word_type, 0) + 1

    # Dynamische Analyse der Problembuchstaben
    all_failed_letters = "".join(profile['failed_words'].keys())
    if all_failed_letters:
        letter_counts = Counter(all_failed_letters)
        # Nimm die 5 häufigsten Problembuchstaben
        profile['problem_letters'] = [letter for letter, count in letter_counts.most_common(5)]

    # update_user_profile(user_id, profile) # Diese Zeile wird durch db.session.commit() ersetzt
    db.session.commit() # Speichere die Änderungen im Profil
    
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

# --- V2 AUTH AND MULTI-USER SYSTEM ---

# USERS_DB_FILE = os.path.join(os.path.dirname(__file__), 'users.json') # Removed as per new_code

# def load_users(): # Removed as per new_code
#     if not os.path.exists(USERS_DB_FILE): # Removed as per new_code
#         teacher_hash = "scrypt:32768:8:1$i1KBgWulYW0KMQbW$763fae0314639b3937d0e537a4fe90c42bae16fcb576ef10dd685d6d3a91bae87c8d3220236606cb1413ea6dfc8fb5d1b4df7061ae1a563d84e14b62dabe6619" # Removed as per new_code
#         initial_data = { # Removed as per new_code
#             "users": [ # Removed as per new_code
#                 {"username": "Lehrer", "hash": teacher_hash, "role": "teacher"} # Removed as per new_code
#             ] # Removed as per new_code
#         } # Removed as per new_code
#         save_users(initial_data) # Removed as per new_code
#         return initial_data # Removed as per new_code
#     with open(USERS_DB_FILE, 'r', encoding='utf-8') as f: # Removed as per new_code
#         return json.load(f) # Removed as per new_code

# def save_users(users_data): # Removed as per new_code
#     with open(USERS_DB_FILE, 'w', encoding='utf-8') as f: # Removed as per new_code
#         json.dump(users_data, f, indent=2) # Removed as per new_code

# --- V2 PLACEMENT TEST ---
@app.route('/api/placement-test/questions')
def get_placement_test_questions():
    """
    Stellt eine feste Liste von Wörtern für den Einstufungstest bereit.
    Die Wörter sind nach ansteigendem Schwierigkeitsgrad geordnet.
    """
    test_words = [
        # A1 Level
        {"word": "Apfel", "type": "Nomen", "category": "Essen"},
        {"word": "Haus", "type": "Nomen", "category": "Wohnen"},
        {"word": "schwimmen", "type": "Verb", "category": "Freizeit"},
        {"word": "groß", "type": "Adjektiv", "category": "Beschreibung"},
        {"word": "die Familie", "type": "Nomen", "category": "Person"},
        # A2 Level
        {"word": "der Ausweis", "type": "Nomen", "category": "Alltag"},
        {"word": "berühmt", "type": "Adjektiv", "category": "Person"},
        {"word": "der Bahnhof", "type": "Nomen", "category": "Reisen"},
        {"word": "erklären", "type": "Verb", "category": "Kommunikation"},
        {"word": "die Mannschaft", "type": "Nomen", "category": "Freizeit"},
        # B1 Level
        {"word": "die Fähigkeit", "type": "Nomen", "category": "Person"},
        {"word": "beeinflussen", "type": "Verb", "category": "Person"},
        {"word": "die Umweltverschmutzung", "type": "Nomen", "category": "Umwelt"},
        {"word": "verantwortlich", "type": "Adjektiv", "category": "Arbeit"},
        {"word": "die Gesellschaft", "type": "Nomen", "category": "Gesellschaft"},
        # B2 Level
        {"word": "die Voraussetzung", "type": "Nomen", "category": "Ausbildung"},
        {"word": "wissenschaftlich", "type": "Adjektiv", "category": "Ausbildung"},
        {"word": "die Wirtschaft", "type": "Nomen", "category": "Wirtschaft"},
        {"word": "komplex", "type": "Adjektiv", "category": "Beschreibung"},
        {"word": "die Herausforderung", "type": "Nomen", "category": "Gesellschaft"}
    ]
    return jsonify(test_words)


@app.route('/api/placement-test/submit', methods=['POST'])
@user_token_required
def submit_placement_test(current_user):
    data = request.get_json()
    correct_answers = data.get('correct_answers', 0)
    total_questions = data.get('total_questions', 1)
    
    # Hier einfache Logik zur Bestimmung des Levels
    score = (correct_answers / total_questions) * 100
    if score >= 80:
        level = 'b1'
    elif score >= 50:
        level = 'a2'
    else:
        level = 'a1'
        
    # Speichere das Level im Profil des Benutzers
    current_user.level = level
    db.session.commit()

    return jsonify({'level': level})


@app.route('/api/v2/login', methods=['POST'])
def login_v2():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'message': 'Username or password missing'}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'message': 'Invalid credentials'}), 401
    
    token = jwt.encode({
        'user_id': user.id, # ID statt Username für mehr Robustheit
        'username': user.username,
        'role': user.role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")

    return jsonify({
        'message': 'Login successful',
        'user': {
            'username': user.username,
            'role': user.role,
            'level': user.level
        },
        'token': token
    })

@app.route('/api/v2/register', methods=['POST'])
def register_v2():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'student')

    if not username or not password:
        return jsonify({'message': 'Username or password missing'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'User already exists'}), 409
    
    new_user = User(
        username=username,
        password_hash=generate_password_hash(password),
        role=role
    )
    db.session.add(new_user)
    db.session.commit()

    # Erstelle ein leeres Profil für den neuen Benutzer
    new_profile = UserProfile(user_id=new_user.id)
    db.session.add(new_profile)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully'}), 201


@app.route('/api/v2/students_data')
@teacher_token_required
def get_students_data_v2(current_user):
    students = User.query.filter_by(role='student').all()
    student_data = []
    for student in students:
        profile = student.profile
        student_data.append({
            'username': student.username,
            'level': student.level,
            'progress': {
                'seen_words': len(profile.seen_words) if profile else 0,
                'failed_words': len(profile.failed_words) if profile else 0,
                'problem_letters': profile.problem_letters if profile else [],
                'failed_word_types': profile.failed_word_types if profile else {}
            }
        })
    return jsonify(student_data)


@app.route('/api/v2/user/<string:username>', methods=['DELETE'])
@teacher_token_required
def delete_user_v2(current_user, username):
    if username == current_user.username:
        return jsonify({'message': 'A teacher cannot delete their own account.'}), 403

    user_to_delete = User.query.filter_by(username=username).first()

    if not user_to_delete:
        return jsonify({'message': 'User not found'}), 404

    db.session.delete(user_to_delete)
    db.session.commit()

    return jsonify({'message': f'User {username} deleted successfully'}), 200

# Serve React App
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder = app.static_folder or ''
    if path != "" and os.path.exists(os.path.join(static_folder, path)):
        return send_from_directory(static_folder, path)
    else:
        return send_from_directory(static_folder, 'index.html')

def init_db():
    with app.app_context():
        db.create_all()
        # Optional: Hier könnten Standard-User oder -Wortlisten hinzugefügt werden

if __name__ == '__main__':
    init_db()
    app.run(debug=True) 