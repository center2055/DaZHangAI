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
from sqlalchemy.ext.mutable import MutableDict, MutableList

load_dotenv()

app = Flask(__name__, static_folder='../frontend/build')
# Secrets and DB
app.config['SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'a-fallback-secret-key-for-dev')
# Use absolute SQLite path to avoid CWD surprises
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(BASE_DIR, 'database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Fail fast in non-development if no proper secret key is configured
if os.environ.get('FLASK_ENV', 'development') != 'development' and app.config['SECRET_KEY'] == 'a-fallback-secret-key-for-dev':
    raise RuntimeError("JWT_SECRET_KEY environment variable must be set in non-development environments.")

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
    seen_words = db.Column(MutableList.as_mutable(db.JSON), default=list)
    failed_words = db.Column(MutableDict.as_mutable(db.JSON), default=dict)
    problem_letters = db.Column(MutableList.as_mutable(db.JSON), default=list)
    failed_word_types = db.Column(MutableDict.as_mutable(db.JSON), default=dict)
    # New: Adaptive difficulty modifier, default 1.0
    difficulty_modifier = db.Column(db.Float, nullable=False, default=1.0)
    # Hint credits economy
    hint_credits = db.Column(db.Integer, nullable=False, default=0)
    wins_since_last_hint = db.Column(db.Integer, nullable=False, default=0)

# New: Persisted game logs for statistics and analysis
class GameLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    word = db.Column(db.String(200), nullable=False)
    was_successful = db.Column(db.Boolean, nullable=False)
    wrong_guesses = db.Column(db.Integer, nullable=False, default=0)
    # Store wrong letters per game for letter-level analytics
    wrong_letters = db.Column(MutableList.as_mutable(db.JSON), default=list)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.now(timezone.utc))


# CORS: be permissive in development, restrict otherwise
frontend_origin = os.environ.get('CORS_ORIGIN', 'http://localhost:3000')
if os.environ.get('FLASK_ENV', 'development') == 'development':
    CORS(app) # Enable CORS for all routes in development
else:
    CORS(app, resources={r"/api/*": {"origins": frontend_origin}, r"/api/v2/*": {"origins": frontend_origin}})

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
        auth_header = request.headers.get('Authorization', '')
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]

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
# Cache for word lists
word_cache = {}
word_cache_meta = {}

def get_words(level='a1'):
    file_path = os.path.join(WORDLISTS_DIR, f'{level}.json')
    # Smart cache invalidation based on file mtime
    try:
        current_mtime = os.path.getmtime(file_path)
    except FileNotFoundError:
        current_mtime = None

    if level in word_cache and word_cache_meta.get(level) == current_mtime:
        return word_cache[level]
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            words_data = json.load(f)
        
        # Process words to separate articles from nouns
        if 'words' in words_data:
            processed_words = []
            for word_data in words_data['words']:
                clean_word, article = separate_article_from_noun(word_data['word'])
                
                processed_word = {
                    'word': clean_word,
                    'type': word_data['type'],
                    'category': word_data['category']
                }
                
                # If it's a noun with an article, include the article in the category display
                if article and word_data['type'] == 'Nomen':
                    processed_word['category'] = f"{word_data['category']} ({article})"
                
                processed_words.append(processed_word)
            
            words_data['words'] = processed_words
        
        word_cache[level] = words_data
        word_cache_meta[level] = current_mtime
        return words_data
    except FileNotFoundError:
        print(f"Warning: Word list for level {level} not found.")
        return []

def generate_game_hints(word, level, difficulty_modifier=1.0, training_letters=None):
    """
    Generate initial hints for a hangman game based on word difficulty, length, and a dynamic modifier.
    If training_letters are provided, avoid revealing these letters and prefer not excluding them so the
    learner can practice them.
    Returns dict with pre_revealed_letters and excluded_letters.
    """
    word_lower = word.lower()
    word_length = len(word_lower)
    training_letters = set([c.lower() for c in training_letters]) if training_letters else set()
    
    # Define difficulty based on level and word length
    if level in ['a1', 'a2']:
        difficulty = 'easy'
    elif level in ['b1']:
        difficulty = 'medium'
    else:
        difficulty = 'hard'
    
    # Adjust difficulty based on word length
    if word_length > 10:
        if difficulty == 'easy':
            difficulty = 'medium'
        elif difficulty == 'medium':
            difficulty = 'hard'
    
    # Determine base number of letters to reveal and exclude
    if difficulty == 'easy':
        base_reveal = max(1, word_length // 4)
        base_exclude = min(8, 26 - len(set(word_lower)))
    elif difficulty == 'medium':
        base_reveal = max(1, word_length // 5)
        base_exclude = min(6, 26 - len(set(word_lower)))
    else:  # hard
        base_reveal = max(1, word_length // 6)
        base_exclude = min(4, 26 - len(set(word_lower)))

    # Apply the difficulty modifier, ensuring at least one letter is revealed and not too many are excluded
    reveal_count = min(word_length - 1, max(1, round(base_reveal * difficulty_modifier)))
    exclude_count = min(20, max(0, round(base_exclude * difficulty_modifier)))
    
    # Get unique letters in the word
    word_letters = set(word_lower)
    
    # Select letters to pre-reveal (prefer vowels and common letters)
    vowels = set('aeiouäöü')
    common_consonants = set('nrtsm')
    
    # Prioritize vowels first, then common consonants
    letters_to_reveal = []
    available_vowels = (word_letters & vowels) - training_letters
    available_consonants = (word_letters & common_consonants) - training_letters
    remaining_letters = (word_letters - vowels - common_consonants) - training_letters
    
    # Add vowels first
    # Deterministic order for UI stability
    letters_to_reveal.extend(sorted(list(available_vowels))[:reveal_count])
    
    # Add common consonants if we need more
    if len(letters_to_reveal) < reveal_count:
        needed = reveal_count - len(letters_to_reveal)
        letters_to_reveal.extend(sorted(list(available_consonants))[:needed])
    
    # Add remaining letters if still needed
    if len(letters_to_reveal) < reveal_count:
        needed = reveal_count - len(letters_to_reveal)
        letters_to_reveal.extend(sorted(list(remaining_letters))[:needed])

    # If still not enough (e.g., training letters cover almost all), allow from the rest excluding duplicates
    if len(letters_to_reveal) < reveal_count:
        needed = reveal_count - len(letters_to_reveal)
        fallback_letters = sorted(list(word_letters - set(letters_to_reveal)))
        letters_to_reveal.extend(fallback_letters[:needed])
    
    # Select letters to exclude (letters not in the word)
    all_letters = set('abcdefghijklmnopqrstuvwxyzäöüß')
    letters_not_in_word = all_letters - word_letters
    
    # Prefer excluding uncommon letters
    uncommon_letters = set('qxyzvjckwpfgbh')
    # Prefer excluding letters the learner is NOT training right now
    exclude_candidates = (letters_not_in_word & uncommon_letters) - training_letters
    
    if len(exclude_candidates) < exclude_count:
        exclude_candidates.update((letters_not_in_word - exclude_candidates) - training_letters)
    
    excluded_letters = sorted(list(exclude_candidates))[:exclude_count]
    
    return {
        'pre_revealed_letters': letters_to_reveal,
        'excluded_letters': excluded_letters
    }

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
        word for word, data in profile.failed_words.items()
        if now >= datetime.fromisoformat(data['next_review'])
    ]
    
    words_response = get_words(level)
    all_words_data = words_response.get('words', []) if isinstance(words_response, dict) else words_response

    if due_words:
        word_to_review = random.choice(due_words)
        # Finde die vollen Wortdaten für das zu wiederholende Wort
        word_data = next((item for item in all_words_data if item['word'] == word_to_review), None)
        if word_data:
            # Add game hints
            hints = generate_game_hints(
                word_data['word'], level, profile.difficulty_modifier,
                training_letters=profile.problem_letters if use_model and profile.problem_letters else None
            )
            word_data.update(hints)
            return jsonify(word_data)

    # 2. Priorität: Gezieltes Training von Problem-Wortarten
    failed_types = profile.failed_word_types
    if failed_types:
        # Finde die problematischste Wortart (die mit den meisten Fehlern)
        problem_type = max(failed_types, key=failed_types.get)
        # Bedingung: mehr als 3 Fehler und es ist ein klares Problemfeld
        if failed_types[problem_type] > 3:
            candidate_words = [
                item for item in all_words_data
                if item.get('type') == problem_type and item['word'] not in profile.seen_words
            ]
            if candidate_words:
                word_data = random.choice(candidate_words)
                # Add game hints
                hints = generate_game_hints(
                    word_data['word'], level, profile.difficulty_modifier,
                    training_letters=profile.problem_letters if use_model and profile.problem_letters else None
                )
                word_data.update(hints)
                return jsonify(word_data)

    # 3. Priorität: KI-Training mit Problembuchstaben (falls aktiviert)
    if use_model:
        problem_letters = profile.problem_letters
        if problem_letters:
            candidate_words = [
                item for item in all_words_data
                if any(char in item['word'].lower() for char in problem_letters) and item['word'] not in profile.seen_words
            ]
            if candidate_words:
                word_data = random.choice(candidate_words)
                # Add game hints
                hints = generate_game_hints(
                    word_data['word'], level, profile.difficulty_modifier,
                    training_letters=profile.problem_letters
                )
                word_data.update(hints)
                return jsonify(word_data)

    # 4. Priorität: Ein zufälliges, noch nicht gesehenes Wort vom gewählten Level
    unseen_words = [item for item in all_words_data if item['word'] not in profile.seen_words]
    if unseen_words:
        word_data = random.choice(unseen_words)
        # Add game hints
        hints = generate_game_hints(
            word_data['word'], level, profile.difficulty_modifier,
            training_letters=profile.problem_letters if use_model and profile.problem_letters else None
        )
        word_data.update(hints)
        return jsonify(word_data)
        
    # 5. Fallback: Wenn alle Wörter des Levels gesehen wurden, ein zufälliges Wort
    if all_words_data:
        word_data = random.choice(all_words_data)
        # Add game hints
        hints = generate_game_hints(
            word_data['word'], level, profile.difficulty_modifier,
            training_letters=profile.problem_letters if use_model and profile.problem_letters else None
        )
        word_data.update(hints)
        return jsonify(word_data)

    # 6. Absoluter Notfall-Fallback, falls alles andere fehlschlägt
    fallback_word = {"word": "software", "type": "Nomen", "category": "Technik"}
    hints = generate_game_hints(
        fallback_word['word'], level, profile.difficulty_modifier,
        training_letters=profile.problem_letters if use_model and profile.problem_letters else None
    )
    fallback_word.update(hints)
    return jsonify(fallback_word)

@app.route('/api/hint')
def get_hint():
    word_to_find = request.args.get('word', default='', type=str)
    if not word_to_find:
        return jsonify({'hint': 'Kein Wort angegeben.'}), 400

    # Durchsuche alle Wortlisten nach dem Wort, um die Metadaten zu finden
    for level in ['a1', 'a2', 'b1', 'b2', 'c1']:
        words_response = get_words(level)
        all_words_data = words_response.get('words', []) if isinstance(words_response, dict) else words_response
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
    
    problem_letters = profile.problem_letters
    # Require sufficient data before giving feedback
    # Aggregate total failures across all failed words
    total_failures = 0
    try:
        total_failures = sum((entry or {}).get('count', 0) for entry in profile.failed_words.values())
    except Exception:
        total_failures = 0

    if not problem_letters or total_failures < 3:
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


@app.route('/api/log_game', methods=['POST'])
@user_token_required
def log_game(current_user):
    """Persist legacy CSV logging for compatibility but use DB for queries."""
    data = request.get_json() or {}
    word = data.get('word') or ''
    word_type = data.get('wordType')
    was_successful = bool(data.get('wasSuccessful'))
    wrong_letters = data.get('wrongLetters', []) or []
    wrong_guesses = int(data.get('wrongGuesses') or 0)
    user_id = current_user.id

    profile = get_user_profile(user_id)

    if word and word not in (profile.seen_words or []):
        profile.seen_words.append(word)

    if not was_successful:
        profile.difficulty_modifier = min(2.0, (profile.difficulty_modifier or 1.0) * 1.1)
        failure_count = (profile.failed_words or {}).get(word, {}).get('count', 0) + 1
        profile.failed_words[word] = {
            "count": failure_count,
            "next_review": (datetime.now(timezone.utc) + timedelta(days=2**failure_count)).isoformat()
        }
        if word_type:
            profile.failed_word_types[word_type] = (profile.failed_word_types or {}).get(word_type, 0) + 1
    else:
        profile.difficulty_modifier = max(0.5, (profile.difficulty_modifier or 1.0) * 0.95)
        profile.wins_since_last_hint = (profile.wins_since_last_hint or 0) + 1
        if profile.wins_since_last_hint >= 3:
            gained = profile.wins_since_last_hint // 3
            profile.hint_credits = int(profile.hint_credits or 0) + int(gained)
            profile.wins_since_last_hint = profile.wins_since_last_hint % 3

    try:
        game_log = GameLog(
            user_id=user_id,
            word=word,
            was_successful=was_successful,
            wrong_guesses=wrong_guesses,
            wrong_letters=[str(ch) for ch in wrong_letters]
        )
        db.session.add(game_log)
    except Exception:
        pass

    try:
        logs = GameLog.query.filter_by(user_id=user_id).all()
        aggregate = Counter()
        for gl in logs:
            for ch in (gl.wrong_letters or []):
                if isinstance(ch, str) and len(ch) == 1:
                    aggregate[ch] += 1
        profile.problem_letters = [letter for letter, _ in aggregate.most_common(5)]
    except Exception:
        pass

    db.session.commit()

    log_entry = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'user_id': user_id,
        'word': word,
        'wrong_guesses': wrong_guesses,
        'was_successful': was_successful
    }
    log_file = os.path.join(os.path.dirname(__file__), 'game_log.csv')
    write_header = not os.path.exists(log_file)
    with open(log_file, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=log_entry.keys())
        if write_header:
            writer.writeheader()
        writer.writerow(log_entry)

    return jsonify({'success': True, 'problem_letters': profile.problem_letters}), 201

@app.route('/api/user/statistics')
@user_token_required
def get_user_statistics(current_user):
    """Get user statistics including wins, losses, and other game data (DB-backed)."""
    user_id = current_user.id
    profile = get_user_profile(user_id)

    # Count wins and losses from GameLog table
    try:
        wins = GameLog.query.filter_by(user_id=user_id, was_successful=True).count()
        losses = GameLog.query.filter_by(user_id=user_id, was_successful=False).count()
    except Exception:
        wins = 0
        losses = 0

    total_games = wins + losses
    win_rate = round((wins / total_games * 100) if total_games > 0 else 0, 1)

    statistics = {
        'wins': wins,
        'losses': losses,
        'total_games': total_games,
        'win_rate': win_rate,
        'seen_words': len(profile.seen_words or []),
        'failed_words': len(profile.failed_words or {}),
        'problem_letters': profile.problem_letters or [],
        'hint_credits': int(profile.hint_credits or 0)
    }

    return jsonify(statistics)

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
def separate_article_from_noun(word_with_article):
    """
    Separates German articles from nouns and returns both the clean word and the article.
    """
    word_with_article = word_with_article.strip()
    
    # Check for definite articles
    if word_with_article.startswith('der '):
        return word_with_article[4:], 'der'
    elif word_with_article.startswith('die '):
        return word_with_article[4:], 'die'
    elif word_with_article.startswith('das '):
        return word_with_article[4:], 'das'
    
    # If no article found, return the word as is
    return word_with_article, None

@app.route('/api/placement-test/questions')
def get_placement_test_questions():
    """
    Stellt eine feste Liste von Wörtern für den Einstufungstest bereit.
    Die Wörter sind nach ansteigendem Schwierigkeitsgrad geordnet.
    """
    test_words = [
        # A1 Level
        {"word": "Apfel", "type": "Nomen", "category": "Essen", "level": "a1"},
        {"word": "Haus", "type": "Nomen", "category": "Wohnen", "level": "a1"},
        {"word": "schwimmen", "type": "Verb", "category": "Freizeit", "level": "a1"},
        {"word": "groß", "type": "Adjektiv", "category": "Beschreibung", "level": "a1"},
        {"word": "die Familie", "type": "Nomen", "category": "Person", "level": "a1"},
        # A2 Level
        {"word": "der Ausweis", "type": "Nomen", "category": "Alltag", "level": "a2"},
        {"word": "berühmt", "type": "Adjektiv", "category": "Person", "level": "a2"},
        {"word": "der Bahnhof", "type": "Nomen", "category": "Reisen", "level": "a2"},
        {"word": "erklären", "type": "Verb", "category": "Kommunikation", "level": "a2"},
        {"word": "die Mannschaft", "type": "Nomen", "category": "Freizeit", "level": "a2"},
        # B1 Level
        {"word": "die Fähigkeit", "type": "Nomen", "category": "Abstrakta", "level": "b1"},
        {"word": "beeinflussen", "type": "Verb", "category": "Person", "level": "b1"},
        {"word": "die Umweltverschmutzung", "type": "Nomen", "category": "Umwelt", "level": "b1"},
        {"word": "verantwortlich", "type": "Adjektiv", "category": "Arbeit", "level": "b1"},
        {"word": "die Gesellschaft", "type": "Nomen", "category": "Gesellschaft", "level": "b1"},
        # B2 Level
        {"word": "die Voraussetzung", "type": "Nomen", "category": "Ausbildung", "level": "b2"},
        {"word": "wissenschaftlich", "type": "Adjektiv", "category": "Ausbildung", "level": "b2"},
        {"word": "die Wirtschaft", "type": "Nomen", "category": "Wirtschaft", "level": "b2"},
        {"word": "komplex", "type": "Adjektiv", "category": "Beschreibung", "level": "b2"},
        {"word": "die Herausforderung", "type": "Nomen", "category": "Gesellschaft", "level": "b2"}
    ]
    
    # Process words to separate articles from nouns
    processed_words = []
    for word_data in test_words.copy():
        clean_word, article = separate_article_from_noun(word_data['word'])
        
        # Create processed word data
        processed_word = {
            'word': clean_word,
            'type': word_data['type'],
            'category': word_data['category'],
            'level': word_data['level']
        }
        
        # If it's a noun with an article, include the article in the category display
        if article and word_data['type'] == 'Nomen':
            processed_word['category'] = f"{word_data['category']} ({article})"
        
        # Generate hints for the clean word (without article)
        hints = generate_game_hints(clean_word, word_data['level'], 1.0)
        processed_word.update(hints)
        
        processed_words.append(processed_word)

    return jsonify(processed_words)


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
        'token': token if isinstance(token, str) else token.decode('utf-8')
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
                'failed_word_types': profile.failed_word_types if profile else {},
                'difficulty_modifier': round(profile.difficulty_modifier, 2) if profile else 1.0
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

@app.route('/api/v2/student/<string:username>/difficulty', methods=['PUT'])
@teacher_token_required
def set_student_difficulty(current_user, username):
    data = request.get_json()
    new_modifier = data.get('difficulty_modifier')

    if new_modifier is None:
        return jsonify({'message': 'Difficulty modifier is required'}), 400

    try:
        new_modifier = float(new_modifier)
        if not (0.1 <= new_modifier <= 3.0):
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'message': 'Invalid difficulty modifier. Must be a number between 0.1 and 3.0'}), 400

    student = User.query.filter_by(username=username, role='student').first()
    if not student:
        return jsonify({'message': 'Student not found'}), 404

    profile = get_user_profile(student.id)
    profile.difficulty_modifier = new_modifier
    db.session.commit()

    return jsonify({'message': f"Difficulty for {username} updated successfully."})


@app.route('/api/v2/logout', methods=['POST'])
def logout_v2():
    """Stateless JWT logout endpoint for symmetry with the client. Always succeeds."""
    return jsonify({'message': 'Logout successful'}), 200


@app.route('/api/v2/use_hint', methods=['POST'])
@user_token_required
def use_hint(current_user):
    data = request.get_json()
    word = (data or {}).get('word', '')
    guessed_letters = set((data or {}).get('guessed_letters', []))

    if not word:
        return jsonify({'message': 'Word required'}), 400

    profile = get_user_profile(current_user.id)
    if (profile.hint_credits or 0) <= 0:
        return jsonify({'message': 'No hint credits available'}), 400

    word_lower = word.lower()
    candidates = [ch for ch in word_lower if ch not in guessed_letters]
    if not candidates:
        return jsonify({'message': 'All letters already revealed'}), 400

    # Choose a letter to reveal: prioritize vowels then common consonants
    vowels = 'aeiouäöü'
    commons = 'nrtsm'
    chosen = None
    for pool in [vowels, commons]:
        for ch in pool:
            if ch in candidates:
                chosen = ch
                break
        if chosen:
            break
    if not chosen:
        chosen = candidates[0]

    # Deduct credit
    profile.hint_credits = max(0, (profile.hint_credits or 0) - 1)
    db.session.commit()

    return jsonify({'revealed_letter': chosen, 'hint_credits': profile.hint_credits})


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
        # Lightweight auto-migration for new columns on existing installs
        try:
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)
            columns = {c['name'] for c in inspector.get_columns('user_profile')}
            with db.engine.connect() as connection:
                if 'difficulty_modifier' not in columns:
                    connection.execute(text('ALTER TABLE user_profile ADD COLUMN difficulty_modifier FLOAT NOT NULL DEFAULT 1.0;'))
                if 'hint_credits' not in columns:
                    connection.execute(text('ALTER TABLE user_profile ADD COLUMN hint_credits INTEGER NOT NULL DEFAULT 0;'))
                if 'wins_since_last_hint' not in columns:
                    connection.execute(text('ALTER TABLE user_profile ADD COLUMN wins_since_last_hint INTEGER NOT NULL DEFAULT 0;'))
        except Exception:
            # Best-effort: never block app startup because of migration issues
            pass

        # Ensure demo teacher account exists with known password
        try:
            teacher_username = os.environ.get('TEACHER_USERNAME', 'Lehrer')
            teacher_password = os.environ.get('TEACHER_PASSWORD', 'BWKI2025!')
            teacher = User.query.filter_by(username=teacher_username).first()
            if teacher is None:
                teacher = User(
                    username=teacher_username,
                    password_hash=generate_password_hash(teacher_password),
                    role='teacher'
                )
                db.session.add(teacher)
            else:
                teacher.password_hash = generate_password_hash(teacher_password)
                teacher.role = 'teacher'
            db.session.commit()
        except Exception:
            # Do not block startup if teacher creation fails
            pass

# Ensure DB is initialized when module is imported (e.g., via `flask run`)
init_db()

if __name__ == '__main__':
    app.run(debug=True)
